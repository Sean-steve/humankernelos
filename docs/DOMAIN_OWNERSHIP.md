# Domain Ownership

This document is the authority for where data and decisions belong.

## Personal Kernel ownership

HumanKernelOS owns:

- user/subject identity
- mission, values and personal standards
- strategic goals and priorities
- Personal Policies
- Human State
- Human State provenance/confidence
- unified Daily Operating Plan
- recommendation/decision lifecycle
- human-level memory and learning
- cross-domain orchestration
- engine grants/consent and platform audit

## Engine ownership principle

Specialized Operating Engines own their domain records.

| Domain | Authoritative owner | HumanKernelOS may consume |
|---|---|---|
| Finance | Finance OS | financial comfort, constraints, risk, budget headroom signals |
| Trading | Trading OS | stress, discipline, workload, confidence, risk signals |
| Business | Business OS | workload, commitments, milestone pressure, operating constraints |
| Health | Health OS / approved health sources | summarized health/recovery context according to consent |
| Learning | Learning OS | learning load, progress, readiness, relevant milestones |
| Routine execution | Routine Execution OS | adherence, execution friction, momentum, schedule proposals |
| Human State | Personal Kernel | engines may consume only authorized state axes |
| Daily Operating Plan | Personal Kernel | engines submit schedule intents/proposals |

## Legacy internal routine tracker

The current repository contains an internal engine with ID `routine`.

Its current responsibilities are limited to:

- recording simple routine completions;
- calculating a basic streak;
- publishing `RoutineCompleted`;
- publishing simple routine signals.

It is **legacy compatibility functionality**, not the canonical Routine Execution OS.

Until migration:

- do not expand its domain;
- do not add HEE-specific behavior to it;
- do not let it become authoritative for global routine scheduling;
- do not duplicate future Routine Execution OS data into its tables;
- preserve only enough behavior to avoid breaking the current HOS foundation.

When Routine Execution OS is integrated, an explicit migration/deprecation decision must be made.

## Cross-boundary rules

### Engines may publish

- FACTS — things that happened
- SIGNALS — interpreted/derived observations
- INTENTS — requested future actions

### Engines may consume

Only HOS capabilities/events explicitly granted by permission and consent.

### Prohibited coupling

No engine may:

- directly write another engine's private tables;
- directly mutate Human State;
- directly overwrite the authoritative Daily Operating Plan;
- change Personal Policies without the canonical Kernel contract;
- bypass lifecycle or consent checks;
- require a hardcoded engine-specific branch in Personal Kernel core.

## Data duplication rule

Replication for cache/read-model purposes is allowed only when:

- ownership remains explicit;
- the copy is non-authoritative;
- provenance is retained;
- synchronization semantics are documented.

Convenience copying without an ownership contract is prohibited.
