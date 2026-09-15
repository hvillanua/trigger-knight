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
  await page.goto("/?manual=1");
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
  await page.goto("/?manual=1");

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
  await page.goto("/?manual=1");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.evaluate(() => {
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
    if (advance === null || dismiss === null) {
      throw new Error("Missing run control");
    }
    for (let step = 0; step < 2_600; step += 1) {
      if (!dismiss.disabled) dismiss.click();
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
  await expect(page.locator(".result-score-card")).toBeVisible();
  await expect(page.locator("#result-score-label")).toHaveText("SCORE GET");
  await expect(page.locator("#result-calculation")).toHaveText("CALCULATION");
  await expect(page.locator("#result-level-label")).toContainText("Level");
  await expect(page.locator("#result-experience")).toHaveText(/^\d+\/\d+ EXP$/);
  await expect(page.locator(".result-score-actions")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Skip score count" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("#result-details")
        .evaluate((element) => (element as HTMLElement).inert),
    )
    .toBe(true);
  await page.locator("#result-view-collections").focus();
  await expect(page.locator("#result-view-collections")).not.toBeFocused();
  const scoreCardGeometry = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".result-score-card");
    const track = document.querySelector<HTMLElement>(".result-xp-track");
    const fill = document.querySelector<HTMLElement>("#result-xp-fill");
    const result = document.querySelector<HTMLElement>("#run-result");
    const silhouette = document.querySelector<HTMLElement>(
      ".result-score-silhouette",
    );
    const twitter = document.querySelector<HTMLElement>(
      ".result-score-twitter",
    );
    if (
      card === null ||
      track === null ||
      fill === null ||
      result === null ||
      silhouette === null ||
      twitter === null
    ) {
      throw new Error("Missing score card geometry");
    }
    const rect = (element: Element) => {
      const { width, height, right } = element.getBoundingClientRect();
      return { width, height, right };
    };
    return {
      card: rect(card),
      track: rect(track),
      fill: rect(fill),
      parchment: getComputedStyle(result).backgroundImage,
      silhouette: getComputedStyle(silhouette).webkitMaskImage,
      twitter: getComputedStyle(twitter).backgroundImage,
    };
  });
  expect(scoreCardGeometry.card.width).toBeCloseTo(480);
  expect(scoreCardGeometry.card.height).toBeCloseTo(320);
  expect(scoreCardGeometry.fill.right).toBeLessThanOrEqual(
    scoreCardGeometry.track.right,
  );
  expect(scoreCardGeometry.parchment).toContain("529.jpg");
  expect(scoreCardGeometry.silhouette).toContain("533.png");
  expect(scoreCardGeometry.twitter).toContain("596.png");
  const savedRecord = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      throw new Error("Expected a committed profile record");
    }
    return raw;
  }, PROFILE_STORAGE_KEY);
  const savedProfile = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      throw new Error("Expected a committed profile record");
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
  }, PROFILE_STORAGE_KEY);

  const reloadedPage = await page.context().newPage();
  try {
    await reloadedPage.goto("/?manual=1");
    await expect(reloadedPage.getByTestId("profile-summary")).toContainText(
      `High score ${savedProfile.highScore}`,
    );
    await expect
      .poll(() =>
        reloadedPage.evaluate(
          () => window.triggerKnightDiagnostics?.read().config.initialProfile,
        ),
      )
      .toEqual(savedProfile);
  } finally {
    await reloadedPage.close();
  }

  const skipScoreCount = page.getByRole("button", {
    name: "Skip score count",
  });
  await skipScoreCount.focus();
  await expect(skipScoreCount).toBeFocused();
  await skipScoreCount.click();
  await expect(page.locator("#result-score-count")).toHaveAttribute(
    "data-state",
    "complete",
  );
  await expect(page.locator(".result-score-actions")).toBeVisible();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROFILE_STORAGE_KEY,
    ),
  ).toBe(savedRecord);
  await page.getByRole("button", { name: "Start next run" }).click();

  await expect(result).toBeHidden();
  await expect(page.locator("#gameplay-screen")).toBeFocused();
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
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.evaluate(() => {
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
    if (advance === null || dismiss === null) {
      throw new Error("Missing run control");
    }
    for (let step = 0; step < 2_600; step += 1) {
      if (!dismiss.disabled) dismiss.click();
      advance.click();
    }
  });
  await page.locator("#game-canvas").click({ position: { x: 240, y: 160 } });

  const result = page.locator("#run-result");
  await expect(result).toHaveAttribute("data-result-state", "failed");
  await expect(page.locator("#result-save-status")).toContainText(
    "Progress was not saved",
  );
  await expect(page.locator("#next-run")).toBeDisabled();

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
  await page.goto("/?manual=1");

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
  await page.goto("/?manual=1");

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
