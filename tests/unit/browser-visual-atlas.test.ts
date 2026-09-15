import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createVisualAtlas,
  ORIGINAL_EFFECT_IMAGE_URLS,
  ORIGINAL_SCENE_ASSET_URLS,
  ORIGINAL_SPRITE_URLS,
  ORIGINAL_ANIMATION_URLS,
  ORIGINAL_UI_IMAGE_URLS,
} from "../../src/browser/visual-atlas.js";

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
});
