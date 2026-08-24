import { describe, expect, it } from "vitest";

import { calculateBackingStoreSize } from "../../src/foundation.js";

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
});
