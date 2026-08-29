import { describe, expect, it } from "vitest";

import type {
  InventoryItemId,
  RunState,
  ShopId,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();
const purchaseCommand = Object.freeze({
  type: "purchase-current-encounter" as const,
});

function activeRun(): RunState {
  const state = gameplayEngine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "shop-purchase-seed",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });

  return {
    ...state,
    movementSpeed: 0,
    lifecycle: {
      ...state.lifecycle,
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
  };
}

function atShop(
  shop: ShopId,
  cachedPrice: number,
  options: {
    readonly gold?: number;
    readonly item?: InventoryItemId | null;
    readonly used?: boolean;
    readonly x?: number;
  } = {},
): RunState {
  const state = activeRun();

  return {
    ...state,
    player: {
      ...state.player,
      gold: options.gold ?? 600,
      inventory: { item: options.item ?? state.player.inventory.item },
    },
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop,
        cachedPrice,
        x: options.x ?? 200,
        used: options.used ?? false,
      },
    },
  };
}

describe("original-v1.3 semantic shop purchases", () => {
  it.each([
    ["pharmacy", 150, "elixir"],
    ["grims-shop", 200, "divine-edge"],
    ["voucher-store", 500, "gold-voucher"],
  ] as const)(
    "buys from %s using its cached price and replaces the inventory slot",
    (shop, cachedPrice, item) => {
      const state = atShop(shop, cachedPrice, {
        gold: cachedPrice,
        item: shop === "pharmacy" ? "elixir" : null,
      });

      expect(
        gameplayEngine.observe(state).actions.canPurchaseCurrentEncounter,
      ).toBe(true);

      const result = gameplayEngine.step(state, [purchaseCommand]);

      expect(result.state.player).toMatchObject({
        gold: 0,
        inventory: { item },
      });
      expect(result.state.encounters.current).toMatchObject({
        kind: "shop",
        shop,
        cachedPrice,
        used: true,
      });
      expect(result.events).toContainEqual({
        type: "shop-purchased",
        shop,
        price: cachedPrice,
      });
    },
  );

  it("charges an already carried item and marks the shop used only once", () => {
    const first = gameplayEngine.step(atShop("pharmacy", 150), [
      purchaseCommand,
      purchaseCommand,
    ]);

    expect(first.state.player).toMatchObject({
      gold: 450,
      inventory: { item: "elixir" },
    });
    expect(first.events).toContainEqual({
      type: "shop-purchased",
      shop: "pharmacy",
      price: 150,
    });
    expect(first.events).toContainEqual({
      type: "purchase-rejected",
      reason: "already-used",
    });

    const repeated = gameplayEngine.step(first.state, [purchaseCommand]);

    expect(repeated.state.player).toEqual(first.state.player);
    expect(repeated.events).toContainEqual({
      type: "purchase-rejected",
      reason: "already-used",
    });
    expect(
      gameplayEngine.observe(repeated.state).actions
        .canPurchaseCurrentEncounter,
    ).toBe(false);
  });

  it.each([
    {
      name: "rejects after pausing",
      paused: false,
      expectedGold: 600,
      expectedEvents: [
        { type: "pause-toggled", paused: true },
        { type: "purchase-rejected", reason: "lifecycle-gated" },
        { type: "step-advanced", step: 1 },
      ],
      expectedUsed: false,
    },
    {
      name: "succeeds after resuming",
      paused: true,
      expectedGold: 450,
      expectedEvents: [
        { type: "pause-toggled", paused: false },
        { type: "shop-purchased", shop: "pharmacy", price: 150 },
        { type: "step-advanced", step: 1 },
      ],
      expectedUsed: true,
    },
  ] as const)(
    "$name when toggle-pause precedes purchase in one command list",
    ({ paused, expectedGold, expectedEvents, expectedUsed }) => {
      const state = atShop("pharmacy", 150);
      const result = gameplayEngine.step(
        { ...state, lifecycle: { ...state.lifecycle, paused } },
        [{ type: "toggle-pause" }, purchaseCommand],
      );

      expect(result.state.player.gold).toBe(expectedGold);
      expect(result.state.encounters.current).toMatchObject({
        kind: "shop",
        used: expectedUsed,
      });
      expect(result.events).toEqual(expectedEvents);
    },
  );

  it.each([
    {
      name: "insufficient gold",
      state: () => atShop("pharmacy", 150, { gold: 149 }),
      reason: "insufficient-gold",
    },
    {
      name: "the lower range boundary",
      state: () => atShop("pharmacy", 150, { x: 0 }),
      reason: "out-of-range",
    },
    {
      name: "the upper range boundary",
      state: () => atShop("pharmacy", 150, { x: 420 }),
      reason: "out-of-range",
    },
    {
      name: "a used shop",
      state: () => atShop("pharmacy", 150, { used: true }),
      reason: "already-used",
    },
    {
      name: "a lifecycle gate",
      state: () => {
        const state = atShop("pharmacy", 150);
        return { ...state, lifecycle: { ...state.lifecycle, paused: true } };
      },
      reason: "lifecycle-gated",
    },
    {
      name: "a non-shop encounter",
      state: () => {
        const state = activeRun();
        return {
          ...state,
          encounters: {
            ...state.encounters,
            current: { kind: "battle" as const, x: 500 },
          },
        };
      },
      reason: "no-current-shop",
    },
  ] as const)(
    "rejects $name without changing economy state",
    ({ state, reason }) => {
      const initial = state();
      const initialPlayer = initial.player;

      expect(
        gameplayEngine.observe(initial).actions.canPurchaseCurrentEncounter,
      ).toBe(false);

      const result = gameplayEngine.step(initial, [purchaseCommand]);

      expect(result.state.player).toEqual(initialPlayer);
      expect(result.events).toContainEqual({
        type: "purchase-rejected",
        reason,
      });
    },
  );

  it("does not implement the deferred Shrine effect", () => {
    const state = atShop("soul-shrine", 50);
    const result = gameplayEngine.step(state, [purchaseCommand]);

    expect(result.state.player).toEqual(state.player);
    expect(result.events).toContainEqual({
      type: "purchase-rejected",
      reason: "shop-effect-unavailable",
    });
    expect(
      gameplayEngine.observe(state).actions.canPurchaseCurrentEncounter,
    ).toBe(false);
  });

  it("reproduces purchases after a checkpoint round trip without mutating inputs", () => {
    const state = atShop("grims-shop", 177);
    const restored = JSON.parse(JSON.stringify(state)) as RunState;
    const before = JSON.stringify(state);

    const first = gameplayEngine.step(state, [purchaseCommand]);
    const repeated = gameplayEngine.step(restored, [purchaseCommand]);

    expect(repeated).toEqual(first);
    expect(JSON.stringify(state)).toBe(before);
    expect(Object.isFrozen(first.state.player)).toBe(true);
    expect(Object.isFrozen(first.state.player.inventory)).toBe(true);
    expect(Object.isFrozen(first.state.encounters.current)).toBe(true);
    expect(Object.isFrozen(first.events)).toBe(true);
  });
});
