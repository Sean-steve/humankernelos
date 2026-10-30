# Phase 1 — Canonical HOS Reconciliation

## Baseline

Repository: `Sean-steve/humankernelos`

Baseline branch: `main`

The repository already contains a meaningful HOS platform foundation: Personal Kernel services, HSIE/PDIE, policies, learning, Event Mesh, Platform Manager, Capability Runtime, Engine SDK, permissions/consent, Supabase RLS and engine-scoped persistence.

## Reconciliation decisions

### Canonical product role

HumanKernelOS is the Personal Kernel and HOS host platform. It owns the human model and cross-domain orchestration, not specialist domain records.

### Existing internal routine engine

Classified as **legacy compatibility**. It is not the independent Routine Execution OS / HEE.

### Runtime extensibility

Persisted engine/capability tables exist, but executable runtime resolution still depends on source-code registries such as:

- `REGISTERED_ENGINES`
- `CAPABILITIES`
- `EVENT_HANDLERS`
- `EVENT_SCHEMAS`

This is recorded as Phase-2 platform debt, not hidden as completed plug-and-play behavior.

### UI truth

Static seed data may be useful during visual prototyping, but must not silently appear as real operator data. Phase 1 removes/neutralizes those fallbacks on the primary Today surface and removes fake connected-system status.

### Repository truth

The README is no longer a master build prompt. It now describes the actual architecture, boundaries, status and completion path.

## Explicitly not part of Phase 1

- Runtime registry redesign
- Engine SDK redesign
- Routine Execution OS integration
- Human-first full UI redesign
- Digital Twin / Knowledge Graph work
- production certification

Those remain later phases.

## Gate

Phase 1 is complete when the repository communicates the correct product boundary, does not misrepresent demo data or engine connectivity as live truth, and can serve as the canonical base for Phase 2.
