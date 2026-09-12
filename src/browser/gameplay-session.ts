import type {
  CompletedRunSettlementInput,
  GameCommand,
  GameEvent,
  GameObservation,
  GameplayEngine,
  GameplayTrace,
  PresentationFrame,
  PresentationPort,
  RunConfig,
} from "../application/contracts.js";
import { completedRunSettlementFromState } from "../application/completed-run.js";
import { createGameplayExecution } from "../application/gameplay-execution.js";

/** @playerVisible One completed logical transition, identified by observation.steps. */
export interface BrowserDispatchResult {
  readonly observation: Readonly<GameObservation>;
  readonly events: readonly GameEvent[];
}

export interface BrowserGameplaySession {
  dispatch(commands: readonly GameCommand[]): BrowserDispatchResult;
  readObservation(): Readonly<GameObservation>;
  render(interpolation: number): void;
  readDiagnostics(): GameplayTrace;
}

export interface BrowserGameplaySessionOptions {
  readonly retainDiagnostics?: boolean;
  readonly renderOnDispatch?: boolean;
  /** Each logical transition, once and in order. Render calls never repeat it. */
  readonly onTransition?: (result: BrowserDispatchResult) => void;
  /** Runs before the terminal checkpoint is presented. */
  readonly onCompletedRun?: (
    run: Readonly<CompletedRunSettlementInput>,
  ) => void;
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
  // Display rendering can lag behind logical dispatch. Keep the public event
  // sequence intact until the presentation consumes it.
  let pendingPresentationEvents: GameEvent[] = [];
  let lastPresentedEvents: readonly GameEvent[] = Object.freeze([]);

  const render = (interpolation: number): void => {
    const frameEvents =
      presentation === undefined
        ? events
        : pendingPresentationEvents.length > 0
          ? Object.freeze([...pendingPresentationEvents])
          : lastPresentedEvents;
    if (presentation !== undefined && pendingPresentationEvents.length > 0) {
      lastPresentedEvents = frameEvents;
      pendingPresentationEvents = [];
    }
    presentation?.present(
      createFrame(previousObservation, observation, frameEvents, interpolation),
    );
  };

  render(1);

  return Object.freeze({
    readObservation: () => observation,
    dispatch(commands: readonly GameCommand[]): BrowserDispatchResult {
      previousObservation = observation;
      const checkpoint = execution.dispatch(commands);
      observation = checkpoint.observation;
      events = checkpoint.events;
      if (presentation !== undefined) {
        pendingPresentationEvents.push(...checkpoint.events);
      }
      const completedRun = completedRunSettlementFromState(checkpoint.state);
      if (completedRun !== undefined) {
        options.onCompletedRun?.(completedRun);
      }
      const result = Object.freeze({ observation, events: checkpoint.events });
      options.onTransition?.(result);
      if (options.renderOnDispatch ?? true) render(0);
      return result;
    },
    render,
    readDiagnostics: () => execution.readDiagnostics(),
  });
}
