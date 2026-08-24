import type { GameCommand } from "../application/contracts.js";

const ADVANCE_COMMANDS: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "advance" }),
]);

/** Maps the browser's Advance control to device-independent gameplay intent. */
export function commandsForAdvanceActivation(): readonly GameCommand[] {
  return ADVANCE_COMMANDS;
}
