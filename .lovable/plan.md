# HOS Remediation — Implementation Dependency Plan

The audit (43/100, partially complete) is treated as authoritative. This plan sequences its findings into dependency-ordered phases, incorporating the four newly supplied specs (HIS-006 Platform Manager, HIS-007 Engine SDK, HIS-005 API Platform, HIS-008 Integration Mesh). No code is changed until approved.

Note on already-shipped P0 work: consent enforcement, the event dispatcher, engine-status gating, removal of the public AI endpoint and the first unit tests exist. Phases below build on that and close what remains.

---

## Phase 0 — Security Lockdown (blocks everything)

**Prerequisites:** none.
**Files:** `src/lib/*.functions.ts` (all), `src/lib/permissions.server.ts`, `src/lib/governance.server.ts`, `src/start.ts`.
**Work**
- Audit every `createServerFn` for `requireSupabaseAuth`; no unauthenticated data or AI endpoint may remain.
- Route every engine-facing read/write through `assertEngineActive` + `assertScope`; delete the dead `hasScope` path in `governance.server.ts` so there is one consent resolver.
- Zod `inputValidator` on every mutation; drop client-supplied `user_id` everywhere in favour of `context.userId`.
- Deny-by-default audit records for every refusal (`permission.denied`, `engine.blocked`).
**Database:** add missing `user_id → auth.users` foreign keys on `engine_signals`, `hos_events`, `nutrition_logs`, `body_sessions`, `routine_completions`; re-verify RLS + GRANTs on all 18 tables.
**API:** none.
**Tests:** per-function auth-required test; consent-denied test; cross-user RLS isolation test.
**Risks:** tightening scopes can break existing surfaces for users with no stored grants — kernel-owned defaults must stay allow-by-default or the app locks itself out.

## Phase 1 — Event Mesh completion (HIS-004)

**Prerequisites:** Phase 0.
**Files:** `src/lib/mesh.server.ts`, `src/lib/kernel.functions.ts`, `src/lib/engines/contract.ts`, `src/routes/signals.tsx`.
**Work**
- Exponential backoff between attempts (currently retries are immediate), plus a replay path for dead-lettered deliveries.
- Enforce event naming/schema standards: per-type payload schemas, `schema_version` validation on publish, rejection of unknown types.
- Idempotent publish keyed on `idempotency_key`; dispatch must be idempotent per `(event, engine, handler)`.
- Dead-letter inspection + manual redrive UI on `/signals`.
**Database:** unique index on `(user_id, idempotency_key)`; `next_attempt_at` on `hos_event_deliveries`; event schema registry table (`event_schemas`).
**API:** none yet (exposed in Phase 4).
**Tests:** duplicate publish, retry/backoff, dead-letter, redrive, unknown-type rejection, consumed-event coverage.
**Risks:** no background worker exists, so retries run inline within the request; long chains risk request timeouts. Mitigation: cap inline attempts, defer the rest to a redrive endpoint.

## Phase 2 — Capability Registry & Invocation (HIS-006 §6–7)

**Prerequisites:** Phases 0–1.
**Files:** new `src/lib/capabilities.server.ts`, `src/lib/capabilities.functions.ts`; `src/lib/engines/contract.ts`; new `/capabilities` route.
**Work**
- Capability descriptors: id, provider engine, version, required permission, input/output schema, status.
- Invocation pipeline enforcing the seven spec checks: engine exists → enabled → capability exists → provider healthy → consumer permitted → input valid → version compatible.
- Every invocation audited with correlation id; failures return controlled errors, never provider internals.
**Database:** `engine_capabilities` (provider, capability, version, permission, schema, status) and `capability_invocations` (audit/latency ledger), both RLS + GRANTs.
**API:** internal only for now.
**Tests:** each of the seven checks failing in isolation; happy-path invoke; schema-violation rejection; disabled-provider refusal.
**Risks:** capability strings are currently free text in the registry; introducing a typed registry is a breaking change to `contract.ts` consumers.

## Phase 3 — Platform Manager enforcement (HIS-006)

**Prerequisites:** Phase 2.
**Files:** new `src/lib/platform-manager.server.ts` + `.functions.ts`, `src/routes/engines.tsx`, `src/lib/permissions.server.ts`.
**Work**
- Full lifecycle state machine: DISCOVERED → INSTALLED → REGISTERED → VALIDATED → ENABLED → RUNNING → SUSPENDED → DISABLED → UNINSTALLED, with validated transitions only.
- Dependency + version resolution at install/upgrade (platform version, SDK version, required capabilities) with failure and rollback.
- Health tracking: heartbeat, last event, last error, error count, derived state (healthy/degraded/unresponsive/disabled/failed) — surfaced on `/engines`.
- Per-engine configuration store with secrets held as references only, never plaintext.
- Uninstall sequence: disable → stop consumption → stop capability publication → deregister → archive audit history.
**Database:** `engines` gains lifecycle `state`, `platform_version`, `sdk_version`, health columns; new `engine_health_events`, `engine_config`.
**API:** internal manager surface (install/enable/suspend/disable/upgrade/uninstall/health).
**Tests:** illegal transition rejection; dependency-failure install; suspended vs disabled operation matrix; health degradation.
**Risks:** the existing binary `status` column must be migrated to the richer state machine without stranding installed engines mid-state.

## Phase 4 — Engine SDK (HIS-007)

**Prerequisites:** Phase 3.
**Files:** new `src/lib/sdk/` (index, events, state, storage, capabilities, identity, ai, logger, testing), `src/lib/engines/contract.ts`.
**Work**
- One façade granting an engine only: register, request permissions, register/invoke capabilities, publish/subscribe events, read authorized Human State, scoped storage, scoped AI, structured logging with `engine_id`/`user_id`/`request_id`/`correlation_id`.
- Descriptor registration from outside core so a new engine needs no core edits.
- Testing helpers (`mockEvent`, mock state, mock identity) plus an SDK-only reference engine as proof.
**Database:** `engine_storage` (engine-scoped key/value, RLS by user + engine), `engine_logs`.
**API:** SDK is the sole internal contract; direct table access from engine code becomes prohibited.
**Tests:** cross-engine storage access denied; state read without permission denied; SDK-only reference engine passing the full lifecycle.
**Risks:** existing engines (nutrition, body, routines, orchestrator, learning) bypass the SDK; migrating them is the real cost and should be incremental, one engine at a time.

## Phase 5 — API Platform (HIS-005)

**Prerequisites:** Phases 1–4.
**Files:** new `src/routes/api/v1/*` (engines, capabilities, events, human-state, health), `src/routes/api/public/webhooks/*`.
**Work**
- Versioned `/api/v1` with a uniform envelope `{ success, data, meta: { request_id, timestamp } }`, server-side auth + authorization on every protected route, and error taxonomy.
- `Idempotency-Key` support on all mutations; rate limiting; CORS; audit logging.
- OpenAPI document generated from the route definitions.
**Database:** `api_idempotency_keys`, `api_request_log`, `api_rate_limits`.
**API:** this phase *is* the API change.
**Tests:** unauthenticated 401s, authorization matrix, idempotent replay returns first result, rate-limit 429, envelope shape.
**Risks:** public webhook routes bypass site auth — signature verification must land in the same change, never after.

## Phase 6 — Integration & Connectivity Mesh (HIS-008)

**Prerequisites:** Phase 5.
**Files:** new `src/lib/integrations/` (registry, connector interface, mapper, sync, webhook processing), `src/routes/api/public/webhooks/[provider].ts`, new `/integrations` route.
**Work**
- Connector interface: `connect/disconnect/sync/mapper/health`, so new providers need no core changes.
- Connector registry with provider, version, status, supported operations, auth type, health, last sync.
- Mandatory inbound mapping — no external schema reaches an internal table directly.
- Webhook gateway: signature verification → idempotency → schema validation → normalization → event publish.
- Outbound calls require auth, authorization, consent, validation, audit, idempotency; exponential-backoff retries into dead letter.
- Failure isolation: a dead provider degrades one connector, never the Kernel.
**Database:** `connectors`, `connector_credentials` (secret references only), `integration_sync_runs`, `integration_events`, `webhook_deliveries`.
**API:** public webhook receivers + authenticated connector management.
**Tests:** bad-signature rejection, replayed webhook, mapping conformance, provider-down isolation, retry→dead-letter.
**Risks:** no scheduler exists (`pg_cron` absent) — scheduled sync needs `pg_cron` calling an `/api/public` route, or explicit manual sync until then.

## Phase 7 — Testing & production hardening

**Prerequisites:** all above (each phase ships its own tests; this phase closes the gaps).
**Files:** `src/lib/__tests__/*`, new `src/lib/observability.server.ts`.
**Work**
- Coverage floor across orchestrator fusion/conflicts, mesh dispatch, permissions, capability invocation, lifecycle transitions, API contracts, connectors.
- Structured logging with correlation ids end to end; per-engine health dashboard.
- Replace remaining sample data (`hos-data.ts`, `hos-extras.ts`, `hos-protocols.ts` on `/achievements`, `/protocols`, `/standards`) with real tables.
- Dependency/version validation hardening, prompt versioning, AI output evaluation and confidence calibration, real pattern learning into `learned_patterns`.
**Database:** `achievements`, `protocols`, `standards` tables + migrations for their seed content.
**API:** health/readiness endpoints.
**Tests:** full-suite green in CI; RLS isolation regression suite.
**Risks:** replacing sample surfaces changes what users see; each must ship with seeded rows in the same migration or the pages go empty.

---

## Deferred (P3, unchanged)

Knowledge graph, simulation/digital twin, experiment intelligence, memory store, per-engine schema isolation, RBAC/ABAC roles table.

## Cross-cutting architectural risks

1. **No background runtime.** Retries, sync and health checks all want a worker; on this stack they must be inline-bounded plus a redrive endpoint driven by `pg_cron`.
2. **Boundary is convention, not isolation.** Until Phase 4 lands, engine code can still reach any table directly; the SDK is what makes the boundary real.
3. **Single shared schema.** Per-engine isolation stays deferred, so consent + RLS remain the only enforcement layer.
4. **Migration ordering.** Phases 1–3 alter live tables (`hos_event_deliveries`, `engines`); each needs backfill in the same migration to avoid stranded rows.
