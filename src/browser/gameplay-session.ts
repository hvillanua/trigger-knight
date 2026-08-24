import type {
  GameCommand,
  GameEvent,
  GameObservation,
  GameplayEngine,
  PresentationFrame,
  PresentationPort,
  RunConfig,
} from "../application/contracts.js";

export interface BrowserDispatchResult {
  readonly observation: Readonly<GameObservation>;
  readonly events: readonly GameEvent[];
}

export interface BrowserGameplaySession {
  dispatch(commands: readonly GameCommand[]): BrowserDispatchResult;
}

function createFrame(
  previous: Readonly<GameObservation>,
  current: Readonly<GameObservation>,
  events: readonly GameEvent[],
): PresentationFrame {
  return Object.freeze({ previous, current, interpolation: 1, events });
}

/** Owns authoritative state while exposing only public values to the browser. */
export function createBrowserGameplaySession(
  engine: GameplayEngine,
  config: RunConfig,
  presentation?: PresentationPort,
): BrowserGameplaySession {
  let state = engine.createRun(config);
  let observation = engine.observe(state);

  presentation?.present(
    createFrame(observation, observation, Object.freeze([])),
  );

  return Object.freeze({
    dispatch(commands: readonly GameCommand[]): BrowserDispatchResult {
      const previous = observation;
      const result = engine.step(state, commands);
      state = result.state;
      observation = engine.observe(state);
      presentation?.present(createFrame(previous, observation, result.events));

      return Object.freeze({
        observation,
        events: result.events,
      });
    },
  });
}
