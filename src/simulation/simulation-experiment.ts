import { normalizeProfile } from "../domain/profile.js";
import type {
  RunConfig,
  SimulationBatchExport,
  SimulationExperiment,
  SimulationManifest,
  SimulationPolicyRegistry,
  SimulationRequest,
  SimulationRequestInput,
  SimulationRunner,
} from "../application/contracts.js";
import {
  SIMULATION_BATCH_EXPORT_SCHEMA_VERSION,
  SIMULATION_MANIFEST_SCHEMA_VERSION,
} from "../application/contracts.js";
import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
  stringifyCanonicalJson,
} from "./canonical-json.js";
import { simulationPolicyRegistry } from "./policy-registry.js";
import { normalizePolicyDescriptor } from "./policy-descriptor.js";
import type { PolicyDescriptor } from "../application/contracts.js";
import type { ProfileInput } from "../domain/contracts.js";

type NormalizedRecord = Readonly<Record<string, unknown>>;

function record(value: unknown, label: string): NormalizedRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }

  return value as NormalizedRecord;
}

function assertKeys(
  value: NormalizedRecord,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();

  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

function normalizeProfileInput(input: unknown): ProfileInput {
  const normalized = normalizeCanonicalJson(input);
  normalizeProfile(normalized);
  return normalized as unknown as ProfileInput;
}

function normalizeRunConfigInput(input: unknown): RunConfig {
  const normalized = record(normalizeCanonicalJson(input), "Simulation config");
  assertKeys(
    normalized,
    ["initialProfile", "ruleset", "seed"],
    "Simulation config",
  );

  if (
    typeof normalized.ruleset !== "string" ||
    normalized.ruleset.length === 0
  ) {
    throw new TypeError("Simulation config ruleset must be a non-empty string");
  }

  if (typeof normalized.seed !== "string") {
    throw new TypeError("Simulation config seed must be a string");
  }

  return Object.freeze({
    ruleset: normalized.ruleset,
    seed: normalized.seed,
    initialProfile: normalizeProfileInput(normalized.initialProfile),
  });
}

function normalizeStepLimit(input: unknown): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input <= 0) {
    throw new RangeError("maxSteps must be a positive safe integer");
  }

  return input;
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
    config: normalizeRunConfigInput(normalized.config),
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
