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
  const execution = createGameplayExecution(
    createTestGameplayEngine(),
    config,
    {
      retainDiagnostics: true,
    },
  );
  execution.dispatch([{ type: "dismiss-tutorial" }]);
  for (let i = 0; i < 100; i += 1) execution.dispatch([]);
  await page.goto("/?manual=1&diagnostics=1");
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
      { retainDiagnostics: true },
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
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();

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
  await page.goto("/?manual=1&diagnostics=1");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  await page.getByRole("button", { name: "Start run" }).click();
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
  await expect(page.locator("#result-view-collections")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("#result-details")
        .evaluate((element) => (element as HTMLElement).inert),
    )
    .toBe(true);
  const scoreCardGeometry = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".result-score-card");
    const track = document.querySelector<HTMLElement>(".result-xp-track");
    const fill = document.querySelector<HTMLElement>("#result-xp-fill");
    const result = document.querySelector<HTMLElement>("#run-result");
    const silhouette = document.querySelector<HTMLElement>(
      ".result-score-silhouette",
    );
    const calculation = document.querySelector<HTMLElement>(
      "#result-calculation",
    );
    if (
      card === null ||
      track === null ||
      fill === null ||
      result === null ||
      silhouette === null ||
      calculation === null
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
      calculation: (() => {
        const style = getComputedStyle(calculation);
        const strip = getComputedStyle(calculation, "::before");
        const textRange = document.createRange();
        textRange.selectNodeContents(calculation);
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: style.color,
          textStroke: style.getPropertyValue("-webkit-text-stroke"),
          textWidth: textRange.getBoundingClientRect().width,
          strip: {
            backgroundImage: strip.backgroundImage,
            top: strip.top,
            width: strip.width,
            height: strip.height,
            zIndex: strip.zIndex,
          },
        };
      })(),
    };
  });
  expect(scoreCardGeometry.card.width).toBeCloseTo(480);
  expect(scoreCardGeometry.card.height).toBeCloseTo(320);
  expect(scoreCardGeometry.fill.right).toBeLessThanOrEqual(
    scoreCardGeometry.track.right,
  );
  expect(scoreCardGeometry.parchment).toContain("529.jpg");
  expect(scoreCardGeometry.silhouette).toContain("533.png");
  expect(scoreCardGeometry.calculation.fontFamily).toContain(
    "Trigger Knight Calibri",
  );
  expect(scoreCardGeometry.calculation.fontSize).toBe("30px");
  expect(scoreCardGeometry.calculation.fontWeight).toBe("400");
  expect(scoreCardGeometry.calculation.color).toBe("rgb(0, 0, 0)");
  expect(scoreCardGeometry.calculation.textStroke).toContain("1px");
  expect(scoreCardGeometry.calculation.textWidth).toBeCloseTo(173, 0);
  expect(scoreCardGeometry.calculation.strip.backgroundImage).toContain(
    "linear-gradient",
  );
  expect(
    Number.parseFloat(scoreCardGeometry.calculation.strip.top),
  ).toBeCloseTo(21, 0);
  expect(
    Number.parseFloat(scoreCardGeometry.calculation.strip.width),
  ).toBeCloseTo(232, 0);
  expect(
    Number.parseFloat(scoreCardGeometry.calculation.strip.height),
  ).toBeCloseTo(13, 0);
  expect(scoreCardGeometry.calculation.strip.zIndex).toBe("-1");
  const scoreCard = page.locator(".result-score-card");
  const calculation = page.locator("#result-calculation");
  const textScreenshot = await scoreCard.screenshot();
  const originalInlineStyles = await calculation.evaluate((element) => ({
    color: element.style.color,
    textShadow: element.style.textShadow,
    textStroke: element.style.getPropertyValue("-webkit-text-stroke"),
  }));
  await calculation.evaluate((element) => {
    element.style.color = "transparent";
    element.style.textShadow = "none";
    element.style.setProperty("-webkit-text-stroke", "0 transparent");
  });
  const backgroundOnlyScreenshot = await scoreCard.screenshot();
  await calculation.evaluate((element, styles) => {
    element.style.color = styles.color;
    element.style.textShadow = styles.textShadow;
    element.style.setProperty("-webkit-text-stroke", styles.textStroke);
  }, originalInlineStyles);
  const visibleTextBounds = await page.evaluate(
    async ({ text, background }) => {
      const readImage = async (base64: string): Promise<ImageData> => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (context === null) throw new Error("Missing screenshot canvas");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };
      const withText = await readImage(text);
      const withoutText = await readImage(background);
      const calculationElement = document.querySelector<HTMLElement>(
        "#result-calculation",
      );
      const cardElement =
        document.querySelector<HTMLElement>(".result-score-card");
      if (calculationElement === null || cardElement === null) {
        throw new Error("Missing calculation screenshot bounds");
      }
      const calculationRect = calculationElement.getBoundingClientRect();
      const cardRect = cardElement.getBoundingClientRect();
      const left = Math.max(
        0,
        Math.floor(calculationRect.left - cardRect.left),
      );
      const right = Math.min(
        withText.width,
        Math.ceil(calculationRect.right - cardRect.left),
      );
      const top = Math.max(0, Math.floor(calculationRect.top - cardRect.top));
      const bottom = Math.min(
        withText.height,
        Math.ceil(calculationRect.bottom - cardRect.top),
      );
      let minY = bottom;
      let maxY = top;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const index = (y * withText.width + x) * 4;
          const withTextLuminance =
            (withText.data[index] ?? 0) +
            (withText.data[index + 1] ?? 0) +
            (withText.data[index + 2] ?? 0);
          const withoutTextLuminance =
            (withoutText.data[index] ?? 0) +
            (withoutText.data[index + 1] ?? 0) +
            (withoutText.data[index + 2] ?? 0);
          if (withoutTextLuminance - withTextLuminance > 24) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      return { minY, maxY };
    },
    {
      text: textScreenshot.toString("base64"),
      background: backgroundOnlyScreenshot.toString("base64"),
    },
  );
  const calculationGeometry = await calculation.evaluate((element) => {
    const card = document.querySelector<HTMLElement>(".result-score-card");
    if (card === null) throw new Error("Missing score card");
    const calculationRect = element.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const strip = getComputedStyle(element, "::before");
    return {
      stripMidpoint:
        calculationRect.top -
        cardRect.top +
        Number.parseFloat(strip.top) +
        Number.parseFloat(strip.height) / 2,
    };
  });
  expect(visibleTextBounds.maxY).toBeGreaterThan(visibleTextBounds.minY);
  expect(
    Math.abs(visibleTextBounds.maxY + 1 - calculationGeometry.stripMidpoint),
  ).toBeLessThan(1.5);
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
    await reloadedPage.goto("/?manual=1&diagnostics=1");
    await reloadedPage.getByRole("button", { name: "Start run" }).click();
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
  await expect(skipScoreCount).toBeHidden();
  await expect(page.locator(".result-score-actions")).toBeVisible();
  await expect(page.locator(".result-more-games")).toHaveCount(0);
  await expect(page.locator("#result-score-actions > button")).toHaveCount(3);
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
  await page.getByRole("button", { name: "Start run" }).click();
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
  await expect(
    page.getByRole("button", { name: "Skip score count" }),
  ).toBeHidden();
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
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();

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
  await page.getByRole("button", { name: "Start run" }).click();

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
