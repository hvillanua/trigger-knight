import { describe, expect, it } from "vitest";

import { normalizeSimulationManifest } from "../../src/simulation/simulation-experiment.js";
import {
  createSimulationBenchmarkHeapTracker,
  createBatchSizedRunner,
  measureSimulationBenchmarkExecution,
} from "../../src/simulation/simulation-benchmark-measurement.js";
import { simulationPolicyRegistry } from "../../src/simulation/policy-registry.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

describe("simulation benchmark measurement", () => {
  it("rejects a non-positive batch size before iterating requests", async () => {
    const runner = createSimulationRunner(createTestGameplayEngine());

    expect(() => createBatchSizedRunner(runner, 0)).toThrowError(
      "Benchmark batch size must be a positive safe integer",
    );

    let now = 0;
    await expect(
      measureSimulationBenchmarkExecution({
        runner,
        policies: simulationPolicyRegistry,
        manifest: normalizeSimulationManifest({
          schemaVersion: 1,
          requests: [],
        }),
        batchSize: 0,
        environment: {
          host: {
            nodeVersion: "test",
            platform: "test",
            architecture: "test",
            cpuCount: 1,
          },
          now: () => {
            now += 10;
            return now;
          },
          readHeapUsedBytes: () => 1_000,
        },
        heapTracker: createSimulationBenchmarkHeapTracker(() => 1_000),
      }),
    ).rejects.toThrowError(
      "Benchmark batch size must be a positive safe integer",
    );
  });

  it("measures one sequential execution without building a benchmark report", async () => {
    let now = 0;
    const execution = await measureSimulationBenchmarkExecution({
      runner: createSimulationRunner(createTestGameplayEngine()),
      policies: simulationPolicyRegistry,
      manifest: normalizeSimulationManifest({
        schemaVersion: 1,
        requests: [
          {
            config: {
              ruleset: "original-v1.3",
              seed: "measurement",
              initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
            },
            policy: { id: "non-progressing", version: "1", config: {} },
            maxSteps: 3,
          },
        ],
      }),
      batchSize: 1,
      environment: {
        host: {
          nodeVersion: "test",
          platform: "test",
          architecture: "test",
          cpuCount: 1,
        },
        now: () => {
          now += 10;
          return now;
        },
        readHeapUsedBytes: () => 1_000,
      },
      heapTracker: createSimulationBenchmarkHeapTracker(() => 1_000),
    });

    expect(execution.batchExport.results).toHaveLength(1);
    expect(execution.elapsedMilliseconds).toBe(10);
    expect(execution.runsPerSecond).toBe(100);
    expect(execution.heapDeltaBytes).toBe(0);
  });
});
