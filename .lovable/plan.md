# HOS Kernel Audit + Next Milestone

## Part A — Audit against `.lovable/plan.md` (v0.1 spec)

Scope note: I'm auditing against `.lovable/plan.md`, which defines v0.1 as Kernel shell + live check-ins/reflections/profile/advisor. The broader "27 engines / event bus / plugin API / multi-OS" spec is explicitly out of scope for v0.1 per that document, so those are recorded as **deferred**, not **missing**.

### v0.1 requirements — status

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Auto-create profile on signup | ✅ | `handle_new_user()` + `on_auth_user_created` trigger in migration `20260711080226_*.sql` |
| 2 | `identity_statements` JSONB column | ✅ | `profiles.identity_statements` (types.ts, supabase-tables) |
| 3 | `updateMyProfile` accepts identity_statements | ✅ | `ProfileUpdate` Zod schema in `src/lib/history.functions.ts` |
| 4 | Home page shows live profile + latest check-in | ✅ | `src/routes/index.tsx` calls `getMyProfile` + `getLatestCheckIn` |
| 5 | Latest check-in feeds Advisor + human-state grid | ✅ | `Advisor` accepts `state` prop; index passes live state |
| 6 | "No check-in yet today" prompt | ✅ | index.tsx conditional |
| 7 | `/settings` route with editable name/becoming/standard/statements | ✅ | `src/routes/settings.tsx` |
| 8 | Sidebar Settings link | ✅ | `Shell.tsx` |
| 9 | Standards page reads live profile | ✅ | `src/routes/standards.tsx` |
| 10 | Advisor system-prompt bug (AI_InvalidPromptError) fixed | ✅ | `advisor.functions.ts` uses `system:` option |
| 11 | Typecheck clean | ✅ | last `tsgo --noEmit` clean |
| 12 | Hydration mismatch on greeting | ✅ | client-side `useEffect` in index |

**v0.1 certification: ✅ all 12 items pass.**

### Deferred (explicitly out of scope in plan.md)
- Third-party engines (Body OS, Trading OS, Nutrition, etc.)
- Standards adherence tracking table
- Achievements ledger (dynamic)
- Event bus, plugin API, multi-OS kernel contracts
- Offline mode

### Gaps worth surfacing even inside v0.1 scope
- **G1**: Home page still shows static `humanState` fallback when no check-in exists — grid is seed data, not "empty state".
- **G2**: `Advisor` fallback still uses seed values instead of prompting for check-in.
- **G3**: No mobile drawer Settings link (plan item 4 mentions both sidebar and mobile drawer; only sidebar confirmed).
- **G4**: `identity_statements` in Settings — reorder UX not verified in code.

---

## Part B — Next milestone to build

Per your answer ("Audit + build the next milestone"), the highest-leverage next step is to convert v0.1's monolithic check-in into a **real Kernel foundation**: a typed Engine contract + Event Bus so future OSes plug in without touching the Kernel. Bundle that with the smallest set of real engines that prove the contract.

### Milestone: "Kernel v0.2 — Engine Contract + First 3 Engines"

**1. Event Bus + Engine Contract (Kernel core)**
- New table `public.hos_events` — `{ id, user_id, type, source_engine, payload jsonb, occurred_at }` with RLS + GRANTs.
- New table `public.engine_signals` — normalized summaries an engine emits to the Kernel (`{ user_id, engine, signal_key, value_num, value_text, occurred_at }`). Kernel reads these; it never reads engine-internal tables.
- Server fns: `publishEvent`, `listEvents`, `getLatestSignals` in `src/lib/kernel.functions.ts`.
- TypeScript `Engine` interface in `src/lib/engines/contract.ts`: `{ id, name, subscribe(events), computeSignals(userId) }`.

**2. Nutrition Engine (proof engine #1)**
- Table `nutrition_logs` (meal, kcal, protein, water_ml, at).
- `/nutrition` route with log form + today's totals.
- Emits `MealLogged` event + `nutrition.hydration`, `nutrition.protein_g` signals.

**3. Body Engine (proof engine #2)**
- Table `body_sessions` (kind, duration_min, intensity, at).
- `/body` route with quick-log form + this-week volume.
- Emits `WorkoutCompleted` + `body.load_7d`, `body.recovery_debt` signals.

**4. Routine Engine (proof engine #3)**
- Table `routine_completions` (routine_key, completed_at).
- Attach to existing `/protocols` page — checkboxes persist.
- Emits `RoutineCompleted` + `routine.streak` signal.

**5. Kernel wiring**
- Human State grid on `/` reads `engine_signals` (latest per key) in addition to check-in — engines feed the Kernel.
- Advisor prompt includes latest signals summary.
- Fix G1–G4 gaps above.

### Out of scope for v0.2 (still deferred)
- Plugin registry / dynamic engine loading
- External OS integrations (Trading, Finance)
- Achievement ledger dynamic tracking
- Offline mode, PWA
- The remaining ~24 engines (added one per future milestone)

### Deliverables
- 4 new tables with RLS + GRANTs (single migration)
- `src/lib/kernel.functions.ts`, `src/lib/engines/contract.ts`
- 3 new routes: `/nutrition`, `/body` (attach routine to `/protocols`)
- Human-state grid + Advisor read live signals
- Sidebar + mobile drawer Settings link
- Typecheck clean + Playwright smoke test

### Technical notes
- All engines are pure `public.*` tables; Kernel reads only `engine_signals`, never engine-internal tables — this is what makes future engines pluggable without modifying Kernel code.
- All server fns use `requireSupabaseAuth`; RLS scopes every row to `auth.uid()`.
- Event emission happens in the same server fn transaction as the domain write, using a single `publishEvent` helper.

Approve to proceed with the migration + code for v0.2.
