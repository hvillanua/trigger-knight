import type { GameCommand } from "../application/contracts.js";
import {
  PURCHASE_CURRENT_ENCOUNTER_COMMANDS,
  USE_CARRIED_ITEM_COMMANDS,
} from "../application/commands.js";

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);
const DISMISS_TUTORIAL_COMMAND = Object.freeze({
  type: "dismiss-tutorial" as const,
});
const DISMISS_TUTORIAL_COMMANDS: readonly GameCommand[] = Object.freeze([
  DISMISS_TUTORIAL_COMMAND,
]);

/** Keeps the temporary manual clock control outside gameplay intent. */
export function commandsForAdvanceActivation(): readonly GameCommand[] {
  return NO_COMMANDS;
}

/** Maps the browser tutorial control to the shared semantic command. */
export function commandsForDismissTutorialActivation(): readonly GameCommand[] {
  return DISMISS_TUTORIAL_COMMANDS;
}

/** Maps a browser activation to the shared semantic purchase command. */
export function commandsForPurchaseActivation(): readonly GameCommand[] {
  return PURCHASE_CURRENT_ENCOUNTER_COMMANDS;
}

/** Maps a browser activation to the shared semantic item-use command. */
export function commandsForItemUseActivation(): readonly GameCommand[] {
  return USE_CARRIED_ITEM_COMMANDS;
}
