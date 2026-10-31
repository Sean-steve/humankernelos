# Phase 5 — External Engine Proof

## Objective

Prove that HumanKernelOS can connect to a substantial independently developed Operating Engine without absorbing its domain or adding engine-specific branches to the Personal Kernel.

The reference engine for this proof is:

- repository: `Sean-steve/Execution-Os`
- HOS engine ID: `execution-os`
- engine version: `E9`
- HOS contract version: `1.1.0`

Execution OS remains a separate runtime, repository, persistence boundary, worker, event system, and domain model.

## Certification evidence from Execution OS

Execution OS PR #7 — **HOS E8-E9: Production Hardening & Integration Certification** — passed its GitHub Actions `Execution OS CI` gate on the certified PR head.

The verified job includes:

1. dependency installation
2. TypeScript
3. HOS Integration Certification
4. full test suite
5. production build

Execution OS itself declares:

- `identityAuthority = HumanKernelOS`
- `scheduleAuthority = HumanKernelOS`

and exposes exactly six canonical HOS capabilities:

- `schedule.get`
- `session.start`
- `session.advance`
- `session.close`
- `fallback.trigger`
- `discipline.score.get`

## Final architecture

```text
                    HUMAN
                      │
                      ▼
               HumanKernelOS
     ┌────────────────┼────────────────┐
     │                │                │
 Human State      Daily Plan        PDIE
     │                │                │
     └─────────────── Event Mesh ──────┘
                      │
              Capability Runtime
                      │
             Platform Manager
                      │
              signed HOS boundary
                      │
                      ▼
              Execution OS / HEE
     ┌────────────────┼────────────────┐
     │                │                │
 Execution       Performance       Adaptation
 Sessions         Sessions          / Recovery
     │                │                │
     └──────── Execution-owned persistence ──┘
```

HumanKernelOS never reads or writes Execution OS private persistence.

Execution OS never becomes authoritative for Human State, Personal Policies, or the final human timeline.

## Identity boundary

HOS signs a time-bounded subject assertion containing:

- HOS subject ID
- tenant ID
- granted permissions
- granted consent scopes
- issue timestamp

The assertion is HMAC-SHA256 signed with the shared HOS/Execution OS boundary secret.

Execution OS verifies the assertion and scopes its repository by tenant + HOS subject.

HumanKernelOS remains the identity authority.

## Consent

Discovery does not grant consent.

The Execution OS manifest is persisted into the HOS Engine Registry with its requested scopes. The operator reviews those scopes in Governance.

A remote call requires all three gates:

1. Execution OS is lifecycle-operational.
2. the HOS consumer is authorized to invoke the capability.
3. the required Execution OS permission and consent scopes are granted.

Missing consent fails closed.

## Daily Operating Plan authority

HOS remains the single final schedule authority.

Only plan items explicitly delegated to Execution OS are projected as `executionActivities`.

A plan item is delegated when either:

- `source_engine = execution-os`; or
- its metadata contains `execution_delegate: true`.

All timed HOS plan items are projected as commitments so Execution OS can respect conflicts and protected time.

Only delegated non-protected windows become autonomous execution windows.

Execution OS may reallocate inside those windows according to the rights HOS granted.

Changes outside those boundaries become schedule proposals.

## Schedule proposal loop

```text
Execution OS detects execution drift
        ↓
execution.schedule.proposal.created
        ↓
signed HOS event ingress
        ↓
HOS Event Mesh
        ↓
Daily Plan proposal inbox
        ↓
human/HOS ACCEPT or REJECT
        ↓
ScheduleProposalResolved
        ↓
Execution OS receives explicit resolution
        ↓
DailyPlanChanged carries the resulting authoritative timeline
```

One external Execution OS proposal remains one HOS decision even when it contains multiple allocations.

## Human State bridge

HumanKernelOS does not send the full HSV.

The Execution OS adapter projects only minimum-necessary execution context:

- energy capacity
- cognitive capacity
- physical capacity
- recovery need
- stress load
- attention stability
- availability
- bounded execution constraints
- state confidence/provenance

No Personal Policy payload is sent.

```text
HOS evidence
   ↓
canonical HSV
   ↓
HumanStateUpdated
   ↓
minimum-necessary adapter projection
   ↓
Execution OS execution-fit context
```

Human State is advisory context inside Execution OS and cannot override HOS schedule authority.

## Decision Intelligence bridge

PDIE may emit an optional, structured execution advisory only when the recommendation genuinely needs execution adaptation.

Allowed advisory types are:

- `PREFER_SHORTER_BLOCKS`
- `PREFER_RECOVERY`
- `REDUCE_CONTEXT_SWITCHING`
- `PREFER_LOWER_COGNITIVE_LOAD`
- `PREFER_LOWER_PHYSICAL_LOAD`

The advisory is sent only after the human accepts or modifies the recommendation.

No natural-language heuristic converts arbitrary advice into Execution OS commands.

## Execution evidence → Human State

Execution OS publishes signed behavioral evidence.

The adapter converts the evidence into numeric engine signals with generic HOS projection metadata:

- `hos_axis`
- `normalized_value`
- `base_reliability`

The Orchestrator does not know Execution OS signal names. Any future external engine can use the same generic projection contract.

Execution evidence contributes to the HSV through the normal Orchestrator/HSIE fusion pipeline.

Execution OS never writes the HSV directly.

## Event ingress

Execution OS publishes to:

```text
POST /api/v1/external-engines/execution-os/events
```

The request body is signed with `HOS_EXECUTION_SHARED_SECRET` using the header:

```text
x-execution-os-signature
```

HumanKernelOS:

- verifies the raw-body HMAC;
- validates the external envelope;
- verifies tenant configuration;
- verifies that Execution OS is lifecycle-operational;
- deduplicates on the external event ID;
- preserves the original occurrence time;
- validates the event schema;
- dispatches through the normal HOS Event Mesh.

## Lifecycle

HOS Platform Manager remains authoritative.

Generic runtime lifecycle hooks bind:

- HOS `ENABLED/RUNNING` → Execution OS `ACTIVATE`
- HOS `SUSPENDED/DISABLED/UNINSTALLED` → Execution OS `PAUSE`

A remote lifecycle failure prevents the local activation from being committed.

There is no Execution-OS-specific lifecycle branch inside Platform Manager.

## UI

Personal HOS exposes Execution OS as a specialist app.

The workspace provides:

- local HOS lifecycle state;
- remote readiness;
- consent completeness;
- integration readiness;
- explicit discovery/connect;
- context synchronization;
- discipline evidence through HOS Capability Runtime;
- delegated schedule/proposal summary;
- links to Governance and Platform Studio.

React never computes Execution OS discipline, fallback, scheduling, or session logic.

## Legacy Routine Tracker

The old internal `routine` tracker is now deprecated compatibility functionality.

It is:

- not auto-installed with active built-ins;
- no longer an HSIE dependency;
- no longer an Orchestrator dependency;
- hidden from the primary Engines workspace.

Existing historical compatibility data is not destructively deleted.

## Runtime configuration

### HumanKernelOS

Server environment:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
EXECUTION_OS_BASE_URL=
HOS_EXECUTION_SHARED_SECRET=
HOS_EXECUTION_TENANT_ID=personal-hos
HOS_DEFAULT_TIMEZONE=UTC
```

The Supabase secret/service-role credential is used only by the signed external-event ingress. It must never reach browser code.

### Execution OS

Execution OS must use the same:

```text
HOS_EXECUTION_SHARED_SECRET=
```

and configure:

```text
EXECUTION_OS_IDENTITY_MODE=HOS
HOS_EVENT_MESH_URL=https://<human-kernel-host>/api/v1/external-engines/execution-os/events
```

Production connections must use HTTPS.

## Connection procedure

1. Open **Engines → Execution OS**.
2. Discover the Execution OS runtime using its base URL.
3. HOS verifies the public manifest and readiness contract.
4. Review all requested scopes in **Governance**.
5. In **Platform Studio → Engine Registry**, validate the engine.
6. Enable it.
7. Platform Manager activates the remote Execution OS lifecycle.
8. Synchronize current HOS context.
9. Confirm `schedule.get` and `discipline.score.get` through the HOS Capability Runtime.
10. Execute a delegated activity through canonical capabilities.
11. Confirm returned behavioral evidence contributes through the generic signal pipeline.
12. Confirm out-of-bound schedule changes arrive as HOS proposals rather than silently changing the day.

## Phase-5 architecture invariants

- HOS works with Execution OS absent.
- Execution OS can be disabled without breaking the Personal Kernel.
- HOS discovers Execution OS capabilities from the external-engine contract.
- Execution OS private state remains external.
- Human State remains Kernel-owned.
- Daily Operating Plan remains Kernel-owned.
- Personal Policies remain Kernel-owned.
- external schedule changes are proposals unless within explicit delegation.
- no Execution OS identifier appears in Personal Kernel or generic Platform Manager/Capability/Event Mesh logic.
- external signal names are not hardcoded into the Orchestrator.
- consent remains explicit.
- signed ingress is fail-closed.
- legacy Routine Tracker is non-authoritative.

## Certification gate

HumanKernelOS Phase 5 must not merge until its own CI passes:

- TypeScript
- semantic ESLint
- Vitest
- production build

The Phase-5 test suite additionally asserts:

- exact six-capability contract;
- generic lifecycle-adapter registration;
- deterministic signed HOS identity;
- tamper rejection for signed event bodies;
- inbound Event Mesh routing;
- generic unknown-signal axis projection;
- absence of `execution-os` branches from Personal Kernel/platform core.

## Deployment note

Repository certification proves the contract and integration implementation. A live production end-to-end call additionally requires both services to be deployed with the matching shared secret, public HTTPS URLs, HOS event ingress URL, and the user's explicit consent grants.
