import type { GameCommand } from "../domain/contracts.js";

export const DISMISS_TUTORIAL_COMMAND = Object.freeze({
  type: "dismiss-tutorial",
} as const satisfies GameCommand);

export const PURCHASE_CURRENT_ENCOUNTER_COMMAND = Object.freeze({
  type: "purchase-current-encounter",
} as const satisfies GameCommand);

export const DISMISS_TUTORIAL_COMMANDS: readonly GameCommand[] = Object.freeze([
  DISMISS_TUTORIAL_COMMAND,
]);

export const PURCHASE_CURRENT_ENCOUNTER_COMMANDS: readonly GameCommand[] =
  Object.freeze([PURCHASE_CURRENT_ENCOUNTER_COMMAND]);
