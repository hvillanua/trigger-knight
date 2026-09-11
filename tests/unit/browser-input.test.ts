import { expect, it } from "vitest";

import {
  commandsForAdvanceActivation,
  commandsForDismissTutorialActivation,
  commandsForItemUseActivation,
  commandsForPurchaseActivation,
  commandsForTogglePauseActivation,
  commandsForKeyboardActivation,
  createBindingCaptureController,
  findBindingConflict,
} from "../../src/browser/input.js";
import { createDefaultSettings } from "../../src/application/settings.js";
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

it("maps keyboard bindings only when the public action is eligible", () => {
  const settings = createDefaultSettings();
  const eligible = {
    canTogglePause: true,
    canDismissTutorial: false,
    canPurchaseCurrentEncounter: true,
    canUseCarriedItem: false,
  } as const;

  expect(
    commandsForKeyboardActivation(
      settings.bindings.togglePause,
      settings.bindings,
      eligible,
    ),
  ).toEqual(commandsForTogglePauseActivation());
  expect(
    commandsForKeyboardActivation(
      settings.bindings.dismissTutorial,
      settings.bindings,
      eligible,
    ),
  ).toEqual([]);
  expect(
    commandsForKeyboardActivation(
      settings.bindings.purchaseCurrentEncounter,
      settings.bindings,
      eligible,
    ),
  ).toEqual(commandsForPurchaseActivation());
});

it("captures remaps with cancellation and rejects conflicts", () => {
  const controller = createBindingCaptureController(
    createDefaultSettings().bindings,
  );

  controller.begin("purchaseCurrentEncounter");
  expect(controller.handleKeyDown("Escape")).toEqual({
    status: "cancelled",
    action: "purchaseCurrentEncounter",
  });
  expect(controller.activeAction()).toBeNull();

  controller.begin("purchaseCurrentEncounter");
  expect(controller.handleKeyDown("KeyP")).toEqual({
    status: "conflict",
    action: "purchaseCurrentEncounter",
    code: "KeyP",
    conflictingAction: "togglePause",
  });
  expect(controller.activeAction()).toBe("purchaseCurrentEncounter");

  expect(findBindingConflict(controller.bindings())).toBeNull();
  expect(controller.handleKeyDown("KeyQ")).toMatchObject({
    status: "captured",
    action: "purchaseCurrentEncounter",
    code: "KeyQ",
  });
  expect(controller.bindings().purchaseCurrentEncounter).toBe("KeyQ");
  expect(controller.activeAction()).toBeNull();
});
