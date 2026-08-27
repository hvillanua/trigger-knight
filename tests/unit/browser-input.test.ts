import { expect, it } from "vitest";

import {
  commandsForAdvanceActivation,
  commandsForPurchaseActivation,
} from "../../src/browser/input.js";

it("does not represent a manual engine step as gameplay intent", () => {
  const commands = commandsForAdvanceActivation();

  expect(commands).toEqual([]);
  expect(Object.isFrozen(commands)).toBe(true);
});

it("maps browser purchase activation to device-independent gameplay intent", () => {
  const commands = commandsForPurchaseActivation();

  expect(commands).toEqual([{ type: "purchase-current-encounter" }]);
  expect(Object.isFrozen(commands)).toBe(true);
  expect(Object.isFrozen(commands[0])).toBe(true);
  expect(commands[0]).not.toHaveProperty("price");
  expect(commands[0]).not.toHaveProperty("effect");
  expect(commands[0]).not.toHaveProperty("coordinate");
});
