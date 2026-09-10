import { expect, test } from "@playwright/test";
import type * as EngineModule from "../../src/application/gameplay-engine.js";
import type * as ExecutionModule from "../../src/application/gameplay-execution.js";
import type * as RulesModule from "../../src/domain/rulesets.js";
import { createFreshProfile } from "../../src/domain/profile.js";
import {
  PROFILE_STORAGE_ENVELOPE_VERSION,
  PROFILE_STORAGE_KEY,
} from "../../src/persistence/browser-profile-store.js";
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

test("starts a browser run from the stored complete profile", async ({
  page,
}) => {
  const profile = {
    ...createFreshProfile(),
    level: 5,
    xp: 42,
    scoreMultiplier: 1.5,
    highScore: 9_876,
    tutorialPreference: "disabled" as const,
  };
  const record = {
    schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
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
    completedRuns: [],
  };

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: PROFILE_STORAGE_KEY, value: record },
  );
  await page.goto("/");

  await expect(page.getByTestId("profile-summary")).toContainText(
    "Level 5 · XP 42",
  );

  await expect
    .poll(() =>
      page.evaluate(
        () => window.triggerKnightDiagnostics?.read().config.initialProfile,
      ),
    )
    .toEqual(profile);
});

test("shows a committed result and starts the next run from its profile", async ({
  page,
}) => {
  await page.goto("/");
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

  const result = page.locator("#run-result");
  await expect(result).toHaveAttribute("data-result-state", "committed");
  await expect(page.locator("#result-save-status")).toHaveText(
    "Progress saved.",
  );
  await expect(
    page.getByRole("button", { name: "Start next run" }),
  ).toBeEnabled();

  const savedProfile = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      throw new Error("Expected a committed profile record");
    }
    const envelope = JSON.parse(raw) as {
      profile: Record<string, unknown>;
      settings: { tutorialPreference: "enabled" | "disabled" };
    };
    return {
      ...envelope.profile,
      tutorialPreference: envelope.settings.tutorialPreference,
    };
  }, PROFILE_STORAGE_KEY);

  await page.getByRole("button", { name: "Skip score count" }).click();
  await page.getByRole("button", { name: "Start next run" }).click();

  await expect(result).toBeHidden();
  await expect(page.getByTestId("game-status")).toHaveText("Step 0");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.triggerKnightDiagnostics?.read().config.initialProfile,
      ),
    )
    .toEqual(savedProfile);
});

test("keeps a failed completed-run save visible until retry succeeds", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    const storage = window.localStorage;
    const originalSetItem = storage.setItem.bind(storage);
    let failed = false;
    Object.defineProperty(storage, "setItem", {
      configurable: true,
      value: (storageKey: string, value: string): void => {
        if (storageKey === key && !failed) {
          failed = true;
          throw new Error("Simulated completed-run write failure");
        }
        originalSetItem(storageKey, value);
      },
    });
  }, PROFILE_STORAGE_KEY);
  await page.goto("/");
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

  const result = page.locator("#run-result");
  await expect(result).toHaveAttribute("data-result-state", "failed");
  await expect(page.locator("#result-save-status")).toContainText(
    "Progress was not saved",
  );
  await expect(
    page.getByRole("button", { name: "Start next run" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Retry save" }).click();

  await expect(result).toHaveAttribute("data-result-state", "committed");
  await expect(page.locator("#result-save-status")).toHaveText(
    "Progress saved.",
  );
});

test("reports an unreadable stored profile without replacing it", async ({
  page,
}) => {
  const raw = "{";
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: PROFILE_STORAGE_KEY, value: raw },
  );
  await page.goto("/");

  const status = page.getByTestId("game-status");
  await expect(status).toHaveAttribute("data-persistence-status", "failed");
  await expect(status).toHaveAttribute(
    "data-persistence-error",
    "corrupt-record",
  );
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROFILE_STORAGE_KEY,
    ),
  ).toBe(raw);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.triggerKnightDiagnostics?.read().config.initialProfile,
      ),
    )
    .toEqual(createFreshProfile());
});

test("starts gameplay when browser storage access is denied", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Access denied", "SecurityError");
      },
    });
  });
  await page.goto("/");

  const status = page.getByTestId("game-status");
  await expect(status).toHaveAttribute("data-persistence-status", "failed");
  await expect(status).toHaveAttribute(
    "data-persistence-error",
    "storage-read-failed",
  );
  await expect(status).toHaveText("Step 0");

  await page.getByRole("button", { name: "Advance run" }).click();
  await expect(status).toHaveText("Step 1");
});
