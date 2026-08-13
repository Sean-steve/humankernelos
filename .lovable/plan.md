# HOS Audit — Remediation Order (no code changed)

This plan exists only to record the remediation sequence produced by the audit. Nothing in the application was modified.

## P0 — Must fix before HOS can be called complete

1. **Enforce consent.** `hasScope()` exists in `src/lib/governance.server.ts:63` and is called by nothing. Every engine-facing server function must check scope before reading or writing, and log the denial to `audit_log`.
2. **Close the public AI endpoint.** `src/lib/advisor.functions.ts` has no `requireSupabaseAuth` middleware, so it is a public, unauthenticated LLM endpoint on the published site. Add the middleware or delete the function (PDIE supersedes it).
3. **Make the Event Mesh consume.** `hos_events` is insert-only; no subscriber, dispatcher, or handler registry exists, and `eventsConsumed` in `src/lib/engines/contract.ts` is declarative only. Add a dispatcher (event → registered handlers), plus `correlation_id`, `idempotency_key`, `schema_version`, attempt counter, and a dead-letter table.
4. **Make engine status real.** `setEngineStatus` writes a string no code reads. Signal publication, event delivery, and capability calls must refuse a disabled engine.
5. **Remove mock data from production paths.** `/signals`, `/achievements`, `/protocols`, `/standards` and the seed fallbacks in `src/routes/index.tsx` render `hos-data.ts` / `hos-extras.ts` / `hos-protocols.ts` constants. Either bind them to real tables or label them explicitly as samples.

## P1 — Required for production

6. **Engine SDK (HIS-007).** No SDK exists. A new engine today requires editing `src/lib/engines/contract.ts` and adding routes inside the core app. Needs: descriptor registration from outside core, capability register/discover/invoke, event publish/subscribe, scoped state access, scoped storage, logging, AI access.
7. **Capability invocation layer.** `capabilities` are strings in the registry with no dispatch path.
8. **HTTP API surface (HIS-005).** `src/routes/api/` does not exist: no versioning, no webhooks, no rate limiting, no OpenAPI. All access is internal RPC.
9. **Test suite.** Zero tests and no test runner installed. Minimum: orchestrator fusion/conflict units, RLS isolation tests, event dispatch tests, permission-enforcement tests.
10. **Integration & Connectivity Mesh (HIS-008).** No connectors, no webhook receivers, no sync jobs, no scheduled work (no `pg_cron`, no background jobs).

## P2 — Important improvements

11. Structured server logging and per-engine health monitoring (registry has no heartbeat).
12. Dependency/version compatibility checking at registration (`dependencies` is stored, never validated).
13. Prompt management (versioned prompts), AI output evaluation, and confidence calibration.
14. Real pattern learning: `learned_patterns` is empty and populated by nothing; learning is currently prompt-context only.
15. Foreign keys on `engine_signals`, `hos_events`, `nutrition_logs`, `body_sessions`, `routine_completions` (`user_id` unconstrained).

## P3 — Future

16. Knowledge graph, simulation/digital twin, experiment intelligence, memory store.
17. Per-engine data isolation (separate schemas or storage grants) instead of one shared public schema.
18. RBAC/ABAC roles table; today there is only owner-scoped RLS.
