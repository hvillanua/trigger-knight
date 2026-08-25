# Original-v1.3 ruleset foundation

`original-v1.3` is the only supported gameplay ruleset. Browser sessions and
headless simulations create it through the same `GameplayEngine`. Creation,
stepping, and observation each resolve the state's identity through the domain
ruleset registry. An unsupported identity, including the former
`walking-skeleton-v1` scaffold, throws a `RangeError` before the engine creates,
steps, or observes a run.

The registry currently has one entry. Its factory accepts any number of unique
ruleset implementations, so a later identity can coexist without changing the
`original-v1.3` object or its constants.

## Owned constants and decisions

The ruleset owns the Milestone 2 values that later lifecycle tickets will use:

| Group            | Values                                                                                                                     | Evidence                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Logical time     | 30 gameplay ticks per second                                                                                               | Confirmed original behavior                                                    |
| Running movement | Speed starts at 0, gains 1 per active tick, caps at 15, and contributes one distance unit per speed unit                   | Confirmed original behavior                                                    |
| Day and score    | 7,000 distance units per day; running score uses 10 points per speed unit before the profile multiplier                    | Confirmed original behavior                                                    |
| Lifespan         | Starts at 99.99, drains the fractional field by 4 per active tick, resets the fraction to 99, and dies below whole value 0 | Confirmed original behavior                                                    |
| World camera     | One original stage unit maps to one world unit; initial camera is 480 by 320 world units                                   | Clean-room coordinate-model decision preserving confirmed original coordinates |
| Random sequence  | `mulberry32-fnv1a32-v1`                                                                                                    | Clean-room reproducibility decision                                            |

The compatibility target for randomness is the confirmed original ranges,
probabilities, and gameplay draw order. The Flash Player's PRNG and seed
sequence remain unrecovered. The chosen algorithm does not claim to reproduce
that sequence. The exact seed expansion and bounded integer mapping are in
[`deterministic-randomness.md`](deterministic-randomness.md).

## Current transition

The ruleset foundation retains the Milestone 1 deterministic transition while
the remaining Milestone 2 mechanics are developed. `createRun(config)` returns
a serializable state with `steps` set to zero. Each `step(state, commands)` call
returns a new state with an incremented step count and one `step-advanced`
event. `observe(state)` returns only the ruleset identity and step count, not the
hidden random state.

This step counter and event are still scaffolding. Movement, active ticks,
lifespan, pause, tutorial gates, and termination belong to later Milestone 2
tickets and are not claimed as recovered original behavior here.

State, results, events, event lists, and observations are frozen. A
JSON-restored checkpoint produces the same next state, observation, and events
as uninterrupted execution. Browser and headless parity traces are described in
[`gameplay-diagnostics.md`](gameplay-diagnostics.md).
