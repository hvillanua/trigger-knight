import { describe, expect, it } from "vitest";

import {
  calculateBackingStoreSize,
  calculateWorldProjection,
} from "../../src/browser/foundation.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

describe("original-v1.3 world camera", () => {
  it("publishes the initial reference view in world units", () => {
    const state = gameplayEngine.createRun({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "world-camera-seed",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });

    expect(gameplayEngine.observe(state)).toMatchObject({
      camera: {
        x: 0,
        y: 0,
        width: 480,
        height: 320,
      },
    });
  });

  it.each([
    {
      output: { width: 960, height: 640 },
      expected: { x: 0, y: 0, width: 960, height: 640, scale: 2 },
    },
    {
      output: { width: 1280, height: 720 },
      expected: { x: 100, y: 0, width: 1080, height: 720, scale: 2.25 },
    },
    {
      output: { width: 600, height: 800 },
      expected: { x: 0, y: 200, width: 600, height: 400, scale: 1.25 },
    },
  ])("fits the same reference view inside $output", ({ output, expected }) => {
    const projection = calculateWorldProjection(
      { x: 0, y: 0, width: 480, height: 320 },
      output,
    );

    expect(projection.scale).toBeCloseTo(expected.scale);
    expect(projection.viewport.x).toBeCloseTo(expected.x);
    expect(projection.viewport.y).toBeCloseTo(expected.y);
    expect(projection.viewport.width).toBeCloseTo(expected.width);
    expect(projection.viewport.height).toBeCloseTo(expected.height);
  });

  it("changes only the physical projection when device pixel ratio changes", () => {
    const camera = { x: 0, y: 0, width: 480, height: 320 };
    const cssDimensions = { width: 720, height: 480 };
    const standard = calculateWorldProjection(
      camera,
      calculateBackingStoreSize(cssDimensions, 1),
    );
    const highDensity = calculateWorldProjection(
      camera,
      calculateBackingStoreSize(cssDimensions, 2),
    );

    expect(highDensity).toEqual({
      scale: standard.scale * 2,
      viewport: {
        x: standard.viewport.x * 2,
        y: standard.viewport.y * 2,
        width: standard.viewport.width * 2,
        height: standard.viewport.height * 2,
      },
    });
    expect(camera).toEqual({ x: 0, y: 0, width: 480, height: 320 });
  });
});
