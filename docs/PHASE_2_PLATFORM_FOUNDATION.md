# Phase 2 — Platform Foundation Completion

## Objective

Make HumanKernelOS a genuinely extensible host platform before integrating any substantial external Operating Engine.

## Completed architecture

### Persisted installation authority

The `engines` table is now the authority for whether an engine is installed and operational.

A catalogue entry is only installable software metadata. It does not grant execution authority.

Fail-closed rule:

```text
not installed
= not operational
```

Operational states are:

- ENABLED
- RUNNING

SUSPENDED, DISABLED, REGISTERED, VALIDATED, INSTALLED and UNINSTALLED cannot perform protected engine work.

### Runtime adapter registry

Executable code is resolved through a generic runtime registry.

It supports:

- capability handlers;
- event handlers;
- event validators.

Built-in handlers register through the same API used by future embedded engines.

The Kernel routing layer no longer requires provider-specific branches for normal capability/event resolution.

### Capability Runtime

Capability discovery is now split correctly:

```text
Persisted capability metadata
        ↓
provider + version selection
        ↓
consumer lifecycle
        ↓
provider lifecycle
        ↓
permission / consent
        ↓
runtime adapter
        ↓
input validation
        ↓
domain execution
        ↓
output validation
        ↓
invocation audit
```

When multiple providers expose the same capability, the caller must identify the provider rather than relying on accidental ordering.

### Event Mesh

Persisted `engine_subscriptions` rows are the delivery authority.

Runtime event handlers provide executable code, but a loaded handler does not receive events unless the subscription exists and the engine is operational.

Event publishing requires:

- operational source engine;
- registered runtime validator;
- active persisted schema;
- payload validation;
- idempotent event persistence.

Delivery retains:

- lifecycle gating;
- consent gating;
- bounded retry;
- delivery ledger;
- dead-letter handling;
- audit evidence.

### Engine SDK

The SDK now supports external/independent engine packages registering:

- manifests;
- executable capabilities;
- event schemas;
- event subscriptions;
- permission requests.

Manifest registration does **not** auto-enable an engine.

New manifests enter:

```text
REGISTERED
→ VALIDATED
→ ENABLED
```

The Platform Manager remains the only lifecycle authority.

Protected SDK storage and capability/event access are lifecycle-gated.

### Lifecycle validation

Dependencies must actually be installed.

Being present in the built-in catalogue no longer satisfies a dependency.

A disabled engine must be revalidated before re-enablement:

```text
DISABLED
→ VALIDATED
→ ENABLED
```

This prevents configuration/version changes from bypassing validation.

### Integration Mesh foundation

A provider-neutral connector runtime now exists.

Connector adapters can register:

- health checks;
- synchronization;
- webhook signature verification;
- webhook normalization.

Persisted connector state remains separate from executable adapter code.

Connector failures update only that connector's health/sync ledger and do not alter Kernel state.

No provider-specific connector has been added in this phase.

### API platform foundation

A versioned public liveness endpoint is available:

`GET /api/v1/health`

It returns a uniform response envelope with:

- request ID;
- timestamp;
- service status;
- Platform version;
- SDK version.

It intentionally exposes no user, engine, connector or database data.

Authenticated application operations continue through the existing authenticated server-function boundary.

### CI quality gate

GitHub Actions now requires:

1. TypeScript typecheck
2. ESLint
3. Vitest
4. production build

The repository also exposes:

- `npm run typecheck`
- `npm run test`
- `npm run check`

## Background execution strategy

HumanKernelOS currently has no continuously running worker process in this deployment model.

Therefore Phase 2 does **not** claim durable background execution that is not actually deployed.

Current behavior:

- Event Mesh retry is bounded inside execution.
- Failed terminal deliveries enter the persisted dead-letter ledger.
- Connector synchronization is invoked explicitly through its runtime contract.
- Health and delivery state are persisted so a future worker can resume safely.

Production deployment must provide one of:

- a dedicated worker process;
- a trusted scheduled function;
- or an equivalent scheduler invoking bounded maintenance jobs.

The worker must use the same persisted lifecycle, permissions, Event Mesh, connector and audit contracts; it must not create a second execution model.

## Remaining boundaries

These are intentional and are **not** represented as completed features:

- no external Routine Execution OS has been integrated yet;
- no provider-specific connector is installed;
- the current runtime adapter registry is process-local executable code, while persisted manifests/capabilities/subscriptions remain authoritative metadata;
- complete external HTTP/gRPC engine adapters will be proven during the external-engine phase;
- full Human State / Daily Operating Plan completion remains Phase 3;
- full Personal HOS / Platform Studio UX split remains Phase 4;
- deployment-specific worker/backup/recovery certification remains Phase 6.

## Phase-2 gate

Phase 2 passes when:

1. uninstalled engines fail closed;
2. persisted manifests govern lifecycle;
3. capability discovery uses persisted metadata;
4. executable capability/event providers use generic runtime adapters;
5. persisted subscriptions govern event delivery;
6. Engine SDK can register an engine's runtime contracts without core provider branches;
7. disabled engines cannot use protected SDK operations;
8. dependency validation requires actual installation;
9. connector runtime is provider-neutral and failure-isolated;
10. CI verifies typecheck, lint, tests and production build.

No external engine integration should begin until the CI gate is green.
