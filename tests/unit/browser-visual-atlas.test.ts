import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createVisualAtlas,
  ORIGINAL_ACTION_EFFECT_URLS,
  ORIGINAL_CLICK_EFFECT_URLS,
  ORIGINAL_EFFECT_IMAGE_URLS,
  ORIGINAL_FLASH_EFFECT_URLS,
  ORIGINAL_SCENE_ASSET_URLS,
  ORIGINAL_SPRITE_URLS,
  ORIGINAL_ANIMATION_URLS,
  ORIGINAL_UI_IMAGE_URLS,
} from "../../src/browser/visual-atlas.js";
import { createSwinirVisualAssetPack } from "../../src/browser/visual-assets.js";

const swinirPack = createSwinirVisualAssetPack({
  imageUrls: {
    "../assets/generated/swinir-2x/key-sprites/DefineSprite_497_Hero/1.png":
      "/swinir/hero-1.png",
    "../assets/generated/swinir-2x/images/357.jpg": "/swinir/sky.jpg",
  },
  manifestText: JSON.stringify({
    schemaVersion: 1,
    treatment: "swinir-2x",
    status: "generated",
    pixelDensity: 2,
    outputs: {
      root: "assets/generated/swinir-2x",
      files: [
        { path: "key-sprites/DefineSprite_497_Hero/1.png", pixelDensity: 2 },
        { path: "images/357.jpg", pixelDensity: 2 },
      ],
    },
  }),
});

describe("approved visual atlas", () => {
  it("leaves artwork absent when the browser image API is unavailable", () => {
    const atlas = createVisualAtlas(() => undefined);

    expect(atlas.status).toBe("unavailable");
    expect(atlas.originalImages).toEqual({});
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads numbered entity frames without requesting generated artwork", () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload?: () => void;
        onerror?: () => void;
        set src(url: string) {
          requests.push(url);
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    createVisualAtlas(() => undefined);
    expect(requests.some((url) => url.includes("world-atlas.svg"))).toBe(false);
    expect(ORIGINAL_ANIMATION_URLS.hero[9]).toMatch(/\/10.png/);
    expect(ORIGINAL_ANIMATION_URLS.hero).toHaveLength(62);
    expect(requests).toContain(ORIGINAL_ANIMATION_URLS.hero[16]);
  });

  it("settles failed assets without substituting another image", async () => {
    vi.stubGlobal(
      "Image",
      class {
        onerror?: () => void;
        set src(_url: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const statuses: string[] = [];
    const atlas = createVisualAtlas((status) => statuses.push(status));
    await Promise.resolve();
    expect(statuses).toEqual(["unavailable"]);
    expect(
      atlas.originalFrames.hero?.every((image) => image === undefined),
    ).toBe(true);
  });

  it("keeps a failed frame empty while neighboring frames remain available", async () => {
    vi.stubGlobal(
      "Image",
      class {
        onload?: () => void;
        onerror?: () => void;
        set src(url: string) {
          queueMicrotask(() =>
            url.includes("_Hero/18.png") ? this.onerror?.() : this.onload?.(),
          );
        }
      },
    );
    const atlas = createVisualAtlas(() => undefined);
    await Promise.resolve();
    expect(atlas.status).toBe("partial");
    expect(atlas.originalFrames.hero?.[16]).toBeDefined();
    expect(atlas.originalFrames.hero?.[17]).toBeUndefined();
    expect(atlas.originalFrames.hero?.[18]).toBeDefined();
  });

  it("selects SwinIR artwork and keeps per-file density metadata", async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload?: () => void;
        onerror?: () => void;
        set src(url: string) {
          requests.push(url);
          queueMicrotask(() => this.onload?.());
        }
      },
    );

    const atlas = createVisualAtlas(() => undefined, swinirPack);
    await Promise.resolve();

    expect(atlas.treatment.id).toBe("swinir-2x");
    expect(requests).toContain("/swinir/hero-1.png");
    expect(atlas.originalFrames.hero?.[0]?.pixelDensity).toBe(2);
    expect(atlas.sceneImages.sky?.pixelDensity).toBe(2);
  });

  it("maps the original character and scene exports into runtime assets", () => {
    expect(Object.keys(ORIGINAL_SPRITE_URLS).sort()).toEqual([
      "dragon",
      "goblin",
      "golem",
      "hero",
      "wolf",
    ]);
    expect(Object.keys(ORIGINAL_SCENE_ASSET_URLS).sort()).toEqual([
      "building",
      "ground",
      "mountains",
      "sky",
    ]);
    for (const url of Object.values(ORIGINAL_SPRITE_URLS)) {
      expect(url).toContain("/assets/original/key-sprites/");
    }
    for (const url of Object.values(ORIGINAL_SCENE_ASSET_URLS)) {
      expect(url).toContain("/assets/original/images/");
    }
    expect(Object.keys(ORIGINAL_EFFECT_IMAGE_URLS)).toEqual([
      "hit-1",
      "hit-2",
      "hit-3",
      "hit-4",
      "hit-5",
      "hit-6",
      "hit-7",
    ]);
    for (const url of Object.values(ORIGINAL_EFFECT_IMAGE_URLS)) {
      expect(url).toContain("/assets/original/images/");
    }
  });

  it("keeps event artwork separate from the compact status artwork", () => {
    expect(ORIGINAL_UI_IMAGE_URLS["session-over-pointer"]).toContain("/12.png");
    expect(ORIGINAL_UI_IMAGE_URLS.pointer).toContain("/19.png");
    expect(ORIGINAL_UI_IMAGE_URLS["pointer-click"]).toContain("/21.png");
    expect(ORIGINAL_UI_IMAGE_URLS["weapon-event-icon"]).toContain("/168.png");
    expect(ORIGINAL_UI_IMAGE_URLS["armor-event-icon"]).toContain("/170.png");
    expect(ORIGINAL_UI_IMAGE_URLS["monster-icon"]).toContain("/179.png");
    expect(ORIGINAL_UI_IMAGE_URLS["weapon-stats-icon"]).toContain("/197.png");
    expect(ORIGINAL_UI_IMAGE_URLS["item-stats-icon"]).toContain("/198.png");
    expect(ORIGINAL_UI_IMAGE_URLS["armor-stats-icon"]).toContain("/199.png");
  });

  it("maps the original 60-frame click feedback timeline in order", () => {
    expect(ORIGINAL_CLICK_EFFECT_URLS).toHaveLength(60);
    expect(ORIGINAL_CLICK_EFFECT_URLS[0]).toContain(
      "/DefineSprite_311_MouseEffect/1.png",
    );
    expect(ORIGINAL_CLICK_EFFECT_URLS.at(-1)).toContain(
      "/DefineSprite_311_MouseEffect/60.png",
    );
  });

  it("maps the original action and flash timelines in order", () => {
    expect(ORIGINAL_ACTION_EFFECT_URLS.buy).toHaveLength(30);
    expect(ORIGINAL_ACTION_EFFECT_URLS.item).toHaveLength(30);
    expect(ORIGINAL_ACTION_EFFECT_URLS.upgrade).toHaveLength(30);
    expect(ORIGINAL_ACTION_EFFECT_URLS.buy[0]).toContain(
      "/DefineSprite_118_FXBuy/1.png",
    );
    expect(ORIGINAL_ACTION_EFFECT_URLS.item.at(-1)).toContain(
      "/DefineSprite_151_FXItem/30.png",
    );
    expect(ORIGINAL_ACTION_EFFECT_URLS.upgrade.at(-1)).toContain(
      "/DefineSprite_153_FXUpgrade/30.png",
    );
    expect(ORIGINAL_FLASH_EFFECT_URLS).toHaveLength(10);
    expect(ORIGINAL_FLASH_EFFECT_URLS[0]).toContain(
      "/DefineSprite_369_Effect-Flash/1.png",
    );
    expect(ORIGINAL_FLASH_EFFECT_URLS.at(-1)).toContain(
      "/DefineSprite_369_Effect-Flash/10.png",
    );
  });
});
