# Gameplay parity diagnostics

The browser and headless hosts record the same structured execution trace around
`gameplayEngine`. Checkpoints include elapsed steps, active ticks, lifecycle
phase and gates, running speed, distance, day, score, public action eligibility,
and lifecycle command events. The initial profile's score multiplier remains in
authoritative state and does not enter the public observation.

## Checkpoints and hashes

`createGameplayExecution(engine, config)` records an initial checkpoint and one
checkpoint after every engine step. Each checkpoint contains:

- its ordered index;
- the normalized semantic command list used for the step;
- the complete authoritative `RunState`;
- the public `GameObservation`;
- the emitted `GameEvent` list;
- a versioned SHA-256 hash of those fields.

The initial checkpoint has index zero with empty command and event lists. A
trace contains the normalized run configuration, the ordered checkpoints, and
a SHA-256 hash of that configuration and the unhashed checkpoint fields. Hashes
use canonical JSON, so object insertion order cannot change their value. The
portable digest implementation returns the same `sha256-v1` value in Chromium
and Node.

`compareGameplayTraces(expected, actual)` compares configuration and checkpoint
fields before derived hashes. A mismatch reports a concrete path such as
`checkpoints[1].state.steps`, plus the expected and actual values. This makes the
first authoritative difference inspectable without relying on a Canvas image.

## Development and test access

`BrowserGameplaySession.readDiagnostics()` returns a frozen snapshot without
adding hidden state to player observations or presentation frames. During Vite
development and browser tests, `window.triggerKnightDiagnostics.read()` exposes
that snapshot to browser tooling. Production builds do not install the window
hook or retain checkpoint history.

`createSimulationRunner()` accepts an optional `onTrace` callback. When supplied,
the runner reports one trace after each run. Without the callback, the runner
keeps only its current checkpoint while its existing streaming result hasher
continues to cover the simulation inputs and steps. This avoids retaining a
full diagnostic history for ordinary batches.

The browser session and simulation runner both step through the same
application execution owner. Presentation remains optional. Replacing or
disabling it does not change checkpoint values or hashes.

## Checkpoint continuation

`RunState` remains plain serializable data. A host can JSON-serialize a current
checkpoint state, restore it, and pass it back to `gameplayEngine.step()`. The
checkpoint continuation test compares the restored transition, events, and
observation with uninterrupted execution.
