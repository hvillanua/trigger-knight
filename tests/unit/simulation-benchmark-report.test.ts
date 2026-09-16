import { describe, expect, it } from "vitest";

import { createSimulationBenchmarkReport } from "../../src/simulation/simulation-benchmark-report.js";
import type { SimulationBenchmarkReportInput } from "../../src/simulation/simulation-benchmark-types.js";

const policy = { id: "non-progressing", version: "1", config: {} } as const;

function input(
  host: SimulationBenchmarkReportInput["host"],
): SimulationBenchmarkReportInput {
  return {
    config: {
      schemaVersion: 1,
      strategies: ["sequential"],
      warmupRepetitions: 0,
      repetitions: 1,
      targets: {
        minimumRunsPerSecond: 1,
        maximumHeapDeltaBytes: 100,
        basis: "test",
      },
      scenarios: [],
    },
    inputFingerprint: "sha256-v1:input",
    measurements: [
      {
        caseId: "case",
        scenarioId: "scenario",
        profileId: "profile",
        policy,
        maxSteps: 1,
        strategy: "sequential",
        batchSize: 1,
        repetition: 0,
        runCount: 1,
        elapsedMilliseconds: 10,
        runsPerSecond: 100,
        heapUsedBeforeBytes: 1_000,
        peakHeapUsedBytes: 1_010,
        heapDeltaBytes: 10,
      },
    ],
    resultCases: [],
    comparisons: [],
    stable: true,
    maximumMeasuredHeapDeltaBytes: 10,
    host,
  };
}

describe("simulation benchmark report construction", () => {
  it("keeps host metadata out of deterministic identities", () => {
    const first = createSimulationBenchmarkReport(
      input({
        nodeVersion: "test-1",
        platform: "test",
        architecture: "test",
        cpuCount: 1,
      }),
    );
    const second = createSimulationBenchmarkReport(
      input({
        nodeVersion: "test-2",
        platform: "other",
        architecture: "other",
        cpuCount: 2,
      }),
    );

    expect(second.deterministic).toEqual(first.deterministic);
    expect(second.host).not.toEqual(first.host);
    expect(second.targets.met).toBe(true);
  });
});
