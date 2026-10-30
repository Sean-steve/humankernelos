# HumanKernelOS

HumanKernelOS is the **Personal Kernel** of the Human Operating System (HOS): the authoritative system for understanding the human, maintaining their operating context, and coordinating how specialized Operating Engines contribute to a better daily operating state.

HumanKernelOS is **not** a monolithic life-management application. It does not own the detailed domains of finance, trading, business, health, routines, learning, or other specialist systems.

## Core purpose

HumanKernelOS exists to continuously answer:

> Given who I am, my current state, priorities, constraints, policies, and direction, what is the best way for me to operate right now?

It owns the human layer:

- identity, values, standards, goals, and personal policies;
- Human State and its provenance/confidence;
- the authoritative unified Daily Operating Plan;
- Decision Intelligence and recommendations;
- personal learning, memory, adaptation, and cross-domain orchestration;
- engine lifecycle, permissions, capability discovery, events, audit, and trust boundaries.

Specialized Operating Engines remain authoritative for their own domain records and publish only the signals, facts, capabilities, and intents that HOS is permitted to consume.

## Architecture rule

**Every piece of data has one authoritative owner and may have many authorized consumers.**

Examples:

- Finance OS owns transactions; HumanKernelOS may consume financial-comfort or constraint signals.
- Trading OS owns trades and journals; HumanKernelOS may consume stress, discipline, workload, or confidence signals.
- Routine Execution OS owns routines, execution sessions, fallbacks, adherence, and execution history; HumanKernelOS may consume behavioral execution signals and schedule proposals.
- HumanKernelOS owns Human State, Personal Policies, Decision Intelligence, and the final unified Daily Operating Plan.

The Personal Kernel must never require domain-specific branches such as `if (engine === "routine-os")` to support a normal engine.

## Platform layers

```text
Human
  │
  ▼
Personal Kernel
  ├─ Identity / Policies / Goals
  ├─ Human State Intelligence
  ├─ Daily Operating Plan
  ├─ Decision Intelligence
  └─ Learning / Adaptation
  │
  ▼
HOS Platform Foundation
  ├─ Platform Manager
  ├─ Engine Registry
  ├─ Capability Runtime
  ├─ Event Mesh
  ├─ Engine SDK
  ├─ Identity / Consent / Audit
  └─ Integration boundary
  │
  ▼
Independent Operating Engines
```

## Current repository status

This repository is the canonical codebase for HumanKernelOS going forward.

The current implementation includes a substantial platform foundation:

- Supabase authentication and PostgreSQL RLS;
- Human State / HSIE;
- Decision Intelligence / PDIE;
- Personal Policies;
- Learning Loop;
- Intelligence Orchestrator;
- Event Mesh with validation, retries, dead-lettering and idempotency;
- Platform Manager lifecycle and health;
- Capability Runtime;
- Engine SDK;
- engine permissions, consent, audit and engine-scoped storage;
- Nutrition and Body engines;
- a small legacy internal routine tracker.

### Legacy routine tracker

The existing internal `routine` engine is **not** the future Routine Execution OS / HEE. It is retained only as a compatibility implementation while the external Routine Execution OS is integrated through the HOS Engine architecture. It must not become a second authoritative routine domain.

## Canonical development direction

Development proceeds in this order:

1. **Canonical HOS Reconciliation** — align the repository, documentation, domain boundaries, and user-facing truth.
2. **Platform Foundation Completion** — make runtime registries and Engine SDK behavior genuinely plug-and-play and production hardened.
3. **Personal Kernel Completion** — finish Human State, Daily Plan, memory, learning, policies, decisions, and adaptation.
4. **Human-first Experience** — Today, Plan, My State, Intelligence, Engines, Me; technical surfaces move to Platform Studio.
5. **External Engine Certification** — integrate Routine Execution OS first, then prove additional engines can coexist without Kernel rewrites.
6. **Production Certification** — security, regression, backup/recovery, observability, performance, documentation and release gates.

See `docs/` for the canonical architecture and ownership rules.

## Development

```sh
npm install
npm run dev
```

The application currently uses TanStack Start, React, TypeScript, Supabase/PostgreSQL, Zod, React Query and Tailwind CSS.

## Live app

https://humankernelos.lovable.app

---

**Design principle:** HumanKernelOS orchestrates the human. Specialized Operating Engines own their domains.
