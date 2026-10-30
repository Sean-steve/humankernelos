# Phase 4 — Human-first Experience

## Objective

Transform HumanKernelOS from an architecture-facing console into a Personal HOS that is usable from waking to sleep.

The product now separates:

### Personal HOS

- Today
- Plan
- My State
- Intelligence
- Engines
- Me

### Platform Studio

- Engine Registry
- Orchestrator
- Governance
- Signals
- Timeline
- advanced technical policy inspection

The Personal HOS is optimized for human decisions. Platform Studio is optimized for system administration.

## Today

Today answers four questions:

1. How am I?
2. What matters now?
3. What is next?
4. What direction am I moving toward?

It reads:

- authoritative Human State;
- authoritative Daily Operating Plan;
- active goals;
- PDIE recommendation and follow-up measurement.

It does not render sample schedule or synthetic state.

The signature NOW surface shows the current authoritative plan block when one exists.

## Plan

Plan is the single human-facing view of the Daily Operating Plan.

Users can:

- add commitments;
- protect commitments;
- start, complete, or defer work;
- activate the day;
- review engine schedule proposals;
- accept, defer, or reject proposals.

Engine proposals remain separate until accepted.

## My State

My State presents Human State in human language while preserving evidence quality.

The experience surfaces:

- overall condition;
- coverage;
- confidence;
- number of evidence sources;
- six state families;
- per-family reliability;
- contributing inputs.

Unknown remains unknown.

## Intelligence

Intelligence combines:

- Personal Decision Intelligence;
- recommendation follow-up measurement;
- adherence;
- learned patterns;
- durable personal memory;
- decision memory;
- recent recommendations.

Kernel refresh remains deterministic and does not silently generate AI advice.

## Engines

The Engines workspace presents specialist Operating Engines as apps.

Technical lifecycle, manifests, permissions, and health administration are no longer the primary user experience.

Built-in domain workspaces remain accessible where available.

The legacy Routine Tracker remains explicitly labelled as compatibility functionality.

## Me

Me owns human-level identity and direction:

- identity;
- becoming;
- primary standard;
- goals;
- Personal Policies;
- standards;
- reflection;
- settings.

Goals are real Kernel-owned records.

## Platform Studio

Platform Studio is the gateway for advanced platform surfaces:

- Engine Registry
- Orchestrator
- Governance
- Signals
- Timeline
- Policy inspection

Normal day-to-day use should not require Platform Studio.

## Navigation

### Desktop

Persistent left navigation:

- Today
- Plan
- My State
- Intelligence
- Engines
- Me

Platform Studio remains a secondary action.

### Mobile

Persistent bottom navigation:

- Today
- Plan
- HOS
- Engines
- Me

The HOS tab opens Intelligence.

A drawer provides the full six-surface navigation and Platform Studio.

## Experience rules

1. Human language before architecture language.
2. Current action before analytics.
3. Missing data remains missing.
4. UI never owns domain calculations.
5. Every state-changing action calls a Kernel/engine service.
6. External engine administration stays separate from Personal HOS.
7. Normal users should not need to understand Event Mesh, capability routing, lifecycle states, or schema registries to operate their day.

## Phase-4 gate

Phase 4 passes when:

- six Personal HOS workspaces are implemented;
- old architecture surfaces are removed from primary navigation;
- Today uses live Kernel state and Daily Plan;
- Plan uses the authoritative Phase-3 Daily Plan;
- My State surfaces certainty and provenance;
- Intelligence exposes recommendations, learning and memory coherently;
- Engines is human-facing rather than registry-facing;
- Me exposes identity/goals/policies;
- Platform Studio owns the technical surfaces;
- mobile navigation is usable;
- no domain logic is duplicated in UI;
- typecheck, semantic lint, tests and production build pass.

## Deferred

- Routine Execution OS integration;
- richer engine-native workspaces;
- cross-engine certification;
- final accessibility audit;
- full browser/device matrix;
- production performance and security certification.

Those remain Phase 5 and Phase 6 work.
