# Canonical HumanKernelOS Architecture

## System role

HumanKernelOS is the Personal Kernel and host platform for a human-centered ecosystem of independent Operating Engines.

Its responsibility is not to absorb specialist domains. It maintains the authoritative model of the human and provides the contracts through which domain systems exchange context safely.

## Closed operating loop

```text
Observe → Understand → Decide → Execute → Measure → Learn → Adapt
```

HumanKernelOS owns Observe/Understand/Decide at the cross-domain human level and coordinates the loop. Engines may implement domain-specific portions of the same loop inside their own boundary.

## Canonical layers

### 1. Personal Kernel

Owns:

- Human identity and profile
- values, standards, goals and Personal Policies
- Human State and state provenance
- unified Daily Operating Plan
- Decision Intelligence
- human-level memory and learning
- cross-engine orchestration
- recommendation acceptance / modification / rejection
- global operating context

### 2. HOS Platform Foundation

Owns generic platform mechanics:

- Platform Manager and engine lifecycle
- Engine Registry
- Engine SDK
- Capability Runtime
- Event Mesh
- identity, trust, consent and audit
- integration boundary
- observability and health
- versioning and compatibility contracts

Platform code must not contain domain-specific business rules.

### 3. Independent Operating Engines

Each engine owns its specialist domain and may:

- expose versioned capabilities;
- publish facts, signals and intents;
- consume authorized HOS context;
- maintain engine-private storage;
- be installed, disabled, upgraded or removed without rewriting the Personal Kernel.

## Authority rules

1. Every record has one authoritative owner.
2. HumanKernelOS does not duplicate specialist domain records merely for convenience.
3. Engines do not write Human State directly; they contribute evidence/signals.
4. Engines do not overwrite the unified Daily Operating Plan directly; they submit proposals/intents.
5. Personal Policies remain Personal Kernel authority.
6. Cross-engine access occurs through approved capabilities/events, not direct database coupling.
7. Missing data remains missing. The system must not manufacture certainty or silently substitute demo values.
8. A disabled or uninstalled engine must not remain operational through static declarations.

## Human State

Human State is a derived, confidence-aware representation of the human. It distinguishes:

- raw observations;
- derived metrics;
- confidence;
- reliability;
- missing data;
- interpretation;
- predictions and risks.

No engine may claim direct ownership of the full Human State Vector.

## Daily Operating Plan

The Daily Operating Plan is the single authoritative unified human timeline.

Engines may propose:

- allocations;
- constraints;
- preferred windows;
- dependencies;
- execution intents.

The Personal Kernel accepts, modifies, rejects or defers those proposals according to human priorities, policies and constraints.

## Decision Intelligence

Decision Intelligence resolves human-level tradeoffs.

Engines remain responsible for translating accepted recommendations into domain-specific actions.

HOS should answer:

> What should the human prioritize or change?

An engine should answer:

> Given that decision, how should this domain execute?

## Runtime truth target

The eventual platform target is:

```text
Persisted Engine Manifest
        ↓
Runtime Registry
        ↓
Capability / Event Provider Resolution
        ↓
Lifecycle + Permission + Consent Gates
        ↓
Engine Adapter / Runtime
```

Static source registries may exist during the current foundation stage, but they are implementation debt and must not be mistaken for the final plug-and-play architecture.

## UI boundary

The product should converge on two surfaces:

### Personal HOS

- Today
- Plan
- My State
- Intelligence
- Engines
- Me

### Platform Studio

- engine registry/lifecycle
- capabilities
- Event Mesh
- connectors
- permissions/consent
- security/audit
- health/readiness/testing

Personal HOS should present human decisions and state, not developer internals.

## Canonical naming

Use **HumanKernelOS** for the repository/product implementation and **Human Operating System (HOS)** for the broader architecture.

The Personal Kernel is the human-facing core inside HOS.

## Completion criterion

HumanKernelOS is complete when a substantial external engine can be installed, authorized, communicate, contribute signals, consume human context, be disabled, upgraded and removed without introducing engine-specific logic into the Personal Kernel.
