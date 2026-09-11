import { expect, test } from "@playwright/test";
import type {
  GameEvent,
  PresentationFrame,
} from "../../src/application/contracts.js";
import { compareGameplayTraces } from "../../src/application/gameplay-execution.js";
import type * as EngineModule from "../../src/application/gameplay-engine.js";
import type * as SessionModule from "../../src/browser/gameplay-session.js";
import type * as CanvasModule from "../../src/browser/canvas-presentation.js";
import type * as RulesModule from "../../src/domain/rulesets.js";
import type * as PolicyModule from "../../src/simulation/combat-policy.js";
import type * as CanonicalModule from "../../src/application/canonical-json.js";
import type * as SimulationReportModule from "../../src/simulation/simulation-report.js";
import {
  combatLoopMaxSteps,
  combatLoopScenarios,
  runCombatLoop,
} from "../helpers/combat-loop.js";

for (const scenario of combatLoopScenarios) {
  test(`complete ${scenario.terminalReason} run matches Node across Canvas output settings`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const headless = runCombatLoop(scenario.seed);
    expect(headless.result).toMatchObject({
      terminalReason: scenario.terminalReason,
      steps: scenario.steps,
    });
    const schedule = headless.trace.checkpoints
      .slice(1)
      .map((checkpoint) => checkpoint.commands);
    const backingSizes = [];
    // Vary both skipped presentation ticks and additional redraws independently
    // of authoritative stepping.
    for (const output of [
      { width: 480, height: 640, dpr: 1, redraws: 0, renderEvery: 1 },
      { width: 640, height: 360, dpr: 2, redraws: 3, renderEvery: 5 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: output.width, height: output.height },
        deviceScaleFactor: output.dpr,
      });
      try {
        const page = await context.newPage();
        await page.goto("/?manual=1");
        const diagnostics = await page.evaluateHandle(
          async ({ config, schedule, maxSteps, redraws, renderEvery }) => {
            const enginePath = "/src/application/gameplay-engine.ts";
            const sessionPath = "/src/browser/gameplay-session.ts";
            const canvasPath = "/src/browser/canvas-presentation.ts";
            const rulesPath = "/src/domain/rulesets.ts";
            const policyPath = "/src/simulation/combat-policy.ts";
            const canonicalPath = "/src/application/canonical-json.ts";
            const reportPath = "/src/simulation/simulation-report.ts";
            const { createGameplayEngine } = (await import(
              enginePath
            )) as typeof EngineModule;
            const { createBrowserGameplaySession } = (await import(
              sessionPath
            )) as typeof SessionModule;
            const { CanvasPresentation } = (await import(
              canvasPath
            )) as typeof CanvasModule;
            const { ruleSetRegistry } = (await import(
              rulesPath
            )) as typeof RulesModule;
            const { createCombatPolicy } = (await import(
              policyPath
            )) as typeof PolicyModule;
            const { stringifyCanonicalJson, fingerprintCanonicalJson } =
              (await import(canonicalPath)) as typeof CanonicalModule;
            const { collectRunMetrics } = (await import(
              reportPath
            )) as typeof SimulationReportModule;
            const canvas = document.createElement("canvas");
            canvas.style.width = "100vw";
            canvas.style.height = "100vh";
            document.body.append(canvas);
            const engine = createGameplayEngine(ruleSetRegistry);
            const presentation = new CanvasPresentation(canvas);
            presentation.resize(
              { width: innerWidth, height: innerHeight },
              devicePixelRatio,
            );
            const session = createBrowserGameplaySession(engine, config, {
              present(frame: PresentationFrame) {
                if (frame.current.steps % renderEvery === 0)
                  presentation.present(frame);
              },
            });
            const policy = createCombatPolicy();
            const agent = policy.createAgent();
            let observation = engine.observe(engine.createRun(config));
            let events: readonly GameEvent[] = [];
            for (let step = 0; step < schedule.length; step++) {
              const commands = agent.decide(observation, events);
              if (JSON.stringify(commands) !== JSON.stringify(schedule[step])) {
                throw new Error(
                  `Public policy command mismatch at step ${step + 1}`,
                );
              }
              ({ observation, events } = session.dispatch(commands));
              for (let redraw = 0; redraw < redraws; redraw++) {
                session.render(((step + redraw) % 3) / 2);
              }
            }
            const trace = session.readDiagnostics();
            const initial = trace.checkpoints[0]!;
            const terminal = trace.checkpoints.at(-1)!.state;
            // Independently encode the RunResult trace with browser Web Crypto.
            // The Node runner owns its streaming node:crypto implementation.
            const record = (value: unknown) => {
              const json = stringifyCanonicalJson(value);
              return `${json.length}:${json}`;
            };
            const records = [
              record({
                schemaVersion: 2,
                ruleset: config.ruleset,
                seed: config.seed,
                initialProfile: config.initialProfile,
                policy: policy.descriptor,
                maxSteps,
              }),
              record({
                observation: initial.observation,
                state: initial.state,
              }),
            ];
            for (const {
              commands,
              events,
              observation,
              state,
            } of trace.checkpoints.slice(1)) {
              records.push(record({ commands, events, observation, state }));
            }
            const digest = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(records.join("")),
            );
            const traceHash =
              "sha256-v1:" +
              Array.from(new Uint8Array(digest), (byte) =>
                byte.toString(16).padStart(2, "0"),
              ).join("");
            const result = {
              schemaVersion: 3,
              ruleset: config.ruleset,
              seed: config.seed,
              initialProfileFingerprint: fingerprintCanonicalJson(
                config.initialProfile,
              ),
              policy: policy.descriptor,
              maxSteps,
              steps: terminal.steps,
              activeTicks: terminal.activeTicks,
              terminalReason: terminal.lifecycle.terminalReason,
              score: terminal.score,
              day: terminal.day,
              distance: terminal.distance,
              gold: terminal.player.gold,
              traceHash,
              metrics: collectRunMetrics(
                trace.checkpoints.flatMap(({ events }) => events),
                terminal,
              ),
            };
            return {
              trace,
              result,
              backingSize: { width: canvas.width, height: canvas.height },
              dpr: window.devicePixelRatio,
            };
          },
          {
            config: headless.trace.config,
            schedule,
            maxSteps: combatLoopMaxSteps,
            redraws: output.redraws,
            renderEvery: output.renderEvery,
          },
        );
        const summary = await diagnostics.evaluate(
          ({ trace, result, backingSize, dpr }) => ({
            schemaVersion: trace.schemaVersion,
            config: trace.config,
            traceHash: trace.traceHash,
            length: trace.checkpoints.length,
            result,
            backingSize,
            dpr,
          }),
        );
        expect(summary.result).toEqual(headless.result);
        expect(summary.traceHash).toBe(headless.trace.traceHash);
        expect(summary.length).toBe(headless.trace.checkpoints.length);
        expect(summary.dpr).toBe(output.dpr);
        backingSizes.push(summary.backingSize);
        // Compare every field, not only hashes. Small transfers keep a complete
        // long run inspectable and report the first divergent checkpoint path.
        for (let start = 0; start < summary.length; start += 250) {
          const checkpoints = await diagnostics.evaluate(
            ({ trace }, start) => trace.checkpoints.slice(start, start + 250),
            start,
          );
          const expected = {
            ...headless.trace,
            checkpoints: headless.trace.checkpoints.slice(start, start + 250),
          };
          const actual = {
            schemaVersion: summary.schemaVersion,
            config: summary.config,
            traceHash: summary.traceHash,
            checkpoints,
          };
          expect(
            compareGameplayTraces(expected, actual),
            `checkpoint block starting at ${start}`,
          ).toEqual({ equal: true });
        }
        await diagnostics.dispose();
      } finally {
        await context.close();
      }
    }
    expect(backingSizes[0]).not.toEqual(backingSizes[1]);
  });
}
