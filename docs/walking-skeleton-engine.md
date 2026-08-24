# Walking-skeleton gameplay engine

The first concrete gameplay engine is a clean-room architecture proof. Its
step counter and `step-advanced` event are milestone scaffolding, not claims
about Trigger Knight v1.3 behavior. Movement, active ticks, lifespan, pause,
tutorials, encounters, and combat remain deferred to their roadmap milestones.

## Deterministic transition

`gameplayEngine.createRun(config)` creates a serializable run with `steps` set
to zero. Each `gameplayEngine.step(state, commands)` call returns a new state
whose `steps` value is one greater and one authoritative event:

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
