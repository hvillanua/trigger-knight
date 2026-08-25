import type {
  GameCommand,
  GameEvent,
  GameObservation,
  ProfileState,
  RuleSetId,
  RunState,
} from "./contracts.js";
import { RANDOM_ALGORITHM } from "./random.js";
import { advanceRunningProgression } from "./running-progression.js";
import {
  advanceRunState,
  createRunState,
  isActiveGameplay,
} from "./run-state.js";

export const ORIGINAL_V13_RULESET_ID = "original-v1.3" as const;

export interface RuleSetConstants {
  readonly logicalTicksPerSecond: number;
  readonly pregameDelaySteps: number;
  readonly movement: {
    readonly initialSpeed: number;
    readonly accelerationPerActiveTick: number;
    readonly maximumSpeed: number;
    readonly distancePerSpeedUnit: number;
    readonly distancePerDay: number;
  };
  readonly runningScorePerSpeedUnit: number;
  readonly lifespan: {
    readonly initialWhole: number;
    readonly initialFraction: number;
    readonly drainPerActiveTick: number;
    readonly fractionReset: number;
    readonly deathBelowWhole: number;
  };
  readonly world: {
    readonly originalStageUnitsPerWorldUnit: number;
    readonly initialCameraWidth: number;
    readonly initialCameraHeight: number;
  };
}

export interface RuleSetCompatibilityDecisions {
  readonly randomSequence: typeof RANDOM_ALGORITHM;
  readonly randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order";
  readonly coordinateModel: "original-stage-units-as-world-units";
  readonly pregameDelayProgression: "after-commands-while-other-gates-open";
  readonly pregameDelayCountsAsActiveGameplay: false;
}

export interface RuleSetStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Pure gameplay implementation selected by one stable ruleset identity. */
export interface RuleSetImplementation {
  readonly id: RuleSetId;
  readonly constants: RuleSetConstants;
  readonly compatibilityDecisions: RuleSetCompatibilityDecisions;
  createRun(seed: string, initialProfile: Readonly<ProfileState>): RunState;
  step(
    state: Readonly<RunState>,
    commands: readonly GameCommand[],
  ): RuleSetStepResult;
  observe(state: Readonly<RunState>): GameObservation;
}

export interface RuleSetRegistry {
  readonly supportedIds: readonly RuleSetId[];
  resolve(id: RuleSetId): RuleSetImplementation;
}

const originalV13Constants: RuleSetConstants = Object.freeze({
  logicalTicksPerSecond: 30,
  pregameDelaySteps: 60,
  movement: Object.freeze({
    initialSpeed: 0,
    accelerationPerActiveTick: 1,
    maximumSpeed: 15,
    distancePerSpeedUnit: 1,
    distancePerDay: 7_000,
  }),
  runningScorePerSpeedUnit: 10,
  lifespan: Object.freeze({
    initialWhole: 99,
    initialFraction: 99,
    drainPerActiveTick: 4,
    fractionReset: 99,
    deathBelowWhole: 0,
  }),
  world: Object.freeze({
    originalStageUnitsPerWorldUnit: 1,
    initialCameraWidth: 480,
    initialCameraHeight: 320,
  }),
});

const originalV13CompatibilityDecisions: RuleSetCompatibilityDecisions =
  Object.freeze({
    randomSequence: RANDOM_ALGORITHM,
    randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order",
    coordinateModel: "original-stage-units-as-world-units",
    pregameDelayProgression: "after-commands-while-other-gates-open",
    pregameDelayCountsAsActiveGameplay: false,
  });

const originalV13RunningProgressionRules = Object.freeze({
  accelerationPerActiveTick:
    originalV13Constants.movement.accelerationPerActiveTick,
  maximumSpeed: originalV13Constants.movement.maximumSpeed,
  distancePerSpeedUnit: originalV13Constants.movement.distancePerSpeedUnit,
  distancePerDay: originalV13Constants.movement.distancePerDay,
  scorePerSpeedUnit: originalV13Constants.runningScorePerSpeedUnit,
});

export const originalV13RuleSet: RuleSetImplementation = Object.freeze({
  id: ORIGINAL_V13_RULESET_ID,
  constants: originalV13Constants,
  compatibilityDecisions: originalV13CompatibilityDecisions,

  createRun(seed: string, initialProfile: Readonly<ProfileState>): RunState {
    return createRunState(
      ORIGINAL_V13_RULESET_ID,
      seed,
      originalV13Constants.pregameDelaySteps,
      initialProfile.scoreMultiplier,
      originalV13Constants.movement.initialSpeed,
    );
  },

  step(
    state: Readonly<RunState>,
    commands: readonly GameCommand[],
  ): RuleSetStepResult {
    const result = advanceRunState(state, commands);

    return Object.freeze({
      state: advanceRunningProgression(
        state,
        result.state,
        originalV13RunningProgressionRules,
      ),
      events: result.events,
    });
  },

  observe(state: Readonly<RunState>): GameObservation {
    const lifecycle = Object.freeze({
      ...state.lifecycle,
      activeGameplay: isActiveGameplay(state.lifecycle),
    });
    const canAcceptLifecycleCommands = state.lifecycle.phase === "running";

    return Object.freeze({
      ruleset: state.ruleset,
      steps: state.steps,
      activeTicks: state.activeTicks,
      movementSpeed: state.movementSpeed,
      distance: state.distance,
      day: state.day,
      score: state.score,
      lifecycle,
      actions: Object.freeze({
        canTogglePause: canAcceptLifecycleCommands,
        canDismissTutorial:
          canAcceptLifecycleCommands && state.lifecycle.tutorialPage !== null,
      }),
    });
  },
});

/** Builds an immutable lookup boundary for independently versioned rulesets. */
export function createRuleSetRegistry(
  implementations: readonly RuleSetImplementation[],
): RuleSetRegistry {
  const byId = new Map<RuleSetId, RuleSetImplementation>();

  for (const implementation of implementations) {
    if (byId.has(implementation.id)) {
      throw new RangeError(`Duplicate ruleset "${implementation.id}"`);
    }

    byId.set(implementation.id, implementation);
  }

  const supportedIds = Object.freeze([...byId.keys()]);

  return Object.freeze({
    supportedIds,
    resolve(id: RuleSetId): RuleSetImplementation {
      const implementation = byId.get(id);

      if (implementation === undefined) {
        throw new RangeError(`Unsupported ruleset "${id}"`);
      }

      return implementation;
    },
  });
}

export const ruleSetRegistry = createRuleSetRegistry([originalV13RuleSet]);
