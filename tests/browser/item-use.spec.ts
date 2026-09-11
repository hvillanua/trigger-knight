import { expect, test } from "@playwright/test";

import type * as GameplayEngineModule from "../../src/application/gameplay-engine.js";
import type { RunConfig, RunState } from "../../src/application/contracts.js";
import type * as BrowserInputModule from "../../src/browser/input.js";
import type * as RuleSetsModule from "../../src/domain/rulesets.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

function activeBattleState(): RunState {
  const config: RunConfig = {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "browser-item-use",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  };
  const engine = createTestGameplayEngine();
  const initial = engine.createRun(config);
  const queuedBattle = initial.encounters.upcoming.find(
    (encounter) => encounter.kind === "battle",
  );

  if (queuedBattle === undefined || queuedBattle.kind !== "battle") {
    throw new Error("Expected a queued battle fixture");
  }

  return engine.step(
    {
      ...initial,
      movementSpeed: 15,
      encounters: {
        ...initial.encounters,
        current: { ...queuedBattle, x: 421 },
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    },
    [],
  ).state;
}

test("browser item-use input shares the domain command and outcome", async ({
  page,
}) => {
  const battleState = activeBattleState();
  const state: RunState = {
    ...battleState,
    player: {
      ...battleState.player,
      hp: { ...battleState.player.hp, current: 1 },
    },
  };
  const nodeEngine = createTestGameplayEngine();
  const nodeCommands = [{ type: "use-carried-item" }] as const;
  const nodeResult = nodeEngine.step(state, nodeCommands);
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
    const commands = inputModule.commandsForItemUseActivation();
    const result = engine.step(inputState, commands);

    return {
      commands,
      result,
      observation: engine.observe(result.state),
    };
  }, state);

  expect(chromium.commands).toEqual(nodeCommands);
  expect(chromium.result).toEqual(nodeResult);
  expect(chromium.observation).toEqual(nodeObservation);
  expect(chromium.result.state.player).toMatchObject({
    hp: { current: 1_908 },
    inventory: { item: null },
  });
  expect(chromium.result.events).toContainEqual({
    type: "item-used",
    item: "elixir",
  });
});
