import { describe, expect, it } from "vitest";

import type {
  GameEvent,
  GameplayEngine,
  InventoryItemId,
  PlayerPolicy,
  RunConfig,
  ShopId,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createCombatPolicy } from "../../src/simulation/combat-policy.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();
const maxSteps = 30_000;
function config(seed: string): RunConfig {
  return {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed,
    initialProfile: {
      schemaVersion: 1,
      scoreMultiplier: 1,
      tutorialPreference: "disabled",
    },
  };
}

function runScenario(seed: string) {
  const shops = new Set<ShopId>();
  const items = new Set<InventoryItemId>();
  const weaponTiers = new Set<number>();
  const armorTiers = new Set<number>();
  let earned = 0;
  let spent = 0;
  let rewards = 0;
  let battles = 0;
  let rewardFundedPurchase = false;
  let precedingEvents: readonly GameEvent[] = [];
  const policy = createCombatPolicy();
  const replayAgent = policy.createAgent();
  const checkedPolicy: PlayerPolicy = {
    descriptor: policy.descriptor,
    createAgent() {
      const agent = policy.createAgent();
      return {
        decide(observation, events) {
          expect(events).toEqual(precedingEvents);
          const commands = agent.decide(observation, events);
          expect(
            replayAgent.decide(
              structuredClone(observation),
              structuredClone(events),
            ),
          ).toEqual(commands);
          return commands;
        },
      };
    },
  };
  const checkedEngine: GameplayEngine = {
    ...engine,
    step(state, commands) {
      const result = engine.step(state, commands);
      precedingEvents = result.events;
      for (const event of result.events) {
        expect(event.type).not.toBe("purchase-rejected");
        expect(event.type).not.toBe("item-use-rejected");
        switch (event.type) {
          case "battle-started":
            battles++;
            break;
          case "battle-reward":
            earned += event.gold;
            rewards++;
            break;
          case "item-used":
            items.add(event.item);
            break;
          case "shop-purchased":
            shops.add(event.shop);
            spent += event.price;
            if (earned > 0 && spent > 300) rewardFundedPurchase = true;
            if (event.shop === "bladesmith")
              weaponTiers.add(result.state.player.weapon.tier);
            if (event.shop === "armorsmith")
              armorTiers.add(result.state.player.armor.tier);
            break;
        }
      }
      expect(result.state.player.gold).toBe(300 + earned - spent);
      expect(Number.isSafeInteger(result.state.player.gold)).toBe(true);
      expect(result.state.player.gold).toBeGreaterThanOrEqual(0);
      return result;
    },
  };
  const result = createSimulationRunner(checkedEngine).run({
    config: config(seed),
    policy: checkedPolicy,
    maxSteps,
  });
  expect(result.policy).toEqual(policy.descriptor);
  expect(result.steps).toBeLessThan(maxSteps);
  expect(battles).toBeGreaterThan(1);
  expect(rewards).toBeGreaterThan(1);
  expect(rewardFundedPurchase).toBe(true);
  return {
    result,
    shops: [...shops].sort(),
    items: [...items].sort(),
    weaponTiers: [...weaponTiers].sort((a, b) => a - b),
    armorTiers: [...armorTiers].sort((a, b) => a - b),
    rewards,
  };
}

describe("continuous combat policy runs", () => {
  it("covers every shop, item, and equipment upgrade in generated runs", () => {
    const run = runScenario("m4-policy-2211");
    expect(run.shops).toEqual([
      "armorsmith",
      "bladesmith",
      "grims-shop",
      "pharmacy",
      "soul-shrine",
      "voucher-store",
    ]);
    expect(run.items).toEqual(["divine-edge", "elixir", "gold-voucher"]);
    const tiers = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(run.weaponTiers).toEqual(tiers);
    expect(run.armorTiers).toEqual(tiers);
    expect(run.rewards).toBe(29);
    expect(run.result).toMatchObject({
      terminalReason: "combat",
      steps: 14800,
    });
  }, 30_000);

  it("repeats complete results and records configuration as experiment input", () => {
    const request = {
      config: config("m4-policy-3"),
      policy: createCombatPolicy(),
      maxSteps,
    };
    const runner = createSimulationRunner(engine);
    const first = runner.run(request);
    expect(first).toMatchObject({ terminalReason: "lifespan", steps: 4501 });
    expect(runner.run(request)).toEqual(first);
    const shortRequest = { ...request, maxSteps: 1 };
    const defaultResult = runner.run(shortRequest);
    const configuredResult = runner.run({
      ...shortRequest,
      policy: createCombatPolicy({ elixirHpFraction: 0.25 }),
    });
    expect(configuredResult.policy.config).toEqual({ elixirHpFraction: 0.25 });
    expect(configuredResult.traceHash).not.toBe(defaultResult.traceHash);
  }, 30_000);

  it("bounds gated and unfinished runs with the configured step limit", () => {
    const runner = createSimulationRunner(engine);
    for (const policy of [nonProgressingPolicy, createCombatPolicy()]) {
      expect(
        runner.run({ config: config("m4-policy-limit"), policy, maxSteps: 20 }),
      ).toMatchObject({ steps: 20, terminalReason: "step-limit" });
    }
  });
});
