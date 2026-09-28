import { expect, test } from "@playwright/test";

test("opens the main menu on a fresh load", async ({ page }) => {
  await page.goto("/?manual=1");

  await expect(page.locator("#title-screen")).toBeVisible();
  await expect(page.locator("#gameplay-screen")).toBeHidden();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible();
});

test("loads the browser and Canvas foundation", async ({ page }) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();

  await expect(
    page.getByRole("heading", { name: "Trigger Knight" }),
  ).toBeVisible();
  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-renderer", "canvas-2d");

  expect(
    await canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) {
        return false;
      }

      return (
        element.width > 0 &&
        element.height > 0 &&
        element.getContext("2d") !== null
      );
    }),
  ).toBe(true);
});

test("projects the complete 480x320 world camera into wide and tall output", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await canvas.evaluate((element) => {
    element.style.width = "640px";
    element.style.height = "360px";
    element.style.aspectRatio = "auto";
    element.style.border = "0";
  });

  await expect(canvas).toHaveAttribute("data-world-camera", "0,0,480,320");
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
          throw new Error("Expected a Canvas element");
        }

        return {
          width: element.width,
          height: element.height,
          viewport: element.dataset.projectionViewport,
        };
      }),
    )
    .toEqual({ width: 640, height: 360, viewport: "50,0,540,360" });

  await canvas.evaluate((element) => {
    element.style.width = "360px";
    element.style.height = "480px";
  });

  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
          throw new Error("Expected a Canvas element");
        }

        return {
          width: element.width,
          height: element.height,
          viewport: element.dataset.projectionViewport,
        };
      }),
    )
    .toEqual({ width: 360, height: 480, viewport: "0,120,360,240" });
  await expect(canvas).toHaveAttribute("data-observation-step", "0");
  await expect(canvas).toHaveAttribute("data-events", "");
});

test("keeps the original game cursor over letterboxed gameplay edges", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await canvas.evaluate((element) => {
    element.style.width = "640px";
    element.style.height = "360px";
    element.style.aspectRatio = "auto";
    element.style.border = "0";
  });
  await expect(canvas).toHaveAttribute(
    "data-projection-viewport",
    "50,0,540,360",
  );

  const cursors = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const dispatchMove = (clientX: number): void => {
      element.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX,
          clientY: rect.top + rect.height / 2,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
    };

    dispatchMove(rect.left + 1);
    const letterbox = {
      cursor: getComputedStyle(element).cursor,
      region: element.getAttribute("data-pointer-region"),
    };
    dispatchMove(rect.left + rect.width / 2);
    return {
      letterbox,
      world: {
        cursor: getComputedStyle(element).cursor,
        region: element.getAttribute("data-pointer-region"),
      },
    };
  });

  expect(cursors.letterbox.region).toBe("letterbox");
  expect(cursors.letterbox.cursor).toContain("/12.png");
  expect(cursors.world).toEqual({ cursor: "none", region: "world" });
});

test("keeps the game cursor over the world-space gameplay margins", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  const cursors = await page
    .getByRole("img", { name: "Trigger Knight game view" })
    .evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) {
        throw new Error("Expected a Canvas element");
      }

      const rect = element.getBoundingClientRect();
      const camera = element.dataset.worldCamera?.split(",").map(Number);
      const projection = element.dataset.projectionViewport
        ?.split(",")
        .map(Number);
      if (camera === undefined || projection === undefined) {
        throw new Error("Missing public Canvas projection");
      }

      const scale = projection[2]! / camera[2]!;
      const styles = getComputedStyle(element);
      const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0;
      const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
      const moveToWorldX = (worldX: number) => {
        const backingX = projection[0]! + (worldX - camera[0]!) * scale;
        element.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX:
              rect.left +
              borderLeft +
              (backingX / element.width) * element.clientWidth,
            clientY:
              rect.top +
              borderTop +
              ((projection[1]! + (160 - camera[1]!) * scale) / element.height) *
                element.clientHeight,
            pointerId: 3,
            pointerType: "mouse",
          }),
        );
        return {
          cursor: getComputedStyle(element).cursor,
          region: element.getAttribute("data-pointer-region"),
        };
      };

      return {
        leftMargin: moveToWorldX(12),
        center: moveToWorldX(240),
        rightMargin: moveToWorldX(468),
      };
    });

  expect(cursors).toEqual({
    leftMargin: { cursor: "none", region: "world" },
    center: { cursor: "none", region: "world" },
    rightMargin: { cursor: "none", region: "world" },
  });
});

test("keeps the last in-world cursor position after leaving gameplay", async ({
  page,
}) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();

  const pointerPositions = await page.evaluate(async (modulePath) => {
    const trace = window.triggerKnightDiagnostics?.read();
    const base = trace?.checkpoints[0]?.observation;
    if (base === undefined) {
      throw new Error("Expected browser diagnostics");
    }

    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof import("../../src/browser/canvas-presentation.js");
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    canvas.style.width = "640px";
    canvas.style.height = "360px";
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

    const current = Object.freeze({
      ...base,
      lifecycle: Object.freeze({
        ...base.lifecycle,
        phase: "running" as const,
        paused: false,
        tutorialPage: null,
        activeGameplay: true,
      }),
      encounters: Object.freeze({
        ...base.encounters,
        current: Object.freeze({
          kind: "shop" as const,
          shop: "pharmacy" as const,
          cachedPrice: 150,
          x: 100,
          used: false,
        }),
      }),
      actions: Object.freeze({
        ...base.actions,
        canPurchaseCurrentEncounter: true,
      }),
    });

    const drawImageDescriptor = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    );
    if (typeof drawImageDescriptor?.value !== "function") {
      throw new Error("Expected Canvas 2D drawImage");
    }
    const originalDrawImage =
      drawImageDescriptor.value as CanvasRenderingContext2D["drawImage"];
    const pointerPositions: { x: number; y: number }[] = [];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (image instanceof HTMLImageElement) {
        const source = image.currentSrc || image.src;
        if (source.includes("/19.png") || source.includes("/21.png")) {
          pointerPositions.push({ x: args[0]!, y: args[1]! });
        }
      }
      originalDrawImage.apply(this, [image, ...args] as Parameters<
        typeof originalDrawImage
      >);
    };

    try {
      presentation.present({
        previous: current,
        current,
        interpolation: 1,
        events: [],
      });
      pointerPositions.length = 0;

      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: rect.left + 320,
          clientY: rect.top + 180,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      const inWorld = pointerPositions.at(-1);
      pointerPositions.length = 0;

      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: rect.left + 1,
          clientY: rect.top + 180,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      const inLetterbox = pointerPositions.at(-1);
      pointerPositions.length = 0;

      canvas.dispatchEvent(
        new PointerEvent("pointerleave", {
          bubbles: true,
          clientX: rect.left + 1,
          clientY: rect.top + 180,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      const afterLeave = pointerPositions.at(-1);
      return { inWorld, inLetterbox, afterLeave };
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  }, "/src/browser/canvas-presentation.ts");

  expect(pointerPositions.inWorld?.x).toBe(231);
  expect(pointerPositions.inWorld?.y).toBeCloseTo(150, 0);
  expect(pointerPositions.inLetterbox).toEqual(pointerPositions.inWorld);
  expect(pointerPositions.afterLeave).toEqual(pointerPositions.inWorld);
});

test("interpolates public observations without mutating gameplay", async ({
  page,
}) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();

  const result = await page
    .getByRole("img", { name: "Trigger Knight game view" })
    .evaluate(async (element, modulePath) => {
      if (!(element instanceof HTMLCanvasElement)) {
        throw new Error("Expected a Canvas element");
      }

      const trace = window.triggerKnightDiagnostics?.read();
      const previous = trace?.checkpoints[0]?.observation;
      if (trace === undefined || previous === undefined) {
        throw new Error("Expected browser diagnostics");
      }

      const presentationModule = (await import(modulePath)) as {
        CanvasPresentation: new (canvas: HTMLCanvasElement) => {
          present(frame: {
            readonly previous: typeof previous;
            readonly current: typeof previous;
            readonly interpolation: number;
            readonly events: readonly unknown[];
          }): void;
        };
      };
      const presentation = new presentationModule.CanvasPresentation(element);
      const current = Object.freeze({
        ...previous,
        distance: 10,
        lifecycle: Object.freeze({
          ...previous.lifecycle,
          phase: "battling" as const,
        }),
        battle: Object.freeze({
          enemy: Object.freeze({
            id: "goblin" as const,
            maximumHp: 660,
            currentHp: 650,
          }),
          actors: Object.freeze({
            hero: Object.freeze({ phase: "idle" as const, x: 50 }),
            enemy: Object.freeze({ phase: "move" as const, x: 406 }),
          }),
        }),
        encounters: Object.freeze({
          ...previous.encounters,
          current: Object.freeze({
            kind: "shop" as const,
            shop: "pharmacy" as const,
            cachedPrice: 150,
            x: 100,
            used: false,
          }),
        }),
        actions: Object.freeze({
          ...previous.actions,
          canPurchaseCurrentEncounter: true,
        }),
      });
      const events = Object.freeze([]);
      const inputsBefore = JSON.stringify({ previous, current, events });
      const traceBefore = JSON.stringify(trace);
      const interpolatedDistances = [0, 0.5, 1].map((interpolation) => {
        presentation.present({
          previous,
          current,
          interpolation,
          events,
        });
        return element.dataset.interpolatedDistance;
      });

      return {
        interpolatedDistances,
        authoritativeDistance: element.dataset.distance,
        phase: element.dataset.phase,
        battleEnemy: element.dataset.battleEnemy,
        battleEnemyHp: element.dataset.battleEnemyHp,
        battleHeroPhase: element.dataset.battleHeroPhase,
        battleEnemyPhase: element.dataset.battleEnemyPhase,
        currentEncounterX: current.encounters.current?.x,
        purchaseEligibility: current.actions.canPurchaseCurrentEncounter,
        inputsUnchanged:
          JSON.stringify({ previous, current, events }) === inputsBefore,
        traceUnchanged:
          JSON.stringify(window.triggerKnightDiagnostics?.read()) ===
          traceBefore,
      };
    }, "/src/browser/canvas-presentation.ts");

  expect(result).toEqual({
    interpolatedDistances: ["0", "5", "10"],
    authoritativeDistance: "10",
    phase: "battling",
    battleEnemy: "goblin",
    battleEnemyHp: "650/660",
    battleHeroPhase: "idle",
    battleEnemyPhase: "move",
    currentEncounterX: 100,
    purchaseEligibility: true,
    inputsUnchanged: true,
    traceUnchanged: true,
  });
});

test("sizes the Canvas backing store from its content box after a DPR change", async ({
  context,
  page,
}) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-renderer", "canvas-2d");

  const initial = await canvas.evaluate(async (element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("Expected a Canvas element");
    }

    const contentBox = await new Promise<DOMRectReadOnly>((resolve) => {
      const observer = new ResizeObserver(([entry]) => {
        if (entry === undefined) {
          return;
        }

        observer.disconnect();
        resolve(entry.contentRect);
      });
      observer.observe(element);
    });
    const borderBox = element.getBoundingClientRect();

    return {
      contentWidth: contentBox.width,
      contentHeight: contentBox.height,
      borderWidth: borderBox.width,
      borderHeight: borderBox.height,
      devicePixelRatio: window.devicePixelRatio,
      worldCamera: element.dataset.worldCamera,
      projectionViewport: element.dataset.projectionViewport,
      observationStep: element.dataset.observationStep,
      trace: window.triggerKnightDiagnostics?.read(),
    };
  });
  expect(initial.borderWidth).toBeGreaterThan(initial.contentWidth);
  expect(initial.borderHeight).toBeGreaterThan(initial.contentHeight);

  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("The browser test requires a fixed viewport");
  }

  const changedDevicePixelRatio = initial.devicePixelRatio === 2 ? 1 : 2;
  const browserSession = await context.newCDPSession(page);
  await browserSession.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: changedDevicePixelRatio,
    mobile: false,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));

  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
          throw new Error("Expected a Canvas element");
        }

        return {
          backingWidth: element.width,
          backingHeight: element.height,
          devicePixelRatio: window.devicePixelRatio,
          worldCamera: element.dataset.worldCamera,
          projectionViewport: element.dataset.projectionViewport,
          observationStep: element.dataset.observationStep,
          trace: window.triggerKnightDiagnostics?.read(),
        };
      }),
    )
    .toEqual({
      backingWidth: Math.round(initial.contentWidth * changedDevicePixelRatio),
      backingHeight: Math.round(
        initial.contentHeight * changedDevicePixelRatio,
      ),
      devicePixelRatio: changedDevicePixelRatio,
      worldCamera: initial.worldCamera,
      projectionViewport: expect.any(String),
      observationStep: "0",
      trace: initial.trace,
    });

  const changed = await canvas.evaluate((element) => ({
    projectionViewport: element.dataset.projectionViewport,
    trace: window.triggerKnightDiagnostics?.read(),
  }));
  if (
    initial.projectionViewport === undefined ||
    changed.projectionViewport === undefined
  ) {
    throw new Error("Expected a Canvas world projection");
  }

  const initialViewport = initial.projectionViewport.split(",").map(Number);
  const changedViewport = changed.projectionViewport.split(",").map(Number);
  expect(changed.trace).toEqual(initial.trace);
  expect(initial.worldCamera).toBe("0,0,480,320");
  for (let index = 0; index < 4; index += 1) {
    const changedCssValue = changedViewport[index]! / changedDevicePixelRatio;
    const initialCssValue = initialViewport[index]! / initial.devicePixelRatio;
    expect(Math.abs(changedCssValue - initialCssValue)).toBeLessThanOrEqual(1);
  }
});
