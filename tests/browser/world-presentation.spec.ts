import { expect, test, type Browser, type Page } from "@playwright/test";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";

const VISUAL_VIEWPORT = Object.freeze({ width: 480, height: 320 });
const VISUAL_DEVICE_SCALE_FACTOR = 1;

async function openReadyWorld(page: Page) {
  await page.goto("/?manual=1&diagnostics=1");
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

async function openStableWorld(browser: Browser) {
  const context = await browser.newContext({
    viewport: VISUAL_VIEWPORT,
    deviceScaleFactor: VISUAL_DEVICE_SCALE_FACTOR,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?manual=1&seed=issue-144-visual");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute(
    "data-asset-source",
    "original-runtime-assets",
  );
  await expect(canvas).toHaveAttribute("data-asset-status", "ready");
  await expect(canvas).toHaveAttribute("data-font-status", "ready");
  await page.evaluate(() => document.fonts.ready);
  await expect(canvas).toHaveAttribute("data-reduced-motion", "true");
  await expect(canvas).toHaveAttribute("data-world-camera", "0,0,480,320");

  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await expect(canvas).not.toHaveAttribute("data-tutorial-page");
  await expect(canvas).toHaveAttribute("data-observation-step", "1");
  await expect(canvas).toHaveAttribute("data-interpolation", "1");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      ),
  );

  return { context, page, canvas };
}

test("checks the controlled world frame and attaches human-review evidence", async ({
  browser,
}, testInfo) => {
  test.setTimeout(30_000);
  const { context, page, canvas } = await openStableWorld(browser);
  try {
    await expect(canvas).toHaveAttribute("data-sprite-mode", "atlas");
    const sprites = (await canvas.getAttribute("data-rendered-sprites"))?.split(
      ",",
    );
    expect(sprites).toEqual(
      expect.arrayContaining(["hero", "weapon", "armor", "elixir"]),
    );

    const screenshot = await canvas.screenshot();
    await testInfo.attach("running-world-human-review.png", {
      body: screenshot,
      contentType: "image/png",
    });

    // PNG byte length says nothing about what the renderer drew. These probes
    // cover the staged scene, actor, HUD, and lifespan assets instead.
    const evidence = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
      if (canvas === null) throw new Error("Missing game canvas");
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("Expected a Canvas 2D context");

      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = image.data;
      const worldToPixel = (
        value: number,
        worldSize: number,
        pixelSize: number,
      ): number =>
        Math.max(
          0,
          Math.min(pixelSize - 1, Math.floor((value / worldSize) * pixelSize)),
        );
      const region = (
        x: number,
        y: number,
        width: number,
        height: number,
        matches: (
          red: number,
          green: number,
          blue: number,
          alpha: number,
        ) => boolean,
      ) => {
        const startX = worldToPixel(x, 480, image.width);
        const startY = worldToPixel(y, 320, image.height);
        const endX = Math.max(
          startX + 1,
          Math.min(image.width, Math.ceil(((x + width) / 480) * image.width)),
        );
        const endY = Math.max(
          startY + 1,
          Math.min(
            image.height,
            Math.ceil(((y + height) / 320) * image.height),
          ),
        );
        const colors = new Set<string>();
        let matchingPixels = 0;
        for (let pixelY = startY; pixelY < endY; pixelY += 1) {
          for (let pixelX = startX; pixelX < endX; pixelX += 1) {
            const index = (pixelY * image.width + pixelX) * 4;
            const red = pixels[index] ?? 0;
            const green = pixels[index + 1] ?? 0;
            const blue = pixels[index + 2] ?? 0;
            const alpha = pixels[index + 3] ?? 0;
            colors.add(`${red},${green},${blue},${alpha}`);
            if (matches(red, green, blue, alpha)) matchingPixels += 1;
          }
        }
        return { distinctColors: colors.size, matchingPixels };
      };

      return {
        width: canvas.width,
        height: canvas.height,
        devicePixelRatio: window.devicePixelRatio,
        regions: {
          sky: region(
            0,
            0,
            480,
            80,
            (red, green, blue, alpha) =>
              alpha === 255 &&
              red >= 80 &&
              red <= 190 &&
              green >= 160 &&
              blue >= 170,
          ),
          mountains: region(
            0,
            95,
            480,
            70,
            (red, green, blue, alpha) =>
              alpha === 255 && red < 130 && green > red + 20 && blue > red + 20,
          ),
          ground: region(
            0,
            180,
            480,
            60,
            (red, green, blue, alpha) =>
              alpha === 255 &&
              green > red * 1.25 &&
              green > blue * 1.1 &&
              green > 60,
          ),
          hero: region(
            24,
            150,
            68,
            78,
            (red, green, blue, alpha) =>
              alpha === 255 &&
              red >= 20 &&
              red <= 80 &&
              green >= 5 &&
              green <= 50 &&
              blue <= 35 &&
              red > green + 8,
          ),
          hud: region(
            0,
            251,
            480,
            69,
            (red, green, blue, alpha) =>
              alpha === 255 && red < 25 && green < 35 && blue < 45,
          ),
          lifespan: region(
            155,
            7,
            301,
            20,
            (red, green, blue, alpha) =>
              alpha === 255 &&
              red >= 180 &&
              green >= 120 &&
              blue <= 120 &&
              red > green * 1.1,
          ),
        },
      };
    });

    expect(evidence.width).toBeGreaterThan(1);
    expect(evidence.height).toBeGreaterThan(1);
    expect(evidence.devicePixelRatio).toBe(VISUAL_DEVICE_SCALE_FACTOR);
    for (const [name, visual] of Object.entries(evidence.regions)) {
      expect(
        visual.distinctColors,
        `${name} should contain rendered detail`,
      ).toBeGreaterThan(100);
    }
    expect(evidence.regions.sky.matchingPixels).toBeGreaterThan(1_000);
    expect(evidence.regions.mountains.matchingPixels).toBeGreaterThan(1_000);
    expect(evidence.regions.ground.matchingPixels).toBeGreaterThan(1_000);
    expect(evidence.regions.hero.matchingPixels).toBeGreaterThan(50);
    expect(evidence.regions.hud.matchingPixels).toBeGreaterThan(1_000);
    expect(evidence.regions.lifespan.matchingPixels).toBeGreaterThan(500);
  } finally {
    await context.close();
  }
});

test("uses one offscreen canvas for the static scenery cache", async ({
  page,
}) => {
  await page.goto("/?manual=1&diagnostics=1");

  const cachedCanvasDraws = await page.evaluate(async (modulePath) => {
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
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected Canvas drawImage");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    let cachedCanvasDraws = 0;
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLCanvasElement) cachedCanvasDraws += 1;
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    try {
      const presentation = new CanvasPresentation(canvas);
      presentation.present({
        previous: base,
        current: base,
        interpolation: 1,
        events: [],
      });
      return cachedCanvasDraws;
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(cachedCanvasDraws).toBe(1);
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
  await page.route("**/assets/original/images/366.png**", (route) =>
    route.request().resourceType() === "image"
      ? route.abort()
      : route.continue(),
  );
  await page.goto("/?manual=1&diagnostics=1");

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

test("retains presentation effects through redraw, pause, and batched transitions", async ({
  page,
}) => {
  await openReadyWorld(page);

  const result = await page.evaluate(async (modulePath) => {
    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof CanvasPresentationModule;
    const base =
      window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
    if (base === undefined) throw new Error("Expected the initial observation");

    const createPresentation = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 320;
      document.body.append(canvas);
      const presentation = new CanvasPresentation(canvas);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (canvas.dataset.assetStatus === "ready") {
          return { presentation, canvas };
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(
        `Timed out waiting for renderer assets: ${canvas.dataset.assetStatus ?? "missing status"}`,
      );
    };

    const purchase = {
      type: "shop-purchased" as const,
      shop: "armorsmith" as const,
      price: 204,
    };
    const purchased = {
      ...base,
      steps: 10,
      activeTicks: 10,
      lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
      player: {
        ...base.player,
        gold: 188,
        armor: { ...base.player.armor, name: "Protector" as const, tier: 1 },
      },
      encounters: {
        ...base.encounters,
        current: {
          kind: "shop" as const,
          shop: "armorsmith" as const,
          cachedPrice: 204,
          x: 180,
          used: true,
        },
      },
    };
    const next = { ...purchased, steps: 11, activeTicks: 11 };
    const later = { ...purchased, steps: 12, activeTicks: 12 };
    const paused = {
      ...later,
      steps: 13,
      lifecycle: { ...later.lifecycle, paused: true },
    };
    const resumed = { ...later, steps: 14, activeTicks: 13 };
    const expired = { ...resumed, steps: 60, activeTicks: 60 };

    const { presentation: messagePresentation, canvas: messageCanvas } =
      await createPresentation();
    const fillTexts: string[] = [];
    const fillTextDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillText",
    );
    if (typeof fillTextDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas fillText method");
    }
    const originalFillText = fillTextDescriptor.value as (
      this: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) => void;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      fillTexts.push(String(text));
      originalFillText.call(this, text, x, y, maxWidth);
    };
    const snapshot = (): string[] => {
      const values = [...fillTexts];
      fillTexts.length = 0;
      return values;
    };
    try {
      messagePresentation.presentTransition({
        previous: base,
        current: purchased,
        events: [purchase],
      });
      messagePresentation.present({
        previous: base,
        current: purchased,
        interpolation: 0,
        events: [purchase],
      });
      const first = snapshot();
      messagePresentation.presentTransition({
        previous: purchased,
        current: next,
        events: [],
      });
      messagePresentation.presentTransition({
        previous: next,
        current: later,
        events: [],
      });
      messagePresentation.present({
        previous: next,
        current: later,
        interpolation: 0,
        events: [purchase],
      });
      const batched = snapshot();
      messagePresentation.presentTransition({
        previous: later,
        current: paused,
        events: [],
      });
      messagePresentation.present({
        previous: later,
        current: paused,
        interpolation: 0,
        events: [],
      });
      const pausedEffects = messageCanvas.dataset.activeEffects;
      messagePresentation.presentTransition({
        previous: paused,
        current: resumed,
        events: [],
      });
      messagePresentation.present({
        previous: paused,
        current: resumed,
        interpolation: 0,
        events: [],
      });
      const resumedTexts = snapshot();
      messagePresentation.present({
        previous: resumed,
        current: expired,
        interpolation: 0,
        events: [],
      });
      const expiredTexts = snapshot();

      const { presentation: effectPresentation, canvas: effectCanvas } =
        await createPresentation();
      const effectCurrent = {
        ...base,
        steps: 5,
        encounters: {
          ...base.encounters,
          current: {
            kind: "shop" as const,
            shop: "pharmacy" as const,
            cachedPrice: 150,
            x: 180,
            used: true,
          },
        },
      };
      const effectEvents = [
        { type: "step-advanced" as const, step: 5 },
        { ...purchase },
      ];
      effectPresentation.present({
        previous: base,
        current: effectCurrent,
        interpolation: 0,
        events: effectEvents,
      });
      const firstSequence = effectCanvas.dataset.effectSequence;
      effectPresentation.present({
        previous: base,
        current: effectCurrent,
        interpolation: 0.5,
        events: effectEvents,
      });
      const redrawSequence = effectCanvas.dataset.effectSequence;
      effectPresentation.present({
        previous: effectCurrent,
        current: { ...effectCurrent, steps: 6 },
        interpolation: 1,
        events: [
          { type: "step-advanced" as const, step: 6 },
          { type: "item-used" as const, item: "elixir" as const },
        ],
      });
      const nextSequence = effectCanvas.dataset.effectSequence;

      const { presentation: retentionPresentation, canvas: retentionCanvas } =
        await createPresentation();
      const battle = {
        ...base,
        steps: 10,
        activeTicks: 10,
        lifecycle: {
          ...base.lifecycle,
          paused: false,
          tutorialPage: null,
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 671 },
          actors: {
            hero: { phase: "attack" as const, x: 150 },
            enemy: { phase: "flinch" as const, x: 210 },
          },
        },
      };
      const hit = {
        type: "combat-hit" as const,
        attacker: "hero" as const,
        target: "enemy" as const,
        damage: 229,
        critical: false,
        remainingHp: 671,
      };
      const show = (
        current: typeof battle,
        events: readonly (typeof hit)[] = [],
      ): string => {
        retentionPresentation.present({
          previous: battle,
          current,
          interpolation: 0,
          events,
        });
        return retentionCanvas.dataset.activeEffects ?? "";
      };
      const firstEffects = show(battle, [hit]);
      const redrawEffects = show(battle);
      const pausedBattle = {
        ...battle,
        steps: 12,
        lifecycle: { ...battle.lifecycle, paused: true },
      };
      const pausedBattleEffects = show(pausedBattle);
      const resumedBattle = { ...battle, steps: 13, activeTicks: 11 };
      const resumedBattleEffects = show(resumedBattle);
      const continuedEffects = show({ ...battle, steps: 14, activeTicks: 14 });
      const expiredEffects = show({ ...battle, steps: 30, activeTicks: 30 });

      return {
        first,
        batched,
        pausedEffects,
        resumedTexts,
        expiredTexts,
        firstSequence,
        redrawSequence,
        nextSequence,
        firstEffects,
        redrawEffects,
        pausedBattleEffects,
        resumedBattleEffects,
        continuedEffects,
        expiredEffects,
      };
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.first).toContain("Upgrade: Clothing > Protector");
  expect(result.batched).toContain("Upgrade: Clothing > Protector");
  expect(result.resumedTexts).toContain("Upgrade: Clothing > Protector");
  expect(result.pausedEffects).toContain("shop-purchased");
  expect(result.expiredTexts).not.toContain("Upgrade: Clothing > Protector");
  expect(result.redrawSequence).toBe(result.firstSequence);
  expect(Number(result.nextSequence)).toBeGreaterThan(
    Number(result.redrawSequence),
  );
  expect(result.firstEffects).toContain("combat-hit");
  expect(result.redrawEffects).toContain("combat-hit");
  expect(result.pausedBattleEffects).toContain("combat-hit");
  expect(result.resumedBattleEffects).toContain("combat-hit");
  expect(result.continuedEffects).toContain("combat-hit");
  expect(result.expiredEffects).not.toContain("combat-hit");
});

test("uses original action feedback without procedural substitutes", async ({
  page,
}) => {
  await openReadyWorld(page);

  const feedback = await page.evaluate(async (modulePath) => {
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

    const frames: string[] = [];
    let arcCount = 0;
    let goldIconCount = 0;
    const rewardTexts: string[] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    const arcDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "arc",
    );
    const fillTextDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillText",
    );
    if (
      typeof drawImageDescriptor?.value !== "function" ||
      typeof arcDescriptor?.value !== "function" ||
      typeof fillTextDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas 2D methods");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    const originalArc = arcDescriptor.value as CanvasRenderingContext2D["arc"];
    const originalFillText = fillTextDescriptor.value as (
      this: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) => void;
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement) {
        if (image.src.includes("/DefineSprite_")) {
          frames.push(image.src.split("/assets/original/effects/")[1] ?? "");
        }
        if (image.src.includes("/164.png")) goldIconCount += 1;
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      arcCount += 1;
      originalArc.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      if (String(text) === "+100G") rewardTexts.push(String(text));
      originalFillText.call(this, text, x, y, maxWidth);
    };

    try {
      const purchased = {
        ...base,
        steps: 10,
        activeTicks: 10,
        lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
        player: {
          ...base.player,
          armor: { ...base.player.armor, name: "Protector" as const, tier: 1 },
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "shop" as const,
            shop: "armorsmith" as const,
            cachedPrice: 204,
            x: 180,
            used: true,
          },
        },
      };
      presentation.present({
        previous: base,
        current: purchased,
        interpolation: 0,
        events: [
          { type: "shop-purchased" as const, shop: "armorsmith", price: 204 },
        ],
      });
      const upgradeFrames = [...frames];
      const upgradeArcCount = arcCount;

      frames.length = 0;
      arcCount = 0;
      const itemUsed = {
        ...purchased,
        steps: 11,
        activeTicks: 11,
        lifecycle: { ...purchased.lifecycle, phase: "battling" as const },
        player: {
          ...purchased.player,
          inventory: { ...purchased.player.inventory, item: null },
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 900 },
          actors: {
            hero: { phase: "idle" as const, x: 90 },
            enemy: { phase: "idle" as const, x: 220 },
          },
        },
        encounters: {
          ...purchased.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "goblin" as const, maximumHp: 900 },
            x: 220,
          },
        },
      };
      presentation.present({
        previous: purchased,
        current: itemUsed,
        interpolation: 0,
        events: [{ type: "item-used" as const, item: "elixir" as const }],
      });
      const itemFrames = [...frames];
      const itemArcCount = arcCount;

      const battle = {
        ...base,
        steps: 1,
        activeTicks: 1,
        lifecycle: {
          ...base.lifecycle,
          phase: "battling" as const,
          paused: false,
          tutorialPage: null,
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 0 },
          actors: {
            hero: { phase: "idle" as const, x: 190 },
            enemy: { phase: "dead" as const, x: 310 },
          },
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "goblin" as const, maximumHp: 900 },
            x: 310,
          },
        },
      };
      const running = {
        ...base,
        steps: 2,
        activeTicks: 2,
        lifecycle: {
          ...base.lifecycle,
          phase: "running" as const,
          paused: false,
          tutorialPage: null,
        },
        battle: null,
        encounters: { ...base.encounters, current: null },
      };
      presentation.presentTransition({
        previous: battle,
        current: running,
        events: [
          {
            type: "battle-reward" as const,
            enemy: "goblin" as const,
            gold: 100,
            score: 100,
            profileExp: 10,
            dragonKilled: false,
          },
        ],
      });
      presentation.present({
        previous: battle,
        current: running,
        interpolation: 1,
        events: [
          {
            type: "battle-reward" as const,
            enemy: "goblin" as const,
            gold: 100,
            score: 100,
            profileExp: 10,
            dragonKilled: false,
          },
        ],
      });

      return {
        upgradeFrames,
        itemFrames,
        upgradeArcCount,
        itemArcCount,
        rewardTexts,
        goldIconCount,
        rewardArcCount: arcCount,
      };
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
      CanvasRenderingContext2D.prototype.arc = originalArc;
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(
    feedback.upgradeFrames.some((frame) =>
      frame.startsWith("DefineSprite_153_FXUpgrade/1.png"),
    ),
  ).toBe(true);
  expect(
    feedback.itemFrames.some((frame) =>
      frame.startsWith("DefineSprite_151_FXItem/1.png"),
    ),
  ).toBe(true);
  expect(feedback.upgradeArcCount).toBe(0);
  expect(feedback.itemArcCount).toBe(0);
  expect(feedback.rewardTexts).toContain("+100G");
  expect(feedback.rewardArcCount).toBe(0);
  expect(feedback.goldIconCount).toBe(0);
});

test("omits a missing hit frame without substituting a burst", async ({
  page,
}) => {
  await page.route("**/assets/original/images/119.png**", (route) =>
    route.request().resourceType() === "image"
      ? route.abort()
      : route.continue(),
  );
  await page.goto("/?manual=1&diagnostics=1");

  const result = await page.evaluate(async (modulePath) => {
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
    if (canvas.dataset.assetStatus === "loading") {
      throw new Error("Timed out waiting for partial renderer assets");
    }

    let arcCount = 0;
    const fillTexts: string[] = [];
    const arcDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "arc",
    );
    const fillTextDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillText",
    );
    if (
      typeof arcDescriptor?.value !== "function" ||
      typeof fillTextDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas drawing methods");
    }
    const originalArc = arcDescriptor.value as CanvasRenderingContext2D["arc"];
    const originalFillText = fillTextDescriptor.value as (
      this: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) => void;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      arcCount += 1;
      originalArc.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      if (String(text) === "229") fillTexts.push(String(text));
      originalFillText.call(this, text, x, y, maxWidth);
    };
    try {
      const current = {
        ...base,
        steps: 10,
        activeTicks: 10,
        lifecycle: {
          ...base.lifecycle,
          phase: "battling" as const,
          paused: false,
          tutorialPage: null,
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 671 },
          actors: {
            hero: { phase: "attack" as const, x: 150 },
            enemy: { phase: "flinch" as const, x: 210 },
          },
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "goblin" as const, maximumHp: 900 },
            x: 210,
          },
        },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 0,
        events: [
          {
            type: "combat-hit" as const,
            attacker: "hero" as const,
            target: "enemy" as const,
            damage: 229,
            critical: false,
            remainingHp: 671,
          },
        ],
      });
      return {
        assetStatus: canvas.dataset.assetStatus,
        arcCount,
        fillTexts,
      };
    } finally {
      CanvasRenderingContext2D.prototype.arc = originalArc;
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.assetStatus).toBe("partial");
  expect(result.arcCount).toBe(0);
  expect(result.fillTexts).toContain("229");
});
