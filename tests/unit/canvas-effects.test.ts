import { describe, expect, it } from "vitest";

import type {
  GameEvent,
  GameObservation,
  PresentationFrame,
} from "../../src/application/contracts.js";
import {
  CanvasEffectTracker,
  type EffectRecord,
} from "../../src/browser/canvas-effects.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

function frame(
  observation: Readonly<GameObservation>,
  events: readonly GameEvent[],
): PresentationFrame {
  return {
    previous: observation,
    current: observation,
    interpolation: 0,
    events,
  };
}

describe("canvas effect retention", () => {
  it("allows a new event to reuse a key after the old effect expires", () => {
    const engine = createTestGameplayEngine();
    const observation = engine.observe(
      engine.createRun({
        ruleset: "original-v1.3",
        seed: "effect-retention",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      }),
    );
    const firstEvent: GameEvent = {
      type: "shop-purchased",
      shop: "armorsmith",
      price: 204,
    };
    const createRecord = (event: GameEvent, key: string): EffectRecord => ({
      event,
      key,
      startActiveTicks: observation.activeTicks,
      anchor: { x: 0, y: 0 },
      clickAnchor: undefined,
      message: undefined,
    });
    const tracker = new CanvasEffectTracker();

    tracker.register(frame(observation, [firstEvent]), createRecord);
    tracker.prune(
      frame({ ...observation, activeTicks: observation.activeTicks + 100 }, []),
    );
    tracker.register(
      frame(observation, [
        {
          type: "shop-purchased",
          shop: "armorsmith",
          price: 204,
        },
      ]),
      createRecord,
    );
    tracker.prune(frame(observation, []));

    expect(tracker.sequence).toBe(2);
    expect(tracker.activeEffects).toHaveLength(1);
  });
});
