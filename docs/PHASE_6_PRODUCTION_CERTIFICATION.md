# Phase 6 — Production Certification

## Objective

Move HumanKernelOS from repository-complete to production-certifiable by adding explicit runtime, security, resilience and operational evidence gates.

Phase 6 is not a feature phase. It is a release gate.

## Production controls added

- Public liveness probe: `GET /api/v1/health`
- Public database-backed readiness probe: `GET /api/v1/readiness`
- Centralized security headers on every server response
- Request IDs on all responses
- Durable external-engine replay protection
- Durable per-subject external-engine rate limiting
- Bounded external-engine request size
- Fail-closed tenant binding for Execution OS ingress
- Sanitized production ingress errors
- Exact Supabase client version pin
- High-severity production dependency audit in CI
- Immutable GitHub Action commit pins
- Dedicated production-certification test suite
- Authenticated Platform Studio production gate
- Explicit backup and restore-drill evidence requirements

## Certification states

The runtime production gate reports one of:

- `certified` — every critical gate passes
- `observing` — no critical failure exists, but there is not enough runtime evidence for a reliability judgment
- `blocked` — at least one critical gate fails

A production activation is allowed only when no critical gate is failed or observing.

## Critical gates

1. Production server configuration
2. Backup verification evidence no older than 30 days
3. Restore-drill evidence no older than 90 days
4. Operational engine health
5. Capability success rate over the last 24 hours
6. Event Mesh dead-letter count over the last 24 hours
7. Execution OS health when it is declared a required production dependency

Connected third-party integration health is reported as a non-critical gate unless separately promoted by deployment policy.

## Runtime evidence thresholds

Capability reliability requires at least 10 invocations in the 24-hour window. Below that threshold the gate remains `observing`.

Once sufficient evidence exists, the minimum capability success rate is 98%.

Any Event Mesh dead letter in the 24-hour window blocks production certification until resolved.

## External-engine ingress

Execution OS ingress remains compatible with delayed/offline reconciliation. HOS does not reject events because their `occurredAt` timestamp is old.

Instead, production protection is based on:

- HMAC body integrity
- configured tenant binding
- durable event-ID receipt tracking
- SHA-256 body fingerprint
- duplicate acceptance only when the body hash matches
- conflict rejection when the same event ID is reused with different content
- durable one-minute per-subject rate limit
- bounded body size

The receipt ledger uses the existing `webhook_deliveries` table and stores metadata/hash only, not a duplicate raw personal payload.

## Production dependency policy

Execution OS is optional unless:

```
HOS_REQUIRE_EXECUTION_OS=true
```

When required, its URL and shared secret become critical configuration checks and its installed runtime state becomes part of the production certification gate.

## Database security

The existing schema audit confirms the user-facing public tables are protected by RLS and ownership predicates. Service/secret keys remain server-only and bypass RLS by design.

Supabase currently recommends publishable keys for client code and secret keys for controlled backend code. Legacy `service_role` remains supported only as a fallback during migration.

## Live infrastructure limitation

The connected Supabase account visible during Phase 6 contains only the project `AGENCY OS v1`. No HumanKernelOS Supabase project is currently available through the connector.

Therefore repository/runtime certification can be completed, but the following live infrastructure evidence cannot be truthfully marked complete from this session:

- HOS Supabase security advisors
- HOS Supabase performance advisors
- backup/PITR configuration inspection
- real restore drill
- live production database readiness
- deployed two-service HOS ↔ Execution OS smoke test

These remain explicit production activation blockers rather than being assumed.

## Release gate

Phase 6 code may merge only when CI passes:

1. TypeScript
2. ESLint
3. production dependency audit (high/critical)
4. dedicated production certification tests
5. full Vitest suite
6. production build

Production activation after merge additionally requires the operational evidence in the runbook.
