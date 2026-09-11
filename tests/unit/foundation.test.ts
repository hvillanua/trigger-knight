import { describe, expect, it } from "vitest";

import {
  calculateBackingStoreSize,
  mapClientPointToWorld,
} from "../../src/browser/foundation.js";

describe("calculateBackingStoreSize", () => {
  it("scales CSS dimensions for a high-density display", () => {
    expect(calculateBackingStoreSize({ width: 480, height: 320 }, 2)).toEqual({
      width: 960,
      height: 640,
    });
  });

  it("keeps the backing store usable before layout has a size", () => {
    expect(calculateBackingStoreSize({ width: 0, height: 0 }, 1)).toEqual({
      width: 1,
      height: 1,
    });
  });

  it("rejects letterbox clicks and maps content clicks to world coordinates", () => {
    const camera = { x: 0, y: 0, width: 480, height: 320 } as const;
    const output = { width: 640, height: 360 } as const;
    const css = { width: 640, height: 360 } as const;
    const rect = { left: 10, top: 20, width: 642, height: 362 } as const;
    const borders = { left: 1, top: 1, right: 1, bottom: 1 } as const;

    expect(
      mapClientPointToWorld(
        camera,
        output,
        css,
        rect,
        { x: 11, y: 21 },
        borders,
      ),
    ).toBeNull();
    expect(
      mapClientPointToWorld(
        camera,
        output,
        css,
        rect,
        { x: 331, y: 201 },
        borders,
      ),
    ).toEqual({ x: 240, y: 160 });
  });
});
