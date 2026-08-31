import { expect, test } from "@playwright/test";

import type {
  GameplayTrace,
  RunState,
} from "../../src/application/contracts.js";
import type * as CanonicalJsonModule from "../../src/application/canonical-json.js";
import type * as GameplayEngineModule from "../../src/application/gameplay-engine.js";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";
import type * as RuleSetsModule from "../../src/domain/rulesets.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import type * as OriginalLifecycleModule from "../helpers/original-lifecycle.js";
import {
  originalLifecycleConfig,
  originalLifecyclePolicy,
} from "../helpers/original-lifecycle.js";

test("proves the complete lifecycle across Node, Chromium, and Canvas variants", async ({
  page,
}) => {
  const headlessTraces: GameplayTrace[] = [];
  const runner = createSimulationRunner(createTestGameplayEngine(), {
    onTrace: (trace) => headlessTraces.push(trace),
  });
  const result = runner.run({
    config: originalLifecycleConfig,
    policy: originalLifecyclePolicy,
    maxSteps: 3_000,
  });
  const headlessTrace = headlessTraces[0];
  if (headlessTrace === undefined) {
    throw new Error("Expected a headless lifecycle trace");
  }

  await page.goto("/");
  const chromium = await page.evaluate(async () => {
    const enginePath = "/src/application/gameplay-engine.ts";
    const rulesPath = "/src/domain/rulesets.ts";
    const presentationPath = "/src/browser/canvas-presentation.ts";
    const lifecyclePath = "/tests/helpers/original-lifecycle.ts";
    const canonicalJsonPath = "/src/application/canonical-json.ts";
    const engineModule = (await import(
      enginePath
    )) as typeof GameplayEngineModule;
    const rulesModule = (await import(rulesPath)) as typeof RuleSetsModule;
    const presentationModule = (await import(
      presentationPath
    )) as typeof CanvasPresentationModule;
    const lifecycleModule = (await import(
      lifecyclePath
    )) as typeof OriginalLifecycleModule;
    const canonicalJsonModule = (await import(
      canonicalJsonPath
    )) as typeof CanonicalJsonModule;
    const engine = engineModule.createGameplayEngine(
      rulesModule.ruleSetRegistry,
    );
    const trace = lifecycleModule.runOriginalLifecycleScenario(engine);
    const terminal = trace.checkpoints.at(-1);
    if (terminal === undefined) {
      throw new Error("Expected a Chromium terminal checkpoint");
    }

    const boundaries = [
      trace.checkpoints.find(
        ({ state }) => state.lifecycle.tutorialPage === 0 && state.steps === 1,
      ),
      trace.checkpoints.find(
        ({ state }) =>
          state.lifecycle.pregameStepsRemaining === 0 &&
          state.activeTicks === 0,
      ),
      trace.checkpoints.find(
        ({ state }) => state.lifecycle.paused && state.steps === 72,
      ),
      trace.checkpoints.find(
        ({ state }) =>
          state.lifespan.whole === 98 && state.lifespan.fraction === 99,
      ),
      trace.checkpoints.find(
        ({ state }) =>
          state.activeTicks === 2_499 && state.lifespan.whole === 0,
      ),
    ];
    const restoredCheckpointsMatch = boundaries.map((boundary) => {
      if (boundary === undefined) {
        return false;
      }

      let state = JSON.parse(JSON.stringify(boundary.state)) as RunState;
      let events = boundary.events;
      for (const expected of trace.checkpoints.slice(boundary.index + 1)) {
        const transition = engine.step(state, expected.commands);
        state = transition.state;
        events = transition.events;
      }

      const observation = engine.observe(state);
      const checkpointHash = canonicalJsonModule.fingerprintCanonicalJson({
        index: terminal.index,
        commands: terminal.commands,
        state,
        observation,
        events,
      });
      return (
        canonicalJsonModule.stringifyCanonicalJson(state) ===
          canonicalJsonModule.stringifyCanonicalJson(terminal.state) &&
        canonicalJsonModule.stringifyCanonicalJson(observation) ===
          canonicalJsonModule.stringifyCanonicalJson(terminal.observation) &&
        canonicalJsonModule.stringifyCanonicalJson(events) ===
          canonicalJsonModule.stringifyCanonicalJson(terminal.events) &&
        checkpointHash === terminal.checkpointHash
      );
    });

    const variants = [
      {
        css: { width: 480, height: 320 },
        devicePixelRatio: 1,
        renderEvery: 1,
        interpolations: [1],
      },
      {
        css: { width: 640, height: 360 },
        devicePixelRatio: 2,
        renderEvery: 2,
        interpolations: [0.5, 1],
      },
      {
        css: { width: 360, height: 480 },
        devicePixelRatio: 1.5,
        renderEvery: 5,
        interpolations: [0.25, 0.75, 1],
      },
    ].map((variant) => {
      const canvas = document.createElement("canvas");
      const presentation = new presentationModule.CanvasPresentation(canvas);
      presentation.resize(variant.css, variant.devicePixelRatio);
      const variantTrace = lifecycleModule.runOriginalLifecycleScenario(
        engine,
        {
          presentation,
          afterDispatch(step) {
            if (step === 1_200) {
              presentation.resize(
                {
                  width: variant.css.height,
                  height: variant.css.width,
                },
                variant.devicePixelRatio,
              );
            }
          },
          interpolationsForStep: (step) =>
            step % variant.renderEvery === 0 ? variant.interpolations : [],
        },
      );
      const variantTerminal = variantTrace.checkpoints.at(-1);

      return {
        traceHash: variantTrace.traceHash,
        checkpointHash: variantTerminal?.checkpointHash,
        state: variantTerminal?.state,
        events: variantTerminal?.events,
        backingSize: { width: canvas.width, height: canvas.height },
        projectionViewport: canvas.dataset.projectionViewport,
      };
    });

    return { trace, restoredCheckpointsMatch, variants };
  });

  expect(chromium.trace).toEqual(headlessTrace);
  expect(chromium.restoredCheckpointsMatch).toEqual([
    true,
    true,
    true,
    true,
    true,
  ]);

  const terminal = headlessTrace.checkpoints.at(-1);
  expect(terminal).toBeDefined();
  expect(
    chromium.variants.map(({ traceHash, checkpointHash, state, events }) => ({
      traceHash,
      checkpointHash,
      state,
      events,
    })),
  ).toEqual(
    Array.from({ length: 3 }, () => ({
      traceHash: headlessTrace.traceHash,
      checkpointHash: terminal?.checkpointHash,
      state: terminal?.state,
      events: terminal?.events,
    })),
  );
  expect(
    new Set(chromium.variants.map(({ backingSize }) => backingSize.width)).size,
  ).toBeGreaterThan(1);
  expect(
    chromium.variants.every(
      ({ projectionViewport }) => projectionViewport !== undefined,
    ),
  ).toBe(true);
  expect(result).toMatchObject({
    steps: 2_564,
    activeTicks: 2_500,
    terminalReason: "lifespan",
    score: 31_350,
    day: 1,
    distance: 3_135,
  });
});
