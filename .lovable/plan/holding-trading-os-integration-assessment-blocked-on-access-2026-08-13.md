# Holding: Trading OS integration assessment (blocked on access)

## Status

Trading OS (`b897f584-e1ec-430a-a823-8b3b7c9e9b29`) sits in the `stevenyaga162` workspace, which you do not own. This project lives in `Personal Projects with AI`. Cross-project reads are workspace-scoped, so checkout attempts by name and by ID both failed — this is an access boundary, not a naming problem.

Your decision: the owner transfers Trading OS into `Personal Projects with AI`, and nothing is built or changed until then.

## What happens when the transfer lands

You say the word, and I run the full inspection before writing anything:

1. Check out the Trading OS snapshot and map its routes, components, server functions and data model.
2. Identify what it owns privately (trades, sessions, risk settings, broker credentials) versus what it can safely publish as normalized signals.
3. Draft the Integration Assessment covering: ownership map, event and signal contracts, database and identity strategy, permission scopes, engine lifecycle, and the UI, intelligence and broker boundaries.
4. Name the adapters required on each side, the risks, and a phased migration order.
5. Stop there for your approval — no code changes in that pass either.

## Constraints already locked in

- Trading OS stays an independent, installable engine. It is not merged into the HOS core app.
- The Kernel never reads a Trading OS domain row; it consumes only `engine_signals` and `hos_events`.
- Trading OS registers through the existing engine registry with its own requested, provided and prohibited scopes, so consent is granted and revoked on `/governance` like every other engine.
- Broker connections and credentials remain entirely on the Trading side.

## Until then

No files are modified and no migrations are run.
