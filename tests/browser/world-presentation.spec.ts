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
    expect.arrayContaining([
      "hero",
      "weapon",
      "armor",
      "elixir",
      "tree",
      "pine",
      "rock",
    ]),
  );

  const screenshot = await canvas.screenshot();
  await testInfo.attach("running-world.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expect(screenshot.byteLength).toBeGreaterThan(1_000);
});

test("keeps the authored shop atlas when the original building asset is unavailable", async ({
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
        if (canvas.dataset.assetStatus === "ready") {
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
    const countBurstPixels = (centerX: number): number => {
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("Expected a Canvas 2D context");
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let y = 145; y <= 216; y += 1) {
        for (let x = centerX - 35; x <= centerX + 35; x += 1) {
          const offset = (y * canvas.width + x) * 4;
          const red = pixels.data[offset] ?? 0;
          const green = pixels.data[offset + 1] ?? 0;
          const blue = pixels.data[offset + 2] ?? 0;
          if (red > 230 && green > 120 && blue > 110 && red - green > 40) {
            count += 1;
          }
        }
      }
      return count;
    };
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
      return {
        hero: countBurstPixels(70),
        enemy: countBurstPixels(380),
      };
    };

    return {
      heroTarget: presentLethalHit("hero"),
      enemyTarget: presentLethalHit("enemy"),
    };
  }, "/src/browser/canvas-presentation.ts");

  expect(result.heroTarget.hero).toBeGreaterThan(result.heroTarget.enemy);
  expect(result.enemyTarget.enemy).toBeGreaterThan(result.enemyTarget.hero);
});

test("interpolates moving scenery from public distance", async ({ page }) => {
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
