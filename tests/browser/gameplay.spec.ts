import { expect, test } from "@playwright/test";

import type { PlayerPolicy } from "../../src/application/contracts.js";
import type { GameplayTrace } from "../../src/application/gameplay-execution.js";
import { createFreshProfile } from "../../src/domain/profile.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

test("drives one fixed shared-engine step from the browser", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-observation-step", "0");
  await expect(canvas).toHaveAttribute("data-movement-speed", "0");
  await expect(canvas).toHaveAttribute("data-distance", "0");
  await expect(canvas).toHaveAttribute("data-day", "1");
  await expect(canvas).toHaveAttribute("data-score", "0");

  await page.getByRole("button", { name: "Advance run" }).click();

  await expect(page.getByTestId("game-status")).toHaveText("Step 1");
  await expect(canvas).toHaveAttribute("data-observation-step", "1");
  await expect(canvas).toHaveAttribute("data-events", "step-advanced:1");
  await expect(canvas).toHaveAttribute("data-interpolation", "1");
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
        await page.goto("/?manual=1");
        await page.getByRole("button", { name: "Start run" }).click();
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
            movementSpeed: element.dataset.movementSpeed,
            distance: element.dataset.distance,
            day: element.dataset.day,
            score: element.dataset.score,
          };
        });
      } finally {
        await page.close();
      }
    }),
  );

  expect(results[0]?.backingSize).not.toEqual(results[1]?.backingSize);
  expect(
    results.map(
      ({ observationStep, events, movementSpeed, distance, day, score }) => ({
        observationStep,
        events,
        movementSpeed,
        distance,
        day,
        score,
      }),
    ),
  ).toEqual([
    {
      observationStep: "1",
      events: "step-advanced:1",
      movementSpeed: "0",
      distance: "0",
      day: "1",
      score: "0",
    },
    {
      observationStep: "1",
      events: "step-advanced:1",
      movementSpeed: "0",
      distance: "0",
      day: "1",
      score: "0",
    },
  ]);
});

test("matches browser and headless diagnostic traces", async ({ page }) => {
  const headlessTraces: GameplayTrace[] = [];
  const policy: PlayerPolicy = {
    descriptor: { id: "no-commands", version: "1", config: {} },
    createAgent: () => ({ decide: () => [] }),
  };
  const runner = createSimulationRunner(gameplayEngine, {
    onTrace: (trace) => headlessTraces.push(trace),
  });
  runner.run({
    config: {
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "browser-run",
      initialProfile: createFreshProfile(),
      startImmediately: true,
    },
    policy,
    maxSteps: 3,
  });

  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();
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
