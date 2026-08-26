import type {
  GameCommand,
  GameEvent,
  LifespanState,
  RuleSetId,
  RunLifecycleState,
  RunState,
} from "./contracts.js";
import { createRandomState } from "./random.js";

export const RUN_STATE_SCHEMA_VERSION = 4 as const;

/** Creates a fresh minimal state value for one independent run. */
export function createRunState(
  ruleset: RuleSetId,
  seed: string,
  pregameSteps: number,
  scoreMultiplier: number,
  initialMovementSpeed: number,
  initialLifespan: Readonly<LifespanState>,
): RunState {
  return Object.freeze({
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    ruleset,
    random: createRandomState(seed),
    steps: 0,
    activeTicks: 0,
    scoreMultiplier,
    movementSpeed: initialMovementSpeed,
    distance: 0,
    day: 1,
    score: 0,
    lifespan: Object.freeze({ ...initialLifespan }),
    lifecycle: Object.freeze({
      phase: "running",
      terminalReason: null,
      paused: false,
      tutorialPage: 0,
      pregameStepsRemaining: pregameSteps,
    }),
  });
}

export interface RunStateStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Reports whether ordinary active-tick systems can advance. */
export function isActiveGameplay(
  lifecycle: Readonly<RunLifecycleState>,
): boolean {
  return (
    lifecycle.phase === "running" &&
    !lifecycle.paused &&
    lifecycle.tutorialPage === null &&
    lifecycle.pregameStepsRemaining === 0
  );
}

function processCommands(
  lifecycle: Readonly<RunLifecycleState>,
  commands: readonly GameCommand[],
): Readonly<{
  lifecycle: RunLifecycleState;
  events: readonly GameEvent[];
}> {
  if (lifecycle.phase === "ended") {
    return Object.freeze({ lifecycle, events: Object.freeze([]) });
  }

  let paused = lifecycle.paused;
  let tutorialPage = lifecycle.tutorialPage;
  const events: GameEvent[] = [];

  for (const command of commands) {
    switch (command.type) {
      case "toggle-pause":
        paused = !paused;
        events.push(Object.freeze({ type: "pause-toggled", paused }));
        break;
      case "dismiss-tutorial":
        if (tutorialPage !== null) {
          events.push(
            Object.freeze({ type: "tutorial-dismissed", page: tutorialPage }),
          );
          tutorialPage = null;
        }
        break;
    }
  }

  return Object.freeze({
    lifecycle: Object.freeze({ ...lifecycle, paused, tutorialPage }),
    events: Object.freeze(events),
  });
}

/** Processes commands and advances one fixed logical opportunity. */
export function advanceRunState(
  state: Readonly<RunState>,
  commands: readonly GameCommand[],
): RunStateStepResult {
  const commandResult = processCommands(state.lifecycle, commands);
  const gameplayGatesOpen =
    commandResult.lifecycle.phase === "running" &&
    !commandResult.lifecycle.paused &&
    commandResult.lifecycle.tutorialPage === null;
  const pregameStepsRemaining =
    gameplayGatesOpen && commandResult.lifecycle.pregameStepsRemaining > 0
      ? commandResult.lifecycle.pregameStepsRemaining - 1
      : commandResult.lifecycle.pregameStepsRemaining;
  const activeTicks = isActiveGameplay(commandResult.lifecycle)
    ? state.activeTicks + 1
    : state.activeTicks;
  const nextState: RunState = Object.freeze({
    ...state,
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    random: Object.freeze({ ...state.random }),
    steps: state.steps + 1,
    activeTicks,
    lifecycle: Object.freeze({
      ...commandResult.lifecycle,
      pregameStepsRemaining,
    }),
  });
  const stepEvent: GameEvent = Object.freeze({
    type: "step-advanced",
    step: nextState.steps,
  });

  return Object.freeze({
    state: nextState,
    events: Object.freeze([...commandResult.events, stepEvent]),
  });
}
