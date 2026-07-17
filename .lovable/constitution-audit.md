# HOSE Constitution v1.0 — Compliance Audit

**Date:** 2026-07-17
**Audited against:** `.lovable/constitution.md`
**Codebase state:** v0.1 Kernel + v0.2 Engine Contract (Nutrition, Body, Routine)

Legend: ✅ compliant · 🟡 partial · ❌ missing · N/A not-yet-in-scope (deferred phase)

---

## Article-by-article findings

### Article I — Core Principle (Sustainable Human Performance)
🟡 **Partial.** Advisor prompt is calm/decisive and considers multi-axis state (energy/focus/recovery/stress/mood/sleep). No explicit long-term-vs-short-term optimization guardrail. Nothing enforces "recommendation cannot destroy another axis."
- **Gap:** No sustainability scoring on recommendations.

### Article II — Ecosystem Structure (3 layers)
✅ **Compliant in shape.** `src/lib/kernel.functions.ts` is the Kernel layer. `src/lib/engines/contract.ts` + `engine_signals` + `hos_events` tables are the Platform Foundation. Nutrition / Body / Routine are Layer-3 OSes.
- **Gap:** Layer 2 lacks an Engine Registry table — engines are hardcoded in `REGISTERED_ENGINES` array (Art. VI).

### Article III — Kernel Boundary
✅ **Compliant.** Kernel tables (`profiles`, `check_ins`, `reflections`, `engine_signals`, `hos_events`) hold identity, human state, personal intelligence. Engine tables (`nutrition_logs`, `body_sessions`, `routine_completions`) hold domain data only.
- Kernel reads engine data only through `engine_signals` (per plan.md rule). ✅

### Article IV — Single Source of Truth
✅ **Compliant.** Each domain table has one owner engine. No duplication observed.

### Article V — Engine Contract
🟡 **Partial.** `EngineDescriptor` interface exists with `id, name, emits, signals`. Missing constitutional fields: `version`, `purpose`, `owner`, `capabilities`, `requiredSignals` (consumption declaration), `ownership` (what data it owns).
- **Gap:** Contract is a subset of Article V's requirements.

### Article VI — Platform Foundation
❌ **Missing.**
- **No Engine Registry table.** `REGISTERED_ENGINES` is a static in-code array; not queryable, not versioned, not user-installable.
- **No lifecycle management** (install/activate/deactivate/update/migrate/remove).
- **No Permission Manager.** Engines can technically read any user row governed only by RLS on `auth.uid()`; no per-engine "data requested / provided / prohibited" declarations enforced.

### Article VII — Event Architecture
✅ **Compliant.** `hos_events` table + `publishEvent` server fn. Engines are decoupled; consumers read the bus.
- **Gap:** No subscription mechanism — consumers must poll `listRecentEvents`. Acceptable for Phase 1; deferred.

### Article VIII — Data Standardization
❌ **Missing.** `engine_signals` currently stores: `engine, signal_key, value_num, value_text, occurred_at, user_id`. Constitutional signal shape requires additionally: **confidence, reliability, trend, metadata**.
- **Gap:** No confidence, reliability, trend, or metadata columns.

### Article IX — Intelligence Architecture
🟡 **Partial.**
- Human State Engine ✅ — check-ins + latest signals.
- Intelligence Orchestrator ❌ — no module that fuses signals across engines, resolves conflicts, prioritizes.
- Recommendation Engine 🟡 — `getAdvisorDirective` returns DIRECTIVE/WHY/AVOID but does NOT emit: evidence, confidence, alternative, expected outcome.

### Article X — AI Governance
🟡 **Partial.** Advisor is on-brand ("no preamble, no emoji, calm decisive"). But: no confidence output, no feedback capture loop, no permission checks in AI calls.

### Article XI — Personal Operating Policies
❌ **Missing.** No `policies` table, no policy DSL, nothing constrains Advisor output against user-defined rules.

### Article XII — Learning Loop
❌ **Missing.** Observe/Recommend exist. Execute/Measure/Reflect/Learn are absent — nothing tracks whether a directive was followed or worked.

### Article XIII — Roadmap
Current position: **Phase 1 in progress (~40% complete)**.
- Event Bus ✅
- Engine Registry ❌
- Permissions ❌
- Schemas 🟡 (missing Art. VIII fields)
- Phases 2–5: not started.

### Article XIV — Security & Privacy
🟡 **Partial.**
- RLS on every user table scoped to `auth.uid()` ✅
- Minimum necessary access 🟡 — no per-engine permission scoping; every engine sees all of its own user's rows.
- Encryption ✅ (at rest via Supabase, in transit via HTTPS).
- **Missing:** audit trail, data-portability export, explicit "data prohibited" declarations.

### Article XV — Final Principle
Design guardrail. Not code-testable. Adopt as review checklist.

---

## Prioritized gap register (what to build next, in order)

| # | Gap | Article | Priority | Effort |
|---|---|---|---|---|
| G1 | Engine Registry table (`engines`) with name, version, status, capabilities, owner | VI | P0 | S |
| G2 | Signal schema upgrade: add `confidence`, `reliability`, `trend`, `metadata jsonb` to `engine_signals` | VIII | P0 | S |
| G3 | Engine Contract expansion: add `version`, `owner`, `capabilities`, `requiredSignals`, `ownership` to `EngineDescriptor` | V | P0 | S |
| G4 | Permissions table: per-engine `data_requested`, `data_provided`, `data_prohibited` + user consent | VI, XIV | P1 | M |
| G5 | Recommendation schema: extend Advisor output to `{ directive, why, avoid, evidence[], confidence, alternative, expected_outcome }` | IX | P1 | S |
| G6 | Personal Policies (`policies` table + policy DSL + Advisor prompt injection) | XI | P1 | M |
| G7 | Intelligence Orchestrator module — cross-engine signal fusion, conflict resolution, priority ranking | IX | P2 | L |
| G8 | Learning Loop — capture directive execution + outcome + reflection; feedback back into signals | XII | P2 | L |
| G9 | Audit trail table (`audit_log`) + data-portability export server fn | XIV | P2 | M |
| G10 | Engine lifecycle mgmt (install/activate/deactivate/version migrate) | VI | P3 | L |
| G11 | Trading / Business / Finance / Asset / Health OSes | II, XIII | P3+ | XL each |
| G12 | Sustainability scoring on recommendations — no single-axis wins that harm others | I | P3 | M |

---

## Compliance summary

| Layer | Score |
|---|---|
| Article I — Core Principle | 40% |
| Article II — Structure | 85% |
| Article III — Kernel Boundary | 100% |
| Article IV — Single Source of Truth | 100% |
| Article V — Engine Contract | 45% |
| Article VI — Platform Foundation | 15% |
| Article VII — Event Bus | 90% |
| Article VIII — Signal Schema | 40% |
| Article IX — Intelligence Architecture | 35% |
| Article X — AI Governance | 40% |
| Article XI — Personal Policies | 0% |
| Article XII — Learning Loop | 15% |
| Article XIV — Security & Privacy | 55% |
| **Overall Phase-1 completion** | **~45%** |

**Certification status: NOT CERTIFIED for Constitution v1.0.**
The ecosystem is architecturally aligned (Articles II/III/IV/VII pass) but missing Phase-1 foundational pieces (Registry, Permissions, full Signal schema) plus every Phase-2+ intelligence article. Recommended next milestone: **G1 + G2 + G3 as v0.3 "Phase-1 Foundation Complete"** — small, self-contained, closes 3 red items in one pass.
