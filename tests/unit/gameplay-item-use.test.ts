import { describe, expect, it } from "vitest";

import type {
  GameCommand,
  InventoryItemId,
  RunConfig,
  RunState,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();
const useCarriedItemCommand = Object.freeze({
  type: "use-carried-item",
} as const satisfies GameCommand);

function activeBattleState(item: InventoryItemId | null = "elixir"): RunState {
  const config: RunConfig = {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "item-use-seed",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  };
  const initial = gameplayEngine.createRun(config);
  const queuedBattle = initial.encounters.upcoming.find(
    (encounter) => encounter.kind === "battle",
  );

  if (queuedBattle === undefined || queuedBattle.kind !== "battle") {
    throw new Error("Expected a queued battle fixture");
  }

  const started = gameplayEngine.step(
    {
      ...initial,
      movementSpeed: 15,
      encounters: {
        ...initial.encounters,
        current: { ...queuedBattle, x: 421 },
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    },
    [],
  );

  return {
    ...started.state,
    player: {
      ...started.state.player,
      inventory: { item },
    },
  };
}

describe("original-v1.3 carried item use", () => {
  it("uses an Elixir only during an active battle", () => {
    const state = activeBattleState();
    const battleState = state.battle;
    if (battleState === null) {
      throw new Error("Expected an active battle fixture");
    }

    const damaged = {
      ...state,
      player: {
        ...state.player,
        hp: { ...state.player.hp, current: 1 },
      },
    };

    expect(gameplayEngine.observe(damaged).actions.canUseCarriedItem).toBe(
      true,
    );

    const result = gameplayEngine.step(damaged, [useCarriedItemCommand]);

    expect(result.state.player).toMatchObject({
      hp: { current: state.player.hp.maximum },
      inventory: { item: null },
    });
    expect(result.state.battle).toEqual(battleState);
    const event = result.events.find(
      (candidate) => candidate.type === "item-used",
    );
    expect(event).toEqual({ type: "item-used", item: "elixir" });
    expect(Object.keys(event ?? {})).toEqual(["type", "item"]);
  });

  it.each([
    ["elixir", { heroAttackFactor: 1, enemyGoldMultiplier: 1 }],
    ["divine-edge", { heroAttackFactor: 100, enemyGoldMultiplier: 1 }],
    ["gold-voucher", { heroAttackFactor: 1, enemyGoldMultiplier: 10 }],
  ] as const)("applies the exact %s battle effect", (item, expected) => {
    const state = activeBattleState(item);
    const randomBefore = state.random;
    const enemyGoldBefore =
      state.encounters.current?.kind === "battle"
        ? state.encounters.current.enemy.goldReward
        : undefined;

    const result = gameplayEngine.step(state, [useCarriedItemCommand]);

    expect(result.state.player.inventory.item).toBeNull();
    expect(result.state.battle?.hero.attackFactor).toBe(
      expected.heroAttackFactor,
    );
    expect(result.state.battle?.enemyGoldMultiplier).toBe(
      expected.enemyGoldMultiplier,
    );
    expect(result.state.random).toEqual(randomBefore);
    expect(
      result.state.encounters.current?.kind === "battle"
        ? result.state.encounters.current.enemy.goldReward
        : undefined,
    ).toBe(enemyGoldBefore);
    expect(result.events).toContainEqual({ type: "item-used", item });
  });

  it("exposes item-use eligibility only for a carried item in active battle", () => {
    expect(
      gameplayEngine.observe(activeBattleState("elixir")).actions
        .canUseCarriedItem,
    ).toBe(true);
    expect(
      gameplayEngine.observe(activeBattleState(null)).actions.canUseCarriedItem,
    ).toBe(false);

    const observation = gameplayEngine.observe(activeBattleState("elixir"));
    expect(Object.keys(observation.actions)).toEqual([
      "canTogglePause",
      "canDismissTutorial",
      "canPurchaseCurrentEncounter",
      "canUseCarriedItem",
    ]);
    expect(observation.battle).not.toHaveProperty("enemyGoldMultiplier");

    const runningState = gameplayEngine.createRun({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "item-use-running",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    expect(gameplayEngine.observe(runningState).actions.canUseCarriedItem).toBe(
      false,
    );
  });

  it.each([
    {
      name: "outside battle",
      state: () => {
        const state = gameplayEngine.createRun({
          ruleset: ORIGINAL_V13_RULESET_ID,
          seed: "item-use-outside-battle",
          initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
        });
        return {
          ...state,
          lifecycle: {
            ...state.lifecycle,
            tutorialPage: null,
            pregameStepsRemaining: 0,
          },
        };
      },
      reason: "no-current-battle",
    },
    {
      name: "without an item",
      state: () => activeBattleState(null),
      reason: "no-item",
    },
    {
      name: "behind a pause gate",
      state: () => {
        const state = activeBattleState("elixir");
        return {
          ...state,
          lifecycle: { ...state.lifecycle, paused: true },
        };
      },
      reason: "lifecycle-gated",
    },
    {
      name: "behind a tutorial gate",
      state: () => {
        const state = activeBattleState("elixir");
        return {
          ...state,
          lifecycle: { ...state.lifecycle, tutorialPage: 0 as const },
        };
      },
      reason: "lifecycle-gated",
    },
    {
      name: "after the run ends",
      state: () => {
        const state = activeBattleState("elixir");
        return {
          ...state,
          lifecycle: {
            ...state.lifecycle,
            phase: "ended" as const,
            terminalReason: "lifespan" as const,
          },
        };
      },
      reason: "lifecycle-gated",
    },
  ] as const)(
    "rejects item use $name without changing item state",
    ({ state, reason }) => {
      const initial = state();
      const initialPlayer = initial.player;
      const initialBattle = initial.battle;

      const result = gameplayEngine.step(initial, [useCarriedItemCommand]);

      expect(result.state.player).toEqual(initialPlayer);
      expect(result.state.battle).toEqual(initialBattle);
      const event = result.events.find(
        (candidate) => candidate.type === "item-use-rejected",
      );
      expect(event).toEqual({ type: "item-use-rejected", reason });
      expect(Object.keys(event ?? {})).toEqual(["type", "reason"]);
      expect(gameplayEngine.observe(initial).actions.canUseCarriedItem).toBe(
        false,
      );
    },
  );

  it("rejects a second use after consuming the item", () => {
    const first = gameplayEngine.step(activeBattleState("elixir"), [
      useCarriedItemCommand,
    ]);
    const second = gameplayEngine.step(first.state, [useCarriedItemCommand]);

    expect(first.state.player.inventory.item).toBeNull();
    expect(second.state.player).toEqual(first.state.player);
    expect(second.events).toContainEqual({
      type: "item-use-rejected",
      reason: "no-item",
    });
  });

  it("resets battle-scoped item effects when the next battle starts", () => {
    const used = gameplayEngine.step(activeBattleState("divine-edge"), [
      useCarriedItemCommand,
    ]);
    const current = used.state.encounters.current;
    if (current?.kind !== "battle") {
      throw new Error("Expected the item fixture to remain in battle");
    }

    const nextBattle = gameplayEngine.step(
      {
        ...used.state,
        battle: null,
        encounters: {
          ...used.state.encounters,
          current: { ...current, x: 421 },
        },
      },
      [],
    );

    expect(nextBattle.state.battle).toMatchObject({
      enemyGoldMultiplier: 1,
      hero: { attackFactor: 1 },
    });
  });
});
