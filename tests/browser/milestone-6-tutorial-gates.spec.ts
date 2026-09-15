import { expect, test } from "@playwright/test";

import type * as GameplayEngineModule from "../../src/application/gameplay-engine.js";
import type * as RuleSetsModule from "../../src/domain/rulesets.js";
import type * as TutorialGateModule from "../helpers/tutorial-gates.js";
import { runTutorialGateScenario } from "../helpers/tutorial-gates.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

test("keeps contextual tutorial gates equivalent in Node and Chromium", async ({
  page,
}) => {
  const nodeResult = runTutorialGateScenario(createTestGameplayEngine());

  await page.goto("/?manual=1");
  const chromiumResult = await page.evaluate(async () => {
    const enginePath = "/src/application/gameplay-engine.ts";
    const rulesPath = "/src/domain/rulesets.ts";
    const helperPath = "/tests/helpers/tutorial-gates.ts";
    const [engineModule, rulesModule, helperModule] = await Promise.all([
      import(enginePath) as Promise<typeof GameplayEngineModule>,
      import(rulesPath) as Promise<typeof RuleSetsModule>,
      import(helperPath) as Promise<typeof TutorialGateModule>,
    ]);
    const engine = engineModule.createGameplayEngine(
      rulesModule.ruleSetRegistry,
    );
    const result = helperModule.runTutorialGateScenario(engine);

    return {
      trace: result.trace,
      tutorialPages: result.tutorialPages,
    };
  });

  expect(chromiumResult).toEqual(nodeResult);
  expect(nodeResult.tutorialPages).toEqual(expect.arrayContaining([0, 1, 3]));
});

test("displays and dismisses the initial public tutorial gate", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-tutorial-page", "0");

  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  await expect(canvas).not.toHaveAttribute("data-tutorial-page");
  await expect(canvas).toHaveAttribute("data-observation-step", "1");
  await expect(canvas).toHaveAttribute("data-movement-speed", "1");
  await expect(canvas).toHaveAttribute("data-distance", "1");
  await expect(canvas).toHaveAttribute("data-score", "10");
});
