import type {
  SimulationBatchExport,
  SimulationExperiment,
  SimulationManifest,
  SimulationPolicyRegistry,
  SimulationRequest,
  SimulationRequestInput,
  SimulationRunner,
  RunMetrics,
  RunResult,
} from "../application/contracts.js";
import { normalizeRunConfig } from "../application/run-config.js";
import {
  SIMULATION_BATCH_EXPORT_SCHEMA_VERSION,
  SIMULATION_MANIFEST_SCHEMA_VERSION,
  SIMULATION_RUN_RESULT_SCHEMA_VERSION,
} from "../application/contracts.js";
import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
  stringifyCanonicalJson,
} from "./canonical-json.js";
import { simulationPolicyRegistry } from "./policy-registry.js";
import { normalizePolicyDescriptor } from "./policy-descriptor.js";
import type { PolicyDescriptor } from "../application/contracts.js";
import { RUN_METRIC_KEYS } from "./simulation-report.js";
import {
  assertKeys,
  positiveSafeInteger,
  record,
} from "./simulation-validation.js";

function normalizeStepLimit(input: unknown): number {
  return positiveSafeInteger(input, "maxSteps");
}

function compareFingerprints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Normalizes one JSON request while retaining the supplied profile shape. */
export function normalizeSimulationRequestInput(
  input: unknown,
): SimulationRequestInput {
  const normalized = record(
    normalizeCanonicalJson(input),
    "Simulation request",
  );
  assertKeys(
    normalized,
    ["config", "maxSteps", "policy"],
    "Simulation request",
  );

  return Object.freeze({
    config: normalizeRunConfig(normalized.config),
    policy: normalizePolicyDescriptor(normalized.policy),
    maxSteps: normalizeStepLimit(normalized.maxSteps),
  });
}

/** Normalizes a versioned manifest without creating any live policy objects. */
export function normalizeSimulationManifest(
  input: unknown,
): SimulationManifest {
  const normalized = record(
    normalizeCanonicalJson(input),
    "Simulation manifest",
  );
  assertKeys(normalized, ["requests", "schemaVersion"], "Simulation manifest");

  if (normalized.schemaVersion !== SIMULATION_MANIFEST_SCHEMA_VERSION) {
    throw new RangeError(
      `Unsupported simulation manifest schemaVersion ${String(normalized.schemaVersion)}`,
    );
  }

  if (!Array.isArray(normalized.requests)) {
    throw new TypeError("Simulation manifest requests must be an array");
  }

  return Object.freeze({
    schemaVersion: SIMULATION_MANIFEST_SCHEMA_VERSION,
    requests: Object.freeze(
      normalized.requests.map((request) =>
        normalizeSimulationRequestInput(request),
      ),
    ),
  });
}

function finiteResultNumber(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new TypeError(`${label} must be a finite number`);
  }

  return input;
}

function nonNegativeResultInteger(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }

  return input;
}

/** Normalizes one retained result and rejects stale or incomplete envelopes. */
export function normalizeSimulationResult(input: unknown): RunResult {
  const normalized = record(normalizeCanonicalJson(input), "Simulation result");
  assertKeys(
    normalized,
    [
      "activeTicks",
      "day",
      "distance",
      "gold",
      "initialProfileFingerprint",
      "maxSteps",
      "metrics",
      "policy",
      "ruleset",
      "schemaVersion",
      "score",
      "seed",
      "steps",
      "terminalReason",
      "traceHash",
    ],
    "Simulation result",
  );

  if (normalized.schemaVersion !== SIMULATION_RUN_RESULT_SCHEMA_VERSION) {
    throw new RangeError(
      `Unsupported simulation result schemaVersion ${String(normalized.schemaVersion)}`,
    );
  }

  if (
    typeof normalized.ruleset !== "string" ||
    normalized.ruleset.length === 0
  ) {
    throw new TypeError("Simulation result ruleset must be a non-empty string");
  }
  if (typeof normalized.seed !== "string") {
    throw new TypeError("Simulation result seed must be a string");
  }
  if (
    typeof normalized.initialProfileFingerprint !== "string" ||
    normalized.initialProfileFingerprint.length === 0
  ) {
    throw new TypeError(
      "Simulation result initialProfileFingerprint must be a non-empty string",
    );
  }
  if (
    typeof normalized.traceHash !== "string" ||
    normalized.traceHash.length === 0
  ) {
    throw new TypeError(
      "Simulation result traceHash must be a non-empty string",
    );
  }
  if (
    normalized.terminalReason !== "lifespan" &&
    normalized.terminalReason !== "combat" &&
    normalized.terminalReason !== "step-limit"
  ) {
    throw new TypeError("Simulation result terminalReason is unsupported");
  }

  const metricsRecord = record(normalized.metrics, "Simulation result metrics");
  assertKeys(metricsRecord, RUN_METRIC_KEYS, "Simulation result metrics");
  const metrics = Object.freeze(
    Object.fromEntries(
      RUN_METRIC_KEYS.map((key) => [
        key,
        finiteResultNumber(
          metricsRecord[key],
          `Simulation result metric ${key}`,
        ),
      ]),
    ),
  ) as RunMetrics;

  return Object.freeze({
    schemaVersion: SIMULATION_RUN_RESULT_SCHEMA_VERSION,
    ruleset: normalized.ruleset,
    seed: normalized.seed,
    initialProfileFingerprint: normalized.initialProfileFingerprint,
    policy: normalizePolicyDescriptor(normalized.policy),
    maxSteps: normalizeStepLimit(normalized.maxSteps),
    steps: nonNegativeResultInteger(
      normalized.steps,
      "Simulation result steps",
    ),
    activeTicks: nonNegativeResultInteger(
      normalized.activeTicks,
      "Simulation result activeTicks",
    ),
    terminalReason: normalized.terminalReason,
    score: finiteResultNumber(normalized.score, "Simulation result score"),
    day: finiteResultNumber(normalized.day, "Simulation result day"),
    distance: finiteResultNumber(
      normalized.distance,
      "Simulation result distance",
    ),
    gold: finiteResultNumber(normalized.gold, "Simulation result gold"),
    traceHash: normalized.traceHash,
    metrics,
  });
}

/** Normalizes a retained batch export and verifies every request/result link. */
export function normalizeSimulationBatchExport(
  input: unknown,
): SimulationBatchExport {
  const normalized = record(
    normalizeCanonicalJson(input),
    "Simulation batch export",
  );
  assertKeys(
    normalized,
    ["manifest", "results", "schemaVersion"],
    "Simulation batch export",
  );

  if (normalized.schemaVersion !== SIMULATION_BATCH_EXPORT_SCHEMA_VERSION) {
    throw new RangeError(
      `Unsupported simulation batch export schemaVersion ${String(normalized.schemaVersion)}`,
    );
  }

  const manifest = normalizeSimulationManifest(normalized.manifest);
  if (!Array.isArray(normalized.results)) {
    throw new TypeError("Simulation batch export results must be an array");
  }
  if (normalized.results.length !== manifest.requests.length) {
    throw new Error(
      `Simulation batch export contains ${normalized.results.length} results for ${manifest.requests.length} requests`,
    );
  }

  const seen = new Set<number>();
  const results = normalized.results.map((inputRecord) => {
    const resultRecord = record(inputRecord, "Simulation result record");
    assertKeys(
      resultRecord,
      ["requestFingerprint", "requestIndex", "result"],
      "Simulation result record",
    );

    const requestIndex = resultRecord.requestIndex;
    if (
      typeof requestIndex !== "number" ||
      !Number.isSafeInteger(requestIndex) ||
      requestIndex < 0 ||
      requestIndex >= manifest.requests.length ||
      seen.has(requestIndex)
    ) {
      throw new Error(
        `Invalid or duplicate simulation result requestIndex ${String(requestIndex)}`,
      );
    }
    seen.add(requestIndex);

    if (
      typeof resultRecord.requestFingerprint !== "string" ||
      resultRecord.requestFingerprint !==
        simulationRequestFingerprint(manifest.requests[requestIndex]!)
    ) {
      throw new Error(
        `Simulation result ${requestIndex} has a mismatched request fingerprint`,
      );
    }

    const result = normalizeSimulationResult(resultRecord.result);
    const request = manifest.requests[requestIndex]!;
    if (
      result.ruleset !== request.config.ruleset ||
      result.seed !== request.config.seed ||
      result.maxSteps !== request.maxSteps ||
      result.initialProfileFingerprint !==
        fingerprintCanonicalJson(request.config.initialProfile) ||
      stringifySimulationPolicy(result.policy) !==
        stringifySimulationPolicy(request.policy)
    ) {
      throw new Error(
        `Simulation result ${requestIndex} does not match its retained request`,
      );
    }

    return Object.freeze({
      requestIndex,
      requestFingerprint: resultRecord.requestFingerprint,
      result,
    });
  });

  if (seen.size !== manifest.requests.length) {
    throw new Error("Simulation batch export is missing a request result");
  }

  return Object.freeze({
    schemaVersion: SIMULATION_BATCH_EXPORT_SCHEMA_VERSION,
    manifest,
    results: Object.freeze(results),
  });
}

/** Returns a stable identity for one retained request input. */
export function simulationRequestFingerprint(
  input: SimulationRequestInput,
): string {
  return fingerprintCanonicalJson(normalizeSimulationRequestInput(input));
}

/** Resolves one retained request into the live public simulator contract. */
export function resolveSimulationRequest(
  input: SimulationRequestInput,
  policies: SimulationPolicyRegistry = simulationPolicyRegistry,
): SimulationRequest {
  const normalized = normalizeSimulationRequestInput(input);

  return Object.freeze({
    config: normalized.config,
    policy: policies.resolve(normalized.policy),
    maxSteps: normalized.maxSteps,
  });
}

/** Executes manifests through the existing finite simulator and normalizes output order. */
export function createSimulationExperiment(
  runner: SimulationRunner,
  policies: SimulationPolicyRegistry = simulationPolicyRegistry,
): SimulationExperiment {
  return Object.freeze({
    async run(input: SimulationManifest): Promise<SimulationBatchExport> {
      const manifest = normalizeSimulationManifest(input);
      const requests = manifest.requests.map((request) =>
        resolveSimulationRequest(request, policies),
      );
      const fingerprints = manifest.requests.map(simulationRequestFingerprint);
      const results = await runner.runBatch(requests);

      if (results.length !== requests.length) {
        throw new Error(
          `Simulation runner returned ${results.length} results for ${requests.length} requests`,
        );
      }

      const records = results.map((result, requestIndex) => ({
        requestIndex,
        requestFingerprint: fingerprints[requestIndex]!,
        result,
      }));
      records.sort((left, right) => {
        const byFingerprint = compareFingerprints(
          left.requestFingerprint,
          right.requestFingerprint,
        );
        return byFingerprint === 0
          ? left.requestIndex - right.requestIndex
          : byFingerprint;
      });

      return Object.freeze({
        schemaVersion: SIMULATION_BATCH_EXPORT_SCHEMA_VERSION,
        manifest,
        results: Object.freeze(records.map((record) => Object.freeze(record))),
      });
    },
  });
}

/** Serializes a validated manifest as byte-stable canonical JSON. */
export function stringifySimulationManifest(input: unknown): string {
  return stringifyCanonicalJson(normalizeSimulationManifest(input));
}

/** Serializes a batch export with sorted keys and no operational metadata. */
export function stringifySimulationBatchExport(
  input: SimulationBatchExport,
): string {
  return stringifyCanonicalJson(input);
}

/** Serializes one policy descriptor for callers that need a canonical identity. */
export function stringifySimulationPolicy(input: PolicyDescriptor): string {
  return stringifyCanonicalJson(normalizePolicyDescriptor(input));
}
