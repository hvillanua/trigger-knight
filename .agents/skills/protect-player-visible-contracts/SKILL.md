---
name: protect-player-visible-contracts
description: Review or change Trigger Knight observations, events, presentation frames, or policy inputs without exposing hidden gameplay state to players or ordinary automated policies.
---

# Protect player-visible contracts

Treat browser presentation and ordinary automated policies as the same player.
They may receive only information the game has intentionally made observable at
that point in the run.

Before changing `GameObservation`, `GameEvent`, `PresentationFrame`,
`PlayerAgent`, or a type reachable from them:

1. Read the selected issue and its required context. Use `research/README.md` to
   locate presentation evidence when the visibility of a value depends on
   original behavior. If evidence is absent, record an explicit clean-room
   decision instead of calling the behavior confirmed.
2. Classify every added value as player-visible or internal. Generation inputs,
   future outcomes, random state, AI decisions, unrevealed enemy statistics,
   rewards, cached calculations, and diagnostic state are internal unless the
   product or behavioral evidence explicitly exposes them.
3. Add the smallest red test first. Assert the exact public object shape or exact
   keys for both observations and events; positive property assertions alone do
   not detect extra leaked fields.
4. Define a dedicated observed type and an explicit projection from
   authoritative state. Never spread an authoritative object into a public
   value, including patterns such as `...state`, `...encounter`, or `...enemy`.
5. Mark player-visible type roots with `@playerVisible`. Mark authoritative
   declarations that must never be reachable from those roots with
   `@hiddenGameplayState`.
6. Run `npm run check:public-contracts` and the focused unit tests that cover the
   changed observation or event. If the checker fails, project the safe fields;
   do not remove a tag or weaken the checker to make the failure disappear.
7. Update public-contract documentation and deterministic trace or hash fixtures
   when the intentional projection changes.

The structural checker prevents player-visible types from transitively reusing
tagged internal types. It cannot determine whether a new primitive field is
secret, so evidence review and exact-shape tests remain required.
