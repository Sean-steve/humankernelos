# HOS v0.4 — Intelligence Layer

Pragmatic mapping of the 8 enterprise specs (DPIS, EMIS, CSPS, PIAS, HIPS, HSIE, PDIE, plus supporting docs) onto the current Lovable Cloud stack. Save the specs as canonical governance docs, then implement the highest-leverage pieces that turn the current shell into a real Intelligence Layer.

## What we're mapping (not building literally)

| Spec construct | Real stack equivalent |
|---|---|
| Operational DB / Event Store / Memory Store | Postgres (Supabase) with distinct tables |
| Event Mesh (Kafka-style) | `hos_events` table + Postgres NOTIFY (future) |
| Schema Registry | Zod validators in `src/lib/*.functions.ts` |
| API Gateway / Services | TanStack `createServerFn` per service |
| Knowledge Graph / Elasticsearch | Deferred — noted in audit |
| Kernel Services | Server fns grouped by domain (kernel, hsie, pdie, policy, timeline) |

## Scope (this milestone)

### 1. Save specs as canonical docs
- `.lovable/specs/dpis.md`, `emis.md`, `csps.md`, `pias.md`, `hips.md`, `hsie.md`, `pdie.md` — condensed authoritative summaries.
- Update `.lovable/constitution-audit.md` with the v0.4 delta.

### 2. Human State Vector (HSIE — Ch. 3/4/20 + "one architectural breakthrough")
- New table `human_states`: per-user, per-day snapshot of 6 core state families (Physical, Cognitive, Emotional, Behavioral, Lifestyle, Operational), each `{ value, confidence, reliability, trend, inputs, updated_at }`.
- Server fn `computeHumanStateVector` — reads latest signals + latest check-in and materializes the HSV row.
- Route `/human-state` upgraded from static grid to live HSV with confidence bars.

### 3. Recommendation Object Model (PDIE — Ch. 6/7)
- New table `recommendations`: `{ id, user_id, type, title, body, evidence[], assumptions[], alternatives[], risks[], confidence, priority, state_alignment, urgency, status, created_at, decided_at }`.
- Server fn `generateRecommendation` — takes HSV + policies + mission context, calls Lovable AI Gateway with the explainability contract from Constitution Art. XI, returns a fully-formed recommendation and persists it.
- Advisor component upgraded: instead of a plain string, renders title + body + evidence chips + confidence + accept/dismiss.

### 4. Personal Policy Service (CSPS Ch. 10)
- New table `policies`: `{ id, user_id, name, when_condition (jsonb), then_action (jsonb), priority, active }`.
- Route `/policies` — list, create, toggle, delete personal operating rules ("if energy < 40 and calendar has deep_work → recommend postpone").
- Recommendation generator consults active policies before calling the AI.

### 5. Timeline Service (CSPS Ch. 7)
- Server fn `getTimeline` — unified feed joining `hos_events` + `check_ins` + `recommendations` + `reflections` + engine signals, ordered by time, with type-tagged rendering data.
- Route `/timeline` — chronological "coherent narrative of daily life" view.

### 6. Kernel v0.4 wiring
- `Advisor.tsx` reads live HSV instead of raw check-in.
- Home page adds "Latest recommendation" and "Today's timeline" strips.
- Register 4 new "services" (hsie, pdie, policy, timeline) in the engine registry so the Platform Foundation view reflects reality.

## Explicitly out of scope (documented, deferred)

- Kafka / real Event Mesh, Neo4j knowledge graph, Elasticsearch — noted in audit; current `hos_events` + Postgres FTS is the pragmatic substitute.
- Separate API Gateway, service mesh, dedicated microservice deployments — collapsed into server fns.
- Digital twin, simulation engine, marketplace, public SDK — Phase-4/5 in the Constitution.
- Wearable/health-provider connectors — need App Connector or user OAuth; separate milestone.
- Full 6-family HSV taxonomy population from real inputs — v0.4 covers the shape and the 3-4 families we already have signals for (Physical from body/nutrition, Behavioral from routine, Operational from check-in, Cognitive from focus/stress in check-in); Emotional and Lifestyle carry `confidence: null` until inputs exist.

## Technical notes

### New migrations (one file per table, all with GRANTs + RLS)

```sql
-- human_states: one row per user per day
create table public.human_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  as_of date not null,
  physical jsonb not null default '{}'::jsonb,
  cognitive jsonb not null default '{}'::jsonb,
  emotional jsonb not null default '{}'::jsonb,
  behavioral jsonb not null default '{}'::jsonb,
  lifestyle jsonb not null default '{}'::jsonb,
  operational jsonb not null default '{}'::jsonb,
  composite numeric,
  updated_at timestamptz not null default now(),
  unique (user_id, as_of)
);
-- + GRANTs + RLS auth.uid() = user_id

-- recommendations: PDIE object model
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null,          -- daily | strategic | preventive | optimization
  title text not null,
  body text not null,
  evidence jsonb not null default '[]',
  assumptions jsonb not null default '[]',
  alternatives jsonb not null default '[]',
  risks jsonb not null default '[]',
  confidence numeric,
  priority numeric,
  state_alignment numeric,
  urgency numeric,
  status text not null default 'pending',  -- pending|accepted|dismissed|completed
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
-- + GRANTs + RLS

-- policies: personal operating rules
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  when_condition jsonb not null default '{}',
  then_action jsonb not null default '{}',
  priority int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- + GRANTs + RLS
```

### New server-fn modules (all in `src/lib/`, no `src/server/`)

- `hsie.functions.ts` — `computeHumanStateVector`, `getLatestHSV`
- `pdie.functions.ts` — `generateRecommendation`, `listRecommendations`, `decideRecommendation`
- `policy.functions.ts` — `listPolicies`, `upsertPolicy`, `deletePolicy`, `togglePolicy`
- `timeline.functions.ts` — `getTimeline`

### AI contract

`generateRecommendation` calls Lovable AI Gateway (existing `ai-gateway.server.ts`) with an `instructions` string enforcing Constitution Art. XI: response schema is `{ title, body, evidence[], assumptions[], alternatives[], risks[], confidence }`. Uses `generateObject` with a Zod schema so we get typed structured output.

### Verification

- Typecheck clean.
- Smoke-check `/human-state`, `/policies`, `/timeline`, plus a `generateRecommendation` invocation via `invoke-server-function` against a signed-in dev user (or read-only assert on empty state if no session).

## Deliverables

1. 7 spec files under `.lovable/specs/` + updated audit
2. 3 migrations (human_states, recommendations, policies)
3. 4 new server-fn modules
4. 3 new routes (or rewrites): `/human-state` upgrade, `/policies` new, `/timeline` new
5. Advisor + Home updates to consume HSV and latest recommendation
6. Engine registry entries for hsie/pdie/policy/timeline
