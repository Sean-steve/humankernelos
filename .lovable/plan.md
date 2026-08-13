# Next build: v0.8 — Finance OS (first non-kernel Layer-3 OS)

## Why this next

The Kernel is now complete end to end: it observes (check-ins, engine signals, events), fuses and ranks (v0.7 Orchestrator), recommends with explanations (PDIE), learns from outcomes (v0.5) and governs consent and audit (v0.6). Every Layer-3 engine so far — Nutrition, Body, Routine — is a body/behaviour engine written by the Kernel team.

The untested claim of the whole architecture is that the Kernel can orchestrate a **domain it does not own**. Finance is the cleanest proof: it has its own private data (accounts, transactions, obligations), it must never leak that data into the Kernel, and it still needs to influence the operator's state through signals alone.

## What v0.8 adds

1. **Finance OS as an independent engine.** Owns its own tables and publishes only normalized signals: runway in months, monthly burn, obligation pressure, spend-friction score. The Kernel never reads a transaction row.

2. **Money-state surface (`/finance`).** Add accounts with balances, record income/expense entries, declare recurring obligations. The page shows runway, burn rate, obligation load and a "financial pressure" reading — not a ledger app, an operating-condition view of money.

3. **Financial pressure enters the Human State Vector.** Finance signals feed the Orchestrator's fusion as contributors to the operational and emotional axes, so money stress becomes a real, weighted input to the directive instead of an invisible one.

4. **Priorities gain a money concern.** The ranked priority list can now surface "runway below threshold" or "obligation due inside 3 days" with its own severity and "why now" reason, competing fairly with recovery debt and hydration gaps.

5. **Governed like every other engine.** A `finance` descriptor in the engine registry with its own requested/provided/prohibited scopes, so consent for it is granted or revoked on `/governance` exactly like the rest, and the prohibition on reading reflections and body data is explicit.

## Technical notes

- Migration adds `finance_accounts` (name, kind, balance, currency), `finance_entries` (direction, amount, category, occurred_at, note) and `finance_obligations` (label, amount, cadence, next_due). All RLS-scoped to `auth.uid() = user_id`, with `GRANT` to `authenticated` and `service_role`, plus `updated_at` triggers, following the existing table conventions.
- `src/lib/finance.server.ts` holds the pure derivations (burn from trailing entries, runway = liquid balance / burn, obligation pressure, friction score). `src/lib/finance.functions.ts` stays a thin `createServerFn` wrapper layer with `requireSupabaseAuth`, mirroring `nutrition.functions.ts`: write the domain row, publish an `hos_event`, then publish recomputed `engine_signals`.
- New event type `FinanceEntryLogged` added to `HosEventType`; new signal keys `finance.runway_months`, `finance.burn_monthly`, `finance.obligation_pressure`, `finance.friction`.
- `src/lib/orchestrator.server.ts` gains finance contributors in the axis map and a money candidate in the priority ranker; HSIE and PDIE need no change since both already read the fused axes and ranked list.
- New route `src/routes/finance.tsx` with its own head metadata, fetches gated on a live session like the other authenticated surfaces; nav entry in `src/components/hos/Shell.tsx` and a `CommandPalette.tsx` entry.

## Deferred to v0.9+

Trading OS, engine lifecycle/version migration, pattern-detection experiments and the digital-twin phase.
