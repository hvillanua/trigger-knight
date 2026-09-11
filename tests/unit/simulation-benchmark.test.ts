import { describe, expect, it, vi } from "vitest";

import type {
  PlayerPolicy,
  SimulationRunner,
  SimulationPolicyRegistry,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import {
  createSimulationBenchmark,
  normalizeSimulationBenchmark,
  type SimulationBenchmarkEnvironment,
} from "../../src/simulation/simulation-benchmark.js";
import { simulationPolicyRegistry } from "../../src/simulation/policy-registry.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();

const baseConfig = {
  schemaVersion: 1,
  strategies: ["sequential"],
  warmupRepetitions: 1,
  repetitions: 2,
  targets: {
    minimumRunsPerSecond: 100,
    maximumHeapDeltaBytes: 10_000,
    basis:
      "The focused fake clock and heap readings exercise target evaluation.",
  },
  scenarios: [
    {
      id: "finite-control",
      ruleset: ORIGINAL_V13_RULESET_ID,
      seeds: ["benchmark-a", "benchmark-b"],
      profiles: [
        {
          id: "minimal",
          initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
        },
      ],
      policies: [{ id: "non-progressing", version: "1", config: {} }],
      batchSizes: [1, 2],
      stepLimits: [3],
    },
  ],
} as const;

function environment(
  host: SimulationBenchmarkEnvironment["host"] = {
    nodeVersion: "v24.19.0",
    platform: "test",
    architecture: "test",
    cpuCount: 1,
  },
): SimulationBenchmarkEnvironment {
  let now = 0;
  let heap = 1_000;

  return {
    host,
    now: () => {
      now += 10;
      return now;
    },
    readHeapUsedBytes: () => {
      heap += 100;
      return heap;
    },
  };
}

describe("simulation benchmark", () => {
  it("normalizes explicit scenarios, profiles, policies, and targets", () => {
    const normalized = normalizeSimulationBenchmark(baseConfig);

    expect(normalized).toMatchObject({
      schemaVersion: 1,
      strategies: ["sequential"],
      warmupRepetitions: 1,
      repetitions: 2,
      targets: baseConfig.targets,
    });
    expect(normalized.scenarios[0]?.profiles[0]?.initialProfile).toEqual(
      baseConfig.scenarios[0].profiles[0].initialProfile,
    );
  });

  it("keeps normalized results and comparisons stable across batch sizes and repetitions", async () => {
    const report = await createSimulationBenchmark(
      createSimulationRunner(engine),
      simulationPolicyRegistry,
      environment(),
    ).run(baseConfig);

    expect(report.deterministic.stable).toBe(true);
    expect(report.deterministic.resultCases).toHaveLength(2);
    expect(
      new Set(
        report.deterministic.resultCases.map(
          ({ resultFingerprint }) => resultFingerprint,
        ),
      ).size,
    ).toBe(1);
    expect(report.deterministic.comparisons).toHaveLength(2);
    expect(
      new Set(
        report.deterministic.comparisons.map(
          ({ comparisonFingerprint }) => comparisonFingerprint,
        ),
      ).size,
    ).toBe(1);
    expect(report.deterministic.comparisons.every(({ stable }) => stable)).toBe(
      true,
    );
    expect(report.measurements).toHaveLength(4);
    expect(report.targets.met).toBe(true);
    expect(report.host.platform).toBe("test");
  });

  it("keeps host and measurement metadata outside deterministic identities", async () => {
    const runner = createSimulationRunner(engine);
    const first = await createSimulationBenchmark(
      runner,
      simulationPolicyRegistry,
      environment(),
    ).run(baseConfig);
    const second = await createSimulationBenchmark(
      runner,
      simulationPolicyRegistry,
      environment({
        nodeVersion: "v99.0.0",
        platform: "other",
        architecture: "other",
        cpuCount: 99,
      }),
    ).run(baseConfig);

    expect(second.deterministic).toEqual(first.deterministic);
    expect(second.host).not.toEqual(first.host);
    expect(second.measurements).toEqual(first.measurements);
  });

  it("isolates stateful agents while exercising a benchmark batch", async () => {
    let createdAgents = 0;
    const statefulPolicy: PlayerPolicy = {
      descriptor: {
        id: "stateful-benchmark",
        version: "1",
        config: {},
      },
      createAgent: () => {
        createdAgents += 1;
        let decisions = 0;
        return {
          decide: () => {
            decisions += 1;
            return decisions === 1 ? [{ type: "dismiss-tutorial" }] : [];
          },
        };
      },
    };
    const policies: SimulationPolicyRegistry = {
      supported: [statefulPolicy.descriptor],
      resolve: () => statefulPolicy,
    };
    const report = await createSimulationBenchmark(
      createSimulationRunner(engine),
      policies,
      environment(),
    ).run({
      ...baseConfig,
      repetitions: 1,
      warmupRepetitions: 0,
      scenarios: [
        {
          ...baseConfig.scenarios[0],
          policies: [statefulPolicy.descriptor],
        },
      ],
    });

    expect(createdAgents).toBeGreaterThan(2);
    expect(report.deterministic.stable).toBe(true);
  });

  it("fails the benchmark when its identical-input comparison diverges", async () => {
    const actualRunner = createSimulationRunner(engine);
    let batchCalls = 0;
    const divergentRunner: SimulationRunner = {
      run: (request) => actualRunner.run(request),
      async runBatch(requests) {
        const results = await actualRunner.runBatch(requests);
        batchCalls += 1;
        if (batchCalls !== 2) return results;
        return Object.freeze(
          results.map((result) =>
            Object.freeze({ ...result, score: result.score + 1 }),
          ),
        );
      },
    };
    const report = await createSimulationBenchmark(
      divergentRunner,
      simulationPolicyRegistry,
      environment(),
    ).run({
      ...baseConfig,
      repetitions: 1,
      warmupRepetitions: 0,
      scenarios: [
        {
          ...baseConfig.scenarios[0],
          batchSizes: [2],
        },
      ],
    });

    expect(report.deterministic.comparisons[0]?.behavioralDifferenceCount).toBe(
      2,
    );
    expect(report.deterministic.stable).toBe(false);
    expect(report.targets.met).toBe(false);
  });

  it("rejects unsupported strategies and invalid targets", () => {
    expect(() =>
      normalizeSimulationBenchmark({
        ...baseConfig,
        strategies: ["parallel"],
      }),
    ).toThrowError(/Unsupported simulation benchmark strategy/);
    expect(() =>
      normalizeSimulationBenchmark({
        ...baseConfig,
        targets: { ...baseConfig.targets, minimumRunsPerSecond: 0 },
      }),
    ).toThrowError(/minimumRunsPerSecond/);
  });

  it("reports a target miss without changing the deterministic result", async () => {
    let now = 0;
    const report = await createSimulationBenchmark(
      createSimulationRunner(engine),
      simulationPolicyRegistry,
      {
        ...environment(),
        now: vi.fn<SimulationBenchmarkEnvironment["now"]>(() => {
          now += 10_000;
          return now;
        }),
      },
    ).run({
      ...baseConfig,
      repetitions: 1,
      warmupRepetitions: 0,
      targets: {
        ...baseConfig.targets,
        minimumRunsPerSecond: 1,
      },
    });

    expect(report.targets.met).toBe(false);
    expect(report.deterministic.inputFingerprint).toMatch(/^sha256-v1:/);
  });

  it("fails the memory target for a retained-trace control", async () => {
    const retainedTraces: unknown[] = [];
    const runner = createSimulationRunner(engine, {
      onTrace: (trace) => retainedTraces.push(trace),
    });
    let now = 0;
    const report = await createSimulationBenchmark(
      runner,
      simulationPolicyRegistry,
      {
        host: {
          nodeVersion: "v24.19.0",
          platform: "test",
          architecture: "test",
          cpuCount: 1,
        },
        now: () => {
          now += 10;
          return now;
        },
        readHeapUsedBytes: () => 1_000 + retainedTraces.length * 1_000,
      },
    ).run({
      ...baseConfig,
      repetitions: 1,
      warmupRepetitions: 0,
      targets: {
        ...baseConfig.targets,
        minimumRunsPerSecond: 1,
        maximumHeapDeltaBytes: 1_000,
      },
      scenarios: [
        {
          ...baseConfig.scenarios[0],
          batchSizes: [2],
        },
      ],
    });

    expect(retainedTraces.length).toBeGreaterThan(0);
    expect(report.targets.maximumMeasuredHeapDeltaBytes).toBeGreaterThan(1_000);
    expect(report.targets.met).toBe(false);
  });
});
