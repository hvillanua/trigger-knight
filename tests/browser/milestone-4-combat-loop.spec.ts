import { expect, test } from "@playwright/test";
import type {
  GameEvent,
  GameplayTrace,
  PresentationFrame,
  RunResult,
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
  combatLoopPresentationProbeMaxSteps,
  combatLoopScenarios,
  runCombatLoop,
} from "../helpers/combat-loop.js";

// The compatibility corpus owns the fixed full combat-death replay. Keep the
// distinct lifespan completion here and use the combat run for bounded output
// variation.
const fullRunScenario = combatLoopScenarios.find(
  (scenario) => scenario.terminalReason === "lifespan",
)!;
const combatScenario = combatLoopScenarios.find(
  (scenario) => scenario.terminalReason === "combat",
)!;

const fullRunOutput = {
  width: 640,
  height: 360,
  dpr: 2,
  redraws: 3,
  renderEvery: 5,
} as const;

const combatProbeOutputs = [
  { width: 480, height: 640, dpr: 1, redraws: 0, renderEvery: 1 },
  { width: 640, height: 360, dpr: 2, redraws: 3, renderEvery: 5 },
] as const;

interface BrowserCombatSummary {
  readonly schemaVersion: GameplayTrace["schemaVersion"];
  readonly config: GameplayTrace["config"];
  readonly traceHash: string;
  readonly length: number;
  readonly result: RunResult;
  readonly backingSize: { readonly width: number; readonly height: number };
  readonly dpr: number;
  readonly renderedFrames: number;
}

async function runBrowserCombatScenario(
  page: import("@playwright/test").Page,
  headless: ReturnType<typeof runCombatLoop>,
  output: {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly redraws: number;
    readonly renderEvery: number;
  },
  label: string,
): Promise<BrowserCombatSummary> {
  const schedule = headless.trace.checkpoints
    .slice(1)
    .map((checkpoint) => checkpoint.commands);
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
      let renderedFrames = 0;
      const session = createBrowserGameplaySession(
        engine,
        config,
        {
          present(frame: PresentationFrame) {
            if (frame.current.steps % renderEvery !== 0) return;
            renderedFrames += 1;
            presentation.present(frame);
          },
        },
        { retainDiagnostics: true },
      );
      const policy = createCombatPolicy();
      const agent = policy.createAgent();
      let observation = engine.observe(engine.createRun(config));
      let events: readonly GameEvent[] = [];
      for (let step = 0; step < schedule.length; step += 1) {
        const commands = agent.decide(observation, events);
        if (JSON.stringify(commands) !== JSON.stringify(schedule[step])) {
          throw new Error(`Public policy command mismatch at step ${step + 1}`);
        }
        ({ observation, events } = session.dispatch(commands));
        for (let redraw = 0; redraw < redraws; redraw += 1) {
          session.render(((step + redraw) % 3) / 2);
        }
      }
      const trace = session.readDiagnostics();
      const initial = trace.checkpoints[0]!;
      const terminal = trace.checkpoints.at(-1)!.state;
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
        record({ observation: initial.observation, state: initial.state }),
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
        terminalReason: terminal.lifecycle.terminalReason ?? "step-limit",
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
        renderedFrames,
      };
    },
    {
      config: headless.trace.config,
      schedule,
      maxSteps: headless.result.maxSteps,
      redraws: output.redraws,
      renderEvery: output.renderEvery,
    },
  );

  try {
    const summary = (await diagnostics.evaluate(
      ({ trace, result, backingSize, dpr, renderedFrames }) => ({
        schemaVersion: trace.schemaVersion,
        config: trace.config,
        traceHash: trace.traceHash,
        length: trace.checkpoints.length,
        result,
        backingSize,
        dpr,
        renderedFrames,
      }),
    )) as BrowserCombatSummary;
    expect(summary.result, `${label} result`).toEqual(headless.result);
    expect(summary.traceHash, `${label} trace`).toBe(headless.trace.traceHash);
    expect(summary.length, `${label} checkpoint count`).toBe(
      headless.trace.checkpoints.length,
    );
    expect(summary.dpr, `${label} DPR`).toBe(output.dpr);
    for (let start = 0; start < summary.length; start += 250) {
      const checkpoints = JSON.parse(
        await diagnostics.evaluate(
          ({ trace }, offset) =>
            JSON.stringify(trace.checkpoints.slice(offset, offset + 250)),
          start,
        ),
      ) as GameplayTrace["checkpoints"];
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
        `${label} checkpoint block starting at ${start}`,
      ).toEqual({ equal: true });
    }
    return summary;
  } finally {
    await diagnostics.dispose();
  }
}

test("complete lifespan run matches Node through Canvas", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const headless = runCombatLoop(fullRunScenario.seed);
  expect(headless.result).toMatchObject({
    terminalReason: fullRunScenario.terminalReason,
    steps: fullRunScenario.steps,
  });
  const context = await browser.newContext({
    viewport: {
      width: fullRunOutput.width,
      height: fullRunOutput.height,
    },
    deviceScaleFactor: fullRunOutput.dpr,
  });

  try {
    const page = await context.newPage();
    await page.goto("/?manual=1");
    const summary = await runBrowserCombatScenario(
      page,
      headless,
      fullRunOutput,
      "lifespan full run",
    );
    expect(summary.backingSize).toEqual({
      width: fullRunOutput.width * fullRunOutput.dpr,
      height: fullRunOutput.height * fullRunOutput.dpr,
    });
    expect(summary.renderedFrames).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test("bounded combat transitions match Node across Canvas output settings", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const headless = runCombatLoop(
    combatScenario.seed,
    combatLoopPresentationProbeMaxSteps,
  );
  expect(headless.result).toMatchObject({
    terminalReason: "step-limit",
    steps: combatLoopPresentationProbeMaxSteps,
  });
  const eventTypes = new Set(
    headless.trace.checkpoints.flatMap(({ events }) =>
      events.map((event) => event.type),
    ),
  );
  expect([...eventTypes]).toEqual(
    expect.arrayContaining([
      "tutorial-dismissed",
      "shop-purchased",
      "battle-started",
      "battle-reward",
      "item-used",
    ]),
  );

  const summaries: BrowserCombatSummary[] = [];
  for (const output of combatProbeOutputs) {
    const context = await browser.newContext({
      viewport: { width: output.width, height: output.height },
      deviceScaleFactor: output.dpr,
    });
    try {
      const page = await context.newPage();
      await page.goto("/?manual=1");
      summaries.push(
        await runBrowserCombatScenario(
          page,
          headless,
          output,
          `bounded combat ${output.width}x${output.height}@${output.dpr}`,
        ),
      );
    } finally {
      await context.close();
    }
  }

  expect(summaries[0]?.backingSize).not.toEqual(summaries[1]?.backingSize);
  expect(summaries.every(({ renderedFrames }) => renderedFrames > 0)).toBe(
    true,
  );
});
