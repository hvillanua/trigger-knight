import { describe, expect, it } from "vitest";

import type {
  GameplayTrace,
  RunConfig,
  RunResult,
  RunState,
  ShopId,
} from "../../src/application/contracts.js";
import { createGameplayEngine } from "../../src/application/gameplay-engine.js";
import { compareGameplayTraces } from "../../src/application/gameplay-execution.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { generateEncounter } from "../../src/domain/encounters.js";
import {
  ORIGINAL_V13_RULESET_ID,
  originalV13RuleSet,
  ruleSetRegistry,
} from "../../src/domain/rulesets.js";
import { RANDOM_ALGORITHM } from "../../src/domain/random.js";
import { purchasingPolicy } from "../../src/simulation/purchasing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";

const gameplayEngine = createGameplayEngine(ruleSetRegistry);
const PURCHASED_SHOPS_BEFORE_COMBAT = [
  "armorsmith",
  "bladesmith",
  "grims-shop",
  "pharmacy",
  "soul-shrine",
] as const;
const POLICY_SEEDS = [
  "m3-policy-01",
  "m3-policy-02",
  "m3-policy-03",
  "m3-policy-04",
  "m3-policy-05",
  "m3-policy-06",
  "m3-policy-07",
  "m3-policy-08",
  "m3-policy-09",
  "m3-policy-10",
  "m3-policy-11",
  "m3-policy-12",
  "m3-policy-13",
  "m3-policy-14",
  "m3-policy-15",
  "m3-policy-16",
] as const;

function config(seed: string): RunConfig {
  return {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed,
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  };
}

function runPolicy(seed: string): {
  readonly result: RunResult;
  readonly trace: GameplayTrace;
} {
  let trace: GameplayTrace | undefined;
  const runner = createSimulationRunner(gameplayEngine, {
    onTrace: (candidate) => {
      trace = candidate;
    },
  });
  const result = runner.run({
    config: config(seed),
    policy: purchasingPolicy,
    maxSteps: 420,
  });

  if (trace === undefined) {
    throw new Error("Expected the purchasing-policy trace");
  }

  return { result, trace };
}

function purchasedShops(trace: GameplayTrace): readonly ShopId[] {
  return trace.checkpoints.flatMap(({ events }) =>
    events.flatMap((event) =>
      event.type === "shop-purchased" ? [event.shop] : [],
    ),
  );
}

function assertCachedPrice(
  state: Readonly<RunState>,
  shop: ShopId,
  price: number,
): void {
  switch (shop) {
    case "bladesmith":
      expect(price).toBeGreaterThanOrEqual(236);
      expect(price).toBeLessThanOrEqual(560);
      expect((price - 200) % 36).toBe(0);
      return;
    case "armorsmith":
      expect(price).toBeGreaterThanOrEqual(204);
      expect(price).toBeLessThanOrEqual(636);
      expect((price - 150) % 54).toBe(0);
      return;
    case "soul-shrine": {
      expect(price).toBeGreaterThanOrEqual(50);
      expect((price - 50) % 70).toBe(0);
      const extensionAtGeneration = (price - 50) / 70;
      expect(extensionAtGeneration).toBeLessThanOrEqual(
        state.encounters.generation.soulShrine.extensions,
      );
      return;
    }
    case "pharmacy":
      expect(price).toBe(150);
      return;
    case "grims-shop":
      expect(price).toBe(200);
      return;
    case "voucher-store":
      expect(price).toBe(500);
      return;
  }
}

function assertQueueInvariants(trace: GameplayTrace): void {
  let spent = 0;
  let earned = 0;
  let purchasesForCurrentShop = 0;

  for (const checkpoint of trace.checkpoints) {
    const { state, events } = checkpoint;
    expect(state.steps).toBe(checkpoint.index);
    expect(state.encounters.upcoming).toHaveLength(3);
    expect(Object.keys(state.player.inventory)).toEqual(["item"]);
    expect([null, "elixir", "divine-edge", "gold-voucher"]).toContain(
      state.player.inventory.item,
    );
    expect(state.player.weapon.tier).toBeGreaterThanOrEqual(1);
    expect(state.player.weapon.tier).toBeLessThanOrEqual(10);
    expect(state.player.weapon.attack).toBe(
      129 + 87 * state.player.weapon.tier,
    );
    expect(state.player.armor.tier).toBeGreaterThanOrEqual(1);
    expect(state.player.armor.tier).toBeLessThanOrEqual(10);
    expect(state.player.hp.maximum).toBe(1_009 + 899 * state.player.armor.tier);
    expect(state.player.hp.current).toBeLessThanOrEqual(
      state.player.hp.maximum,
    );

    for (const encounter of [
      state.encounters.current,
      ...state.encounters.upcoming,
    ]) {
      if (encounter?.kind === "shop") {
        assertCachedPrice(state, encounter.shop, encounter.cachedPrice);
      }
    }

    for (const event of events) {
      expect(event.type).not.toBe("purchase-rejected");
      if (event.type === "battle-reward") earned += event.gold;
      if (event.type === "shop-purchased") {
        spent += event.price;
        const current = state.encounters.current;
        expect(current?.kind).toBe("shop");
        if (current?.kind !== "shop") {
          throw new Error("A purchase event requires a current shop");
        }
        expect(current.used).toBe(true);
        expect(purchasesForCurrentShop).toBe(0);
        purchasesForCurrentShop = 1;
      }
      if (event.type === "encounter-promoted") {
        purchasesForCurrentShop = 0;
      }
      if (event.type === "shop-departed") {
        purchasesForCurrentShop = 0;
      }
    }

    expect(state.player.gold).toBe(300 + earned - spent);
    expect(state.player.gold).toBeGreaterThanOrEqual(0);
  }
}

describe("Milestone 3 economy verification", () => {
  it("purchases every affordable pre-combat shop type across a fixed seed set", () => {
    const runs = POLICY_SEEDS.map(runPolicy);
    const purchased = [
      ...new Set(runs.flatMap(({ trace }) => purchasedShops(trace))),
    ].sort();
    expect(purchased).toEqual([...PURCHASED_SHOPS_BEFORE_COMBAT].sort());
    expect(
      runs.every(({ result }) => result.terminalReason === "step-limit"),
    ).toBe(true);
    expect(
      runs.every(({ trace }) =>
        trace.checkpoints.some(({ events }) =>
          events.some((event) => event.type === "battle-started"),
        ),
      ),
    ).toBe(true);
    for (const { trace } of runs) {
      assertQueueInvariants(trace);
    }
  });

  it("keeps policy decisions within public observation and preceding events", () => {
    const run = runPolicy(POLICY_SEEDS[0]);
    const commands = run.trace.checkpoints.flatMap(({ commands }) => commands);

    expect(
      commands.every(
        (command) =>
          command.type === "dismiss-tutorial" ||
          command.type === "purchase-current-encounter" ||
          command.type === "use-carried-item",
      ),
    ).toBe(true);
    expect(commands.every((command) => Object.keys(command).length === 1)).toBe(
      true,
    );
    expect(
      run.trace.checkpoints.some(({ events }) =>
        events.some((event) => event.type === "shop-purchased"),
      ),
    ).toBe(true);
  });

  it("covers later-day, higher-cost, and post-battle-dependent economy states", () => {
    const initial = gameplayEngine.createRun(config("m3-focused-states"));
    const laterDay: RunState = {
      ...initial,
      distance: 21_000,
      day: 4,
      player: { ...initial.player, gold: 500 },
      encounters: {
        ...initial.encounters,
        current: {
          kind: "shop",
          shop: "voucher-store",
          cachedPrice: 500,
          x: 200,
          used: false,
        },
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    };
    const laterDayResult = gameplayEngine.step(
      laterDay,
      purchasingPolicy
        .createAgent()
        .decide(gameplayEngine.observe(laterDay), []),
    );
    expect(laterDayResult.state.player).toMatchObject({
      gold: 0,
      inventory: { item: "gold-voucher" },
    });

    const higherCost: RunState = {
      ...initial,
      player: {
        ...initial.player,
        gold: 524,
        weapon: { tier: 9, name: "Excalibur", attack: 912 },
      },
      encounters: {
        ...initial.encounters,
        current: {
          kind: "shop",
          shop: "bladesmith",
          cachedPrice: 524,
          x: 200,
          used: false,
        },
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    };
    const higherCostResult = gameplayEngine.step(
      higherCost,
      purchasingPolicy
        .createAgent()
        .decide(gameplayEngine.observe(higherCost), []),
    );
    expect(higherCostResult.state.player).toMatchObject({
      gold: 0,
      weapon: { tier: 10, name: "Astral Sword", attack: 999 },
    });

    const battleQueued = generateEncounter(
      { algorithm: RANDOM_ALGORITHM, state: 2 },
      {
        ...initial.encounters.generation,
        shopsUntilBattle: 0,
        seenSinceBattle: {
          bladesmith: true,
          armorsmith: true,
          soulShrine: true,
        },
      },
      4,
      initial.player,
      initial.lifespan,
      originalV13RuleSet.constants.encounters,
    );
    expect(battleQueued.encounter).toMatchObject({
      kind: "battle",
      enemy: { id: "goblin" },
    });
    expect(battleQueued.generation.seenSinceBattle).toEqual({
      bladesmith: false,
      armorsmith: false,
      soulShrine: false,
    });
    const postBattle = generateEncounter(
      { algorithm: RANDOM_ALGORITHM, state: 91 },
      {
        ...battleQueued.generation,
        shopsUntilBattle: 1,
      },
      4,
      {
        ...initial.player,
        weapon: { tier: 2, name: "Sword", attack: 303 },
      },
      initial.lifespan,
      originalV13RuleSet.constants.encounters,
    );
    expect(postBattle.encounter).toEqual({
      kind: "shop",
      shop: "bladesmith",
      cachedPrice: 272,
    });
    expect(postBattle.generation.seenSinceBattle.bladesmith).toBe(true);

    if (postBattle.encounter.kind !== "shop") {
      throw new Error("Expected a post-battle shop fixture");
    }
    const postBattleState: RunState = {
      ...initial,
      random: postBattle.random,
      player: {
        ...initial.player,
        gold: 272,
        weapon: { tier: 2, name: "Sword", attack: 303 },
      },
      encounters: {
        ...initial.encounters,
        current: { ...postBattle.encounter, x: 200, used: false },
        generation: postBattle.generation,
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    };
    const postBattlePurchase = gameplayEngine.step(
      postBattleState,
      purchasingPolicy
        .createAgent()
        .decide(gameplayEngine.observe(postBattleState), []),
    );
    expect(postBattlePurchase.state.player).toMatchObject({
      gold: 0,
      weapon: { tier: 3, name: "Rapier", attack: 390 },
    });
    expect(postBattlePurchase.events).toContainEqual({
      type: "shop-purchased",
      shop: "bladesmith",
      price: 272,
    });
  });

  it("starts the active battle without settling rewards", () => {
    const initial = gameplayEngine.createRun(config("m3-active-battle"));
    const queuedBattle = initial.encounters.upcoming.find(
      (encounter) => encounter.kind === "battle",
    );
    if (queuedBattle === undefined) {
      throw new Error("Expected a queued battle fixture");
    }
    const state: RunState = {
      ...initial,
      movementSpeed: 15,
      player: { ...initial.player, gold: 64 },
      encounters: {
        ...initial.encounters,
        current: { ...queuedBattle, x: 421 },
        distanceUntilNext: 500,
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    };

    const started = gameplayEngine.step(state, []);
    expect(started.state.lifecycle.phase).toBe("battling");
    expect(started.events).toContainEqual({
      type: "battle-started",
      enemy: {
        id: queuedBattle.enemy.id,
        maximumHp: queuedBattle.enemy.maximumHp,
        currentHp: queuedBattle.enemy.maximumHp,
      },
    });
    expect(started.state.player.gold).toBe(64);
    expect(started.state.encounters.upcoming).toEqual(
      state.encounters.upcoming,
    );
    expect(started.state.battle?.enemyHp).toBe(queuedBattle.enemy.maximumHp);

    const held = gameplayEngine.step(started.state, []);
    expect(held.state.lifecycle.phase).toBe("battling");
    expect(held.state.player.gold).toBe(64);
    expect(held.state.encounters).toEqual(started.state.encounters);
    expect(held.state.movementSpeed).toBe(14);
    expect(held.events).not.toContainEqual({ type: "shop-purchased" });
  });

  it("matches a browser session and a headless policy trace for the same schedule", () => {
    const seed = "m3-parity-schedule";
    const headless = runPolicy(seed);
    const browser = createBrowserGameplaySession(
      gameplayEngine,
      config(seed),
      undefined,
      { retainDiagnostics: true },
    );

    for (const checkpoint of headless.trace.checkpoints.slice(1)) {
      browser.dispatch(checkpoint.commands);
    }

    expect(
      compareGameplayTraces(browser.readDiagnostics(), headless.trace),
    ).toEqual({
      equal: true,
    });
    expect(headless.trace.traceHash).toBe(
      "sha256-v1:a3fe9595fad4876f05bbe5112bb8cfcf31d2c2f06ff8f33174769056b37cfdcb",
    );
    expect(browser.readDiagnostics().traceHash).toBe(headless.trace.traceHash);
  });
});
