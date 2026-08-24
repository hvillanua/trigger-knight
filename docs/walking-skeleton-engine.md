# Walking-skeleton gameplay engine

The first concrete gameplay engine is a clean-room architecture proof. Its
step counter and `step-advanced` event are milestone scaffolding, not claims
about Trigger Knight v1.3 behavior. Movement, active ticks, lifespan, pause,
tutorials, encounters, and combat remain deferred to their roadmap milestones.

## Deterministic transition

`gameplayEngine.createRun(config)` creates a serializable run with `steps` set
to zero. `walking-skeleton-v1` is the only supported ruleset identity at this
stage. `createRun`, `step`, and `observe` reject any other identity instead of
labeling the temporary transition or its observation as another ruleset. Each
`gameplayEngine.step(state, commands)` call returns a new state whose `steps`
value is one greater and one authoritative event:

```json
{
  "type": "step-advanced",
  "step": 1
}
```

The transition does not mutate its input state or command list and does not
draw from the run's random source. Repeating it with equal state and commands
therefore produces equal state and events.

`gameplayEngine.observe(state)` returns the single public player observation:
the ruleset identity and current step count. It omits the run's seeded random
state. State, results, events, event lists, and observations created by the
engine are frozen so callers cannot mutate authoritative values through the
returned object graph.

## Minimal browser path

The browser composition root creates the same `gameplayEngine` exported for
other hosts. A browser gameplay session owns its current `RunState` and sends
only `GameObservation` and `GameEvent` values through `PresentationPort`.
Activating the "Advance run" control maps to an `advance` `GameCommand`, steps
the shared engine, and presents the resulting observation and event.

`CanvasPresentation` draws the current public step and emitted event with
Canvas 2D. It retains the latest presentation frame so physical Canvas or
device-pixel-ratio changes can redraw that frame without stepping or inspecting
the engine. The browser session also accepts no presentation or a replacement
port; both cases produce the same public engine result for the same commands.
