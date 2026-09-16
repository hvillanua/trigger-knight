import type {
  GameplayEngine,
  GameplayTrace,
} from "../application/contracts.js";
import type {
  SimulationBatchExport,
  SimulationPolicyComparison,
  SimulationPolicyRegistry,
  SimulationReplay,
  SimulationReplayCaseReport,
  SimulationReplayInput,
  SimulationReplayPairReport,
  SimulationReplayReport,
  SimulationReplayRunReport,
  SimulationRequestInput,
} from "../application/contracts.js";
import { SIMULATION_REPLAY_SCHEMA_VERSION } from "../application/contracts.js";
import {
  compareGameplayTracesForDivergence,
  type GameplayTraceDivergenceComparison,
} from "../application/gameplay-execution.js";
import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
} from "./canonical-json.js";
import {
  normalizeSimulationBatchExport,
  resolveSimulationRequest,
  stringifySimulationPolicy,
} from "./simulation-experiment.js";
import { simulationPolicyRegistry } from "./policy-registry.js";
import { createSimulationRunner } from "./simulation-runner.js";
import { assertKeys, record } from "./simulation-validation.js";

function replayRequestIndex(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }

  return input;
}

function policyComparison(input: unknown): SimulationPolicyComparison {
  if (input !== "same-policy" && input !== "allow-different") {
    throw new TypeError(
      "Simulation replay policyComparison must be same-policy or allow-different",
    );
  }

  return input;
}

/** Normalizes a retained case or pair selection without creating live agents. */
export function normalizeSimulationReplayInput(
  input: unknown,
): SimulationReplayInput {
  const normalized = record(normalizeCanonicalJson(input), "Simulation replay");

  if (normalized.schemaVersion !== SIMULATION_REPLAY_SCHEMA_VERSION) {
    throw new RangeError(
      `Unsupported simulation replay schemaVersion ${String(normalized.schemaVersion)}`,
    );
  }

  if (normalized.mode === "case") {
    assertKeys(
      normalized,
      ["experiment", "mode", "requestIndex", "schemaVersion"],
      "Simulation replay case",
    );
    return Object.freeze({
      schemaVersion: SIMULATION_REPLAY_SCHEMA_VERSION,
      mode: "case",
      experiment: normalizeSimulationBatchExport(normalized.experiment),
      requestIndex: replayRequestIndex(
        normalized.requestIndex,
        "Simulation replay requestIndex",
      ),
    });
  }

  if (normalized.mode === "pair") {
    assertKeys(
      normalized,
      [
        "baseline",
        "baselineRequestIndex",
        "candidate",
        "candidateRequestIndex",
        "mode",
        "policyComparison",
        "schemaVersion",
      ],
      "Simulation replay pair",
    );
    return Object.freeze({
      schemaVersion: SIMULATION_REPLAY_SCHEMA_VERSION,
      mode: "pair",
      policyComparison: policyComparison(normalized.policyComparison),
      baseline: normalizeSimulationBatchExport(normalized.baseline),
      candidate: normalizeSimulationBatchExport(normalized.candidate),
      baselineRequestIndex: replayRequestIndex(
        normalized.baselineRequestIndex,
        "Simulation replay baselineRequestIndex",
      ),
      candidateRequestIndex: replayRequestIndex(
        normalized.candidateRequestIndex,
        "Simulation replay candidateRequestIndex",
      ),
    });
  }

  throw new TypeError('Simulation replay mode must be "case" or "pair"');
}

interface SelectedRequest {
  readonly request: SimulationRequestInput;
  readonly recordedResult: SimulationBatchExport["results"][number];
}

function selectRequest(
  experiment: SimulationBatchExport,
  requestIndex: number,
  label: string,
): SelectedRequest {
  const request = experiment.manifest.requests[requestIndex];
  if (request === undefined) {
    throw new RangeError(
      `Missing ${label} request at index ${requestIndex} in retained experiment`,
    );
  }

  const recordedResult = experiment.results.find(
    (result) => result.requestIndex === requestIndex,
  );
  if (recordedResult === undefined) {
    throw new Error(
      `Missing retained result for ${label} request at index ${requestIndex}`,
    );
  }

  return Object.freeze({ request, recordedResult });
}

function requestProfileFingerprint(request: SimulationRequestInput): string {
  return fingerprintCanonicalJson(request.config.initialProfile);
}

function assertPairCompatibility(
  baseline: SimulationRequestInput,
  candidate: SimulationRequestInput,
  comparison: SimulationPolicyComparison,
): void {
  if (baseline.config.seed !== candidate.config.seed) {
    throw new Error(
      "Incompatible replay pair: seed must match for chronological replay",
    );
  }
  if (
    requestProfileFingerprint(baseline) !== requestProfileFingerprint(candidate)
  ) {
    throw new Error(
      "Incompatible replay pair: exact initial profile input must match",
    );
  }
  if (baseline.maxSteps !== candidate.maxSteps) {
    throw new Error(
      "Incompatible replay pair: maxSteps must match for chronological replay",
    );
  }
  if (
    comparison === "same-policy" &&
    stringifySimulationPolicy(baseline.policy) !==
      stringifySimulationPolicy(candidate.policy)
  ) {
    throw new Error(
      "Incompatible replay pair: policy descriptors differ; use allow-different explicitly",
    );
  }
}

interface ReplayedRun {
  readonly report: SimulationReplayRunReport;
  readonly trace: GameplayTrace;
}

function replayRequest(
  engine: GameplayEngine,
  selected: SelectedRequest,
  policies: SimulationPolicyRegistry,
): ReplayedRun {
  let trace: GameplayTrace | undefined;
  const runner = createSimulationRunner(engine, {
    onTrace: (replayedTrace) => {
      trace = replayedTrace;
    },
  });
  const replayedResult = runner.run(
    resolveSimulationRequest(selected.request, policies),
  );
  if (trace === undefined) {
    throw new Error("Simulation replay did not retain a diagnostic trace");
  }

  const recordedResult = selected.recordedResult.result;
  return Object.freeze({
    report: Object.freeze({
      requestIndex: selected.recordedResult.requestIndex,
      requestFingerprint: selected.recordedResult.requestFingerprint,
      recordedResult,
      replayedResult,
      resultMatches:
        fingerprintCanonicalJson(recordedResult) ===
        fingerprintCanonicalJson(replayedResult),
      traceIdentityMatches:
        recordedResult.traceHash === replayedResult.traceHash,
      replayedTraceHash: trace.traceHash,
    }),
    trace,
  });
}

function caseReport(
  engine: GameplayEngine,
  experiment: SimulationBatchExport,
  requestIndex: number,
  policies: SimulationPolicyRegistry,
): SimulationReplayCaseReport {
  const selected = selectRequest(experiment, requestIndex, "case");
  const replayed = replayRequest(engine, selected, policies);
  return Object.freeze({
    schemaVersion: SIMULATION_REPLAY_SCHEMA_VERSION,
    mode: "case",
    run: replayed.report,
  });
}

function pairReport(
  engine: GameplayEngine,
  input: Extract<SimulationReplayInput, { readonly mode: "pair" }>,
  policies: SimulationPolicyRegistry,
): SimulationReplayPairReport {
  const baseline = selectRequest(
    input.baseline,
    input.baselineRequestIndex,
    "baseline",
  );
  const candidate = selectRequest(
    input.candidate,
    input.candidateRequestIndex,
    "candidate",
  );
  assertPairCompatibility(
    baseline.request,
    candidate.request,
    input.policyComparison,
  );

  const replayedBaseline = replayRequest(engine, baseline, policies);
  const replayedCandidate = replayRequest(engine, candidate, policies);
  const comparison: GameplayTraceDivergenceComparison =
    compareGameplayTracesForDivergence(
      replayedBaseline.trace,
      replayedCandidate.trace,
    );

  if (comparison.incompatibleDifference !== null) {
    throw new Error(
      `Incompatible replay traces at ${comparison.incompatibleDifference.path}`,
    );
  }

  return Object.freeze({
    schemaVersion: SIMULATION_REPLAY_SCHEMA_VERSION,
    mode: "pair",
    policyComparison: input.policyComparison,
    baseline: replayedBaseline.report,
    candidate: replayedCandidate.report,
    comparison,
  });
}

/** Replays selected retained requests through fresh agents and host diagnostics. */
export function createSimulationReplay(
  engine: GameplayEngine,
  policies: SimulationPolicyRegistry = simulationPolicyRegistry,
): SimulationReplay {
  return Object.freeze({
    run(input: SimulationReplayInput): Promise<SimulationReplayReport> {
      return Promise.resolve().then(() => {
        const normalized = normalizeSimulationReplayInput(input);
        if (normalized.mode === "case") {
          return caseReport(
            engine,
            normalized.experiment,
            normalized.requestIndex,
            policies,
          );
        }

        return pairReport(engine, normalized, policies);
      });
    },
  });
}
