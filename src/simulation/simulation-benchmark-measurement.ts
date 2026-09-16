import type {
  RunResult,
  SimulationBatchExport,
  SimulationManifest,
  SimulationPolicyRegistry,
  SimulationRequest,
  SimulationRunner,
} from "../application/contracts.js";
import { SIMULATION_BATCH_EXPORT_SCHEMA_VERSION } from "../application/contracts.js";
import { fingerprintCanonicalJson } from "./canonical-json.js";
import {
  normalizeSimulationBatchExport,
  resolveSimulationRequest,
  simulationRequestFingerprint,
  stringifySimulationBatchExport,
} from "./simulation-experiment.js";
import type {
  SimulationBenchmarkExecution,
  SimulationBenchmarkHeapTracker,
  SimulationBenchmarkMeasuredExecution,
  SimulationBenchmarkMeasurementInput,
} from "./simulation-benchmark-types.js";

function checkHeapValue(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function checkClockValue(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
  return value;
}

/** Tracks the peak heap reading for one complete benchmark process. */
export function createSimulationBenchmarkHeapTracker(
  readHeapUsedBytes: () => number,
  collectGarbage: () => void = () => {},
): SimulationBenchmarkHeapTracker {
  collectGarbage();
  const baselineHeapUsedBytes = checkHeapValue(
    readHeapUsedBytes(),
    "Heap usage",
  );
  let peakHeapUsedBytes = baselineHeapUsedBytes;

  return {
    sample(): number {
      const heapUsedBytes = checkHeapValue(readHeapUsedBytes(), "Heap usage");
      peakHeapUsedBytes = Math.max(peakHeapUsedBytes, heapUsedBytes);
      return heapUsedBytes;
    },
    collectAndSample(): number {
      collectGarbage();
      return this.sample();
    },
    delta(): number {
      return peakHeapUsedBytes - baselineHeapUsedBytes;
    },
  };
}

function normalizedBatchExport(
  manifest: SimulationManifest,
  results: readonly RunResult[],
): SimulationBatchExport {
  if (results.length !== manifest.requests.length) {
    throw new Error(
      `Simulation benchmark runner returned ${results.length} results for ${manifest.requests.length} requests`,
    );
  }

  const records = results.map((result, requestIndex) => ({
    requestIndex,
    requestFingerprint: simulationRequestFingerprint(
      manifest.requests[requestIndex]!,
    ),
    result,
  }));
  records.sort((left, right) =>
    left.requestFingerprint < right.requestFingerprint
      ? -1
      : left.requestFingerprint > right.requestFingerprint
        ? 1
        : left.requestIndex - right.requestIndex,
  );
  return normalizeSimulationBatchExport({
    schemaVersion: SIMULATION_BATCH_EXPORT_SCHEMA_VERSION,
    manifest,
    results: records,
  });
}

async function runSequential(
  runner: SimulationRunner,
  policies: SimulationPolicyRegistry,
  manifest: SimulationManifest,
  batchSize: number,
  readHeapUsedBytes: () => number,
): Promise<SimulationBenchmarkExecution> {
  const requests = manifest.requests.map((request) =>
    resolveSimulationRequest(request, policies),
  );
  const results: Array<RunResult | undefined> = Array<RunResult | undefined>(
    requests.length,
  ).fill(undefined);
  let peakHeapUsedBytes = 0;

  for (let start = 0; start < requests.length; start += batchSize) {
    const end = Math.min(start + batchSize, requests.length);
    const batchResults = await runner.runBatch(requests.slice(start, end));
    if (batchResults.length !== end - start) {
      throw new Error(
        `Simulation benchmark runner returned ${batchResults.length} results for batch size ${end - start}`,
      );
    }
    for (let index = 0; index < batchResults.length; index += 1) {
      results[start + index] = batchResults[index];
    }
    peakHeapUsedBytes = Math.max(
      peakHeapUsedBytes,
      checkHeapValue(readHeapUsedBytes(), "Heap usage"),
    );
  }

  const completeResults = results.map((result, index) => {
    if (result === undefined) {
      throw new Error(`Simulation benchmark missing result ${index}`);
    }
    return result;
  });
  const batchExport = normalizedBatchExport(manifest, completeResults);
  const canonicalResult = stringifySimulationBatchExport(batchExport);

  return Object.freeze({
    batchExport,
    canonicalResult,
    resultFingerprint: fingerprintCanonicalJson(batchExport),
    peakHeapUsedBytes,
  });
}

/** Applies a benchmark batch size to comparison runs without changing the runner. */
export function createBatchSizedRunner(
  runner: SimulationRunner,
  batchSize: number,
  afterBatch?: () => void,
): SimulationRunner {
  return Object.freeze({
    run: (request: SimulationRequest) => runner.run(request),
    async runBatch(
      requests: readonly SimulationRequest[],
    ): Promise<readonly RunResult[]> {
      const results: RunResult[] = [];
      for (let start = 0; start < requests.length; start += batchSize) {
        const end = Math.min(start + batchSize, requests.length);
        const batchResults = await runner.runBatch(requests.slice(start, end));
        if (batchResults.length !== end - start) {
          throw new Error(
            `Simulation benchmark comparison runner returned ${batchResults.length} results for batch size ${end - start}`,
          );
        }
        afterBatch?.();
        results.push(...batchResults);
      }
      return Object.freeze(results);
    },
  });
}

/** Measures one fixed sequential execution, keeping timing separate from reporting. */
export async function measureSimulationBenchmarkExecution(
  input: SimulationBenchmarkMeasurementInput,
): Promise<SimulationBenchmarkMeasuredExecution> {
  const heapUsedBeforeBytes = input.heapTracker.sample();
  const start = checkClockValue(input.environment.now(), "Benchmark clock");
  const result = await runSequential(
    input.runner,
    input.policies,
    input.manifest,
    input.batchSize,
    () => input.heapTracker.sample(),
  );
  const end = checkClockValue(input.environment.now(), "Benchmark clock");
  const elapsedMilliseconds = end - start;
  if (elapsedMilliseconds <= 0) {
    throw new RangeError("Benchmark clock must advance during an execution");
  }
  const peakHeapUsedBytes = Math.max(
    result.peakHeapUsedBytes,
    input.heapTracker.collectAndSample(),
    heapUsedBeforeBytes,
  );
  const heapDeltaBytes = peakHeapUsedBytes - heapUsedBeforeBytes;
  const runsPerSecond =
    (input.manifest.requests.length * 1_000) / elapsedMilliseconds;

  return Object.freeze({
    ...result,
    elapsedMilliseconds: roundMeasurement(elapsedMilliseconds),
    heapUsedBeforeBytes,
    heapDeltaBytes,
    runsPerSecond: roundMeasurement(runsPerSecond),
    peakHeapUsedBytes,
  });
}

function roundMeasurement(value: number): number {
  const rounded = Math.round(value * 1_000) / 1_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
