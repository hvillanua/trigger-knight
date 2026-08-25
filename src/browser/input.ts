import type { GameCommand } from "../application/contracts.js";

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);

/** Keeps the temporary manual clock control outside gameplay intent. */
export function commandsForAdvanceActivation(): readonly GameCommand[] {
  return NO_COMMANDS;
}
