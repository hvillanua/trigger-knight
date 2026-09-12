import { expect, test } from "@playwright/test";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";

test("loads the approved atlas and produces a readable world screenshot", async ({
  page,
}, testInfo) => {
  await page.goto("/?manual=1");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-asset-source", "world-atlas.svg");
  await expect
    .poll(() => canvas.getAttribute("data-asset-status"), {
      message: "the approved clean-room atlas should load",
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
