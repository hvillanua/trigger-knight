import { expect, test } from "@playwright/test";

import type {
  GameEvent,
  GameplayTrace,
  PlayerPolicy,
  PresentationFrame,
  ProfileState,
  RunConfig,
  RunResult,
} from "../../src/application/contracts.js";
import type * as CanonicalJsonModule from "../../src/application/canonical-json.js";
import type * as CompletedRunModule from "../../src/application/completed-run.js";
import type * as GameplayEngineModule from "../../src/application/gameplay-engine.js";
import type * as BrowserGameplaySessionModule from "../../src/browser/gameplay-session.js";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";
import { createGameplayEngine } from "../../src/application/gameplay-engine.js";
import { completedRunSettlementFromState } from "../../src/application/completed-run.js";
import { settleCompletedRun } from "../../src/domain/profile.js";
import type * as ProfileModule from "../../src/domain/profile.js";
import type * as RulesModule from "../../src/domain/rulesets.js";
import { ruleSetRegistry } from "../../src/domain/rulesets.js";
import { createCombatPolicy } from "../../src/simulation/combat-policy.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";
import { purchasingPolicy } from "../../src/simulation/purchasing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { originalLifecyclePolicy } from "../helpers/original-lifecycle.js";
import {
  compareGameplayTraceBlock,
  COMPATIBILITY_CHECKPOINT_BLOCK_SIZE,
} from "../helpers/compatibility-corpus.js";
import type * as OriginalLifecycleModule from "../helpers/original-lifecycle.js";
import type * as CombatPolicyModule from "../../src/simulation/combat-policy.js";
import type * as NonProgressingPolicyModule from "../../src/simulation/non-progressing-policy.js";
import type * as PurchasingPolicyModule from "../../src/simulation/purchasing-policy.js";
import type * as SimulationReportModule from "../../src/simulation/simulation-report.js";
import {
  originalV13CompatibilityRuns,
  originalV13CompatibilitySettlements,
  summarizeCheckpoint,
  tutorialPages,
  toOriginalV13BaselineResult,
  type CompatibilityPolicyKey,
  type OriginalV13CompatibilityRun,
  type OriginalV13CompatibilitySettlement,
} from "../fixtures/original-v13-compatibility.js";

const OBSERVATION_KEYS = [
  "actions",
  "activeTicks",
  "battle",
  "camera",
  "day",
  "distance",
  "encounters",
  "lifecycle",
  "lifespan",
  "movementSpeed",
  "player",
  "ruleset",
  "score",
  "steps",
];

const VARIANTS = [
  {
    name: "reference-output",
    viewport: { width: 480, height: 320 },
    deviceScaleFactor: 1,
    renderEvery: 1,
    redraws: 1,
    ambientProfile: {
      level: 2,
      xp: 7,
      scoreMultiplier: 1.2,
      highScore: 222,
      tutorialPreference: "disabled" as const,
    },
  },
  {
    name: "responsive-output",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    renderEvery: 11,
    redraws: 4,
    ambientProfile: {
      level: 8,
      xp: 31,
      scoreMultiplier: 1.8,
      highScore: 888_888,
      tutorialPreference: "enabled" as const,
    },
  },
] as const;

function policyFor(key: CompatibilityPolicyKey): PlayerPolicy {
  switch (key) {
    case "original-lifecycle":
      return originalLifecyclePolicy;
    case "combat-shopper":
      return createCombatPolicy({ elixirHpFraction: 0.5 });
    case "non-progressing":
      return nonProgressingPolicy;
    case "purchasing":
      return purchasingPolicy;
  }
}

function runNodeFixture(fixture: OriginalV13CompatibilityRun): {
  readonly result: RunResult;
  readonly trace: GameplayTrace;
} {
  let trace: GameplayTrace | undefined;
  const policy = policyFor(fixture.policy.key);
  const result = createSimulationRunner(nodeGameplayEngine, {
    onTrace: (value) => {
      trace = value;
    },
  }).run({
    config: fixture.config,
    policy,
    maxSteps: fixture.maxSteps,
  });

  if (trace === undefined) {
    throw new Error(`Expected a retained Node trace for ${fixture.id}`);
  }

  return { result, trace };
}

function assertFixedBaseline(
  fixture: OriginalV13CompatibilityRun,
  result: RunResult,
  trace: GameplayTrace,
): void {
  expect(result.schemaVersion, `${fixture.id} Node result schema`).toBe(3);
  expect(
    toOriginalV13BaselineResult(result),
    `${fixture.id} Node result`,
  ).toEqual(fixture.expected.result);
  expect(trace.traceHash, `${fixture.id} Node trace`).toBe(
    fixture.expected.traceHash,
  );
  expect(tutorialPages(trace)).toEqual(fixture.expected.tutorialPages);

  for (const expected of fixture.expected.checkpoints) {
    const actual = trace.checkpoints[expected.index];
    expect(
      actual,
      `missing Node checkpoint ${fixture.id}:${expected.index}`,
    ).toBeDefined();
    expect(summarizeCheckpoint(actual!)).toEqual(expected);
  }

  const terminal = trace.checkpoints.at(-1)?.state;
  expect(terminal, `${fixture.id} terminal state`).toBeDefined();
  if (fixture.expected.completedProfile !== undefined) {
    const settlement = completedRunSettlementFromState(terminal!);
    expect(settlement, `${fixture.id} settlement`).toBeDefined();
    expect(
      settleCompletedRun(fixture.config.initialProfile, settlement!),
    ).toEqual(fixture.expected.completedProfile);
  }
}

function assertFixedSettlementBaselines(): void {
  for (const fixture of originalV13CompatibilitySettlements) {
    let profile: ProfileState | undefined;
    for (let index = 0; index < fixture.runs.length; index += 1) {
      profile = settleCompletedRun(
        fixture.initialProfiles[index]!,
        fixture.runs[index]!,
      );
      expect(profile).toEqual(fixture.expectedProfiles[index]);
    }
  }
}

function toStorageEnvelope(
  profile: (typeof VARIANTS)[number]["ambientProfile"],
) {
  return {
    schemaVersion: 3,
    profile: {
      schemaVersion: 2,
      level: profile.level,
      xp: profile.xp,
      scoreMultiplier: profile.scoreMultiplier,
      highScore: profile.highScore,
      weaponDiscoveries: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      armorDiscoveries: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      achievementSlots: [false, false, false, false, false, false],
    },
    settings: { tutorialPreference: profile.tutorialPreference },
    completedRuns: [],
  };
}

const nodeGameplayEngine = createGameplayEngine(ruleSetRegistry);

interface BrowserCorpusSummary {
  readonly schemaVersion: GameplayTrace["schemaVersion"];
  readonly config: RunConfig;
  readonly traceHash: string;
  readonly length: number;
  readonly result: RunResult;
  readonly completedProfile: unknown;
  readonly policyObservationShapes: readonly string[];
  readonly hiddenObservationKeys: readonly string[];
  readonly hiddenEventKeys: readonly string[];
  readonly initialObservationKeys: readonly string[];
  readonly presentation: {
    readonly backingSize: { readonly width: number; readonly height: number };
    readonly renderedFrames: number;
    readonly presentationKeys: readonly string[];
  };
}

async function runBrowserFixture(
  page: import("@playwright/test").Page,
  fixture: OriginalV13CompatibilityRun,
  variant: (typeof VARIANTS)[number],
  nodeTrace: GameplayTrace,
) {
  return page.evaluateHandle(
    async ({
      config,
      policyKey,
      policyConfig,
      maxSteps,
      schedule,
      variant,
    }) => {
      const enginePath = "/src/application/gameplay-engine.ts";
      const sessionPath = "/src/browser/gameplay-session.ts";
      const presentationPath = "/src/browser/canvas-presentation.ts";
      const canonicalPath = "/src/application/canonical-json.ts";
      const lifecyclePath = "/tests/helpers/original-lifecycle.ts";
      const combatPath = "/src/simulation/combat-policy.ts";
      const nonProgressingPath = "/src/simulation/non-progressing-policy.ts";
      const purchasingPath = "/src/simulation/purchasing-policy.ts";
      const completedRunPath = "/src/application/completed-run.ts";
      const profilePath = "/src/domain/profile.ts";
      const reportPath = "/src/simulation/simulation-report.ts";
      const rulesPath = "/src/domain/rulesets.ts";
      const engineModule = (await import(
        enginePath
      )) as typeof GameplayEngineModule;
      const sessionModule = (await import(
        sessionPath
      )) as typeof BrowserGameplaySessionModule;
      const presentationModule = (await import(
        presentationPath
      )) as typeof CanvasPresentationModule;
      const canonicalModule = (await import(
        canonicalPath
      )) as typeof CanonicalJsonModule;
      const lifecycleModule = (await import(
        lifecyclePath
      )) as typeof OriginalLifecycleModule;
      const combatModule = (await import(
        combatPath
      )) as typeof CombatPolicyModule;
      const nonProgressingModule = (await import(
        nonProgressingPath
      )) as typeof NonProgressingPolicyModule;
      const purchasingModule = (await import(
        purchasingPath
      )) as typeof PurchasingPolicyModule;
      const completedRunModule = (await import(
        completedRunPath
      )) as typeof CompletedRunModule;
      const profileModule = (await import(profilePath)) as typeof ProfileModule;
      const reportModule = (await import(
        reportPath
      )) as typeof SimulationReportModule;
      const rulesModule = (await import(rulesPath)) as typeof RulesModule;

      const engine = engineModule.createGameplayEngine(
        rulesModule.ruleSetRegistry,
      );
      const policy = (() => {
        switch (policyKey) {
          case "original-lifecycle":
            return lifecycleModule.originalLifecyclePolicy;
          case "combat-shopper":
            return combatModule.createCombatPolicy({
              elixirHpFraction: (
                policyConfig as { readonly elixirHpFraction: number }
              ).elixirHpFraction,
            });
          case "non-progressing":
            return nonProgressingModule.nonProgressingPolicy;
          case "purchasing":
            return purchasingModule.purchasingPolicy;
        }
      })();
      const canvas = document.createElement("canvas");
      const presentation = new presentationModule.CanvasPresentation(canvas);
      presentation.resize(
        { width: innerWidth, height: innerHeight },
        devicePixelRatio,
      );
      let renderedFrames = 0;
      const session = sessionModule.createBrowserGameplaySession(
        engine,
        config,
        {
          present(frame: PresentationFrame) {
            if (frame.current.steps % variant.renderEvery !== 0) return;
            renderedFrames += 1;
            presentation.present(frame);
          },
        },
      );
      document.body.append(canvas);

      let observation = session.readDiagnostics().checkpoints[0]!.observation;
      let events: readonly GameEvent[] = [];
      const agent = policy.createAgent();
      const policyObservationShapes = new Set<string>();
      const hiddenObservationKeys = new Set<string>();
      const hiddenEventKeys = new Set<string>();

      for (let step = 0; step < maxSteps; step += 1) {
        policyObservationShapes.add(Object.keys(observation).sort().join(","));
        for (const key of ["random", "tutorials", "scoreMultiplier"]) {
          if (Object.hasOwn(observation, key)) hiddenObservationKeys.add(key);
        }
        for (const event of events) {
          for (const key of ["random", "tutorials", "state"]) {
            if (Object.hasOwn(event, key)) hiddenEventKeys.add(key);
          }
        }
        const commands = agent.decide(observation, events);
        const expectedCommands = schedule[step] ?? [];
        if (
          canonicalModule.stringifyCanonicalJson(commands) !==
          canonicalModule.stringifyCanonicalJson(expectedCommands)
        ) {
          throw new Error(`Policy command mismatch at step ${step + 1}`);
        }
        const result = session.dispatch(commands);
        observation = result.observation;
        events = result.events;
        if (observation.lifecycle.terminalReason !== null) break;

        if (step === Math.floor(maxSteps / 2)) {
          presentation.resize(
            { width: innerHeight, height: innerWidth },
            devicePixelRatio,
          );
        }
        for (let redraw = 0; redraw < variant.redraws; redraw += 1) {
          session.render(((step + redraw) % 4) / 3);
        }
      }

      const trace = session.readDiagnostics();
      const initial = trace.checkpoints[0]!;
      const terminal = trace.checkpoints.at(-1)!.state;
      const record = (value: unknown): string => {
        const json = canonicalModule.stringifyCanonicalJson(value);
        return `${json.length}:${json}`;
      };
      const records = [
        record({
          schemaVersion: 2,
          ruleset: trace.config.ruleset,
          seed: trace.config.seed,
          initialProfile: trace.config.initialProfile,
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
      const settlement =
        completedRunModule.completedRunSettlementFromState(terminal);
      const completedProfile =
        settlement === undefined
          ? null
          : profileModule.settleCompletedRun(
              trace.config.initialProfile,
              settlement,
            );
      const browserResult = {
        schemaVersion: 3,
        ruleset: trace.config.ruleset,
        seed: trace.config.seed,
        initialProfileFingerprint: canonicalModule.fingerprintCanonicalJson(
          trace.config.initialProfile,
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
        metrics: reportModule.collectRunMetrics(
          trace.checkpoints.flatMap(({ events }) => events),
          terminal,
        ),
      };
      const presentationKeys = Object.keys(canvas.dataset).filter((key) =>
        ["random", "tutorials", "state"].includes(key),
      );
      const initialObservationKeys = Object.keys(initial.observation).sort();
      canvas.remove();
      return {
        trace,
        result: browserResult,
        completedProfile,
        initialObservationKeys,
        policyObservationShapes: [...policyObservationShapes].sort(),
        hiddenObservationKeys: [...hiddenObservationKeys].sort(),
        hiddenEventKeys: [...hiddenEventKeys].sort(),
        presentation: {
          backingSize: { width: canvas.width, height: canvas.height },
          renderedFrames,
          presentationKeys,
        },
      };
    },
    {
      config: fixture.config,
      policyKey: fixture.policy.key,
      policyConfig: fixture.policy.descriptor.config,
      maxSteps: fixture.maxSteps,
      schedule: nodeTrace.checkpoints.slice(1).map(({ commands }) => commands),
      variant,
    },
  );
}

async function runBrowserSettlement(
  page: import("@playwright/test").Page,
  fixture: OriginalV13CompatibilitySettlement,
): Promise<readonly ProfileState[]> {
  return page.evaluate(async ({ initialProfiles, runs }) => {
    const profilePath = "/src/domain/profile.ts";
    const profileModule = (await import(profilePath)) as typeof ProfileModule;
    return runs.map((run, index) =>
      profileModule.settleCompletedRun(initialProfiles[index]!, run),
    );
  }, fixture);
}

test("replays the retained compatibility corpus in Node and Chromium", async ({
  browser,
}) => {
  test.setTimeout(600_000);
  assertFixedSettlementBaselines();
  const contexts = await Promise.all(
    VARIANTS.map(async (variant) => {
      const context = await browser.newContext({
        viewport: variant.viewport,
        deviceScaleFactor: variant.deviceScaleFactor,
      });
      await context.addInitScript((storage) => {
        window.localStorage.setItem(
          "trigger-knight.profile",
          JSON.stringify(storage),
        );
      }, toStorageEnvelope(variant.ambientProfile));
      return { context, page: await context.newPage(), variant };
    }),
  );

  try {
    const variantSummaries: BrowserCorpusSummary[] = [];
    for (const fixture of originalV13CompatibilityRuns) {
      const node = runNodeFixture(fixture);
      assertFixedBaseline(fixture, node.result, node.trace);
      const expectedCompletedProfile =
        fixture.expected.completedProfile ?? null;

      for (const { page, variant } of contexts) {
        await page.goto("/");
        const diagnostics = await runBrowserFixture(
          page,
          fixture,
          variant,
          node.trace,
        );
        const summary = (await diagnostics.evaluate(
          ({
            trace,
            result,
            completedProfile,
            initialObservationKeys,
            policyObservationShapes,
            hiddenObservationKeys,
            hiddenEventKeys,
            presentation,
          }) => ({
            schemaVersion: trace.schemaVersion,
            config: trace.config,
            traceHash: trace.traceHash,
            length: trace.checkpoints.length,
            result,
            completedProfile,
            initialObservationKeys,
            policyObservationShapes,
            hiddenObservationKeys,
            hiddenEventKeys,
            presentation,
          }),
        )) as BrowserCorpusSummary;

        expect(summary.schemaVersion).toBe(node.trace.schemaVersion);
        expect(summary.length).toBe(node.trace.checkpoints.length);
        for (
          let start = 0;
          start < summary.length;
          start += COMPATIBILITY_CHECKPOINT_BLOCK_SIZE
        ) {
          const checkpoints = await diagnostics.evaluate(
            ({ trace }, range: { start: number; end: number }) =>
              trace.checkpoints.slice(range.start, range.end),
            { start, end: start + COMPATIBILITY_CHECKPOINT_BLOCK_SIZE },
          );
          const comparison = compareGameplayTraceBlock(
            node.trace,
            {
              schemaVersion: summary.schemaVersion,
              config: summary.config,
              checkpoints,
            },
            start,
          );
          expect(
            comparison,
            `${fixture.id} ${variant.name} checkpoint block ${start}`,
          ).toEqual({ equal: true });
        }

        expect(summary.traceHash, `${fixture.id} ${variant.name} trace`).toBe(
          node.trace.traceHash,
        );
        expect(summary.result.schemaVersion).toBe(3);
        expect(
          summary.result,
          `${fixture.id} ${variant.name} current result`,
        ).toEqual(node.result);
        expect(
          toOriginalV13BaselineResult(summary.result),
          `${fixture.id} ${variant.name} result`,
        ).toEqual(fixture.expected.result);
        expect(summary.completedProfile).toEqual(expectedCompletedProfile);
        expect(summary.initialObservationKeys).toEqual(OBSERVATION_KEYS);
        expect(summary.policyObservationShapes).toEqual([
          OBSERVATION_KEYS.join(","),
        ]);
        expect(summary.hiddenObservationKeys).toEqual([]);
        expect(summary.hiddenEventKeys).toEqual([]);
        expect(summary.presentation.presentationKeys).toEqual([]);

        variantSummaries.push(summary);
        await diagnostics.dispose();
      }
    }

    for (const fixture of originalV13CompatibilitySettlements) {
      for (const { page, variant } of contexts) {
        await page.goto("/");
        const profiles = await runBrowserSettlement(page, fixture);
        expect(profiles, `${fixture.id} ${variant.name} profiles`).toEqual(
          fixture.expectedProfiles,
        );
      }
    }

    expect(
      new Set(
        variantSummaries.map(
          ({ presentation }) =>
            `${presentation.backingSize.width}x${presentation.backingSize.height}`,
        ),
      ).size,
    ).toBeGreaterThan(1);
    expect(
      variantSummaries.every(
        ({ presentation }) => presentation.renderedFrames > 0,
      ),
    ).toBe(true);
  } finally {
    await Promise.all(contexts.map(({ context }) => context.close()));
  }
});
