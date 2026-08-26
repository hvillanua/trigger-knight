# Finite headless simulation

The headless runner is the programmatic consumer of the shared gameplay engine.
It creates `original-v1.3` runs through the same ruleset registry and
`GameplayEngine` operations as the browser session. Ordinary policies receive
the same `GameObservation` and `GameEvent` values used by presentation.

The runner now recognizes committed gameplay termination. Worker concurrency,
reporting, Monte Carlo tooling, combat death, and gold remain outside this
slice.

## Run sequence

Create a runner with `createSimulationRunner(gameplayEngine)` and supply a
`SimulationRequest`. The runner performs these operations for each run:

1. Require `maxSteps` to be a positive safe integer.
2. Create a fresh policy agent and fresh engine state.
3. Pass the initial public observation and an empty event list to the first
   decision.
4. Step the engine with that decision's commands.
5. Pass the new observation and that step's events to the next decision.
6. Stop when the engine commits a terminal reason, or after `maxSteps` when no
   gameplay death occurs.

The included `nonProgressingPolicy` returns no commands and creates a new agent
for every run. It exists to prove that a policy which never reaches gameplay
termination still cannot hang a run or batch.

The engine reports authoritative lifecycle, running progression, and lifespan.
A policy that does not dismiss initial tutorial page 0 remains gated, so its
active-tick count, speed, distance, score, and lifespan stay unchanged while
`steps` still reaches the finite budget. Day starts at 1. Such a run returns
`step-limit`, which is a runner outcome rather than gameplay death.

A policy that dismisses page 0 and otherwise takes no action completes the
60-step pregame gate, then reaches lifespan death on active tick 2,500. The
runner stops at elapsed step 2,560 even when `maxSteps` is larger. It returns
terminal reason `lifespan` and copies the actual steps, active ticks, score,
day, and distance from the committed state. A smaller budget still returns
`step-limit`. Gold remains zero until the economy tickets implement it.

## Reproducible identity

Each result copies its ruleset, seed, normalized policy descriptor, and step
limit. It also contains a fingerprint of the initial profile. Canonical JSON
sorts object keys recursively, retains array order, normalizes negative zero,
preserves own object keys such as `__proto__`, and rejects non-finite numbers,
cycles, sparse arrays, and other non-JSON values. Result-owned policy configuration
and metrics are frozen copies, not live policy objects.

Fingerprints use SHA-256 over the UTF-8 bytes of canonical JSON and carry the
`sha256-v1` prefix. The trace uses the same digest and covers:

- the full normalized run inputs;
- the initial observation and authoritative state;
- every command list, emitted event list, resulting observation, and resulting
  authoritative state.

SHA-256 makes accidental collisions between experiment inputs impractical. The
versioned prefix allows a later digest or canonicalization change to remain
distinguishable from existing results.

This result trace identifies the complete simulation experiment. The optional
host-parity trace omits policy identity and the finite budget from its digest so
the browser can produce the same authoritative checkpoint hashes from an equal
run configuration and command schedule. See
[`gameplay-diagnostics.md`](gameplay-diagnostics.md).

## Minimal batches

`runBatch()` executes requests without shared state and returns results in
request order. The current implementation runs them sequentially. This fixes
observable ordering without selecting a worker or concurrency strategy for
later Monte Carlo work.

Supplying `onTrace` when creating a runner retains and reports structured
checkpoints for diagnosis. Ordinary runs without that callback retain only the
current checkpoint and continue to stream their experiment trace into the
result hash.
