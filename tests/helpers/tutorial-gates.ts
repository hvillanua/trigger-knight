import type {
  GameCommand,
  GameplayEngine,
  GameplayTrace,
  GameObservation,
} from "../../src/application/contracts.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);
const DISMISS_TUTORIAL: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "dismiss-tutorial" }),
]);
const PURCHASE: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "purchase-current-encounter" }),
]);
const USE_ITEM: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "use-carried-item" }),
]);

export interface TutorialGateScenarioResult {
  readonly trace: GameplayTrace;
  readonly tutorialPages: readonly number[];
}

function commandsFor(
  observation: Readonly<GameObservation>,
): readonly GameCommand[] {
  if (observation.actions.canDismissTutorial) return DISMISS_TUTORIAL;
  if (observation.actions.canUseCarriedItem) return USE_ITEM;
  if (
    observation.actions.canPurchaseCurrentEncounter &&
    observation.encounters.current?.kind === "shop"
  ) {
    return PURCHASE;
  }
  return NO_COMMANDS;
}

/** Runs the same public-observation policy in Node and Chromium. */
export function runTutorialGateScenario(
  engine: GameplayEngine,
  maxSteps = 2_200,
): TutorialGateScenarioResult {
  const session = createBrowserGameplaySession(
    engine,
    {
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "tutorial-gates-browser-parity",
      initialProfile: {
        schemaVersion: 1,
        scoreMultiplier: 1,
        tutorialPreference: "enabled",
      },
    },
    undefined,
    { retainDiagnostics: true },
  );
  let observation = session.readDiagnostics().checkpoints[0]!.observation;
  const tutorialPages: number[] = [];

  for (let step = 0; step < maxSteps; step += 1) {
    const page = observation.lifecycle.tutorialPage;
    if (page !== null && tutorialPages.at(-1) !== page) {
      tutorialPages.push(page);
    }

    const result = session.dispatch(commandsFor(observation));
    observation = result.observation;
    if (observation.lifecycle.terminalReason !== null) break;
  }

  return Object.freeze({
    trace: session.readDiagnostics(),
    tutorialPages: Object.freeze(tutorialPages),
  });
}
