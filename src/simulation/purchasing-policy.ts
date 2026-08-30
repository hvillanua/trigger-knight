import type {
  GameCommand,
  GameEvent,
  GameObservation,
  PlayerAgent,
  PlayerPolicy,
  PolicyDescriptor,
} from "../application/contracts.js";
import {
  DISMISS_TUTORIAL_COMMANDS,
  PURCHASE_CURRENT_ENCOUNTER_COMMANDS,
} from "../application/commands.js";

const descriptor: PolicyDescriptor = Object.freeze({
  id: "purchase-reachable-shops",
  version: "1",
  config: Object.freeze({}),
});

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);

function decide(
  observation: Readonly<GameObservation>,
  events: readonly GameEvent[],
): readonly GameCommand[] {
  if (events.some((event) => event.type === "run-ended")) {
    return NO_COMMANDS;
  }

  if (observation.actions.canDismissTutorial) {
    return DISMISS_TUTORIAL_COMMANDS;
  }

  if (
    observation.actions.canPurchaseCurrentEncounter &&
    observation.encounters.current?.kind === "shop"
  ) {
    return PURCHASE_CURRENT_ENCOUNTER_COMMANDS;
  }

  return NO_COMMANDS;
}

/** Buys every shop that the public observation says is currently eligible. */
export const purchasingPolicy: PlayerPolicy = Object.freeze({
  descriptor,
  createAgent(): PlayerAgent {
    return Object.freeze({ decide });
  },
});
