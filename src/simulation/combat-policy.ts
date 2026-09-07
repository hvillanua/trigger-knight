import type {
  GameCommand,
  GameEvent,
  GameObservation,
  PlayerPolicy,
  PolicyDescriptor,
} from "../application/contracts.js";
import {
  DISMISS_TUTORIAL_COMMANDS,
  PURCHASE_CURRENT_ENCOUNTER_COMMANDS,
  USE_CARRIED_ITEM_COMMANDS,
} from "../application/commands.js";

export interface CombatPolicyConfig {
  readonly elixirHpFraction?: number;
}

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);

/** Buys eligible shops and saves Elixir until HP reaches the configured fraction. */
export function createCombatPolicy(
  config: CombatPolicyConfig = {},
): PlayerPolicy {
  const elixirHpFraction = config.elixirHpFraction ?? 0.5;
  if (
    !Number.isFinite(elixirHpFraction) ||
    elixirHpFraction < 0 ||
    elixirHpFraction > 1
  ) {
    throw new RangeError("elixirHpFraction must be between 0 and 1");
  }
  const descriptor: PolicyDescriptor = Object.freeze({
    id: "combat-shopper",
    version: "1",
    config: Object.freeze({ elixirHpFraction }),
  });

  function decide(
    observation: Readonly<GameObservation>,
    events: readonly GameEvent[],
  ): readonly GameCommand[] {
    if (events.some((event) => event.type === "run-ended")) return NO_COMMANDS;
    if (observation.actions.canDismissTutorial)
      return DISMISS_TUTORIAL_COMMANDS;
    if (
      observation.actions.canUseCarriedItem &&
      (observation.player.inventory.item !== "elixir" ||
        observation.player.hp.current <=
          observation.player.hp.maximum * elixirHpFraction)
    ) {
      return USE_CARRIED_ITEM_COMMANDS;
    }
    if (
      observation.actions.canPurchaseCurrentEncounter &&
      observation.encounters.current?.kind === "shop"
    ) {
      return PURCHASE_CURRENT_ENCOUNTER_COMMANDS;
    }
    return NO_COMMANDS;
  }

  return Object.freeze({
    descriptor,
    createAgent: () => Object.freeze({ decide }),
  });
}
