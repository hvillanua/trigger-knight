import { expect, test } from "@playwright/test";

import type { PlayerPolicy } from "../../src/application/contracts.js";
import { gameplayEngine } from "../../src/application/gameplay-engine.js";
import type { GameplayTrace } from "../../src/application/gameplay-execution.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";

test("drives the shared engine through a semantic browser command", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-observation-step", "0");

  await page.getByRole("button", { name: "Advance run" }).click();

  await expect(page.getByTestId("game-status")).toHaveText("Step 1");
  await expect(canvas).toHaveAttribute("data-observation-step", "1");
  await expect(canvas).toHaveAttribute("data-events", "step-advanced:1");
});

test("physical Canvas size does not change the engine result", async ({
  browser,
}) => {
  const results = await Promise.all(
    [
      { width: 480, height: 640 },
      { width: 1280, height: 720 },
    ].map(async (viewport) => {
      const page = await browser.newPage({ viewport });

      try {
        await page.goto("/");
        const canvas = page.getByRole("img", {
          name: "Trigger Knight game view",
        });
        await expect(canvas).toHaveAttribute("data-observation-step", "0");
        await page.getByRole("button", { name: "Advance run" }).click();

        return await canvas.evaluate((element) => {
          if (!(element instanceof HTMLCanvasElement)) {
            throw new Error("Expected a Canvas element");
          }

          return {
            backingSize: {
              width: element.width,
              height: element.height,
            },
            observationStep: element.dataset.observationStep,
            events: element.dataset.events,
          };
        });
      } finally {
        await page.close();
      }
    }),
  );

  expect(results[0]?.backingSize).not.toEqual(results[1]?.backingSize);
  expect(
    results.map(({ observationStep, events }) => ({
      observationStep,
      events,
    })),
  ).toEqual([
    { observationStep: "1", events: "step-advanced:1" },
    { observationStep: "1", events: "step-advanced:1" },
  ]);
});

test("matches browser and headless diagnostic traces", async ({ page }) => {
  const headlessTraces: GameplayTrace[] = [];
  const policy: PlayerPolicy = {
    descriptor: { id: "advance-every-step", version: "1", config: {} },
    createAgent: () => ({ decide: () => [{ type: "advance" }] }),
  };
  const runner = createSimulationRunner(gameplayEngine, {
    onTrace: (trace) => headlessTraces.push(trace),
  });
  runner.run({
    config: {
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "browser-run",
      initialProfile: { schemaVersion: 1 },
    },
    policy,
    maxSteps: 3,
  });

  await page.goto("/");
  const advance = page.getByRole("button", { name: "Advance run" });
  await advance.click();
  await advance.click();
  await advance.click();

  const browserTrace = await page.evaluate(() =>
    window.triggerKnightDiagnostics?.read(),
  );

  expect(browserTrace).toBeDefined();
  expect(browserTrace).toEqual(headlessTraces[0]);
});
