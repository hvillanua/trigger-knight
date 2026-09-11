import { expect, test, type Page } from "@playwright/test";
import { createGameplayExecution } from "../../src/application/gameplay-execution.js";
import { createFreshProfile } from "../../src/domain/profile.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

declare global {
  interface Window {
    testFrame(time: number): void;
  }
}

async function installFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let nextId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = (callback) => {
      callbacks.set(++nextId, callback);
      return nextId;
    };
    window.cancelAnimationFrame = (id) => {
      callbacks.delete(id);
    };
    window.testFrame = (time) => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(time));
    };
  });
  await page.goto("/");
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-renderer",
    "canvas-2d",
  );
  await page.evaluate(() => window.testFrame(0));
}

test("normal play advances automatically with no manual control", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Advance run" })).toHaveCount(
    0,
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .locator("#game-canvas")
          .getAttribute("data-observation-step"),
      ),
    )
    .toBeGreaterThan(0);
});

test("scheduled browser input and interpolated rendering match headless execution", async ({
  page,
}) => {
  await installFrames(page);
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-observation-step",
    "0",
  );
  await page.evaluate(() => {
    for (let time = 100; time <= 3000; time += 100) window.testFrame(time);
    window.testFrame(3010);
  });
  const headless = createGameplayExecution(createTestGameplayEngine(), {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "browser-run",
    initialProfile: createFreshProfile(),
  });
  for (let step = 0; step < 90; step += 1)
    headless.dispatch(step === 0 ? [{ type: "dismiss-tutorial" }] : []);
  expect(
    await page.evaluate(() => window.triggerKnightDiagnostics?.read()),
  ).toEqual(headless.readDiagnostics());
  expect(
    Number(
      await page.locator("#game-canvas").getAttribute("data-interpolation"),
    ),
  ).toBeCloseTo(0.3);
});

test("pause and tutorial commands resume at logical opportunities; leaving cancels queued input", async ({
  page,
}) => {
  await installFrames(page);
  await page.evaluate(() => window.testFrame(100));
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => window.testFrame(200));
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeEnabled();
  const paused = await page.evaluate(
    () =>
      window.triggerKnightDiagnostics?.read().checkpoints.at(-1)?.observation,
  );
  expect(paused?.lifecycle.paused).toBe(true);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.evaluate(() => window.testFrame(300));
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    window.testFrame(400);
    window.dispatchEvent(new Event("pageshow"));
    window.testFrame(1000);
    window.testFrame(1100);
  });
  const resumed = await page.evaluate(
    () =>
      window.triggerKnightDiagnostics?.read().checkpoints.at(-1)?.observation,
  );
  expect(resumed?.steps).toBe(12);
  expect(resumed?.lifecycle.paused).toBe(false);
});

test("visibility and long gaps discard elapsed time and queued actions", async ({
  page,
}) => {
  await installFrames(page);
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.testFrame(10000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.testFrame(10000);
    window.testFrame(10100);
  });
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-tutorial-page",
    "0",
  );
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.evaluate(() => {
    window.testFrame(20000);
    window.testFrame(20100);
  });
  const trace = await page.evaluate(() =>
    window.triggerKnightDiagnostics?.read(),
  );
  expect(trace?.checkpoints.at(-1)?.observation.steps).toBe(6);
  expect(
    trace?.checkpoints.every(({ commands }) => commands.length === 0),
  ).toBe(true);
});

test("automatic termination commits progression and the next run gets a fresh clock", async ({
  page,
}) => {
  await installFrames(page);
  await page.evaluate(() => {
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial")!;
    for (let time = 100; time <= 100000; time += 100) {
      if (!dismiss.disabled) dismiss.click();
      window.testFrame(time);
    }
  });
  await expect(page.locator("#game-status")).toHaveAttribute(
    "data-completion-status",
    "committed",
  );
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-phase",
    "ended",
  );
  const terminal = await page.evaluate(() =>
    window.triggerKnightDiagnostics?.read(),
  );
  await page.evaluate(() => window.testFrame(100100));
  expect(
    await page.evaluate(() => window.triggerKnightDiagnostics?.read()),
  ).toEqual(terminal);
  await page.getByRole("button", { name: "Start next run" }).click();
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-observation-step",
    "0",
  );
  await page.evaluate(() => {
    window.testFrame(200000);
    window.testFrame(200100);
  });
  const nextRun = await page.evaluate(() =>
    window.triggerKnightDiagnostics?.read(),
  );
  expect(nextRun?.config.seed).toBe("browser-run-2");
  expect(nextRun?.checkpoints.at(-1)?.observation.steps).toBe(3);
  expect(
    nextRun?.checkpoints.every(({ commands }) => commands.length === 0),
  ).toBe(true);
});
