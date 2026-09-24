import { expect, test } from "@playwright/test";

import type {
  GameplayTrace,
  RunConfig,
} from "../../src/application/contracts.js";
import type * as BrowserGameplaySessionModule from "../../src/browser/gameplay-session.js";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";
import { createGameplayEngine } from "../../src/application/gameplay-engine.js";
import type * as GameplayEngineModule from "../../src/application/gameplay-engine.js";
import type * as RuleSetsModule from "../../src/domain/rulesets.js";
import {
  ORIGINAL_V13_RULESET_ID,
  ruleSetRegistry,
} from "../../src/domain/rulesets.js";
import { purchasingPolicy } from "../../src/simulation/purchasing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";

const gameplayEngine = createGameplayEngine(ruleSetRegistry);

function config(seed: string): RunConfig {
  return {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed,
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  };
}

function runPolicy(seed: string): {
  readonly trace: GameplayTrace;
  readonly schedule: readonly GameplayTrace["checkpoints"][number]["commands"][];
} {
  let trace: GameplayTrace | undefined;
  const runner = createSimulationRunner(gameplayEngine, {
    onTrace: (candidate) => {
      trace = candidate;
    },
  });
  runner.run({ config: config(seed), policy: purchasingPolicy, maxSteps: 600 });

  if (trace === undefined) {
    throw new Error("Expected the purchasing-policy trace");
  }

  return {
    trace,
    schedule: trace.checkpoints.slice(1).map(({ commands }) => commands),
  };
}

test("exposes a disabled purchase activation until public eligibility allows it", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();

  await expect(
    page.getByRole("button", { name: "Purchase current shop" }),
  ).toBeDisabled();
});

test("matches Node and Chromium traces for a purchasing policy schedule", async ({
  page,
}) => {
  const seed = "m3-parity-schedule";
  const headless = runPolicy(seed);

  expect(
    headless.trace.checkpoints.some(({ events }) =>
      events.some((event) => event.type === "shop-purchased"),
    ),
  ).toBe(true);
  expect(
    headless.trace.checkpoints.some(({ events }) =>
      events.some((event) => event.type === "battle-started"),
    ),
  ).toBe(true);

  await page.goto("/?manual=1");
  const chromiumTrace = await page.evaluate(
    async ({ runConfig, schedule }) => {
      const enginePath = "/src/application/gameplay-engine.ts";
      const rulesPath = "/src/domain/rulesets.ts";
      const sessionPath = "/src/browser/gameplay-session.ts";
      const engineModule = (await import(
        enginePath
      )) as typeof GameplayEngineModule;
      const rulesModule = (await import(rulesPath)) as typeof RuleSetsModule;
      const sessionModule = (await import(
        sessionPath
      )) as typeof BrowserGameplaySessionModule;
      const engine = engineModule.createGameplayEngine(
        rulesModule.ruleSetRegistry,
      );
      const session = sessionModule.createBrowserGameplaySession(
        engine,
        runConfig,
        undefined,
        { retainDiagnostics: true },
      );

      for (const commands of schedule) {
        session.dispatch(commands);
      }

      session.render(0);
      session.render(0.5);
      session.render(1);
      return session.readDiagnostics();
    },
    { runConfig: config(seed), schedule: headless.schedule },
  );

  expect(chromiumTrace).toEqual(headless.trace);
  expect(chromiumTrace.traceHash).toBe(headless.trace.traceHash);
});

test("keeps policy outcomes fixed across Canvas size, DPR, and redraw cadence", async ({
  browser,
}) => {
  const seed = "m3-parity-schedule";
  const headless = runPolicy(seed);
  const viewports = [
    { width: 480, height: 640, deviceScaleFactor: 1 },
    { width: 1280, height: 720, deviceScaleFactor: 2 },
  ] as const;

  const results = await Promise.all(
    viewports.map(async (viewport, index) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
      });
      const page = await context.newPage();

      try {
        await page.goto("/?manual=1");
        await page.getByRole("button", { name: "Start run" }).click();
        return await page.evaluate(
          async ({ runConfig, schedule, redraws }) => {
            const enginePath = "/src/application/gameplay-engine.ts";
            const rulesPath = "/src/domain/rulesets.ts";
            const sessionPath = "/src/browser/gameplay-session.ts";
            const presentationPath = "/src/browser/canvas-presentation.ts";
            const engineModule = (await import(
              enginePath
            )) as typeof GameplayEngineModule;
            const rulesModule = (await import(
              rulesPath
            )) as typeof RuleSetsModule;
            const sessionModule = (await import(
              sessionPath
            )) as typeof BrowserGameplaySessionModule;
            const presentationModule = (await import(
              presentationPath
            )) as typeof CanvasPresentationModule;
            const canvas = document.querySelector("#game-canvas");
            if (!(canvas instanceof HTMLCanvasElement)) {
              throw new Error("Expected the game Canvas");
            }

            const engine = engineModule.createGameplayEngine(
              rulesModule.ruleSetRegistry,
            );
            const session = sessionModule.createBrowserGameplaySession(
              engine,
              runConfig,
              new presentationModule.CanvasPresentation(canvas),
              { retainDiagnostics: true },
            );

            for (const commands of schedule) {
              session.dispatch(commands);
              for (let redraw = 0; redraw < redraws; redraw += 1) {
                session.render(redraw / Math.max(1, redraws - 1));
              }
            }

            return {
              trace: session.readDiagnostics(),
              backingSize: { width: canvas.width, height: canvas.height },
            };
          },
          {
            runConfig: config(seed),
            schedule: headless.schedule,
            redraws: index === 0 ? 2 : 7,
          },
        );
      } finally {
        await context.close();
      }
    }),
  );

  expect(results[0]?.trace).toEqual(headless.trace);
  expect(results[1]?.trace).toEqual(headless.trace);
  expect(results[0]?.trace).toEqual(results[1]?.trace);
  expect(results[0]?.backingSize).not.toEqual(results[1]?.backingSize);
});
