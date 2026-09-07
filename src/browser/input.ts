import type { GameCommand } from "../application/contracts.js";
import {
  PURCHASE_CURRENT_ENCOUNTER_COMMANDS,
  USE_CARRIED_ITEM_COMMANDS,
} from "../application/commands.js";

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);

/** Keeps the temporary manual clock control outside gameplay intent. */
export function commandsForAdvanceActivation(): readonly GameCommand[] {
  return NO_COMMANDS;
}

export function commandsForPurchaseActivation(): readonly GameCommand[] {
  return PURCHASE_CURRENT_ENCOUNTER_COMMANDS;
}

export function commandsForItemUseActivation(): readonly GameCommand[] {
  return USE_CARRIED_ITEM_COMMANDS;
}
