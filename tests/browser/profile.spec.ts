import { expect, test } from "@playwright/test";
import type * as EngineModule from "../../src/application/gameplay-engine.js";
import type * as ExecutionModule from "../../src/application/gameplay-execution.js";
import type * as RulesModule from "../../src/domain/rulesets.js";
import { createFreshProfile } from "../../src/domain/profile.js";
import { createGameplayExecution } from "../../src/application/gameplay-execution.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

test("retains an explicit complete profile with identical browser and headless traces", async ({
  page,
}) => {
  const config = {
    ruleset: "original-v1.3",
    seed: "complete-profile",
    initialProfile: {
      ...createFreshProfile(),
      level: 4,
      xp: 150,
      highScore: 12345.5,
      scoreMultiplier: 1.4,
      weaponDiscoveries: [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      achievementSlots: [true, false, false, false, false, false],
    },
  };
  const execution = createGameplayExecution(createTestGameplayEngine(), config);
  execution.dispatch([{ type: "dismiss-tutorial" }]);
  for (let i = 0; i < 100; i += 1) execution.dispatch([]);
  await page.goto("/");
  const browserTrace = await page.evaluate(async (input) => {
    const enginePath = "/src/application/gameplay-engine.ts";
    const executionPath = "/src/application/gameplay-execution.ts";
    const rulesPath = "/src/domain/rulesets.ts";
    const { createGameplayEngine } = (await import(
      enginePath
    )) as typeof EngineModule;
    const { createGameplayExecution } = (await import(
      executionPath
    )) as typeof ExecutionModule;
    const { ruleSetRegistry } = (await import(rulesPath)) as typeof RulesModule;
    const execution = createGameplayExecution(
      createGameplayEngine(ruleSetRegistry),
      input,
    );
    execution.dispatch([{ type: "dismiss-tutorial" }]);
    for (let i = 0; i < 100; i += 1) execution.dispatch([]);
    return execution.readDiagnostics();
  }, config);
  expect(browserTrace).toEqual(execution.readDiagnostics());
  expect(browserTrace.config.initialProfile).toEqual(config.initialProfile);
});
