# Next development: v0.7 — Intelligence Orchestrator

## Where things stand

The Kernel now observes (check-ins, engine signals, events), models state (Human State Vector), recommends with explanations (PDIE), learns from outcomes (v0.5), and governs consent and audit (v0.6). Nutrition, Body and Routine run as Layer-3 engines.

The remaining unmet Kernel article is **Art. IX — Intelligence Orchestrator**. Today signals go straight from engines into the state model and the advisor. Nothing sits in between to fuse conflicting inputs, weigh reliability, resolve contradictions between engines, or decide what matters *most right now*. There is no orchestrator module in the codebase.

## What v0.7 adds

1. **Signal fusion pass.** One place that collects every current signal, weighs each by confidence, reliability, recency and trend, and produces a single fused view of the operator per axis, instead of each surface re-deriving it.

2. **Conflict resolution.** When two engines disagree (Body says load is high while Routine says adherence is perfect and the check-in says energy is high), the orchestrator records the conflict, picks a resolution with a stated reason, and marks the affected axis as contested rather than silently averaging it.

3. **Priority ranking.** The orchestrator ranks the candidate concerns of the day (recovery debt, hydration gap, streak risk, stress load) into an ordered list with a "why now" reason, and PDIE receives that ranked list instead of a raw signal dump — so the directive addresses the single highest-leverage thing.

4. **Attention surface.** A new `/orchestrator` page showing: the fused axis view with contributing signals, any open conflicts and how they were resolved, and today's ranked priority list. This makes the Kernel's reasoning inspectable, which the Constitution requires of intelligence output.

5. **Orchestrator engine descriptor** registered in the engine registry with its own permissions and consent scopes, so it is governed like every other engine.

## Technical notes

- Migration adds `orchestrator_runs` (fused axes, resolved conflicts, ranked priorities as jsonb, generated_at) and `signal_conflicts` (axis, competing engines, resolution, reason). Both RLS-scoped to `auth.uid() = user_id` with explicit GRANTs to `authenticated` and `service_role`.
- New `src/lib/orchestrator.server.ts` holds the fusion, conflict and ranking logic (pure functions, unit-testable). `src/lib/orchestrator.functions.ts` stays a thin `createServerFn` wrapper layer, auth-gated with `requireSupabaseAuth`.
- `src/lib/pdie.functions.ts` prompt context switches from raw signals to the orchestrator's ranked priorities plus fused axes, keeping the existing learning-history and policy blocks.
- `src/lib/hsie.functions.ts` consumes the fused axes so HSV and the advisor stop diverging.
- New route `src/routes/orchestrator.tsx` with its own head metadata; nav entry in `src/components/hos/Shell.tsx` and a palette entry in `CommandPalette.tsx`. Fetches gated on a live session, matching the other authenticated surfaces.

## Deferred to v0.8+

First non-kernel Layer-3 OS (Finance or Trading), engine lifecycle/version migration, pattern-detection experiments and the digital-twin phase.
