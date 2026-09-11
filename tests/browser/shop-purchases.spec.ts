import { expect, test } from "@playwright/test";

import type * as GameplayEngineModule from "../../src/application/gameplay-engine.js";
import type { RunState } from "../../src/application/contracts.js";
import type * as BrowserInputModule from "../../src/browser/input.js";
import type * as RuleSetsModule from "../../src/domain/rulesets.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

function purchasableState(): RunState {
  const state = createTestGameplayEngine().createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "browser-purchase-parity",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });

  return {
    ...state,
    movementSpeed: 0,
    player: { ...state.player, gold: 200 },
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop: "grims-shop",
        cachedPrice: 200,
        x: 200,
        used: false,
      },
    },
    lifecycle: {
      ...state.lifecycle,
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
  };
}

test("browser input uses the shared purchase command and domain outcome", async ({
  page,
}) => {
  const state = purchasableState();
  const command = [{ type: "purchase-current-encounter" }] as const;
  const nodeEngine = createTestGameplayEngine();
  const nodeResult = nodeEngine.step(state, command);
  const nodeObservation = nodeEngine.observe(nodeResult.state);

  await page.goto("/?manual=1");
  const chromium = await page.evaluate(async (inputState) => {
    const enginePath = "/src/application/gameplay-engine.ts";
    const inputPath = "/src/browser/input.ts";
    const rulesPath = "/src/domain/rulesets.ts";
    const engineModule = (await import(
      enginePath
    )) as typeof GameplayEngineModule;
    const inputModule = (await import(inputPath)) as typeof BrowserInputModule;
    const rulesModule = (await import(rulesPath)) as typeof RuleSetsModule;
    const engine = engineModule.createGameplayEngine(
      rulesModule.ruleSetRegistry,
    );
    const commands = inputModule.commandsForPurchaseActivation();
    const result = engine.step(inputState, commands);

    return {
      commands,
      result,
      observation: engine.observe(result.state),
    };
  }, state);

  expect(chromium.commands).toEqual(command);
  expect(chromium.result).toEqual(nodeResult);
  expect(chromium.observation).toEqual(nodeObservation);
  expect(chromium.result.state.player).toMatchObject({
    gold: 0,
    inventory: { item: "divine-edge" },
  });
  expect(chromium.result.events).toContainEqual({
    type: "shop-purchased",
    shop: "grims-shop",
    price: 200,
  });
});
