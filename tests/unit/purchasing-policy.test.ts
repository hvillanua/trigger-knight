import { describe, expect, it } from "vitest";

import type { RunState } from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { purchasingPolicy } from "../../src/simulation/purchasing-policy.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

function activeRun(): RunState {
  const state = gameplayEngine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "purchasing-policy-seed",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });

  return {
    ...state,
    movementSpeed: 0,
    player: { ...state.player, gold: 200 },
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop: "grims-shop",
        cachedPrice: 200,
        x: 200,
        used: false,
      },
    },
    lifecycle: {
      ...state.lifecycle,
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
  };
}

describe("purchasing policy", () => {
  it("has a versioned descriptor and fresh agents", () => {
    expect(purchasingPolicy.descriptor).toEqual({
      id: "purchase-reachable-shops",
      version: "1",
      config: {},
    });
    expect(purchasingPolicy.createAgent()).not.toBe(
      purchasingPolicy.createAgent(),
    );
  });

  it("issues the shared purchase command for a publicly eligible shop", () => {
    const observation = gameplayEngine.observe(activeRun());
    const agent = purchasingPolicy.createAgent();

    expect(agent.decide(observation, [])).toEqual([
      { type: "purchase-current-encounter" },
    ]);
    expect(
      agent.decide(observation, [{ type: "run-ended", reason: "lifespan" }]),
    ).toEqual([]);
  });

  it("dismisses the public tutorial gate before shopping", () => {
    const state = gameplayEngine.createRun({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "purchasing-policy-tutorial",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    const observation = gameplayEngine.observe(state);
    const agent = purchasingPolicy.createAgent();

    expect(agent.decide(observation, [])).toEqual([
      { type: "dismiss-tutorial" },
    ]);
  });

  it("does not issue a purchase when public eligibility is false", () => {
    const state = activeRun();
    const observation = gameplayEngine.observe({
      ...state,
      player: { ...state.player, gold: 199 },
    });
    const agent = purchasingPolicy.createAgent();

    expect(agent.decide(observation, [])).toEqual([]);
  });
});
