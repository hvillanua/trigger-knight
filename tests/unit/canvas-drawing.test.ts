import { describe, expect, it } from "vitest";

import type {
  GameEvent,
  GameObservation,
  ShopId,
} from "../../src/application/contracts.js";
import {
  actionPointerImageId,
  calculateEffectAnchor,
  drawClippedHealthFill,
  drawClippedLifespanFill,
  drawHealthBar,
  drawOriginalActionEffect,
  drawOriginalFlashEffect,
  drawOriginalHitEffect,
  drawOriginalTimelineFrame,
  drawScenery,
  encounterQueueItems,
  originalEventVisual,
} from "../../src/browser/canvas-drawing.js";

interface DrawCall {
  readonly method: string;
  readonly args: readonly unknown[];
  readonly fillStyle: string | CanvasGradient | CanvasPattern;
  readonly strokeStyle: string | CanvasGradient | CanvasPattern;
}

interface RecordingContext extends CanvasRenderingContext2D {
  readonly calls: readonly DrawCall[];
}

function createRecordingContext(): RecordingContext {
  const calls: DrawCall[] = [];
  const context = {
    calls,
    fillStyle: "#000000" as string | CanvasGradient | CanvasPattern,
    strokeStyle: "#000000" as string | CanvasGradient | CanvasPattern,
    globalAlpha: 1,
    lineWidth: 1,
    save() {
      calls.push({
        method: "save",
        args: [],
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    restore() {
      calls.push({
        method: "restore",
        args: [],
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    beginPath() {
      calls.push({
        method: "beginPath",
        args: [],
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    rect(...args: number[]) {
      calls.push({
        method: "rect",
        args,
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    moveTo(...args: number[]) {
      calls.push({
        method: "moveTo",
        args,
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    lineTo(...args: number[]) {
      calls.push({
        method: "lineTo",
        args,
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    closePath() {
      calls.push({
        method: "closePath",
        args: [],
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    clip() {
      calls.push({
        method: "clip",
        args: [],
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    drawImage(image: unknown, ...args: number[]) {
      calls.push({
        method: "drawImage",
        args: [image, ...args],
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    fillRect(...args: number[]) {
      calls.push({
        method: "fillRect",
        args,
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
    strokeRect(...args: number[]) {
      calls.push({
        method: "strokeRect",
        args,
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
      });
    },
  } as unknown as RecordingContext;
  return context;
}

interface FakeImage extends HTMLImageElement {
  readonly name: string;
}

function fakeImage(
  name: string,
  naturalWidth = 1,
  naturalHeight = 1,
): FakeImage {
  return {
    name,
    complete: true,
    naturalWidth,
    naturalHeight,
  } as FakeImage;
}

const BASE_OBSERVATION: GameObservation = {
  ruleset: "original-v1.3",
  camera: { x: 0, y: 0, width: 480, height: 320 },
  steps: 0,
  activeTicks: 0,
  movementSpeed: 1,
  distance: 0,
  day: 1,
  score: 0,
  lifespan: { whole: 99, fraction: 99 },
  player: {
    gold: 300,
    weapon: { tier: 0, name: "Dagger", attack: 216 },
    armor: { tier: 0, name: "Clothing" },
    hp: { current: 1_908, maximum: 1_908 },
    inventory: { item: "elixir" },
  },
  battle: null,
  encounters: { current: null, upcoming: [] },
  lifecycle: {
    phase: "running",
    terminalReason: null,
    paused: false,
    tutorialPage: null,
    pregameStepsRemaining: 0,
    activeGameplay: true,
  },
  actions: {
    canTogglePause: true,
    canDismissTutorial: false,
    canPurchaseCurrentEncounter: false,
    canUseCarriedItem: false,
  },
};

function drawImages(context: RecordingContext): DrawCall[] {
  return context.calls.filter(({ method }) => method === "drawImage");
}

function imageName(call: DrawCall): string {
  const image = call.args[0] as FakeImage;
  return image.name;
}

function shopPurchased(shop: ShopId): GameEvent {
  return { type: "shop-purchased", shop, price: 204 };
}

describe("Canvas drawing decisions", () => {
  it("keeps scenery order, registration coordinates, and tile overlap in process", () => {
    const context = createRecordingContext();
    const images = {
      mountains: fakeImage("mountains"),
      building: fakeImage("building", 478, 203),
      ground: fakeImage("ground"),
    };

    drawScenery(context, BASE_OBSERVATION.camera, 760, images, 180, 234);

    expect(drawImages(context).map(imageName)).toEqual([
      "mountains",
      "building",
      "ground",
      "ground",
    ]);
    expect(drawImages(context)[1]?.args.slice(1)).toEqual([-59, 31, 478, 203]);
    const groundTiles = drawImages(context)
      .filter((call) => imageName(call) === "ground")
      .map((call) => ({
        x: call.args[1] as number,
        width: call.args[3] as number,
      }));
    expect(groundTiles).toEqual([
      { x: -760, width: 961 },
      { x: 200, width: 961 },
    ]);
    expect(groundTiles[1]!.x).toBeLessThanOrEqual(
      groundTiles[0]!.x + groundTiles[0]!.width,
    );
  });

  it("omits a building without substituting fallback artwork", () => {
    const context = createRecordingContext();

    drawScenery(
      context,
      BASE_OBSERVATION.camera,
      0,
      { mountains: fakeImage("mountains"), ground: fakeImage("ground") },
      180,
      234,
    );

    expect(drawImages(context).map(imageName)).not.toContain("building");
  });

  it("preserves the lifespan crop and frame-relative fill draw", () => {
    const context = createRecordingContext();
    drawClippedLifespanFill(
      context,
      fakeImage("lifespan-fill", 305, 10),
      160,
      10,
      309,
      14,
      0.5119,
    );

    expect(
      context.calls
        .filter(({ method }) => method === "clip")
        .map(({ method }) => method),
    ).toHaveLength(2);
    expect(
      context.calls
        .filter(({ method }) => method === "rect")
        .map(({ args }) => args),
    ).toEqual([
      [162, 10, 305, 14],
      [162, 12, expect.closeTo(156.1295), 10],
    ]);
    expect(drawImages(context)[0]?.args.slice(1)).toEqual([162, 12, 305, 10]);
  });

  it("preserves the health crop and compact bar colors", () => {
    const context = createRecordingContext();
    drawClippedHealthFill(context, fakeImage("hp-fill", 97, 9), 112, 32, 0.5);
    drawHealthBar(context, 250, 163, 194, 660);

    expect(drawImages(context)[0]?.args.slice(1)).toEqual([
      112 + 2,
      32 + 2,
      48.5,
      9,
    ]);
    expect(
      context.calls
        .filter(({ method }) => method === "fillRect")
        .map(({ fillStyle, args }) => [fillStyle, ...args]),
    ).toEqual([
      ["#7e0101", 225, 160, 50, 6],
      ["#ffff00", 225, 160, expect.closeTo(14.696969), 6],
    ]);
    expect(
      context.calls
        .filter(({ method }) => method === "strokeRect")
        .map(({ strokeStyle, args }) => [strokeStyle, ...args]),
    ).toEqual([["#545401", 224.5, 159.5, 51, 7]]);
  });

  it("maps encounter queue icons and action pointer frames from public state", () => {
    const observation: GameObservation = {
      ...BASE_OBSERVATION,
      encounters: {
        current: {
          kind: "battle",
          enemy: { id: "goblin", maximumHp: 900 },
          x: 300,
        },
        upcoming: [
          { kind: "shop", shop: "armorsmith", cachedPrice: 204 },
          { kind: "shop", shop: "bladesmith", cachedPrice: 236 },
          { kind: "battle" },
        ],
      },
    };

    expect(encounterQueueItems(observation)).toEqual([
      { imageId: "monster-icon", x: 298, y: 44, price: null },
      { imageId: "armor-event-icon", x: 344, y: 44, price: 204 },
      { imageId: "weapon-event-icon", x: 390, y: 44, price: 236 },
      { imageId: "monster-icon", x: 436, y: 44, price: null },
    ]);
    expect(
      [0, 11, 12, 23, 24].map((steps) =>
        actionPointerImageId({ ...observation, steps }),
      ),
    ).toEqual([
      "pointer",
      "pointer",
      "pointer-click",
      "pointer-click",
      "pointer",
    ]);
  });

  it("selects original feedback assets without procedural substitutes", () => {
    expect(
      [
        "bladesmith",
        "armorsmith",
        "soul-shrine",
        "pharmacy",
        "grims-shop",
        "voucher-store",
      ].map((shop) => originalEventVisual(shopPurchased(shop as ShopId))),
    ).toEqual(["upgrade", "upgrade", "flash", "buy", "buy", "buy"]);
    expect(originalEventVisual({ type: "item-used", item: "elixir" })).toBe(
      "item",
    );
    expect(
      originalEventVisual({
        type: "combat-hit",
        attacker: "hero",
        target: "enemy",
        damage: 229,
        critical: false,
        remainingHp: 671,
      }),
    ).toBe("hit");
  });

  it("anchors targeted combat and reward feedback to public actor positions", () => {
    const inputs = {
      camera: BASE_OBSERVATION.camera,
      groundY: 234,
      heroX: 70,
      enemyX: 380,
      encounterX: 180,
    } as const;

    expect(
      calculateEffectAnchor(
        {
          type: "combat-lethal-hit",
          attacker: "enemy",
          target: "hero",
        },
        inputs,
      ),
    ).toEqual({ x: 70, y: 181 });
    expect(
      calculateEffectAnchor(
        {
          type: "battle-reward",
          enemy: "goblin",
          gold: 100,
          score: 100,
          profileExp: 10,
          dragonKilled: false,
        },
        inputs,
      ),
    ).toEqual({ x: 70, y: 176 });
    expect(
      calculateEffectAnchor({ type: "pause-toggled", paused: true }, inputs),
    ).toEqual({ x: 240, y: 108 });
  });

  it("selects original timeline frames, scales action feedback, and skips missing hits", () => {
    const context = createRecordingContext();
    const hitTwo = fakeImage("hit-2", 32, 24);
    const action = fakeImage("action", 16, 16);
    const flash = fakeImage("flash", 20, 10);

    expect(
      drawOriginalHitEffect(
        context,
        { "hit-2": hitTwo },
        { x: 100, y: 80 },
        1.2,
      ),
    ).toBe(true);
    expect(drawImages(context)[0]?.args.slice(1)).toEqual([84, 68]);
    expect(
      drawOriginalActionEffect(context, [action], { x: 100, y: 80 }, 0),
    ).toBe(true);
    expect(drawImages(context)[1]?.args.slice(1)).toEqual([88, 68, 24, 24]);
    expect(
      drawOriginalFlashEffect(context, [flash], BASE_OBSERVATION.camera, 0),
    ).toBe(true);
    expect(drawImages(context)[2]?.args.slice(1)).toEqual([230, 155, 20, 10]);

    const missingContext = createRecordingContext();
    expect(
      drawOriginalHitEffect(missingContext, {}, { x: 100, y: 80 }, 0),
    ).toBe(false);
    expect(drawImages(missingContext)).toEqual([]);
    expect(
      drawOriginalTimelineFrame(
        missingContext,
        [undefined],
        { x: 100, y: 80 },
        0,
        1,
      ),
    ).toBe(false);
  });
});
