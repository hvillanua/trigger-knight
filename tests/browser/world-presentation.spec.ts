import { expect, test } from "@playwright/test";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";

test("loads original runtime assets and produces a readable world screenshot", async ({
  page,
}, testInfo) => {
  await page.goto("/?manual=1");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute(
    "data-asset-source",
    "original-runtime-assets",
  );
  await expect
    .poll(() => canvas.getAttribute("data-asset-status"), {
      message: "the original runtime assets should load",
    })
    .toBe("ready");
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
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    let clipCount = 0;
    let clipsBeforeFill = 0;
    let fillArgs: number[] = [];
    let frameArgs: number[] = [];
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
      return { clipCount, clipsBeforeFill, fillArgs, frameArgs };
    } finally {
      CanvasRenderingContext2D.prototype.clip = originalClip;
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(fillDetails.clipsBeforeFill).toBeGreaterThan(2);
  expect(fillDetails.fillArgs).toEqual([160, 10, 305, 10]);
  expect(fillDetails.frameArgs).toEqual([160, 10, 309, 14]);
});

test("clips the health fill inside its original frame", async ({ page }) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

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

test("omits the building when its original image is unavailable", async ({
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
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if (canvas.dataset.assetStatus === "partial") {
          resolve();
          return;
        }
        window.setTimeout(check, 0);
      };
      check();
    });

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

test("preserves the original building registration canvas", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const drawArguments = await page.evaluate(async (modulePath) => {
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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const calls: number[][] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas drawImage method");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement && image.src.includes("/366.png")) {
        calls.push(args);
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
        encounters: {
          ...base.encounters,
          current: {
            kind: "shop" as const,
            shop: "armorsmith" as const,
            cachedPrice: 204,
            x: 180,
            used: false,
          },
        },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [],
      });
      return calls;
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(
    drawArguments.some(
      (args) => args.length === 4 && args[2] === 478 && args[3] === 203,
    ),
  ).toBe(true);
});

test("draws the original shop between the middle and front background planes", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const layers = await page.evaluate(async (modulePath) => {
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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const relevant: string[] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas drawImage method");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement) {
        if (image.src.includes("/363.png")) relevant.push("mountains");
        if (image.src.includes("/366.png")) relevant.push("building");
        if (image.src.includes("/360.png")) relevant.push("ground");
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
      return relevant;
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(layers.slice(0, 3)).toEqual(["mountains", "building", "ground"]);
});

test("overlaps repeating background tiles at their moving seam", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const groundTiles = await page.evaluate(async (modulePath) => {
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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const tiles: { x: number; width: number }[] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas drawImage method");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (
        image instanceof HTMLImageElement &&
        image.src.includes("/360.png") &&
        args.length === 4
      ) {
        tiles.push({ x: args[0]!, width: args[2]! });
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        distance: 760,
        lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
      };
      presentation.present({
        previous: { ...base, distance: 759 },
        current,
        interpolation: 1,
        events: [],
      });
      return tiles;
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  const ordered = [...groundTiles].sort((a, b) => a.x - b.x);
  expect(ordered.length).toBeGreaterThanOrEqual(2);
  expect(ordered.every(({ width }) => width === 961)).toBe(true);
  expect(ordered[1]!.x).toBeLessThanOrEqual(ordered[0]!.x + ordered[0]!.width);
});

test("leaves shop offers to the cursor prompt without an extra scene marker", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const productDraws: number[][] = [];
    const markerStyles: string[] = [];
    const promptTexts: Array<{ text: string; y: number }> = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    const strokeDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "stroke",
    );
    const strokeTextDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "strokeText",
    );
    if (
      typeof drawImageDescriptor?.value !== "function" ||
      typeof strokeDescriptor?.value !== "function" ||
      typeof strokeTextDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas 2D methods");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    const originalStroke = strokeDescriptor.value as () => void;
    const originalStrokeText =
      strokeTextDescriptor.value as CanvasRenderingContext2D["strokeText"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (
        image instanceof HTMLImageElement &&
        image.src.includes("/198.png") &&
        args.length === 2
      ) {
        productDraws.push(args);
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    CanvasRenderingContext2D.prototype.stroke = function () {
      if (typeof this.strokeStyle === "string") {
        markerStyles.push(this.strokeStyle);
      }
      originalStroke.call(this);
    };
    CanvasRenderingContext2D.prototype.strokeText = function (
      text: string,
      x: number,
      y: number,
    ) {
      if (x >= 170 && x <= 190 && y > 140) promptTexts.push({ text, y });
      originalStrokeText.call(this, text, x, y);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
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
        actions: { ...base.actions, canPurchaseCurrentEncounter: false },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [],
      });
      return {
        cursorMarkerDraws: markerStyles.filter((style) => style === "#ef2a2a")
          .length,
        productDraws: productDraws.length,
        sceneMarkerDraws: markerStyles.filter((style) => style === "#ffb4a8")
          .length,
        promptTexts: promptTexts.map(({ text }) => text),
      };
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
      CanvasRenderingContext2D.prototype.stroke = originalStroke;
      CanvasRenderingContext2D.prototype.strokeText = originalStrokeText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.productDraws).toBe(0);
  expect(result.sceneMarkerDraws).toBe(0);
  expect(result.cursorMarkerDraws).toBeGreaterThan(0);
  expect(result.promptTexts).toEqual(["No Action!"]);
});

test("uses the compact original enemy health bar without a name or HP label", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const fills: Array<{ style: string; args: number[] }> = [];
    const strokes: Array<{ style: string; args: number[] }> = [];
    const text: string[] = [];
    const fillDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillRect",
    );
    const strokeRectDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "strokeRect",
    );
    const fillTextDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "fillText",
    );
    if (
      typeof fillDescriptor?.value !== "function" ||
      typeof strokeRectDescriptor?.value !== "function" ||
      typeof fillTextDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas 2D methods");
    }
    const originalFill =
      fillDescriptor.value as CanvasRenderingContext2D["fillRect"];
    const originalStrokeRect =
      strokeRectDescriptor.value as CanvasRenderingContext2D["strokeRect"];
    const originalFillText =
      fillTextDescriptor.value as CanvasRenderingContext2D["fillText"];
    CanvasRenderingContext2D.prototype.fillRect = function (
      x: number,
      y: number,
      width: number,
      height: number,
    ) {
      if (width <= 50 && height === 6) {
        fills.push({
          style:
            typeof this.fillStyle === "string" ? this.fillStyle : "non-solid",
          args: [x, y, width, height],
        });
      }
      originalFill.call(this, x, y, width, height);
    };
    CanvasRenderingContext2D.prototype.strokeRect = function (
      x: number,
      y: number,
      width: number,
      height: number,
    ) {
      if (width >= 50 && width <= 52 && height >= 6 && height <= 8) {
        strokes.push({
          style:
            typeof this.strokeStyle === "string"
              ? this.strokeStyle
              : "non-solid",
          args: [x, y, width, height],
        });
      }
      originalStrokeRect.call(this, x, y, width, height);
    };
    CanvasRenderingContext2D.prototype.fillText = function (
      value: string,
      x: number,
      y: number,
    ) {
      if (value.includes(" / ") || value.startsWith("Approaching")) {
        text.push(value);
      }
      originalFillText.call(this, value, x, y);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        activeTicks: base.activeTicks + 1,
        lifecycle: {
          ...base.lifecycle,
          phase: "battling" as const,
          paused: false,
          tutorialPage: null,
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "golem" as const, maximumHp: 660 },
            x: 250,
          },
        },
        battle: {
          enemy: { id: "golem" as const, maximumHp: 660, currentHp: 194 },
          actors: {
            hero: { phase: "attack" as const, x: 150 },
            enemy: { phase: "flinch" as const, x: 250 },
          },
        },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 0,
        events: [],
      });
      return { fills, strokes, text };
    } finally {
      CanvasRenderingContext2D.prototype.fillRect = originalFill;
      CanvasRenderingContext2D.prototype.strokeRect = originalStrokeRect;
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.fills).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        style: "#7e0101",
        args: expect.arrayContaining([50, 6]),
      }),
      expect.objectContaining({ style: "#ffff00" }),
    ]),
  );
  expect(result.strokes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        style: "#545401",
        args: expect.arrayContaining([51, 7]),
      }),
    ]),
  );
  expect(result.text).toEqual([]);
});

test("uses reference event icons and the staggered compact status icons", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const calls: { id: string; args: number[] }[] = [];
    const queueOperations: string[] = [];
    const slotFrameStrokes: string[] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    const strokeDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "stroke",
    );
    const strokeTextDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "strokeText",
    );
    if (
      typeof drawImageDescriptor?.value !== "function" ||
      typeof strokeDescriptor?.value !== "function" ||
      typeof strokeTextDescriptor?.value !== "function"
    ) {
      throw new Error("Expected Canvas 2D methods");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    const originalStroke = strokeDescriptor.value as () => void;
    const originalStrokeText = strokeTextDescriptor.value as (
      text: string,
      x: number,
      y: number,
    ) => void;
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement) {
        const id = image.src.match(/\/(\d+)\.(?:png|jpg)(?:$|[?#])/);
        if (id !== null) {
          calls.push({ id: id[1]!, args });
          queueOperations.push(`image:${id[1]}`);
        }
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    CanvasRenderingContext2D.prototype.stroke = function () {
      if (this.strokeStyle === "#2a0000") {
        slotFrameStrokes.push(this.strokeStyle);
      }
      originalStroke.call(this);
    };
    CanvasRenderingContext2D.prototype.strokeText = function (
      text: string,
      x: number,
      y: number,
    ) {
      if (text === "Now" || text === "Next") {
        queueOperations.push(`text:${text}`);
      }
      originalStrokeText.call(this, text, x, y);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        lifecycle: {
          ...base.lifecycle,
          paused: false,
          tutorialPage: null,
          phase: "battling" as const,
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 720 },
          actors: {
            hero: { phase: "idle" as const, x: 50 },
            enemy: { phase: "idle" as const, x: 300 },
          },
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "goblin" as const, maximumHp: 900 },
            x: 300,
          },
          upcoming: [
            {
              kind: "shop" as const,
              shop: "armorsmith" as const,
              cachedPrice: 204,
            },
            {
              kind: "shop" as const,
              shop: "bladesmith" as const,
              cachedPrice: 236,
            },
            { kind: "battle" as const },
          ],
        },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [],
      });
      return {
        calls,
        queueOperations,
        slotFrameStrokes,
      };
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
      CanvasRenderingContext2D.prototype.stroke = originalStroke;
      CanvasRenderingContext2D.prototype.strokeText = originalStrokeText;
    }
  }, "/src/browser/canvas-presentation.ts");

  const ids = result.calls.map(({ id }) => id);
  expect(ids.filter((id) => id === "179")).toHaveLength(2);
  expect(ids).toContain("170");
  expect(ids).toContain("168");
  expect(ids).not.toContain("156");
  expect(ids).not.toContain("158");
  expect(result.calls).toContainEqual({ id: "197", args: [235, 266, 16, 16] });
  expect(result.calls).toContainEqual({ id: "199", args: [255, 282, 16, 16] });
  expect(result.calls).toContainEqual({ id: "198", args: [275, 298, 16, 16] });
  expect(result.slotFrameStrokes).toContain("#2a0000");
  expect(result.queueOperations.indexOf("text:Now")).toBeGreaterThan(
    result.queueOperations.lastIndexOf("image:179"),
  );
  expect(result.queueOperations.indexOf("text:Next")).toBeGreaterThan(
    result.queueOperations.lastIndexOf("image:179"),
  );
});

test("animates an available action prompt with the original mouse frames", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const pointerFrames = await page.evaluate(async (modulePath) => {
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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const ids: string[] = [];
    const frames: string[][] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected Canvas drawImage method");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement) {
        const match = image.src.match(/\/(19|21)\.png(?:$|[?#])/);
        if (match !== null) ids.push(match[1]!);
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    try {
      let previous = base;
      for (const steps of [0, 11, 12, 23, 24]) {
        const current = {
          ...base,
          steps,
          lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
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
          previous,
          current,
          interpolation: 1,
          events: [],
        });
        frames.push([...ids]);
        previous = current;
      }
      return frames;
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(pointerFrames.map((frame) => frame.at(-1))).toEqual([
    "19",
    "19",
    "21",
    "21",
    "19",
  ]);
});

test("uses the original expanding click feedback for successful actions", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    canvas.style.width = "480px";
    canvas.style.height = "320px";
    document.body.append(canvas);
    const presentation = new CanvasPresentation(canvas);
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const calls: { frame: string; args: number[] }[] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas drawImage method");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (
        image instanceof HTMLImageElement &&
        image.src.includes("/DefineSprite_311_MouseEffect/")
      ) {
        calls.push({
          frame: image.src.split("/").at(-1)!.split("?")[0]!,
          args,
        });
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    const takeCalls = (): { frame: string; args: number[] }[] => {
      const snapshot = [...calls];
      calls.length = 0;
      return snapshot;
    };
    const movePointer = (x: number, y: number): void => {
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
        }),
      );
    };
    try {
      presentation.present({
        previous: base,
        current: base,
        interpolation: 1,
        events: [],
      });
      movePointer(120, 100);
      takeCalls();

      const shop = {
        ...base,
        steps: 10,
        activeTicks: 10,
        lifecycle: {
          ...base.lifecycle,
          phase: "running" as const,
          paused: false,
          tutorialPage: null,
        },
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
      presentation.present({
        previous: base,
        current: shop,
        interpolation: 0,
        events: [
          {
            type: "shop-purchased" as const,
            shop: "pharmacy" as const,
            price: 150,
          },
        ],
      });
      const shopFirst = takeCalls();

      const shopNext = { ...shop, steps: 11, activeTicks: 11 };
      presentation.present({
        previous: shop,
        current: shopNext,
        interpolation: 0,
        events: [],
      });
      const shopSecond = takeCalls();

      const shopLastFrame = {
        ...shop,
        steps: 69,
        activeTicks: 69,
      };
      presentation.present({
        previous: shopNext,
        current: shopLastFrame,
        interpolation: 0,
        events: [],
      });
      const shopLast = takeCalls();

      const shopExpired = { ...shop, steps: 71, activeTicks: 71 };
      presentation.present({
        previous: shopLastFrame,
        current: shopExpired,
        interpolation: 0,
        events: [],
      });
      const expired = takeCalls();

      movePointer(300, 100);
      takeCalls();
      const item = {
        ...base,
        steps: 72,
        activeTicks: 72,
        lifecycle: {
          ...base.lifecycle,
          phase: "battling" as const,
          paused: false,
          tutorialPage: null,
        },
        player: {
          ...base.player,
          inventory: { ...base.player.inventory, item: null },
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 900 },
          actors: {
            hero: { phase: "idle" as const, x: 70 },
            enemy: { phase: "idle" as const, x: 220 },
          },
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "goblin" as const, maximumHp: 900 },
            x: 220,
          },
        },
      };
      presentation.present({
        previous: shopExpired,
        current: item,
        interpolation: 0,
        events: [{ type: "item-used" as const, item: "elixir" as const }],
      });
      const itemFirst = takeCalls();
      return {
        shopFirst,
        shopSecond,
        shopLast,
        expired,
        itemFirst,
      };
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(feedback.shopFirst.map(({ frame }) => frame)).toContain("1.png");
  expect(feedback.shopSecond.map(({ frame }) => frame)).toContain("2.png");
  expect(feedback.shopLast.map(({ frame }) => frame)).toContain("60.png");
  expect(feedback.expired).toEqual([]);
  expect(feedback.itemFirst.map(({ frame }) => frame)).toContain("1.png");
  const shopCall = feedback.shopFirst.find(({ frame }) => frame === "1.png");
  const itemCall = feedback.itemFirst.find(({ frame }) => frame === "1.png");
  expect(shopCall?.args[0]).toBeGreaterThan(83);
  expect(shopCall?.args[0]).toBeLessThan(84);
  expect(shopCall?.args[1]).toBeGreaterThan(63);
  expect(shopCall?.args[1]).toBeLessThan(65);
  expect(itemCall?.args[0]).toBeGreaterThan(264);
  expect(itemCall?.args[0]).toBeLessThan(265);
  expect(itemCall?.args[1]).toBeGreaterThan(63);
  expect(itemCall?.args[1]).toBeLessThan(65);
});

test("covers every public enemy, shop, and actor phase in Canvas presentation", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    const shops = [
      "bladesmith",
      "armorsmith",
      "soul-shrine",
      "pharmacy",
      "grims-shop",
      "voucher-store",
    ] as const;
    const enemies = ["goblin", "golem", "wolf", "dragon"] as const;
    const phaseNames = ["idle", "move", "attack", "flinch", "dead"] as const;

    const shopScenes = shops.map((shop) => {
      const current = {
        kind: "shop" as const,
        shop,
        cachedPrice: 150,
        x: 180,
        used: false,
      };
      const observation = {
        ...base,
        steps: base.steps + 1,
        encounters: { ...base.encounters, current },
        actions: { ...base.actions, canPurchaseCurrentEncounter: true },
      };
      presentation.present({
        previous: base,
        current: observation,
        interpolation: 0.5,
        events: [],
      });
      return {
        shop,
        currentShop: canvas.dataset.currentShop,
        sprites: canvas.dataset.renderedSprites,
      };
    });

    const enemyScenes = enemies.map((enemy) => {
      const enemyObservation = {
        id: enemy,
        maximumHp: 900,
        currentHp: 720,
      };
      const battle = {
        enemy: enemyObservation,
        actors: {
          hero: { phase: "attack" as const, x: 50 },
          enemy: { phase: "flinch" as const, x: 300 },
        },
      };
      const observation = {
        ...base,
        steps: base.steps + 2,
        battle,
        lifecycle: { ...base.lifecycle, phase: "battling" as const },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: enemy, maximumHp: 900 },
            x: 300,
          },
        },
      };
      presentation.present({
        previous: base,
        current: observation,
        interpolation: 0.5,
        events: [],
      });
      return {
        enemy,
        battleEnemy: canvas.dataset.battleEnemy,
        scene: canvas.dataset.visualScene,
        sprites: canvas.dataset.renderedSprites,
      };
    });

    const phaseScenes = phaseNames.map((phase, index) => {
      const observation = {
        ...base,
        steps: base.steps + 10 + index,
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 720 },
          actors: {
            hero: { phase, x: 50 },
            enemy: { phase, x: 300 },
          },
        },
        lifecycle: { ...base.lifecycle, phase: "battling" as const },
      };
      presentation.present({
        previous: base,
        current: observation,
        interpolation: 1,
        events: [],
      });
      return {
        hero: canvas.dataset.battleHeroPhase,
        enemy: canvas.dataset.battleEnemyPhase,
      };
    });

    return { shopScenes, enemyScenes, phaseScenes };
  }, "/src/browser/canvas-presentation.ts");

  expect(result.shopScenes.map(({ currentShop }) => currentShop)).toEqual(
    result.shopScenes.map(({ shop }) => shop),
  );
  for (const scene of result.shopScenes) {
    expect(scene.sprites).toContain(scene.shop);
  }
  expect(result.enemyScenes.map(({ battleEnemy }) => battleEnemy)).toEqual(
    result.enemyScenes.map(({ enemy }) => enemy),
  );
  expect(result.enemyScenes.every(({ scene }) => scene === "battle")).toBe(
    true,
  );
  for (const scene of result.enemyScenes) {
    expect(scene.sprites).toContain(scene.enemy);
  }
  expect(result.phaseScenes).toEqual(
    ["idle", "move", "attack", "flinch", "dead"].map((phase) => ({
      hero: phase,
      enemy: phase,
    })),
  );
});

test("anchors targeted lethal effects to the targeted public actor", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const hitCenters: number[] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas drawImage method");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (
        image instanceof HTMLImageElement &&
        /\/(?:119|121|123|125|127|129|131)\.png/.test(image.src)
      ) {
        hitCenters.push((args[0] ?? 0) + image.naturalWidth / 2);
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    const current = {
      ...base,
      steps: base.steps + 1,
      lifecycle: { ...base.lifecycle, phase: "battling" as const },
      battle: {
        enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 720 },
        actors: {
          hero: { phase: "idle" as const, x: 70 },
          enemy: { phase: "idle" as const, x: 380 },
        },
      },
    };
    const previous = current;
    const presentLethalHit = (target: "hero" | "enemy") => {
      const event =
        target === "hero"
          ? {
              type: "combat-lethal-hit" as const,
              attacker: "enemy" as const,
              target,
            }
          : {
              type: "combat-lethal-hit" as const,
              attacker: "hero" as const,
              target,
            };
      presentation.present({
        previous,
        current,
        interpolation: 1,
        events: [event],
      });
      return hitCenters.slice();
    };

    try {
      return {
        heroTarget: presentLethalHit("hero"),
        enemyTarget: presentLethalHit("enemy"),
      };
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.heroTarget).toContain(70);
  expect(result.heroTarget).not.toContain(380);
  expect(result.enemyTarget).toContain(380);
});

test("anchors battle rewards to the hero when combat returns to running", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const rewardTextXs = await page.evaluate(async (modulePath) => {
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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const rewardTextXs: number[] = [];
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
      if (text === "+100G") rewardTextXs.push(x);
      originalFillText.call(this, text, x, y, maxWidth);
    };

    try {
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
      const reward = {
        type: "battle-reward" as const,
        enemy: "goblin" as const,
        gold: 100,
        score: 100,
        profileExp: 10,
        dragonKilled: false,
      };

      presentation.present({
        previous: base,
        current: battle,
        interpolation: 1,
        events: [],
      });
      presentation.presentTransition({
        previous: battle,
        current: running,
        events: [reward],
      });
      presentation.present({
        previous: battle,
        current: running,
        interpolation: 1,
        events: [reward],
      });
      return rewardTextXs;
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(rewardTextXs.length).toBeGreaterThan(0);
  expect(rewardTextXs.every((x) => x === 190)).toBe(true);
});

test("interpolates original scenery from public distance", async ({ page }) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));
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

test("does not restart one-shot effects when a frame is redrawn", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const sequence = await page.evaluate(async (modulePath) => {
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
    const current = {
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
    const events = [
      { type: "step-advanced" as const, step: 5 },
      {
        type: "shop-purchased" as const,
        shop: "pharmacy" as const,
        price: 150,
      },
    ];
    presentation.present({ previous: base, current, interpolation: 0, events });
    const first = canvas.dataset.effectSequence;
    presentation.present({
      previous: base,
      current,
      interpolation: 0.5,
      events,
    });
    const redraw = canvas.dataset.effectSequence;
    presentation.present({
      previous: current,
      current: { ...current, steps: 6 },
      interpolation: 1,
      events: [
        { type: "step-advanced" as const, step: 6 },
        { type: "item-used" as const, item: "elixir" as const },
      ],
    });
    return { first, redraw, next: canvas.dataset.effectSequence };
  }, "/src/browser/canvas-presentation.ts");

  expect(sequence.redraw).toBe(sequence.first);
  expect(Number(sequence.next)).toBeGreaterThan(Number(sequence.redraw));
});

test("keeps event feedback visible between logical event frames", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    const current = {
      ...base,
      steps: 10,
      activeTicks: 10,
      lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
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
      next: typeof current,
      events: readonly (typeof hit)[] = [],
    ) => {
      presentation.present({
        previous: current,
        current: next,
        interpolation: 0,
        events,
      });
      return {
        effects: canvas.dataset.activeEffects ?? "",
        sequence: canvas.dataset.effectSequence ?? "",
      };
    };
    const first = show(current, [hit]);
    const redraw = show(current);
    const paused = show({
      ...current,
      steps: 12,
      lifecycle: { ...current.lifecycle, paused: true },
    });
    const resumed = show({ ...current, steps: 13, activeTicks: 11 });
    const continued = show({ ...current, steps: 14, activeTicks: 14 });
    const expired = show({ ...current, steps: 30, activeTicks: 30 });
    return { first, redraw, paused, resumed, continued, expired };
  }, "/src/browser/canvas-presentation.ts");

  expect(result.first.effects).toContain("combat-hit");
  expect(result.redraw.effects).toContain("combat-hit");
  expect(result.paused.effects).toContain("combat-hit");
  expect(result.resumed.effects).toContain("combat-hit");
  expect(result.continued.effects).toContain("combat-hit");
  expect(result.expired.effects).not.toContain("combat-hit");
  expect(result.redraw.sequence).toBe(result.first.sequence);
});

test("uses the staged original hit animation frames", async ({ page }) => {
  await page.goto("/?manual=1");

  const frames = await page.evaluate(async (modulePath) => {
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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    const seen: string[] = [];
    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas drawImage method");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement && image.src.includes("/119.png"))
        seen.push("hit-1");
      if (image instanceof HTMLImageElement && image.src.includes("/121.png"))
        seen.push("hit-2");
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };
    try {
      const battle = {
        enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 671 },
        actors: {
          hero: { phase: "attack" as const, x: 150 },
          enemy: { phase: "flinch" as const, x: 210 },
        },
      };
      const first = {
        ...base,
        steps: 10,
        activeTicks: 10,
        lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
        battle,
      };
      const hit = {
        type: "combat-hit" as const,
        attacker: "hero" as const,
        target: "enemy" as const,
        damage: 229,
        critical: false,
        remainingHp: 671,
      };
      presentation.present({
        previous: base,
        current: first,
        interpolation: 0,
        events: [hit],
      });
      presentation.present({
        previous: first,
        current: { ...first, steps: 11, activeTicks: 11 },
        interpolation: 0,
        events: [],
      });
      return seen;
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(frames).toContain("hit-1");
  expect(frames).toContain("hit-2");
});

test("omits a missing original hit frame without substituting a burst", async ({
  page,
}) => {
  await page.route("**/assets/original/images/119.png", (route) =>
    route.abort(),
  );
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

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
      return { assetStatus: canvas.dataset.assetStatus, arcCount, fillTexts };
    } finally {
      CanvasRenderingContext2D.prototype.arc = originalArc;
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.assetStatus).toBe("partial");
  expect(result.arcCount).toBe(0);
  expect(result.fillTexts).toContain("229");
});

test("does not draw a spawn effect when a monster enters the screen", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

    let arcCount = 0;
    const arcDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "arc",
    );
    if (typeof arcDescriptor?.value !== "function") {
      throw new Error("Expected the Canvas arc method");
    }
    const originalArc = arcDescriptor.value as CanvasRenderingContext2D["arc"];
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      arcCount += 1;
      originalArc.apply(this, args);
    };
    try {
      const current = {
        ...base,
        steps: base.steps + 1,
        activeTicks: base.activeTicks + 1,
        lifecycle: {
          ...base.lifecycle,
          phase: "battling" as const,
          paused: false,
          tutorialPage: null,
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 900 },
          actors: {
            hero: { phase: "idle" as const, x: 70 },
            enemy: { phase: "move" as const, x: 300 },
          },
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "goblin" as const, maximumHp: 900 },
            x: 300,
          },
        },
      };
      presentation.present({
        previous: base,
        current,
        interpolation: 1,
        events: [
          {
            type: "encounter-promoted" as const,
            encounter: current.encounters.current,
          },
          {
            type: "battle-started" as const,
            enemy: current.battle.enemy,
          },
        ],
      });
      return {
        activeEffects: canvas.dataset.activeEffects ?? "",
        arcCount,
      };
    } finally {
      CanvasRenderingContext2D.prototype.arc = originalArc;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.activeEffects).toBe("");
  expect(result.arcCount).toBe(0);
});

test("retains the equipment-change strip through batched transitions", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

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
      const texts = [...fillTexts];
      fillTexts.length = 0;
      return texts;
    };
    try {
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
      presentation.presentTransition({
        previous: base,
        current: purchased,
        events: [purchase],
      });
      presentation.present({
        previous: base,
        current: purchased,
        interpolation: 0,
        events: [purchase],
      });
      const first = snapshot();

      presentation.presentTransition({
        previous: purchased,
        current: next,
        events: [],
      });
      presentation.presentTransition({
        previous: next,
        current: later,
        events: [],
      });
      presentation.present({
        previous: next,
        current: later,
        interpolation: 0,
        events: [purchase],
      });
      const batched = snapshot();

      const paused = {
        ...later,
        steps: 13,
        lifecycle: { ...later.lifecycle, paused: true },
      };
      presentation.presentTransition({
        previous: later,
        current: paused,
        events: [],
      });
      presentation.present({
        previous: later,
        current: paused,
        interpolation: 0,
        events: [],
      });
      const pausedEffects = canvas.dataset.activeEffects ?? "";

      const resumed = {
        ...later,
        steps: 14,
        activeTicks: 13,
      };
      presentation.presentTransition({
        previous: paused,
        current: resumed,
        events: [],
      });
      presentation.present({
        previous: paused,
        current: resumed,
        interpolation: 0,
        events: [],
      });
      const resumedTexts = snapshot();

      const expired = { ...resumed, steps: 60, activeTicks: 60 };
      presentation.present({
        previous: resumed,
        current: expired,
        interpolation: 0,
        events: [],
      });
      return {
        first,
        batched,
        pausedEffects,
        resumedTexts,
        expired: snapshot(),
      };
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.first, "first").toContain("Upgrade: Clothing > Protector");
  expect(result.batched, "batched").toContain("Upgrade: Clothing > Protector");
  expect(result.resumedTexts, "resumed").toContain(
    "Upgrade: Clothing > Protector",
  );
  expect(result.pausedEffects).toContain("shop-purchased");
  expect(result.expired).not.toContain("Upgrade: Clothing > Protector");
});

test("presents reference purchase, item-use, and combat feedback", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));

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
      const texts = [...fillTexts];
      fillTexts.length = 0;
      return texts;
    };
    try {
      const armorObservation = {
        ...base,
        steps: 10,
        activeTicks: 10,
        lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
        player: {
          ...base.player,
          gold: 188,
          armor: {
            ...base.player.armor,
            name: "Protector" as const,
            tier: 1,
          },
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
        current: armorObservation,
        interpolation: 0,
        events: [
          {
            type: "shop-purchased" as const,
            shop: "armorsmith" as const,
            price: 204,
          },
        ],
      });
      const armor = snapshot();

      const itemObservation = {
        ...base,
        steps: 20,
        activeTicks: 20,
        lifecycle: {
          ...base.lifecycle,
          phase: "battling" as const,
          tutorialPage: null,
        },
        player: {
          ...base.player,
          inventory: { ...base.player.inventory, item: "elixir" as const },
        },
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 671 },
          actors: {
            hero: { phase: "idle" as const, x: 90 },
            enemy: { phase: "idle" as const, x: 220 },
          },
        },
        encounters: {
          ...base.encounters,
          current: {
            kind: "battle" as const,
            enemy: { id: "goblin" as const, maximumHp: 900 },
            x: 220,
          },
        },
      };
      presentation.present({
        previous: armorObservation,
        current: itemObservation,
        interpolation: 0,
        events: [],
      });
      const hint = snapshot();

      const usedObservation = {
        ...itemObservation,
        steps: 21,
        activeTicks: 21,
        player: {
          ...itemObservation.player,
          inventory: { ...itemObservation.player.inventory, item: null },
        },
      };
      presentation.present({
        previous: itemObservation,
        current: usedObservation,
        interpolation: 0,
        events: [
          {
            type: "combat-hit" as const,
            attacker: "hero" as const,
            target: "enemy" as const,
            damage: 229,
            critical: false,
            remainingHp: 442,
          },
          { type: "item-used" as const, item: "elixir" as const },
        ],
      });
      const used = snapshot();
      return { armor, hint, used };
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(result.armor).toContain("UPGRADE!");
  expect(result.armor).toContain("-Lost 204G!");
  expect(result.armor).toContain("Upgrade: Clothing > Protector");
  expect(result.hint).toContain("You can use Elixir to heal HP!");
  expect(result.used).toContain("229");
  expect(result.used).toContain("ITEM USED!");
});
