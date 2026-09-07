import { describe, expect, it } from "vitest";

import type {
  GameObservation,
  InventoryItemId,
} from "../../src/application/contracts.js";
import { createCombatPolicy } from "../../src/simulation/combat-policy.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

function observation(
  item: InventoryItemId = "elixir",
  hp = 954,
): GameObservation {
  const initial = createTestGameplayEngine().observe(
    createTestGameplayEngine().createRun({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "combat-policy-unit",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    }),
  );
  return {
    ...initial,
    player: {
      ...initial.player,
      hp: { current: hp, maximum: 1908 },
      inventory: { item },
    },
    actions: {
      ...initial.actions,
      canDismissTutorial: false,
      canUseCarriedItem: true,
    },
  };
}

describe("combat policy", () => {
  it("retains an Elixir above the configured HP fraction and uses it at the boundary", () => {
    const agent = createCombatPolicy().createAgent();
    expect(agent.decide(observation("elixir", 955), [])).toEqual([]);
    expect(agent.decide(observation(), [])).toEqual([
      { type: "use-carried-item" },
    ]);
    expect(agent.decide(observation("elixir", 953), [])).toEqual([
      { type: "use-carried-item" },
    ]);
    expect(
      createCombatPolicy({ elixirHpFraction: 0.25 })
        .createAgent()
        .decide(observation(), []),
    ).toEqual([]);
  });

  it("records normalized configuration and isolates it from the caller", () => {
    const config = { elixirHpFraction: 0.25 };
    const policy = createCombatPolicy(config);
    config.elixirHpFraction = 1;
    expect(policy.descriptor).toEqual({
      id: "combat-shopper",
      version: "1",
      config: { elixirHpFraction: 0.25 },
    });
    expect(policy.createAgent().decide(observation(), [])).toEqual([]);
    expect(policy.createAgent()).not.toBe(policy.createAgent());
    expect(createCombatPolicy().descriptor.config).toEqual({
      elixirHpFraction: 0.5,
    });
    expect(Object.isFrozen(policy.descriptor.config)).toBe(true);
  });

  it.each([-0.1, 1.1, NaN, Infinity])(
    "rejects invalid HP fraction %s",
    (elixirHpFraction) => {
      expect(() => createCombatPolicy({ elixirHpFraction })).toThrow(
        RangeError,
      );
    },
  );

  it.each(["divine-edge", "gold-voucher"] as const)(
    "uses eligible %s immediately",
    (item) => {
      expect(
        createCombatPolicy().createAgent().decide(observation(item, 1908), []),
      ).toEqual([{ type: "use-carried-item" }]);
    },
  );

  it("honors tutorial, item, and shop eligibility and terminal events", () => {
    const agent = createCombatPolicy().createAgent();
    const current = observation();
    expect(
      agent.decide(
        {
          ...current,
          actions: { ...current.actions, canDismissTutorial: true },
        },
        [],
      ),
    ).toEqual([{ type: "dismiss-tutorial" }]);
    const shopping = {
      ...current,
      encounters: {
        ...current.encounters,
        current: {
          kind: "shop" as const,
          shop: "bladesmith" as const,
          cachedPrice: 236,
          x: 200,
          used: false,
        },
      },
      actions: {
        ...current.actions,
        canUseCarriedItem: false,
        canPurchaseCurrentEncounter: true,
      },
    };
    expect(agent.decide(shopping, [])).toEqual([
      { type: "purchase-current-encounter" },
    ]);
    expect(
      agent.decide(
        {
          ...shopping,
          actions: { ...shopping.actions, canPurchaseCurrentEncounter: false },
        },
        [],
      ),
    ).toEqual([]);
    expect(
      agent.decide(shopping, [{ type: "run-ended", reason: "combat" }]),
    ).toEqual([]);
  });
});
