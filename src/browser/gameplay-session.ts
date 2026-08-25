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
  render(interpolation: number): void;
  readDiagnostics(): GameplayTrace;
}

export interface BrowserGameplaySessionOptions {
  readonly retainDiagnostics?: boolean;
}

function createFrame(
  previous: Readonly<GameObservation>,
  current: Readonly<GameObservation>,
  events: readonly GameEvent[],
  interpolation: number,
): PresentationFrame {
  const normalizedInterpolation = Number.isFinite(interpolation)
    ? Math.min(1, Math.max(0, interpolation))
    : 1;

  return Object.freeze({
    previous,
    current,
    interpolation: normalizedInterpolation,
    events,
  });
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
  let previousObservation = observation;
  let events: readonly GameEvent[] = Object.freeze([]);

  const render = (interpolation: number): void => {
    presentation?.present(
      createFrame(previousObservation, observation, events, interpolation),
    );
  };

  render(1);

  return Object.freeze({
    dispatch(commands: readonly GameCommand[]): BrowserDispatchResult {
      previousObservation = observation;
      const checkpoint = execution.dispatch(commands);
      observation = checkpoint.observation;
      events = checkpoint.events;
      render(0);

      return Object.freeze({
        observation,
        events: checkpoint.events,
      });
    },
    render,
    readDiagnostics: () => execution.readDiagnostics(),
  });
}
