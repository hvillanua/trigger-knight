import type {
  DismissTutorialCommand,
  EncounterQueueState,
  GameEvent,
  LifespanState,
  PlayerState,
  ProfileUnlockState,
  RandomState,
  RuleSetId,
  RunLifecycleState,
  RunState,
  TogglePauseCommand,
} from "./contracts.js";
import { createEncounterQueueState } from "./encounters.js";
import { createBattleState } from "./battle.js";
import { createPlayerState } from "./player-state.js";
import { createFreshProfile } from "./profile.js";

export const RUN_STATE_SCHEMA_VERSION = 16 as const;

/** Creates a fresh minimal state value for one independent run. */
export function createRunState(
  ruleset: RuleSetId,
  random: Readonly<RandomState>,
  pregameSteps: number,
  scoreMultiplier: number,
  initialMovementSpeed: number,
  initialLifespan: Readonly<LifespanState>,
  initialPlayer: Readonly<PlayerState>,
  initialEncounters: Readonly<EncounterQueueState>,
  initialUnlocks: Readonly<ProfileUnlockState> = createFreshProfile(),
): RunState {
  return Object.freeze({
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    ruleset,
    random: Object.freeze({ ...random }),
    steps: 0,
    activeTicks: 0,
    scoreMultiplier,
    movementSpeed: initialMovementSpeed,
    distance: 0,
    day: 1,
    score: 0,
    profileExpEarned: 0,
    dragonKills: 0,
    weaponDiscoveries: Object.freeze([...initialUnlocks.weaponDiscoveries]),
    armorDiscoveries: Object.freeze([...initialUnlocks.armorDiscoveries]),
    achievementSlots: Object.freeze([...initialUnlocks.achievementSlots]),
    lifespan: Object.freeze({ ...initialLifespan }),
    player: createPlayerState(initialPlayer),
    battle: null,
    encounters: createEncounterQueueState(initialEncounters),
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

export interface RunCommandResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Reports whether ordinary active-tick systems can advance. */
export function isActiveGameplay(
  lifecycle: Readonly<RunLifecycleState>,
): boolean {
  return (
    lifecycle.phase !== "ended" &&
    !lifecycle.paused &&
    lifecycle.tutorialPage === null &&
    lifecycle.pregameStepsRemaining === 0
  );
}

/** Applies one lifecycle command without advancing the logical opportunity. */
export function applyLifecycleCommand(
  state: Readonly<RunState>,
  command: Readonly<TogglePauseCommand | DismissTutorialCommand>,
): RunCommandResult {
  if (state.lifecycle.phase === "ended") {
    return Object.freeze({ state, events: Object.freeze([]) });
  }

  switch (command.type) {
    case "toggle-pause": {
      const paused = !state.lifecycle.paused;
      return Object.freeze({
        state: Object.freeze({
          ...state,
          lifecycle: Object.freeze({ ...state.lifecycle, paused }),
        }),
        events: Object.freeze([
          Object.freeze({ type: "pause-toggled", paused }),
        ]),
      });
    }
    case "dismiss-tutorial": {
      const tutorialPage = state.lifecycle.tutorialPage;
      if (tutorialPage === null) {
        return Object.freeze({ state, events: Object.freeze([]) });
      }

      return Object.freeze({
        state: Object.freeze({
          ...state,
          lifecycle: Object.freeze({ ...state.lifecycle, tutorialPage: null }),
        }),
        events: Object.freeze([
          Object.freeze({ type: "tutorial-dismissed", page: tutorialPage }),
        ]),
      });
    }
  }
}

/** Advances one fixed logical opportunity after commands have been applied. */
export function advanceRunState(state: Readonly<RunState>): RunStateStepResult {
  const gameplayGatesOpen =
    state.lifecycle.phase !== "ended" &&
    !state.lifecycle.paused &&
    state.lifecycle.tutorialPage === null;
  const pregameStepsRemaining =
    gameplayGatesOpen && state.lifecycle.pregameStepsRemaining > 0
      ? state.lifecycle.pregameStepsRemaining - 1
      : state.lifecycle.pregameStepsRemaining;
  const activeTicks = isActiveGameplay(state.lifecycle)
    ? state.activeTicks + 1
    : state.activeTicks;
  const nextState: RunState = Object.freeze({
    ...state,
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    random: Object.freeze({ ...state.random }),
    weaponDiscoveries: Object.freeze([...state.weaponDiscoveries]),
    armorDiscoveries: Object.freeze([...state.armorDiscoveries]),
    achievementSlots: Object.freeze([...state.achievementSlots]),
    player: createPlayerState(state.player),
    battle: state.battle === null ? null : createBattleState(state.battle),
    encounters: createEncounterQueueState(state.encounters),
    steps: state.steps + 1,
    activeTicks,
    lifecycle: Object.freeze({
      ...state.lifecycle,
      pregameStepsRemaining,
    }),
  });
  const stepEvent: GameEvent = Object.freeze({
    type: "step-advanced",
    step: nextState.steps,
  });

  return Object.freeze({
    state: nextState,
    events: Object.freeze([stepEvent]),
  });
}
