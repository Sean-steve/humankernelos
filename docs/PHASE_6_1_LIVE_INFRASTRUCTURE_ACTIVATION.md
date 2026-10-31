# Phase 6.1 — Live Infrastructure Activation & Evidence Closure

Status: **BLOCKED — infrastructure bindings required**

Date opened: 2026-10-31

## Purpose

Phase 6 certified the repository/runtime implementation. Phase 6.1 closes the gap between code certification and a truthful production activation.

This phase is complete only when real infrastructure evidence exists. No operator may mark a gate complete from intended configuration alone.

## Verified starting position

### HumanKernelOS repository

- Canonical repository: `Sean-steve/humankernelos`
- Phase 6 is merged into `main`.
- Production CI passed typecheck, lint, production dependency audit, dedicated certification tests, full tests, and production build.
- The app's Supabase configuration is bound to project ref:
  - `rulihgwaeggjpcrmfmnp`
- The connected Supabase account does **not** expose that project.
- Direct connector calls to that project return **permission denied**.
- The only Supabase project visible to the current connection is `AGENCY OS v1`; it is unrelated and must not be modified.

### Execution OS

- Repository: `Sean-steve/Execution-Os`
- Production-hardening/HOS integration commit:
  - `60be4e0df7c82332e10815632581044bd2971e00`
- Execution OS CI run `41195178891` passed.
- Public production endpoints exist in code:
  - `GET /api/health`
  - `GET /api/v1/hos/manifest`
  - `GET /api/v1/hos/health`
  - `GET /api/v1/hos/readiness`
- No discoverable production deployment URL was found.
- Production runtime persistence is file-backed. The production host must therefore provide persistent durable storage for the configured HOS boundary store, per-subject state directory, and DLQ. Ephemeral container storage is not acceptable evidence of durability.

## Current blockers

### B1 — Supabase project access

**BLOCKED**

The currently connected Supabase identity does not have permission to project `rulihgwaeggjpcrmfmnp`.

Required closure evidence:

1. Project is visible to the connected Supabase account/MCP session.
2. Project identity matches the intended HumanKernelOS database.
3. Migration history can be read.
4. Security and performance advisors can be executed.

Do not replace the configured project with another project solely to make this gate pass.

### B2 — HumanKernelOS production URL

**BLOCKED**

No production HTTPS URL is currently recorded for HOS.

Required closure evidence:

- deployed HTTPS origin;
- `GET /api/v1/health` returns 200;
- `GET /api/v1/readiness` returns 200 against the actual production database.

### B3 — Execution OS production URL

**BLOCKED**

No production HTTPS URL is currently recorded for Execution OS.

Required closure evidence:

- deployed HTTPS origin;
- `GET /api/health` returns 200;
- `GET /api/v1/hos/manifest` identifies `execution-os`;
- identity authority is `HumanKernelOS`;
- schedule authority is `HumanKernelOS`;
- `GET /api/v1/hos/readiness` returns 200 and all production checks pass.

### B4 — Execution OS durable runtime volume

**BLOCKED**

Execution OS currently persists HOS boundary state, subject state, and DLQ to filesystem paths.

Required closure evidence:

- production storage paths are mounted on durable storage;
- paths are outside the source tree;
- boundary, subject-state, and DLQ locations are distinct;
- restart/redeploy preserves state;
- backup procedure for Execution OS state is documented and tested.

### B5 — Database backup evidence

**BLOCKED**

Required closure evidence:

- a real backup exists for the HumanKernelOS production database;
- `HOS_BACKUP_VERIFIED_AT` is set only after verification;
- evidence is no older than 30 days.

Supabase paid projects have managed daily backups; PITR is available as a paid add-on and replaces daily backups when enabled. The selected policy must satisfy the production RPO.

### B6 — Restore drill

**BLOCKED**

Required closure evidence:

- restore into an isolated project/environment;
- RLS ownership isolation re-tested;
- Kernel state, Event Mesh, capability ledger, audit history, and engine registry verified;
- application connects to restored data;
- `HOS_RESTORE_DRILL_VERIFIED_AT` is set only after successful completion.

Evidence expires after 90 days.

### B7 — Live HOS ↔ Execution OS read-only certification

**BLOCKED until B2 and B3 close**

Repository command:

```bash
HOS_PRODUCTION_URL=https://hos.example.com \
EXECUTION_OS_PRODUCTION_URL=https://execution.example.com \
bun run certify:live
```

GitHub workflow:

`Phase 6.1 — Live Production Certification`

Configure repository variables:

- `HOS_PRODUCTION_URL`
- `EXECUTION_OS_PRODUCTION_URL`

The workflow performs no production writes.

### B8 — Signed write/capability smoke test

**NOT STARTED**

This step is deliberately excluded from the automated read-only certifier.

It requires:

- a designated production test subject;
- explicit operator authorization;
- the production HOS ↔ Execution OS shared secret configured on both services;
- one signed external event;
- one governed capability invocation;
- confirmation that the event is idempotent and the capability respects lifecycle/consent;
- cleanup or permanent classification of the test evidence.

Never inject synthetic execution events into a real person's production history.

## Database verification sequence after access is restored

1. Confirm project ref.
2. List live migrations.
3. Compare live migration history to repository migrations.
4. Run Supabase security advisors.
5. Run Supabase performance advisors.
6. Verify all exposed user tables have RLS enabled.
7. Verify ownership predicates on read/write policies.
8. Verify no authorization depends on user-editable metadata.
9. Verify server secret/service-role credentials are not browser-exposed.
10. Confirm current Postgres minor version and review any applicable upgrade advisories.

## Supabase platform note

As of October 2026, Supabase has announced removal of several outdated TLS 1.2 CBC cipher suites from project HTTP APIs starting no earlier than 2026-11-10. HumanKernelOS and Execution OS production clients must use modern TLS stacks.

## Completion rule

Phase 6.1 can be merged/closed only when:

- Supabase project access is restored;
- migrations/advisors are verified;
- backup evidence is real;
- restore drill is complete;
- both services are deployed on HTTPS;
- Execution OS durable storage is proven across restart;
- the read-only cross-service certifier passes;
- a designated-subject signed write/capability smoke test passes;
- Platform Studio reports production activation ready with sufficient runtime evidence.

Until then, the correct production state is **BLOCKED**.
