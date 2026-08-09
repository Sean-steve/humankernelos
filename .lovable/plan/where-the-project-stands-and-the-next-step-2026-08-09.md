# Where the project stands, and the next step

## What is already built (verified in code and migrations)

- **Kernel (Layer 1):** identity/profile, check-ins, reflections, standards, settings.
- **Platform Foundation (Layer 2):** event bus (`hos_events`), normalized signals (`engine_signals` with confidence/reliability/trend/metadata), engine registry table (`engines`) plus a live `/engines` install-sync-activate surface, and a full `EngineDescriptor` contract including declared permissions.
- **Specialized OSes (Layer 3):** Nutrition, Body, Routine engines with their own domain tables, publishing signals and events.
- **Intelligence layer (v0.4):** Human State Vector (`human_states` + HSIE), explainable recommendations (`recommendations` + PDIE, which already reads active personal policies), Policy service (`policies`), unified Timeline.

## What the governing documents still require and the code does not have

1. **Learning Loop (Constitution Art. XII).** Recommendations have a `status` column only. Nothing captures whether a directive was executed, what actually happened afterwards, or feeds that back into future recommendations. This is the single largest unmet article, and every later phase (pattern recognition, experiments, digital twin) depends on it.
2. **Permission Manager (Art. VI, XIV).** Engines *declare* requested/provided/prohibited data in code, but nothing persists user consent or enforces the declaration at read time.
3. **Intelligence Orchestrator (Art. IX).** Signals are read, but there is no explicit fusion/conflict-resolution/priority ranking step between HSIE and PDIE.
4. **Audit trail and data export (Art. XIV).**
5. **Sustainability scoring (Art. I)** — a recommendation is not yet checked for harming another life axis.
6. Additional Layer-3 OSes (Trading, Business, Finance, Asset, Health) — later phases.

## Recommended next step: v0.5 — Close the Learning Loop

This is the correct next move because the platform can currently observe and recommend but never learns, which is what the Constitution defines as the system's core purpose.

### Scope

1. **Outcome capture.** New `recommendation_outcomes` table: recommendation ref, executed (yes/partial/no), measured effect on the affected state axes, friction/notes, timestamp. RLS scoped to the owner, with grants.
2. **Execution states.** Extend recommendation lifecycle: `pending → accepted → executed → measured → reflected` (plus `dismissed`), driven from the UI.
3. **Follow-up prompt.** When an accepted recommendation ages past its window, the Kernel surfaces a "did you do it, and what changed?" card on Today and Timeline.
4. **Learning feedback into PDIE.** Recommendation generation additionally receives a compact history of past recommendations and their outcomes, so it favours patterns that worked for this operator and avoids ones that repeatedly failed. It also emits an adherence signal into `engine_signals`.
5. **New `/learning` surface.** Adherence rate, which recommendation types actually moved which axes, top repeated failures, and a running list of learned personal patterns.
6. **Sustainability check on output.** Each recommendation records which axes it may cost, and is flagged when it trades one axis away for another — satisfying Art. I in the recommendation object itself.

### Technical notes

- Migration adds `recommendation_outcomes` and a `learned_patterns` table (pattern text, supporting evidence count, confidence), both with RLS `auth.uid() = user_id` and explicit GRANTs to `authenticated` / `service_role`.
- New `src/lib/learning.functions.ts` (thin `createServerFn` wrappers only; helpers in a `.server.ts` sibling) for recording outcomes, deriving adherence, and summarising patterns.
- `src/lib/pdie.functions.ts` gains an outcome-history block in its prompt context and the sustainability field in its structured output.
- Register a `learning` engine descriptor in `src/lib/engines/contract.ts` so it appears in the registry like every other engine.
- New route `src/routes/learning.tsx` with its own head metadata; nav entry added in `src/components/hos/Shell.tsx`.

### Deferred to v0.6 and beyond

Permission Manager with persisted consent, Intelligence Orchestrator as an explicit module, audit log plus data export, then the first non-body Layer-3 OS (Finance or Trading).
