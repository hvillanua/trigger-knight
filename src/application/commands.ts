import type { GameCommand } from "../domain/contracts.js";

export const TOGGLE_PAUSE_COMMAND = Object.freeze({
  type: "toggle-pause",
} as const satisfies GameCommand);

export const DISMISS_TUTORIAL_COMMAND = Object.freeze({
  type: "dismiss-tutorial",
} as const satisfies GameCommand);

export const PURCHASE_CURRENT_ENCOUNTER_COMMAND = Object.freeze({
  type: "purchase-current-encounter",
} as const satisfies GameCommand);

export const DISMISS_TUTORIAL_COMMANDS: readonly GameCommand[] = Object.freeze([
  DISMISS_TUTORIAL_COMMAND,
]);

export const TOGGLE_PAUSE_COMMANDS: readonly GameCommand[] = Object.freeze([
  TOGGLE_PAUSE_COMMAND,
]);

export const PURCHASE_CURRENT_ENCOUNTER_COMMANDS: readonly GameCommand[] =
  Object.freeze([PURCHASE_CURRENT_ENCOUNTER_COMMAND]);

export const USE_CARRIED_ITEM_COMMAND = Object.freeze({
  type: "use-carried-item",
} as const satisfies GameCommand);

export const USE_CARRIED_ITEM_COMMANDS: readonly GameCommand[] = Object.freeze([
  USE_CARRIED_ITEM_COMMAND,
]);
