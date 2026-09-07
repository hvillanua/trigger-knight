import type {
  GameCommand,
  GameplayEngine,
  GameplayTrace,
  PlayerPolicy,
  PresentationPort,
  RunConfig,
} from "../../src/application/contracts.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";

export const originalLifecycleConfig: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "milestone-2-lifecycle-2",
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

export const ORIGINAL_LIFECYCLE_TERMINAL_STEP = 2_564;

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);
const DISMISS_TUTORIAL: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "dismiss-tutorial" }),
]);
const TOGGLE_PAUSE: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "toggle-pause" }),
]);

export function commandsForOriginalLifecycleStep(
  step: number,
): readonly GameCommand[] {
  if (step === 2) {
    return DISMISS_TUTORIAL;
  }

  if (step === 72 || step === 75) {
    return TOGGLE_PAUSE;
  }

  return NO_COMMANDS;
}

export const originalLifecyclePolicy: PlayerPolicy = Object.freeze({
  descriptor: Object.freeze({
    id: "milestone-2-lifecycle",
    version: "1",
    config: Object.freeze({}),
  }),
  createAgent: () => {
    let step = 0;

    return Object.freeze({
      decide: () => commandsForOriginalLifecycleStep((step += 1)),
    });
  },
});

export interface OriginalLifecycleScenarioOptions {
  readonly presentation?: PresentationPort;
  readonly afterDispatch?: (step: number) => void;
  readonly interpolationsForStep?: (step: number) => readonly number[];
}

export function runOriginalLifecycleScenario(
  engine: GameplayEngine,
  options: OriginalLifecycleScenarioOptions = {},
): GameplayTrace {
  const session = createBrowserGameplaySession(
    engine,
    originalLifecycleConfig,
    options.presentation,
  );

  for (let step = 1; step <= ORIGINAL_LIFECYCLE_TERMINAL_STEP; step += 1) {
    const result = session.dispatch(commandsForOriginalLifecycleStep(step));
    options.afterDispatch?.(step);
    for (const interpolation of options.interpolationsForStep?.(step) ?? []) {
      session.render(interpolation);
    }

    if (result.observation.lifecycle.terminalReason !== null) {
      break;
    }
  }

  return session.readDiagnostics();
}
