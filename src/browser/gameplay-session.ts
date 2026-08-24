import type {
  GameCommand,
  GameEvent,
  GameObservation,
  GameplayEngine,
  GameplayTrace,
  PresentationFrame,
  PresentationPort,
  RunConfig,
} from "../application/contracts.js";
import { createGameplayExecution } from "../application/gameplay-execution.js";

export interface BrowserDispatchResult {
  readonly observation: Readonly<GameObservation>;
  readonly events: readonly GameEvent[];
}

export interface BrowserGameplaySession {
  dispatch(commands: readonly GameCommand[]): BrowserDispatchResult;
  readDiagnostics(): GameplayTrace;
}

export interface BrowserGameplaySessionOptions {
  readonly retainDiagnostics?: boolean;
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
  options: BrowserGameplaySessionOptions = {},
): BrowserGameplaySession {
  const execution = createGameplayExecution(engine, config, options);
  let observation = execution.readCurrentCheckpoint().observation;

  presentation?.present(
    createFrame(observation, observation, Object.freeze([])),
  );

  return Object.freeze({
    dispatch(commands: readonly GameCommand[]): BrowserDispatchResult {
      const previous = observation;
      const checkpoint = execution.dispatch(commands);
      observation = checkpoint.observation;
      presentation?.present(
        createFrame(previous, observation, checkpoint.events),
      );

      return Object.freeze({
        observation,
        events: checkpoint.events,
      });
    },
    readDiagnostics: () => execution.readDiagnostics(),
  });
}
