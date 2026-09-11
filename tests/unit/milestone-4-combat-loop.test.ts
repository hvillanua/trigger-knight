import { describe, expect, it } from "vitest";
import type { EnemySnapshot, GameEvent } from "../../src/domain/contracts.js";
import { combatLoopScenarios, runCombatLoop } from "../helpers/combat-loop.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

// Confirmed formulas from research/mechanics.md, enemies and scaling. The
// generation day is retained by the test only; policies never receive it.
function expectEnemy(enemy: EnemySnapshot, day: number) {
  const [
    hpBase,
    hpPerDay,
    attackBase,
    attackPerDay,
    goldBase,
    goldPerDay,
    expBase,
    expPerDay,
  ] = {
    goblin: [600, 60, 82, 40, 70, 12, 10, 3],
    golem: [860, 120, 40, 28, 78, 14, 9, 4],
    wolf: [450, 44, 94, 56, 78, 14, 8, 5],
    dragon: [2400, 300, 160, 80, 350, 60, 40, 25],
  }[enemy.id] as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  expect(enemy).toEqual({
    id: enemy.id,
    maximumHp: hpBase + hpPerDay * day,
    attack: attackBase + attackPerDay * day,
    goldReward: goldBase + goldPerDay * day,
    profileExp: expBase + expPerDay * day,
  });
}

describe("Milestone 4 complete combat loop", () => {
  it.each(combatLoopScenarios)(
    "preserves per-step invariants through $terminalReason death",
    (scenario) => {
      const { trace, result } = runCombatLoop(scenario.seed);
      const first = trace.checkpoints[0]!;
      let earned = 0;
      let spent = 0;
      let experience = 0;
      let dragons = 0;
      let battles = 0;
      let rewards = 0;
      let shopsSinceReward = 0;
      let cycles = 0;
      let fundedPurchase = false;
      const enemies = new Set<string>();
      const items = new Set<string>();
      const shops = new Set<string>();
      const weaponTiers = new Set<number>();
      const armorTiers = new Set<number>();
      const firstOutcomes = new Map<string, unknown>();
      const generationDays = first.state.encounters.upcoming.map(() => 1);
      for (const entry of first.state.encounters.upcoming) {
        if (entry.kind === "battle") expectEnemy(entry.enemy, 1);
      }

      for (let index = 1; index < trace.checkpoints.length; index++) {
        const { state, events, observation, checkpointHash } =
          trace.checkpoints[index]!;
        const previous = trace.checkpoints[index - 1]!.state;
        expect(state.player.hp.current).toBeGreaterThanOrEqual(0);
        expect(state.player.hp.current).toBeLessThanOrEqual(
          state.player.hp.maximum,
        );
        expect(Object.keys(state.player.inventory)).toEqual(["item"]);
        expect([null, "elixir", "divine-edge", "gold-voucher"]).toContain(
          state.player.inventory.item,
        );
        expect(state.encounters.upcoming).toHaveLength(3);
        expect(observation.encounters.upcoming).toEqual(
          state.encounters.upcoming.map((entry) =>
            entry.kind === "battle" ? { kind: "battle" } : entry,
          ),
        );
        if (state.battle !== null) {
          expect(state.battle.enemyHp).toBeGreaterThanOrEqual(0);
          expect(state.encounters.current?.kind).toBe("battle");
          if (state.encounters.current?.kind === "battle") {
            expect(state.battle.enemyHp).toBeLessThanOrEqual(
              state.encounters.current.enemy.maximumHp,
            );
          }
        }
        if (state.battle !== null && previous.battle !== null) {
          const used = events.find((event) => event.type === "item-used");
          expect(state.battle.hero.attackFactor).toBe(
            used?.item === "divine-edge"
              ? 100
              : previous.battle.hero.attackFactor,
          );
          expect(state.battle.enemyGoldMultiplier).toBe(
            used?.item === "gold-voucher"
              ? previous.battle.enemyGoldMultiplier * 10
              : previous.battle.enemyGoldMultiplier,
          );
        }
        for (const event of events) {
          if (
            event.type !== "step-advanced" &&
            !firstOutcomes.has(event.type)
          ) {
            firstOutcomes.set(event.type, {
              step: state.steps,
              random: state.random,
              events,
              checkpointHash,
            });
          }
          switch (event.type) {
            case "encounter-promoted": {
              const day = generationDays.shift()!;
              if (state.encounters.current?.kind === "battle") {
                expectEnemy(state.encounters.current.enemy, day);
              }
              expect(state.encounters.upcoming.slice(0, 2)).toEqual(
                previous.encounters.upcoming.slice(1),
              );
              generationDays.push(state.day);
              const generated = state.encounters.upcoming[2]!;
              if (generated.kind === "battle")
                expectEnemy(generated.enemy, state.day);
              break;
            }
            case "battle-started":
              battles++;
              if (rewards > 0 && shopsSinceReward > 0) cycles++;
              shopsSinceReward = 0;
              enemies.add(event.enemy.id);
              expect(state.battle!.hero.attackFactor).toBe(1);
              expect(state.battle!.enemyGoldMultiplier).toBe(1);
              break;
            case "item-used":
              items.add(event.item);
              expect(event.item).toBe(previous.player.inventory.item);
              expect(state.player.inventory.item).toBeNull();
              break;
            case "shop-purchased":
              shops.add(event.shop);
              shopsSinceReward++;
              spent += event.price;
              fundedPurchase ||= earned > 0 && spent > first.state.player.gold;
              if (event.shop === "bladesmith")
                weaponTiers.add(state.player.weapon.tier);
              if (event.shop === "armorsmith")
                armorTiers.add(state.player.armor.tier);
              break;
            case "battle-reward": {
              expect(previous.battle!.enemy).toMatchObject({
                phase: "dead",
                alpha: 10,
              });
              const current = previous.encounters.current;
              expect(current?.kind).toBe("battle");
              if (current?.kind !== "battle")
                throw new Error("Reward without enemy");
              const enemy = current.enemy;
              expect(event).toEqual({
                type: "battle-reward",
                enemy: enemy.id,
                gold: enemy.goldReward * previous.battle!.enemyGoldMultiplier,
                score:
                  enemy.maximumHp * 10 +
                  enemy.attack * 60 * previous.scoreMultiplier,
                profileExp: enemy.profileExp,
                dragonKilled: enemy.id === "dragon",
              });
              expect(state.score - previous.score).toBe(event.score);
              expect(state.battle).toBeNull();
              expect(state.encounters.current).toBeNull();
              expect(state.random).toEqual(previous.random);
              earned += event.gold;
              experience += event.profileExp;
              dragons += Number(event.dragonKilled);
              rewards++;
              break;
            }
          }
        }
        expect(state.player.gold).toBe(
          first.state.player.gold + earned - spent,
        );
        expect(Number.isSafeInteger(state.player.gold)).toBe(true);
        expect(state.player.gold).toBeGreaterThanOrEqual(0);
        expect(state.profileExpEarned).toBe(experience);
        expect(state.dragonKills).toBe(dragons);
        expect(
          events.filter((event) => event.type === "battle-reward").length,
        ).toBeLessThanOrEqual(1);
      }
      expect(result).toMatchObject({
        terminalReason: scenario.terminalReason,
        steps: scenario.steps,
      });
      expect(battles).toBeGreaterThan(1);
      expect(rewards).toBeGreaterThan(1);
      expect(cycles).toBeGreaterThan(1);
      expect(fundedPurchase).toBe(true);
      if (scenario.terminalReason === "combat") {
        expect([...enemies].sort()).toEqual([
          "dragon",
          "goblin",
          "golem",
          "wolf",
        ]);
        expect([...items].sort()).toEqual([
          "divine-edge",
          "elixir",
          "gold-voucher",
        ]);
        expect([...shops].sort()).toEqual([
          "armorsmith",
          "bladesmith",
          "grims-shop",
          "pharmacy",
          "soul-shrine",
          "voucher-store",
        ]);
        expect([...weaponTiers]).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect([...armorTiers]).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
      }
      const terminal = trace.checkpoints.at(-1)!.state;
      const engine = createTestGameplayEngine();
      let state = terminal;
      for (let step = 0; step < 5; step++) {
        const later = engine.step(state, [
          { type: "use-carried-item" },
          { type: "purchase-current-encounter" },
          { type: "toggle-pause" },
          { type: "dismiss-tutorial" },
        ]);
        expect({ ...later.state, steps: terminal.steps }).toEqual(terminal);
        const allowed: GameEvent["type"][] = [
          "step-advanced",
          "item-use-rejected",
          "purchase-rejected",
        ];
        expect(
          later.events.every((event) => allowed.includes(event.type)),
        ).toBe(true);
        state = later.state;
      }
      // Compact regression evidence locks RNG consumption and event order as well
      // as the complete execution. It does not claim original Flash scheduling.
      expect({
        // Keep the v2 result projection in this older snapshot while the
        // current runner's versioned metrics are asserted by M7 tests.
        result: { ...result, schemaVersion: 2, metrics: {} },
        traceHash: trace.traceHash,
        firstOutcomes: Object.fromEntries(firstOutcomes),
      }).toMatchSnapshot();
    },
    60_000,
  );
});
