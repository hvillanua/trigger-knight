import { expect, it } from "vitest";

import { commandsForAdvanceActivation } from "../../src/browser/input.js";

it("maps an Advance control activation to a semantic gameplay command", () => {
  const commands = commandsForAdvanceActivation();

  expect(commands).toEqual([{ type: "advance" }]);
  expect(Object.isFrozen(commands)).toBe(true);
  expect(Object.isFrozen(commands[0])).toBe(true);
});
