import { describe, expect, it } from "vitest";

import type {
  CombatActorState,
  EnemyId,
  ProfileState,
  RunState,
} from "../../src/application/contracts.js";
import {
  ACHIEVEMENT_IDS,
  achievementIdForSlot,
  calculateProfileProgress,
  createFreshProfile,
  settleCompletedRun,
} from "../../src/domain/profile.js";
import { createRandomState } from "../../src/domain/random.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();
const purchase = Object.freeze({ type: "purchase-current-encounter" as const });

function profileWith(patch: Partial<ProfileState> = {}): ProfileState {
  return {
    ...createFreshProfile(),
    ...patch,
  };
}

function activeRun(
  initialProfile: ProfileState = createFreshProfile(),
): RunState {
  const state = engine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "profile-achievements",
    initialProfile,
  });

  return {
    ...state,
    lifecycle: {
      ...state.lifecycle,
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
  };
}

function atShop(
  state: Readonly<RunState>,
  shop: "bladesmith" | "armorsmith",
): RunState {
  return {
    ...state,
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop,
        cachedPrice: shop === "bladesmith" ? 236 : 204,
        x: 200,
        used: false,
      },
    },
  };
}

function endedRun(
  state: Readonly<RunState>,
  terminalReason: "lifespan" | "combat" = "lifespan",
): RunState {
  return {
    ...state,
    lifecycle: {
      ...state.lifecycle,
      phase: "ended",
      terminalReason,
    },
  };
}

function actor(
  x: number,
  overrides: Partial<CombatActorState> = {},
): CombatActorState {
  return {
    phase: "idle",
    x,
    attackDelay: 100,
    attackFactor: 1,
    attackCount: 0,
    alpha: 100,
    attackTicks: 0,
    knockback: 0,
    ...overrides,
  };
}

function battleState(
  id: EnemyId = "goblin",
  options: {
    readonly gold?: number;
    readonly enemyHp?: number;
    readonly weaponAttack?: number;
    readonly heroAttackFactor?: number;
    readonly initialProfile?: ProfileState;
  } = {},
): RunState {
  const initial = activeRun(options.initialProfile);
  const enemy = {
    goblin: { maximumHp: 660, attack: 122, goldReward: 82, profileExp: 13 },
    golem: { maximumHp: 980, attack: 68, goldReward: 92, profileExp: 13 },
    wolf: { maximumHp: 494, attack: 150, goldReward: 92, profileExp: 13 },
    dragon: {
      maximumHp: 2_700,
      attack: 240,
      goldReward: 410,
      profileExp: 65,
    },
  }[id];

  return {
    ...initial,
    lifecycle: {
      ...initial.lifecycle,
      phase: "battling",
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
    player: {
      ...initial.player,
      gold: options.gold ?? initial.player.gold,
      weapon: {
        ...initial.player.weapon,
        attack: options.weaponAttack ?? initial.player.weapon.attack,
      },
    },
    encounters: {
      ...initial.encounters,
      current: { kind: "battle", x: 400, enemy: { id, ...enemy } },
    },
    battle: {
      enemyHp: options.enemyHp ?? 1,
      enemyGoldMultiplier: 1,
      hero: actor(50, {
        phase: "attack",
        attackTicks: 5,
        attackFactor: options.heroAttackFactor ?? 1,
      }),
      enemy: actor(400),
    },
  };
}

function finishEnemyReward(initial: Readonly<RunState>) {
  let result = engine.step(initial, []);
  for (let index = 0; index < 10; index += 1) {
    result = engine.step(result.state, []);
  }
  return result;
}

describe("profile collections and achievements", () => {
  it("computes fresh and complete researched progress without counting slot five", () => {
    expect(ACHIEVEMENT_IDS).toHaveLength(5);
    expect(() => achievementIdForSlot(5)).toThrow("has no defined condition");
    expect(calculateProfileProgress(createFreshProfile())).toEqual({
      weaponCount: 1,
      armorCount: 1,
      collectionProgress: 7,
      achievementsUnlocked: 0,
      achievementProgress: 0,
      totalProgress: 7,
    });

    const complete = profileWith({
      weaponDiscoveries: Array(10).fill(true),
      armorDiscoveries: Array(10).fill(true),
      achievementSlots: Array(6).fill(true),
    });
    expect(calculateProfileProgress(complete)).toEqual({
      weaponCount: 10,
      armorCount: 10,
      collectionProgress: 70,
      achievementsUnlocked: 5,
      achievementProgress: 30,
      totalProgress: 100,
    });
  });

  it("records a new equipment tier once and carries it into completed profile settlement", () => {
    const initial = profileWith();
    const purchased = engine.step(atShop(activeRun(initial), "bladesmith"), [
      purchase,
    ]);

    expect(purchased.events).toEqual([
      { type: "shop-purchased", shop: "bladesmith", price: 236 },
      { type: "equipment-discovered", equipment: "weapon", tier: 2 },
      { type: "step-advanced", step: 1 },
    ]);
    expect(purchased.state.weaponDiscoveries[1]).toBe(true);

    for (const terminalReason of ["lifespan", "combat"] as const) {
      const settled = settleCompletedRun(
        initial,
        endedRun(purchased.state, terminalReason),
      );
      expect(settled.weaponDiscoveries[1]).toBe(true);
    }
  });

  it("does not emit a duplicate discovery for a tier already in the profile", () => {
    const initial = profileWith({
      weaponDiscoveries: [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
    });
    const result = engine.step(atShop(activeRun(initial), "bladesmith"), [
      purchase,
    ]);

    expect(result.events).toEqual([
      { type: "shop-purchased", shop: "bladesmith", price: 236 },
      { type: "step-advanced", step: 1 },
    ]);
  });

  it("records armor discoveries with the same once-only rule", () => {
    const result = engine.step(atShop(activeRun(), "armorsmith"), [purchase]);

    expect(result.events).toContainEqual({
      type: "equipment-discovered",
      equipment: "armor",
      tier: 2,
    });
    expect(result.state.armorDiscoveries[1]).toBe(true);
  });

  it("unlocks complete collection only when the last tier is discovered", () => {
    const initial = profileWith({
      weaponDiscoveries: [
        true,
        false,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
      ],
      armorDiscoveries: Array(10).fill(true),
    });
    const result = engine.step(atShop(activeRun(initial), "bladesmith"), [
      purchase,
    ]);

    expect(result.events).toContainEqual({
      type: "achievement-unlocked",
      achievement: "get-all-collection",
    });
    expect(result.state.achievementSlots[3]).toBe(true);
  });

  it("retains discoveries across consecutive settled runs", () => {
    const initial = profileWith({
      weaponDiscoveries: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
    });
    const firstRun = engine.step(atShop(activeRun(initial), "bladesmith"), [
      purchase,
    ]).state;
    const afterFirstRun = settleCompletedRun(initial, endedRun(firstRun));
    const secondRunStart = {
      ...activeRun(afterFirstRun),
      player: { ...activeRun(afterFirstRun).player, gold: 1_000 },
    };
    const repeatedTier = engine.step(atShop(secondRunStart, "bladesmith"), [
      purchase,
    ]).state;
    const secondRun = engine.step(atShop(repeatedTier, "bladesmith"), [
      purchase,
    ]).state;
    const afterSecondRun = settleCompletedRun(
      afterFirstRun,
      endedRun(secondRun),
    );

    expect(afterSecondRun.weaponDiscoveries.slice(0, 3)).toEqual([
      true,
      true,
      true,
    ]);
    expect(calculateProfileProgress(afterSecondRun).weaponCount).toBe(3);
  });

  it.each([
    { gold: 2_917, unlocked: false },
    { gold: 2_918, unlocked: true },
  ])("checks the post-reward gold threshold at $gold", ({ gold, unlocked }) => {
    const reward = finishEnemyReward(battleState("goblin", { gold }));

    expect(reward.state.player.gold).toBe(gold + 82);
    expect(
      reward.events.filter((event) => event.type === "achievement-unlocked"),
    ).toEqual(
      unlocked
        ? [
            {
              type: "achievement-unlocked",
              achievement: "stashed-3000-gold",
            },
          ]
        : [],
    );
  });

  it("keeps the gold achievement after a qualifying reward is spent", () => {
    const reward = finishEnemyReward(battleState("goblin", { gold: 2_918 }));
    const spent = engine.step(atShop(reward.state, "bladesmith"), [purchase]);

    expect(spent.state.player.gold).toBeLessThan(3_000);
    expect(spent.state.achievementSlots[1]).toBe(true);
    expect(
      spent.events.filter((event) => event.type === "achievement-unlocked"),
    ).toEqual([]);
  });

  it("unlocks the Dragon achievement at the lethal hit and only once", () => {
    const first = engine.step(battleState("dragon"), []);
    expect(first.events).toContainEqual({
      type: "achievement-unlocked",
      achievement: "slay-a-dragon",
    });
    expect(first.state.achievementSlots[0]).toBe(true);

    const repeated = engine.step(
      battleState("dragon", {
        initialProfile: profileWith({
          achievementSlots: [true, false, false, false, false, false],
        }),
      }),
      [],
    );
    expect(
      repeated.events.filter((event) => event.type === "achievement-unlocked"),
    ).toEqual([]);
  });

  it.each([
    { distance: 62_984, unlocks: false },
    { distance: 62_985, unlocks: true },
  ])(
    "checks the day achievement at distance $distance",
    ({ distance, unlocks }) => {
      const initial = {
        ...activeRun(),
        movementSpeed: 15,
        distance,
        day: 9,
        encounters: {
          ...activeRun().encounters,
          current: null,
          distanceUntilNext: 100_000,
        },
      };
      const result = engine.step(initial, []);

      expect(result.state.day).toBe(unlocks ? 10 : 9);
      expect(
        result.events.filter((event) => event.type === "achievement-unlocked"),
      ).toEqual(
        unlocks
          ? [
              {
                type: "achievement-unlocked",
                achievement: "reach-day-10",
              },
            ]
          : [],
      );
    },
  );

  it("unlocks computed-hit damage from raw overkill damage", () => {
    const result = engine.step(
      battleState("goblin", {
        enemyHp: 1,
        weaponAttack: 999,
        heroAttackFactor: 100,
      }),
      [],
    );
    const hit = result.events.find((event) => event.type === "combat-hit");

    if (hit?.type !== "combat-hit") {
      throw new Error("Expected a combat-hit event");
    }
    expect(hit.damage).toBeGreaterThanOrEqual(70_000);
    expect(hit.remainingHp).toBe(0);
    expect(result.events).toContainEqual({
      type: "achievement-unlocked",
      achievement: "perform-70000-damage",
    });
    expect(result.state.achievementSlots[4]).toBe(true);
  });

  it.each([
    { weaponAttack: 699, unlocks: false },
    { weaponAttack: 700, unlocks: true },
  ])(
    "checks computed damage at the 70000 boundary for $weaponAttack attack",
    ({ weaponAttack, unlocks }) => {
      const result = engine.step(
        {
          ...battleState("goblin", {
            enemyHp: 100_000,
            weaponAttack,
            heroAttackFactor: 100,
          }),
          random: createRandomState("4"),
        },
        [],
      );
      const hit = result.events.find((event) => event.type === "combat-hit");

      expect(hit).toMatchObject({
        type: "combat-hit",
        damage: weaponAttack * 100,
        remainingHp: 100_000 - weaponAttack * 100,
      });
      expect(
        result.events.filter((event) => event.type === "achievement-unlocked"),
      ).toEqual(
        unlocks
          ? [
              {
                type: "achievement-unlocked",
                achievement: "perform-70000-damage",
              },
            ]
          : [],
      );
    },
  );

  it("does not emit an achievement for a qualifying action already unlocked", () => {
    const result = engine.step(
      battleState("goblin", {
        enemyHp: 1,
        weaponAttack: 999,
        heroAttackFactor: 100,
        initialProfile: profileWith({
          achievementSlots: [false, false, false, false, true, false],
        }),
      }),
      [],
    );

    expect(
      result.events.filter((event) => event.type === "achievement-unlocked"),
    ).toEqual([]);
  });
});
