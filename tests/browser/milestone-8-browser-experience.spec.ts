import { expect, test, type Page } from "@playwright/test";

import { createGameplayExecution } from "../../src/application/gameplay-execution.js";
import type { GameplayTrace } from "../../src/application/gameplay-execution.js";
import { createFreshProfile } from "../../src/domain/profile.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import {
  PROFILE_STORAGE_ENVELOPE_VERSION,
  PROFILE_STORAGE_KEY,
} from "../../src/persistence/browser-profile-store.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const REPRESENTATIVE_VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720, dpr: 1 },
  { name: "mobile portrait", width: 360, height: 640, dpr: 2 },
  { name: "mobile landscape", width: 640, height: 360, dpr: 2 },
] as const;

const disabledTutorialProfile = Object.freeze({
  ...createFreshProfile(),
  tutorialPreference: "disabled" as const,
});

function profileEnvelope() {
  return {
    schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
    profile: {
      schemaVersion: disabledTutorialProfile.schemaVersion,
      level: disabledTutorialProfile.level,
      xp: disabledTutorialProfile.xp,
      scoreMultiplier: disabledTutorialProfile.scoreMultiplier,
      highScore: disabledTutorialProfile.highScore,
      weaponDiscoveries: disabledTutorialProfile.weaponDiscoveries,
      armorDiscoveries: disabledTutorialProfile.armorDiscoveries,
      achievementSlots: disabledTutorialProfile.achievementSlots,
    },
    settings: {
      tutorialPreference: disabledTutorialProfile.tutorialPreference,
    },
    completedRuns: [],
  };
}

async function seedDisabledTutorialProfile(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { key: PROFILE_STORAGE_KEY, value: profileEnvelope() },
  );
}

async function installFullscreenStub(
  page: Page,
  mode: "working" | "denied" | "unsupported",
): Promise<void> {
  await page.addInitScript((stubMode) => {
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => stubMode !== "unsupported",
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: function requestFullscreen() {
        if (stubMode === "denied") {
          return Promise.reject(new DOMException("Denied", "NotAllowedError"));
        }
        fullscreenElement = document.querySelector("#gameplay-screen");
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      },
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: function exitFullscreen() {
        fullscreenElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      },
    });
  }, mode);
}

async function advanceUntilResult(
  page: Page,
  maxSteps: number,
  purchase: boolean,
) {
  return page.evaluate(
    ({ maxSteps: stepLimit, purchase: purchaseShops }) => {
      const advance = document.querySelector<HTMLButtonElement>("#advance-run");
      const purchase = document.querySelector<HTMLButtonElement>(
        "#purchase-current-encounter",
      );
      const dismiss =
        document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
      const result = document.querySelector<HTMLElement>("#run-result");
      const diagnostics = window.triggerKnightDiagnostics;
      if (
        advance === null ||
        purchase === null ||
        dismiss === null ||
        result === null
      ) {
        throw new Error("Missing manual run controls");
      }
      if (!dismiss.disabled) dismiss.click();
      let purchaseCount = 0;
      for (let step = 0; step < stepLimit; step += 1) {
        if (purchaseShops && !purchase.disabled) {
          purchase.click();
          purchaseCount += 1;
        }
        if (advance.disabled) break;
        advance.click();
        if (result.dataset.resultState === "committed") break;
      }
      const trace = diagnostics?.read();
      if (trace === undefined) throw new Error("Missing browser diagnostics");
      return {
        purchaseCount,
        steps: trace.checkpoints.at(-1)?.state.steps,
        terminalReason:
          trace.checkpoints.at(-1)?.state.lifecycle.terminalReason,
        activeTicks: trace.checkpoints.at(-1)?.state.activeTicks,
        distance: trace.checkpoints.at(-1)?.state.distance,
        currentEncounter:
          trace.checkpoints.at(-1)?.observation.encounters.current,
        seed: trace.config.seed,
        eventTypes: trace.checkpoints.flatMap(({ events }) =>
          events.map(({ type }) => type),
        ),
      };
    },
    { maxSteps, purchase },
  );
}

async function readDiagnostics(page: Page): Promise<GameplayTrace> {
  return page.evaluate(() => {
    const trace = window.triggerKnightDiagnostics?.read();
    if (trace === undefined) throw new Error("Missing browser diagnostics");
    return trace;
  });
}

test("exposes fullscreen controls and the reduced-motion presentation state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?manual=1");

  await expect(
    page.getByRole("button", { name: "Enter fullscreen" }),
  ).toBeVisible();
  await expect(page.locator("#toggle-fullscreen")).toBeEnabled();
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
});

test("handles fullscreen entry, exit, resize, and denied or unsupported hosts", async ({
  browser,
}) => {
  for (const mode of ["working", "denied", "unsupported"] as const) {
    const context = await browser.newContext({
      viewport: { width: 640, height: 360 },
    });
    const page = await context.newPage();
    try {
      await installFullscreenStub(page, mode);
      await page.goto("/?manual=1");
      const button = page.locator("#toggle-fullscreen");
      if (mode === "working") {
        await expect(button).toBeEnabled();
        await button.click();
        await expect(
          page.getByRole("button", { name: "Exit fullscreen" }),
        ).toBeVisible();
        await expect(page.locator("#fullscreen-status")).toHaveText(
          "Fullscreen is active. Use Exit fullscreen to leave it.",
        );
        await expect(page.locator("#game-canvas")).toHaveAttribute(
          "data-world-camera",
          "0,0,480,320",
        );

        await page.evaluate(() => {
          const canvas =
            document.querySelector<HTMLCanvasElement>("#game-canvas");
          if (canvas === null) throw new Error("Missing game canvas");
          canvas.style.width = "600px";
          canvas.style.height = "400px";
          window.dispatchEvent(new Event("resize"));
        });
        await expect(page.locator("#game-canvas")).toHaveAttribute(
          "data-world-camera",
          "0,0,480,320",
        );
        await page.getByRole("button", { name: "Exit fullscreen" }).click();
        await expect(
          page.getByRole("button", { name: "Enter fullscreen" }),
        ).toBeVisible();
      } else if (mode === "denied") {
        await expect(button).toBeEnabled();
        await button.click();
        await expect(page.locator("#fullscreen-status")).toHaveText(
          "Fullscreen request was denied. Check browser permissions and try again.",
        );
        await expect(button).toHaveText("Enter fullscreen");
      } else {
        await expect(button).toBeDisabled();
        await expect(page.locator("#fullscreen-status")).toHaveText(
          "Fullscreen is not available in this browser.",
        );
      }
    } finally {
      await context.close();
    }
  }
});

test("keeps the fullscreen stage within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/?manual=1");

  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator("#gameplay-screen")).toBeVisible();

  const layout = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>("#gameplay-screen");
    const stage = document.querySelector<HTMLElement>(".gameplay-stage");
    if (screen === null || stage === null) {
      throw new Error("Missing fullscreen layout elements");
    }

    const screenRect = screen.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      screen: {
        clientHeight: screen.clientHeight,
        scrollHeight: screen.scrollHeight,
      },
      stage: {
        bottom: stageRect.bottom,
        top: stageRect.top,
      },
      viewport: {
        bottom: window.innerHeight,
        top: screenRect.top,
      },
    };
  });

  expect(layout.screen.scrollHeight).toBeLessThanOrEqual(
    layout.screen.clientHeight + 1,
  );
  expect(layout.stage.top).toBeGreaterThanOrEqual(layout.viewport.top - 1);
  expect(layout.stage.bottom).toBeLessThanOrEqual(layout.viewport.bottom + 1);
});

test("keeps assembled screens readable and operable at representative sizes", async ({
  browser,
}) => {
  for (const viewport of REPRESENTATIVE_VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
    });
    const page = await context.newPage();
    try {
      await page.goto("/?manual=1");
      const layout = await page.evaluate(() => {
        const visibleButtons = [...document.querySelectorAll("button")].filter(
          (button) => !button.hidden && button.getClientRects().length > 0,
        );
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          buttons: visibleButtons.map((button) => {
            const rect = button.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              name: button.textContent?.trim() ?? "",
            };
          }),
          canvasDescription: document
            .querySelector("#game-canvas")
            ?.getAttribute("aria-describedby"),
        };
      });
      expect(layout.scrollWidth, viewport.name).toBeLessThanOrEqual(
        layout.clientWidth + 1,
      );
      expect(layout.canvasDescription).toContain("gameplay-hud");
      for (const button of layout.buttons) {
        expect(button.name, viewport.name).not.toBe("");
        expect(
          button.width,
          `${viewport.name} ${button.name}`,
        ).toBeGreaterThanOrEqual(44);
        expect(
          button.height,
          `${viewport.name} ${button.name}`,
        ).toBeGreaterThanOrEqual(44);
        expect(
          button.left,
          `${viewport.name} ${button.name}`,
        ).toBeGreaterThanOrEqual(-1);
        expect(
          button.right,
          `${viewport.name} ${button.name}`,
        ).toBeLessThanOrEqual(layout.clientWidth + 1);
      }

      await page.getByRole("button", { name: "Dismiss tutorial" }).click();
      await page.keyboard.press("p");
      await page
        .getByRole("button", { name: "Main menu", exact: true })
        .click();
      await expect(page.locator("#title-screen")).toBeVisible();
      await expect(page.locator("#title-screen")).toBeFocused();
      await page.getByRole("button", { name: "View collections" }).click();
      await expect(page.locator("#collections-screen")).toBeVisible();
      await page.locator("#collections-back").click();
      await page.getByRole("button", { name: "View achievements" }).click();
      await expect(page.locator("#achievements-screen")).toBeVisible();
      await page.locator("#achievements-back").click();
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.locator("#settings-screen")).toBeVisible();
      await page.locator("#settings-back").click();
      await page.getByRole("button", { name: "Start run" }).click();
      await expect(page.locator("#gameplay-screen")).toBeVisible();
      await expect(page.locator("#tutorial-panel")).toBeVisible();
    } finally {
      await context.close();
    }
  }
});

test("reduced motion keeps timing and committed results durable", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const normalContext = await browser.newContext({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  const reducedContext = await browser.newContext({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  const normalPage = await normalContext.newPage();
  const reducedPage = await reducedContext.newPage();
  try {
    await seedDisabledTutorialProfile(normalPage);
    await normalPage.goto("/?manual=1&seed=m4-policy-3");
    const normalSummary = await advanceUntilResult(normalPage, 12_000, true);
    const normalTrace = await readDiagnostics(normalPage);

    await reducedPage.emulateMedia({ reducedMotion: "reduce" });
    await seedDisabledTutorialProfile(reducedPage);
    await reducedPage.goto("/?manual=1&seed=m4-policy-3");
    const reducedSummary = await advanceUntilResult(reducedPage, 12_000, true);
    const reducedTrace = await readDiagnostics(reducedPage);

    for (const summary of [normalSummary, reducedSummary]) {
      expect(
        summary,
        JSON.stringify({ ...summary, eventTypes: summary.eventTypes.length }),
      ).toMatchObject({
        seed: "m4-policy-3",
        terminalReason: "lifespan",
      });
      expect(summary.purchaseCount).toBeGreaterThan(0);
    }
    expect(reducedTrace).toEqual(normalTrace);

    const headless = createGameplayExecution(createTestGameplayEngine(), {
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "m4-policy-3",
      initialProfile: disabledTutorialProfile,
    });
    for (const checkpoint of normalTrace.checkpoints.slice(1)) {
      headless.dispatch(checkpoint.commands);
    }
    expect(headless.readDiagnostics()).toEqual(normalTrace);

    await expect(reducedPage.locator("#run-result")).toHaveAttribute(
      "data-result-state",
      "committed",
    );
    await expect(reducedPage.locator("#run-result")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
    await expect(reducedPage.locator("#result-score-count")).toHaveAttribute(
      "data-state",
      "complete",
    );
    await expect(reducedPage.locator("#result-save-status")).toHaveText(
      "Progress saved.",
    );

    const saved = await reducedPage.evaluate((key) => {
      const value = window.localStorage.getItem(key);
      if (value === null) throw new Error("Expected a committed profile");
      return value;
    }, PROFILE_STORAGE_KEY);
    await reducedPage.goto("/?manual=1&seed=m4-policy-3");
    expect(
      await reducedPage.evaluate(
        (key) => localStorage.getItem(key),
        PROFILE_STORAGE_KEY,
      ),
    ).toBe(saved);
  } finally {
    await Promise.all([normalContext.close(), reducedContext.close()]);
  }
});

test("completes both gameplay death paths and starts another real browser run", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  for (const scenario of [
    { seed: "m4-policy-2211", reason: "combat", maxSteps: 20_000 },
    { seed: "m4-policy-3", reason: "lifespan", maxSteps: 12_000 },
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 640, height: 360 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    try {
      await seedDisabledTutorialProfile(page);
      await page.goto(`/?manual=1&seed=${scenario.seed}`);
      const summary = await advanceUntilResult(page, scenario.maxSteps, true);
      expect(summary.seed).toBe(scenario.seed);
      expect(summary.terminalReason, JSON.stringify(summary)).toBe(
        scenario.reason,
      );
      expect(summary.purchaseCount).toBeGreaterThan(0);
      expect(summary.eventTypes).toContain("shop-purchased");
      expect(summary.eventTypes).toContain("battle-started");
      expect(summary.eventTypes).toContain("run-ended");
      await expect(page.locator("#run-result")).toHaveAttribute(
        "data-result-state",
        "committed",
      );
      await expect(page.locator("#result-terminal-reason")).toHaveText(
        scenario.reason === "combat" ? "Combat defeat" : "Lifespan depleted",
      );

      await page
        .getByRole("button", { name: "Main menu", exact: true })
        .click();
      await expect(page.locator("#title-screen")).toBeVisible();
      await page.getByRole("button", { name: "Start run" }).click();
      await expect(page.locator("#gameplay-screen")).toBeVisible();
      await expect(page.getByTestId("game-status")).toHaveText("Step 0");
      await expect(page.locator("#tutorial-panel")).toBeVisible();
      await page.getByRole("button", { name: "Dismiss tutorial" }).click();
      await expect(page.locator("#tutorial-panel")).toBeHidden();
    } finally {
      await context.close();
    }
  }
});
