import { expect, test, type Page } from "@playwright/test";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";

async function openReadyWorld(page: Page) {
  await page.goto("/?manual=1");
  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute(
    "data-asset-source",
    "original-runtime-assets",
  );
  await expect
    .poll(() => canvas.getAttribute("data-asset-status"), {
      timeout: 5_000,
      message: "the original runtime assets should load within five seconds",
    })
    .toBe("ready");
  return canvas;
}

test("loads original runtime assets and produces a readable world screenshot", async ({
  page,
}, testInfo) => {
  const canvas = await openReadyWorld(page);
  await expect(canvas).toHaveAttribute("data-sprite-mode", "atlas");
  await expect(canvas).toHaveAttribute("data-world-camera", "0,0,480,320");

  const sprites = (await canvas.getAttribute("data-rendered-sprites"))?.split(
    ",",
  );
  expect(sprites).toEqual(
    expect.arrayContaining(["hero", "weapon", "armor", "elixir"]),
  );

  const screenshot = await canvas.screenshot();
  await testInfo.attach("running-world.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expect(screenshot.byteLength).toBeGreaterThan(1_000);
});

test("clips the lifespan fill inside its original frame", async ({ page }) => {
  await openReadyWorld(page);

  const fillDetails = await page.evaluate(async (modulePath) => {
    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof CanvasPresentationModule;
    const base =
      window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
    if (base === undefined) throw new Error("Expected the initial observation");

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 320;
    document.body.append(canvas);
    const presentation = new CanvasPresentation(canvas);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (canvas.dataset.assetStatus === "ready") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (canvas.dataset.assetStatus !== "ready") {
      throw new Error(
        `Timed out waiting for renderer assets: ${canvas.dataset.assetStatus ?? "missing status"}`,
      );
    }

    let clipCount = 0;
    let clipsBeforeFill = 0;
    let fillArgs: number[] = [];
    let frameArgs: number[] = [];
    const lifespanTextCalls: {
      text: string;
      x: number;
      y: number;
      font: string;
    }[] = [];
    const clipDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "clip",
    );
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    const fillTextDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillText",
    );
    if (
      typeof clipDescriptor?.value !== "function" ||
      typeof drawImageDescriptor?.value !== "function" ||
      typeof fillTextDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas 2D methods");
    }
    const originalClip = clipDescriptor.value as () => void;
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    const originalFillText = fillTextDescriptor.value as (
      this: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) => void;
    CanvasRenderingContext2D.prototype.clip = function () {
      clipCount += 1;
      originalClip.call(this);
    };
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement && image.src.includes("/251.png")) {
        clipsBeforeFill = clipCount;
        fillArgs = args;
      }
      if (image instanceof HTMLImageElement && image.src.includes("/253.png")) {
        frameArgs = args;
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      if (["LIFESPAN", "51", "19", "%"].includes(String(text))) {
        lifespanTextCalls.push({
          text: String(text),
          x,
          y,
          font: this.font,
        });
      }
      originalFillText.call(this, text, x, y, maxWidth);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        lifespan: { whole: 51, fraction: 19 },
        lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [],
      });
      return {
        clipCount,
        clipsBeforeFill,
        fillArgs,
        frameArgs,
        lifespanTextCalls,
      };
    } finally {
      CanvasRenderingContext2D.prototype.clip = originalClip;
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(fillDetails.clipsBeforeFill).toBeGreaterThanOrEqual(2);
  expect(fillDetails.fillArgs).toEqual([162, 12, 305, 10]);
  expect(fillDetails.frameArgs).toEqual([160, 10, 309, 14]);
  expect(fillDetails.lifespanTextCalls).toEqual([
    expect.objectContaining({
      text: "LIFESPAN",
      x: 217,
      y: 31,
      font: expect.stringContaining("20px"),
    }),
    expect.objectContaining({
      text: "51",
      x: 420,
      y: 39,
      font: expect.stringContaining("32px"),
    }),
    expect.objectContaining({
      text: "19",
      x: 430,
      y: 31,
      font: expect.stringContaining("20px"),
    }),
    expect.objectContaining({
      text: "%",
      x: 454,
      y: 38,
      font: expect.stringContaining("30px"),
    }),
  ]);
});

test("clips the health fill inside its original frame", async ({ page }) => {
  await openReadyWorld(page);

  const fillClipCount = await page.evaluate(async (modulePath) => {
    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof CanvasPresentationModule;
    const base =
      window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
    if (base === undefined) throw new Error("Expected the initial observation");

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 320;
    document.body.append(canvas);
    const presentation = new CanvasPresentation(canvas);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (canvas.dataset.assetStatus === "ready") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (canvas.dataset.assetStatus !== "ready") {
      throw new Error(
        `Timed out waiting for renderer assets: ${canvas.dataset.assetStatus ?? "missing status"}`,
      );
    }

    let clipCount = 0;
    let clipsBeforeFill = 0;
    const clipDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "clip",
    );
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (
      typeof clipDescriptor?.value !== "function" ||
      typeof drawImageDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas 2D methods");
    }
    const originalClip = clipDescriptor.value as () => void;
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.clip = function () {
      clipCount += 1;
      originalClip.call(this);
    };
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement && image.src.includes("/202.png")) {
        clipsBeforeFill = clipCount;
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [],
      });
      return clipsBeforeFill;
    } finally {
      CanvasRenderingContext2D.prototype.clip = originalClip;
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(fillClipCount).toBeGreaterThan(4);
});

test("omits a missing original building without drawing a fallback", async ({
  page,
}) => {
  await page.route("**/assets/original/images/366.png", (route) =>
    route.abort(),
  );
  await page.goto("/?manual=1");

  const fallbackCalls = await page.evaluate(async (modulePath) => {
    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof CanvasPresentationModule;
    const base =
      window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
    if (base === undefined) throw new Error("Expected the initial observation");

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 320;
    document.body.append(canvas);
    const presentation = new CanvasPresentation(canvas);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (canvas.dataset.assetStatus !== "loading") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (canvas.dataset.assetStatus !== "partial") {
      throw new Error(
        `Expected partial renderer assets, got ${canvas.dataset.assetStatus ?? "missing status"}`,
      );
    }

    const fillRectDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillRect",
    );
    if (typeof fillRectDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas fillRect method");
    }
    const originalFillRect = fillRectDescriptor.value as (
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => void;
    let buildingFallbackCalls = 0;
    CanvasRenderingContext2D.prototype.fillRect = function (
      x,
      y,
      width,
      height,
    ): void {
      if (width === 56 && height === 57) buildingFallbackCalls += 1;
      originalFillRect.call(this, x, y, width, height);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        encounters: {
          ...base.encounters,
          current: {
            kind: "shop" as const,
            shop: "pharmacy" as const,
            cachedPrice: 150,
            x: 180,
            used: false,
          },
        },
        actions: { ...base.actions, canPurchaseCurrentEncounter: true },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [],
      });
      return buildingFallbackCalls;
    } finally {
      CanvasRenderingContext2D.prototype.fillRect = originalFillRect;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(fallbackCalls).toBe(0);
});

test("animates the session-over bands over a composited world", async ({
  page,
}) => {
  await openReadyWorld(page);

  const animation = await page.evaluate(async (modulePath) => {
    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof CanvasPresentationModule;
    const base =
      window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
    if (base === undefined) throw new Error("Expected the initial observation");

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 320;
    canvas.style.width = "480px";
    canvas.style.height = "320px";
    document.body.append(canvas);
    const presentation = new CanvasPresentation(canvas);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (canvas.dataset.assetStatus === "ready") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (canvas.dataset.assetStatus !== "ready") {
      throw new Error(
        `Timed out waiting for renderer assets: ${canvas.dataset.assetStatus ?? "missing status"}`,
      );
    }

    const bands: Array<{ y: number; height: number }> = [];
    const actorDraws: string[] = [];
    const fillRectDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillRect",
    );
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (
      typeof fillRectDescriptor?.value !== "function" ||
      typeof drawImageDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas 2D methods");
    }
    const originalFillRect = fillRectDescriptor.value as (
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => void;
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.fillRect = function (
      x,
      y,
      width,
      height,
    ) {
      if (width === 480 && height !== 320) bands.push({ y, height });
      originalFillRect.call(this, x, y, width, height);
    };
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (
        image instanceof HTMLImageElement &&
        image.src.includes("/key-sprites/")
      ) {
        actorDraws.push(image.src);
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        lifecycle: {
          ...base.lifecycle,
          phase: "ended" as const,
          terminalReason: "combat" as const,
          paused: true,
          tutorialPage: null,
        },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [],
      });
      const initial = bands.slice(-2);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { initial, final: bands.slice(-2), actorDraws };
    } finally {
      CanvasRenderingContext2D.prototype.fillRect = originalFillRect;
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(animation.initial).toEqual([
    { y: -45, height: 41 },
    { y: 330, height: -10 },
  ]);
  expect(animation.final).toEqual([
    { y: 0, height: 41 },
    { y: 280, height: 40 },
  ]);
  expect(animation.actorDraws.length).toBeGreaterThan(0);
});

test("changes composited scenery when public distance is interpolated", async ({
  page,
}) => {
  await openReadyWorld(page);

  const changedPixels = await page.evaluate(async (modulePath) => {
    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof CanvasPresentationModule;
    const base =
      window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
    if (base === undefined) throw new Error("Expected the initial observation");
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 320;
    document.body.append(canvas);
    const presentation = new CanvasPresentation(canvas);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (canvas.dataset.assetStatus === "ready") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (canvas.dataset.assetStatus !== "ready") {
      throw new Error(
        `Timed out waiting for renderer assets: ${canvas.dataset.assetStatus ?? "missing status"}`,
      );
    }
    const current = { ...base, steps: base.steps + 1, distance: 10 };
    const snapshot = (): Uint8ClampedArray => {
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("Expected a Canvas 2D context");
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };

    presentation.present({
      previous: base,
      current,
      interpolation: 0,
      events: [],
    });
    const start = snapshot();
    presentation.present({
      previous: base,
      current,
      interpolation: 1,
      events: [],
    });
    const end = snapshot();
    let changed = 0;
    for (let index = 0; index < start.length; index += 1) {
      if (start[index] !== end[index]) changed += 1;
    }
    return changed;
  }, "/src/browser/canvas-presentation.ts");

  expect(changedPixels).toBeGreaterThan(100);
});
