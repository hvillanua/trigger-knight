import { expect, test } from "@playwright/test";
import type * as CompletedRunModule from "../../src/application/completed-run.js";
import type * as ContractsModule from "../../src/application/contracts.js";
import type * as EngineModule from "../../src/application/gameplay-engine.js";
import type * as SessionModule from "../../src/browser/gameplay-session.js";
import type * as RulesModule from "../../src/domain/rulesets.js";
import type * as StoreModule from "../../src/persistence/browser-profile-store.js";
import { completedRunSettlementFromState } from "../../src/application/completed-run.js";
import {
  createFreshProfile,
  settleCompletedRun,
} from "../../src/domain/profile.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const terminalStepLimit = 2_560;
const parityProfile = Object.freeze({
  ...createFreshProfile(),
  tutorialPreference: "disabled" as const,
});
const parityConfig = Object.freeze({
  ruleset: "original-v1.3" as const,
  seed: "milestone-2-lifecycle-2",
  initialProfile: parityProfile,
});
const paritySchedule = Object.freeze(
  Array.from({ length: terminalStepLimit }, (_, step) =>
    step === 0
      ? Object.freeze([{ type: "dismiss-tutorial" as const }])
      : Object.freeze([]),
  ),
);

function runHeadlessParityScenario() {
  let trace: ContractsModule.GameplayTrace | undefined;
  const policy: ContractsModule.PlayerPolicy = Object.freeze({
    descriptor: Object.freeze({
      id: "m5-07-no-commands",
      version: "1",
      config: Object.freeze({}),
    }),
    createAgent: () => {
      let firstDecision = true;
      return Object.freeze({
        decide: () => {
          if (firstDecision) {
            firstDecision = false;
            return Object.freeze([{ type: "dismiss-tutorial" as const }]);
          }
          return Object.freeze([]);
        },
      });
    },
  });
  const result = createSimulationRunner(createTestGameplayEngine(), {
    onTrace: (value) => {
      trace = value;
    },
  }).run({
    config: parityConfig,
    policy,
    maxSteps: terminalStepLimit,
  });
  if (trace === undefined) {
    throw new Error("Expected the headless parity trace");
  }
  const terminal = trace.checkpoints.at(-1)?.state;
  if (terminal === undefined) {
    throw new Error("Expected a headless terminal checkpoint");
  }
  const settlement = completedRunSettlementFromState(terminal);
  if (settlement === undefined) {
    throw new Error("Expected a gameplay death for the parity scenario");
  }
  return { result, trace, settlement };
}

test("browser and headless progression agree despite storage and presentation cadence", async ({
  page,
}) => {
  const headless = runHeadlessParityScenario();
  expect(headless.result).toMatchObject({
    terminalReason: "lifespan",
    steps: terminalStepLimit,
    score: 320_200,
  });
  const expectedProfile = settleCompletedRun(
    parityConfig.initialProfile,
    headless.settlement,
  );
  await page.goto("/?manual=1&diagnostics=1");

  const variants = await page.evaluate(
    async ({ config, schedule }) => {
      const enginePath = "/src/application/gameplay-engine.ts";
      const sessionPath = "/src/browser/gameplay-session.ts";
      const completedRunPath = "/src/application/completed-run.ts";
      const rulesPath = "/src/domain/rulesets.ts";
      const storePath = "/src/persistence/browser-profile-store.ts";
      const { createGameplayEngine } = (await import(
        enginePath
      )) as typeof EngineModule;
      const { createBrowserGameplaySession } = (await import(
        sessionPath
      )) as typeof SessionModule;
      const { createCompletedRunCoordinator } = (await import(
        completedRunPath
      )) as typeof CompletedRunModule;
      const { ruleSetRegistry } = (await import(
        rulesPath
      )) as typeof RulesModule;
      const { createBrowserProfileStore } = (await import(
        storePath
      )) as typeof StoreModule;

      localStorage.setItem(
        "trigger-knight.profile",
        JSON.stringify({ ambient: "ignored", highScore: 999_999 }),
      );

      function runVariant(cadence: number, storageKey: string) {
        const store = createBrowserProfileStore(localStorage, storageKey);
        const saved = store.save(config.initialProfile);
        if (saved.status !== "saved") {
          throw new Error("Expected the explicit profile to be saved");
        }
        const coordinator = createCompletedRunCoordinator(store);
        let committed: ReturnType<typeof coordinator.commit> | undefined;
        let presentationCalls = 0;
        const session = createBrowserGameplaySession(
          createGameplayEngine(ruleSetRegistry),
          config,
          {
            present(frame) {
              if (frame.current.steps % cadence === 0) {
                presentationCalls += 1;
              }
            },
          },
          {
            retainDiagnostics: true,
            onCompletedRun(run) {
              committed = coordinator.commit({
                completionId: `${storageKey}-completion`,
                initialProfile: config.initialProfile,
                run,
              });
            },
          },
        );

        for (let step = 0; step < schedule.length; step += 1) {
          session.dispatch(schedule[step] ?? []);
          if (step % cadence === 0) {
            session.render((step % 4) / 3);
          }
        }
        if (committed === undefined) {
          throw new Error("Expected the browser completion to commit");
        }
        const loaded = store.load();
        if (loaded.status !== "loaded") {
          throw new Error("Expected the committed browser profile to load");
        }
        return {
          traceHash: session.readDiagnostics().traceHash,
          profile: loaded.profile,
          commitStatus: committed.status,
          presentationCalls,
          terminalReason: session.readDiagnostics().checkpoints.at(-1)?.state
            .lifecycle.terminalReason,
        };
      }

      return [
        runVariant(1, "m5-07-parity-fast"),
        runVariant(17, "m5-07-parity-slow"),
      ];
    },
    { config: parityConfig, schedule: paritySchedule },
  );

  expect(variants).toHaveLength(2);
  for (const variant of variants) {
    expect(variant).toMatchObject({
      traceHash: headless.trace.traceHash,
      profile: expectedProfile,
      commitStatus: "committed",
      terminalReason: "lifespan",
    });
  }
  expect(variants[0]?.presentationCalls).toBeGreaterThan(
    variants[1]?.presentationCalls ?? 0,
  );
  expect(variants[0]?.profile).toEqual(variants[1]?.profile);
});

test("a migrated profile is committed before result presentation and survives navigation", async ({
  page,
}) => {
  const profile = {
    ...createFreshProfile(),
    level: 2,
    xp: 159,
    scoreMultiplier: 1.2,
    highScore: 900,
    tutorialPreference: "disabled" as const,
  };
  const migratedEnvelope = {
    schemaVersion: 2,
    profile: {
      schemaVersion: profile.schemaVersion,
      level: profile.level,
      xp: profile.xp,
      scoreMultiplier: profile.scoreMultiplier,
      highScore: profile.highScore,
      weaponDiscoveries: profile.weaponDiscoveries,
      armorDiscoveries: profile.armorDiscoveries,
      achievementSlots: profile.achievementSlots,
    },
    settings: { tutorialPreference: profile.tutorialPreference },
  };

  await page.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem("m5-07-profile-seeded") === "true") {
        return;
      }
      window.localStorage.setItem(key, JSON.stringify(value));
      sessionStorage.setItem("m5-07-profile-seeded", "true");
    },
    { key: "trigger-knight.profile", value: migratedEnvelope },
  );
  await page.goto("/?manual=1&diagnostics=1");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  await expect(page.getByTestId("profile-summary")).toContainText(
    "Level 2 · XP 159",
  );
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  await page.evaluate(() => {
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    if (advance === null) {
      throw new Error("Missing advance control");
    }
    for (let step = 0; step < 2_600; step += 1) {
      advance.click();
    }
  });
  await page.locator("#game-canvas").click({ position: { x: 240, y: 160 } });

  const result = page.locator("#run-result");
  await expect(result).toHaveAttribute("data-result-state", "committed");
  await expect(page.locator("#result-save-status")).toHaveText(
    "Progress saved.",
  );
  await expect(page.locator("#result-score-count")).toHaveAttribute(
    "data-state",
    "counting",
  );

  const savedProfile = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      throw new Error("Expected a committed migrated profile");
    }
    const envelope = JSON.parse(raw) as {
      profile: {
        schemaVersion: 2;
        level: number;
        xp: number;
        scoreMultiplier: number;
        highScore: number;
        weaponDiscoveries: readonly boolean[];
        armorDiscoveries: readonly boolean[];
        achievementSlots: readonly boolean[];
      };
      settings: { tutorialPreference: "enabled" | "disabled" };
    };
    return {
      ...envelope.profile,
      tutorialPreference: envelope.settings.tutorialPreference,
    };
  }, "trigger-knight.profile");
  expect(savedProfile).toMatchObject({
    level: expect.any(Number),
    xp: expect.any(Number),
    highScore: expect.any(Number),
  });
  await expect(page.locator("#result-profile-level")).toHaveText(
    String(savedProfile.level),
  );
  await expect(page.locator("#result-profile-xp")).toHaveText(
    String(savedProfile.xp),
  );
  const rawBeforeNavigation = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      throw new Error("Expected the profile record before navigation");
    }
    return raw;
  }, "trigger-knight.profile");

  // Navigate while the optional score count is still running. The next page
  // starts from the committed profile rather than the result animation.
  await page.goto("/?manual=1&diagnostics=1");
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      "trigger-knight.profile",
    ),
  ).toBe(rawBeforeNavigation);
  await expect(page.getByTestId("profile-summary")).toContainText(
    `Level ${savedProfile.level} · XP ${savedProfile.xp}`,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => window.triggerKnightDiagnostics?.read().config.initialProfile,
      ),
    )
    .toEqual(savedProfile);
});
