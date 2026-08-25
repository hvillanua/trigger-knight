import { expect, it } from "vitest";

import { commandsForAdvanceActivation } from "../../src/browser/input.js";

it("does not represent a manual engine step as gameplay intent", () => {
  const commands = commandsForAdvanceActivation();

  expect(commands).toEqual([]);
  expect(Object.isFrozen(commands)).toBe(true);
});
