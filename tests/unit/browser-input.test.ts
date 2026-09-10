import { expect, it } from "vitest";

import {
  commandsForAdvanceActivation,
  commandsForDismissTutorialActivation,
  commandsForItemUseActivation,
  commandsForPurchaseActivation,
} from "../../src/browser/input.js";
import {
  PURCHASE_CURRENT_ENCOUNTER_COMMAND,
  USE_CARRIED_ITEM_COMMAND,
} from "../../src/application/commands.js";

it("does not represent a manual engine step as gameplay intent", () => {
  const commands = commandsForAdvanceActivation();

  expect(commands).toEqual([]);
  expect(Object.isFrozen(commands)).toBe(true);
});

it("maps the tutorial control to the shared dismissal command", () => {
  const commands = commandsForDismissTutorialActivation();

  expect(commands).toEqual([{ type: "dismiss-tutorial" }]);
  expect(Object.isFrozen(commands)).toBe(true);
  expect(Object.isFrozen(commands[0])).toBe(true);
});

it("maps browser purchase activation to device-independent gameplay intent", () => {
  const commands = commandsForPurchaseActivation();

  expect(commands).toEqual([{ type: "purchase-current-encounter" }]);
  expect(commands[0]).toBe(PURCHASE_CURRENT_ENCOUNTER_COMMAND);
  expect(Object.isFrozen(commands)).toBe(true);
  expect(Object.isFrozen(commands[0])).toBe(true);
  expect(commands[0]).not.toHaveProperty("price");
  expect(commands[0]).not.toHaveProperty("effect");
  expect(commands[0]).not.toHaveProperty("coordinate");
});

it("maps browser item-use activation to device-independent gameplay intent", () => {
  const commands = commandsForItemUseActivation();

  expect(commands).toEqual([{ type: "use-carried-item" }]);
  expect(commands[0]).toBe(USE_CARRIED_ITEM_COMMAND);
  expect(Object.isFrozen(commands)).toBe(true);
  expect(Object.isFrozen(commands[0])).toBe(true);
  expect(commands[0]).not.toHaveProperty("effect");
  expect(commands[0]).not.toHaveProperty("item");
});
