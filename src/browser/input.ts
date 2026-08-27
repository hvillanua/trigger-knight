import type { GameCommand } from "../application/contracts.js";

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);
const PURCHASE_CURRENT_ENCOUNTER: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "purchase-current-encounter" }),
]);

/** Keeps the temporary manual clock control outside gameplay intent. */
export function commandsForAdvanceActivation(): readonly GameCommand[] {
  return NO_COMMANDS;
}

/** Maps a browser activation to the shared semantic purchase command. */
export function commandsForPurchaseActivation(): readonly GameCommand[] {
  return PURCHASE_CURRENT_ENCOUNTER;
}
