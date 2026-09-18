import { expect, test, type Page } from "@playwright/test";

import { createGameplayExecution } from "../../src/application/gameplay-execution.js";
import type { GameplayTrace } from "../../src/application/gameplay-execution.js";
import type {
  PresentationFrame,
  PresentationTransition,
} from "../../src/application/contracts.js";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";
import type * as EngineModule from "../../src/application/gameplay-engine.js";
import type * as RulesModule from "../../src/domain/rulesets.js";
import type * as SessionModule from "../../src/browser/gameplay-session.js";
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

const REDUCED_MOTION_PARITY_RENDER_EVERY = 11;

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
        fullscreenElement = document.querySelector("#app-shell");
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

test("keeps fullscreen active while moving from a finished run to player status", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await installFullscreenStub(page, "working");
  await seedDisabledTutorialProfile(page);
  await page.goto("/?manual=1&seed=milestone-2-lifecycle-2&diagnostics=1");

  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null))
    .toBe("app-shell");

  const summary = await advanceUntilResult(page, 2_600, false);
  expect(summary.terminalReason, JSON.stringify(summary)).toBe("lifespan");
  await expect(page.locator("#run-result")).toHaveAttribute(
    "data-result-state",
    "committed",
  );
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null))
    .toBe("app-shell");

  await expect(
    page.getByRole("button", { name: "View achievements" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View achievements" }).click();
  await expect(
    page.getByRole("heading", { name: "Achievements" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exit fullscreen" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null))
    .toBe("app-shell");

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View collections" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View collections" }).click();
  await expect(
    page.getByRole("heading", { name: "PLAYER STATUS" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exit fullscreen" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null))
    .toBe("app-shell");

  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null))
    .toBeNull();
});

async function advanceUntilResult(
  page: Page,
  maxSteps: number,
  purchase: boolean,
) {
  const summary = await page.evaluate(
    ({ maxSteps: stepLimit, purchase: purchaseShops }) => {
      const advance = document.querySelector<HTMLButtonElement>("#advance-run");
      const purchase = document.querySelector<HTMLButtonElement>(
        "#purchase-current-encounter",
      );
      const dismiss =
        document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
      const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
      const diagnostics = window.triggerKnightDiagnostics;
      if (
        advance === null ||
        purchase === null ||
        dismiss === null ||
        canvas === null
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
        if (canvas.dataset.visualScene === "ended") break;
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
        ended: canvas.dataset.visualScene === "ended",
        eventTypes: trace.checkpoints.flatMap(({ events }) =>
          events.map(({ type }) => type),
        ),
      };
    },
    { maxSteps, purchase },
  );
  if (summary.ended || summary.terminalReason !== null) {
    await page.locator("#game-canvas").click({ position: { x: 240, y: 160 } });
  }
  return summary;
}

type TraceParity = {
  readonly config: GameplayTrace["config"];
  readonly traceHash: string;
  readonly length: number;
  readonly commands: readonly GameplayTrace["checkpoints"][number]["commands"][];
};

type SampledTraceParity = TraceParity & {
  readonly renderedFrames: number;
};

async function readTraceParity(page: Page): Promise<TraceParity> {
  return page.evaluate(() => {
    const trace = window.triggerKnightDiagnostics?.read();
    if (trace === undefined) throw new Error("Missing browser diagnostics");
    return {
      config: trace.config,
      traceHash: trace.traceHash,
      length: trace.checkpoints.length,
      commands: trace.checkpoints.slice(1).map(({ commands }) => commands),
    };
  });
}

async function replayWithSampledCanvas(
  page: Page,
  input: Readonly<{
    readonly config: GameplayTrace["config"];
    readonly commands: TraceParity["commands"];
    readonly renderEvery: number;
  }>,
): Promise<SampledTraceParity> {
  return page.evaluate(async ({ config, commands, renderEvery }) => {
    const enginePath = "/src/application/gameplay-engine.ts";
    const sessionPath = "/src/browser/gameplay-session.ts";
    const rulesPath = "/src/domain/rulesets.ts";
    const presentationPath = "/src/browser/canvas-presentation.ts";
    const engineModule = (await import(enginePath)) as typeof EngineModule;
    const sessionModule = (await import(sessionPath)) as typeof SessionModule;
    const rulesModule = (await import(rulesPath)) as typeof RulesModule;
    const presentationModule = (await import(
      presentationPath
    )) as typeof CanvasPresentationModule;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    document.body.append(canvas);
    const presentation = new presentationModule.CanvasPresentation(canvas);
    presentation.resize(
      { width: innerWidth, height: innerHeight },
      devicePixelRatio,
    );
    let renderedFrames = 0;
    const session = sessionModule.createBrowserGameplaySession(
      engineModule.createGameplayEngine(rulesModule.ruleSetRegistry),
      config,
      {
        present(frame: PresentationFrame) {
          if (
            frame.current.steps % renderEvery !== 0 &&
            frame.current.lifecycle.terminalReason === null
          ) {
            return;
          }
          renderedFrames += 1;
          presentation.present(frame);
        },
        presentTransition(transition: PresentationTransition) {
          presentation.presentTransition(transition);
        },
      },
      { renderOnDispatch: false, retainDiagnostics: true },
    );

    for (const commandBatch of commands) {
      session.dispatch(commandBatch);
      if (session.readObservation().steps % renderEvery === 0) {
        session.render(1);
      }
    }
    session.render(1);

    const trace = session.readDiagnostics();
    return {
      config: trace.config,
      traceHash: trace.traceHash,
      length: trace.checkpoints.length,
      commands: trace.checkpoints.slice(1).map(({ commands: batch }) => batch),
      renderedFrames,
    };
  }, input);
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
  await expect(
    page.evaluate(() => window.triggerKnightDiagnostics),
  ).resolves.toBeUndefined();
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
    await reducedPage.emulateMedia({ reducedMotion: "reduce" });
    await seedDisabledTutorialProfile(reducedPage);
    await reducedPage.goto("/?manual=1&seed=m4-policy-3&diagnostics=1");
    const reducedSummary = await advanceUntilResult(reducedPage, 12_000, true);
    const reducedTrace = await readTraceParity(reducedPage);

    expect(
      reducedSummary,
      JSON.stringify({
        ...reducedSummary,
        eventTypes: reducedSummary.eventTypes.length,
      }),
    ).toMatchObject({
      seed: "m4-policy-3",
      terminalReason: "lifespan",
    });
    expect(reducedSummary.purchaseCount).toBeGreaterThan(0);
    expect(reducedSummary.eventTypes).toContain("shop-purchased");
    expect(reducedSummary.eventTypes).toContain("battle-started");
    expect(reducedSummary.eventTypes).toContain("run-ended");

    await normalPage.emulateMedia({ reducedMotion: "no-preference" });
    await normalPage.goto("/?manual=1");
    const normalReplay = await replayWithSampledCanvas(normalPage, {
      config: reducedTrace.config,
      commands: reducedTrace.commands,
      renderEvery: REDUCED_MOTION_PARITY_RENDER_EVERY,
    });
    expect({
      config: normalReplay.config,
      traceHash: normalReplay.traceHash,
      length: normalReplay.length,
      commands: normalReplay.commands,
    }).toEqual(reducedTrace);
    expect(normalReplay.renderedFrames).toBeGreaterThan(0);

    const headless = createGameplayExecution(
      createTestGameplayEngine(),
      {
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "m4-policy-3",
        initialProfile: disabledTutorialProfile,
        startImmediately: true,
      },
      { retainDiagnostics: true },
    );
    for (const commands of reducedTrace.commands) {
      headless.dispatch(commands);
    }
    const headlessTrace = headless.readDiagnostics();
    expect(headlessTrace.config).toEqual(reducedTrace.config);
    expect(headlessTrace.traceHash).toBe(reducedTrace.traceHash);

    await expect(reducedPage.locator("#run-result")).toHaveAttribute(
      "data-result-state",
      "committed",
    );
    await expect(reducedPage.locator("#result-terminal-reason")).toHaveText(
      "Lifespan depleted",
    );
    await expect(reducedPage.locator(".result-score-actions")).toBeVisible();
    await expect(reducedPage.locator("#run-result")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
    await expect(reducedPage.locator("#result-score-count")).toHaveAttribute(
      "data-state",
      "complete",
    );
    await expect(
      reducedPage.getByRole("button", { name: "Skip score count" }),
    ).toBeHidden();
    await expect(reducedPage.locator("#result-save-status")).toHaveText(
      "Progress saved.",
    );

    const saved = await reducedPage.evaluate((key) => {
      const value = window.localStorage.getItem(key);
      if (value === null) throw new Error("Expected a committed profile");
      return value;
    }, PROFILE_STORAGE_KEY);
    await reducedPage.goto("/?manual=1&seed=m4-policy-3&diagnostics=1");
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

test("dismisses the original session-over screen with keyboard activation", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await seedDisabledTutorialProfile(page);
  await page.goto("/?manual=1&seed=milestone-2-lifecycle-2");

  const ended = await page.evaluate(() => {
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
    if (advance === null || dismiss === null) {
      throw new Error("Missing manual run controls");
    }
    if (!dismiss.disabled) dismiss.click();
    for (let step = 0; step < 2_600; step += 1) {
      if (advance.disabled) break;
      advance.click();
      if (
        document.querySelector<HTMLCanvasElement>("#game-canvas")?.dataset
          .visualScene === "ended"
      ) {
        return true;
      }
    }
    return false;
  });

  expect(ended).toBe(true);
  const canvas = page.locator("#game-canvas");
  await expect(canvas).toHaveAttribute("data-visual-scene", "ended");
  await expect(page.locator("#toggle-fullscreen")).toBeHidden();
  await expect(page.locator("#run-result")).toBeHidden();
  const screenshot = await canvas.screenshot();
  await testInfo.attach("session-over-human-review.png", {
    body: screenshot,
    contentType: "image/png",
  });

  await canvas.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#run-result")).toHaveAttribute(
    "data-result-state",
    "committed",
  );
});

test("completes the combat death path and starts another real browser run", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  for (const scenario of [
    { seed: "m4-policy-2211", reason: "combat", maxSteps: 20_000 },
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 640, height: 360 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    try {
      await seedDisabledTutorialProfile(page);
      await page.goto(`/?manual=1&seed=${scenario.seed}&diagnostics=1`);
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
      await expect(page.locator(".result-score-actions")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Skip score count" }),
      ).toBeHidden();

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
