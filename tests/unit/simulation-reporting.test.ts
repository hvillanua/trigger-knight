import { describe, expect, it } from "vitest";

import type {
  GameEvent,
  GameplayEngine,
  SimulationBatchExport,
} from "../../src/application/contracts.js";
import { createSimulationExperiment } from "../../src/simulation/simulation-experiment.js";
import {
  createSimulationReport,
  RUN_METRIC_KEYS,
} from "../../src/simulation/simulation-report.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();

function request(seed: string, maxSteps = 3) {
  return {
    config: {
      ruleset: "original-v1.3",
      seed,
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    },
    policy: { id: "non-progressing", version: "1", config: {} },
    maxSteps,
  } as const;
}

function batch(
  requests: readonly ReturnType<typeof request>[],
): SimulationBatchExport {
  return {
    schemaVersion: 1,
    manifest: { schemaVersion: 1, requests },
    results: [],
  };
}

describe("simulation reports", () => {
  it("returns a versioned empty report with normalized empty statistics", () => {
    const report = createSimulationReport(batch([]));

    expect(report).toMatchObject({
      schemaVersion: 1,
      runCount: 0,
      completedRunCount: 0,
      truncatedRunCount: 0,
      terminalReasons: { lifespan: 0, combat: 0, "step-limit": 0 },
      groups: [],
    });
    expect(report.inputFingerprint).toMatch(/^sha256-v1:[0-9a-f]{64}$/);
    expect(report.overall.steps).toEqual({
      count: 0,
      sum: 0,
      mean: 0,
      minimum: null,
      maximum: null,
    });
    expect(Object.keys(report.overall.metrics)).toEqual([...RUN_METRIC_KEYS]);
  });

  it("derives compact metrics from authoritative events and terminal state", () => {
    let stepCount = 0;
    const metricEvents: readonly GameEvent[] = [
      {
        type: "encounter-promoted",
        encounter: {
          kind: "shop",
          shop: "pharmacy",
          cachedPrice: 150,
          x: 100,
          used: false,
        },
      },
      {
        type: "encounter-promoted",
        encounter: {
          kind: "battle",
          enemy: { id: "goblin", maximumHp: 600 },
          x: 100,
        },
      },
      { type: "shop-departed", shop: "pharmacy" },
      { type: "shop-purchased", shop: "pharmacy", price: 150 },
      {
        type: "battle-started",
        enemy: { id: "goblin", maximumHp: 600, currentHp: 600 },
      },
      {
        type: "combat-hit",
        attacker: "hero",
        target: "enemy",
        damage: 37,
        critical: true,
        remainingHp: 563,
      },
      {
        type: "combat-hit",
        attacker: "enemy",
        target: "hero",
        damage: 11,
        critical: false,
        remainingHp: 1_897,
      },
      { type: "combat-lethal-hit", attacker: "hero", target: "enemy" },
      {
        type: "battle-reward",
        enemy: "goblin",
        gold: 23,
        score: 7,
        profileExp: 11,
        dragonKilled: true,
      },
      { type: "equipment-discovered", equipment: "weapon", tier: 2 },
      { type: "achievement-unlocked", achievement: "reach-day-10" },
    ];
    const metricEngine: GameplayEngine = {
      ...engine,
      step(state, commands) {
        const result = engine.step(state, commands);
        stepCount += 1;
        if (stepCount !== 1) return result;

        return {
          state: {
            ...result.state,
            score: 17,
            profileExpEarned: 11,
            dragonKills: 1,
            player: { ...result.state.player, gold: 123 },
          },
          events: [...result.events, ...metricEvents],
        };
      },
    };
    const runner = createSimulationRunner(metricEngine);
    const result = runner.run({
      config: request("metrics").config,
      policy: {
        descriptor: request("metrics").policy,
        createAgent: () => ({ decide: () => [] }),
      },
      maxSteps: 1,
    });

    expect(result.metrics).toEqual({
      "combat.battles-started": 1,
      "combat.critical-hits": 1,
      "combat.hits": 2,
      "combat.lethal-hits": 1,
      "combat.reward-gold": 23,
      "combat.reward-profile-exp": 11,
      "combat.reward-score": 7,
      "combat.rewards": 1,
      "combat.damage": 48,
      "encounters.battles": 1,
      "encounters.promoted": 2,
      "encounters.shop-departures": 1,
      "encounters.shops": 1,
      "progression.achievements-unlocked": 1,
      "progression.dragon-kills": 1,
      "progression.equipment-discoveries": 1,
      "progression.profile-exp-earned": 11,
      "purchases.completed": 1,
      "purchases.gold-spent": 150,
    });
  });

  it("groups by every reproducibility input except the varying seed", async () => {
    const report = createSimulationReport(
      await createSimulationExperiment(createSimulationRunner(engine)).run({
        schemaVersion: 1,
        requests: [
          request("a", 3),
          request("b", 3),
          request("different-limit", 4),
        ],
      }),
    );

    expect(report.runCount).toBe(3);
    expect(report.truncatedRunCount).toBe(3);
    expect(report.completedRunCount).toBe(0);
    expect(report.groups).toHaveLength(2);
    expect(report.groups.map((group) => group.runCount).sort()).toEqual([1, 2]);
    expect(report.overall.steps).toEqual({
      count: 3,
      sum: 10,
      mean: 3.333333,
      minimum: 3,
      maximum: 4,
    });
    expect(report.overall.progression.profileExpEarned.count).toBe(0);
    expect(report.truncation).toEqual({
      count: 3,
      frequency: 1,
      excludedProgressionRunCount: 3,
      progressionStatistics: "completed-runs-only",
    });
  });

  it("counts gameplay deaths as settled runs and excludes only step limits from progression summaries", async () => {
    const completingEngine: GameplayEngine = {
      ...engine,
      step(state, commands) {
        const result = engine.step(state, commands);
        return {
          state: {
            ...result.state,
            profileExpEarned: 19,
            lifecycle: {
              ...result.state.lifecycle,
              phase: "ended",
              terminalReason: "lifespan",
            },
          },
          events: result.events,
        };
      },
    };
    const runner = createSimulationRunner(completingEngine);
    const completed = await createSimulationExperiment(runner).run({
      schemaVersion: 1,
      requests: [request("complete", 3)],
    });
    const truncated = await createSimulationExperiment(
      createSimulationRunner(engine),
    ).run({
      schemaVersion: 1,
      requests: [request("truncated", 3)],
    });

    const report = createSimulationReport({
      schemaVersion: 1,
      manifest: {
        schemaVersion: 1,
        requests: [request("complete", 3), request("truncated", 3)],
      },
      results: [
        completed.results[0]!,
        { ...truncated.results[0]!, requestIndex: 1 },
      ],
    });

    expect(report.completedRunCount).toBe(1);
    expect(report.truncatedRunCount).toBe(1);
    expect(report.terminalReasons).toEqual({
      lifespan: 1,
      combat: 0,
      "step-limit": 1,
    });
    expect(report.overall.progression.profileExpEarned).toEqual({
      count: 1,
      sum: 19,
      mean: 19,
      minimum: 19,
      maximum: 19,
    });
  });
});
