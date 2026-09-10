import { describe, expect, it } from "vitest";

import type {
  RunResult,
  SimulationManifest,
  SimulationRequestInput,
  SimulationRunner,
} from "../../src/application/contracts.js";
import { createFreshProfile } from "../../src/domain/profile.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";
import {
  createSimulationExperiment,
  normalizeSimulationManifest,
  resolveSimulationRequest,
  simulationRequestFingerprint,
  stringifySimulationBatchExport,
  stringifySimulationManifest,
} from "../../src/simulation/simulation-experiment.js";
import { simulationPolicyRegistry } from "../../src/simulation/policy-registry.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();

function input(
  seed: string,
  overrides: Partial<SimulationRequestInput> = {},
): SimulationRequestInput {
  return {
    config: {
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed,
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    },
    policy: {
      id: "non-progressing",
      version: "1",
      config: {},
    },
    maxSteps: 3,
    ...overrides,
  };
}

describe("serializable simulation experiments", () => {
  it("normalizes manifests while preserving minimal and expanded profiles", () => {
    const expandedProfile = createFreshProfile();
    const manifest = normalizeSimulationManifest({
      requests: [
        {
          maxSteps: 3,
          policy: { config: {}, version: "1", id: "non-progressing" },
          config: {
            initialProfile: { scoreMultiplier: 1, schemaVersion: 1 },
            seed: "minimal",
            ruleset: ORIGINAL_V13_RULESET_ID,
          },
        },
        input("expanded", {
          config: {
            ruleset: ORIGINAL_V13_RULESET_ID,
            seed: "expanded",
            initialProfile: expandedProfile,
          },
        }),
      ],
      schemaVersion: 1,
    });

    expect(manifest.schemaVersion).toBe(1);
    expect(Object.keys(manifest.requests[0]!.config.initialProfile)).toEqual([
      "schemaVersion",
      "scoreMultiplier",
    ]);
    expect(manifest.requests[1]!.config.initialProfile).toEqual(
      expandedProfile,
    );
    expect(
      Object.keys(manifest.requests[1]!.config.initialProfile),
    ).toHaveLength(Object.keys(expandedProfile).length);
    expect(stringifySimulationManifest(manifest)).toBe(
      stringifySimulationManifest({
        schemaVersion: 1,
        requests: manifest.requests,
      }),
    );
  });

  it.each([
    { schemaVersion: 2, requests: [] },
    { schemaVersion: 1, requests: [{ ...input("bad"), maxSteps: 0 }] },
    { schemaVersion: 1, requests: [{ ...input("bad"), extra: true }] },
  ])("rejects invalid manifest input %j", (manifest) => {
    expect(() => normalizeSimulationManifest(manifest)).toThrow();
  });

  it("resolves existing policies by identity, version, and normalized configuration", () => {
    const resolved = simulationPolicyRegistry.resolve({
      id: "combat-shopper",
      version: "1",
      config: { elixirHpFraction: 0.25 },
    });

    expect(resolved.descriptor).toEqual({
      id: "combat-shopper",
      version: "1",
      config: { elixirHpFraction: 0.25 },
    });
    expect(resolved.createAgent()).not.toBe(resolved.createAgent());
    expect(() =>
      simulationPolicyRegistry.resolve({
        id: "combat-shopper",
        version: "99",
        config: { elixirHpFraction: 0.25 },
      }),
    ).toThrowError(/Unsupported policy/);
    expect(() =>
      simulationPolicyRegistry.resolve({
        id: "combat-shopper",
        version: "1",
        config: { elixirHpFraction: 0.25, unknown: true },
      }),
    ).toThrowError(/Unsupported policy configuration/);
  });

  it("runs empty, duplicate, gated, and progressing requests with retained inputs", async () => {
    const runner = createSimulationRunner(engine);
    const experiment = createSimulationExperiment(runner);
    const empty = await experiment.run({ schemaVersion: 1, requests: [] });

    expect(empty).toEqual({
      schemaVersion: 1,
      manifest: { schemaVersion: 1, requests: [] },
      results: [],
    });
    expect(Object.isFrozen(empty)).toBe(true);
    expect(Object.isFrozen(empty.results)).toBe(true);

    const first = input("first");
    const duplicate = input("first");
    const progressing = input("progressing", {
      config: {
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "progressing",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      },
      policy: {
        id: "purchase-reachable-shops",
        version: "2",
        config: {},
      },
      maxSteps: 62,
    });
    const manifest: SimulationManifest = {
      schemaVersion: 1,
      requests: [progressing, first, duplicate],
    };

    const report = await experiment.run(manifest);
    const individual = await runner.runBatch(
      manifest.requests.map((request) => resolveSimulationRequest(request)),
    );

    expect(report.manifest).toEqual(normalizeSimulationManifest(manifest));
    expect(report.results).toHaveLength(3);
    expect(
      report.results.filter((entry) => entry.requestIndex === 1),
    ).toHaveLength(1);
    expect(
      report.results.filter((entry) => entry.requestIndex === 2),
    ).toHaveLength(1);
    expect(report.results.map((entry) => entry.result.terminalReason)).toEqual([
      "step-limit",
      "step-limit",
      "step-limit",
    ]);
    for (const entry of report.results) {
      expect(entry.result).toEqual(individual[entry.requestIndex]);
      expect(entry.requestFingerprint).toBe(
        simulationRequestFingerprint(manifest.requests[entry.requestIndex]!),
      );
    }
    expect(
      report.results[0]!.requestFingerprint <=
        report.results[1]!.requestFingerprint,
    ).toBe(true);
    expect(
      report.results[1]!.requestFingerprint <=
        report.results[2]!.requestFingerprint,
    ).toBe(true);
    expect(report.results.map((entry) => entry.requestIndex)).toEqual(
      [...report.results]
        .sort((left, right) =>
          left.requestFingerprint < right.requestFingerprint
            ? -1
            : left.requestFingerprint > right.requestFingerprint
              ? 1
              : 0,
        )
        .map((entry) => entry.requestIndex),
    );
    expect(
      report.results.find((entry) => entry.requestIndex === 1)!.result.steps,
    ).toBe(3);
    expect(
      report.results.find((entry) => entry.requestIndex === 0)!.result
        .activeTicks,
    ).toBeGreaterThan(0);
    expect(stringifySimulationBatchExport(report)).toBe(
      stringifySimulationBatchExport(
        await experiment.run({
          schemaVersion: 1,
          requests: [
            {
              maxSteps: progressing.maxSteps,
              policy: progressing.policy,
              config: progressing.config,
            },
            {
              maxSteps: first.maxSteps,
              policy: first.policy,
              config: first.config,
            },
            {
              maxSteps: duplicate.maxSteps,
              policy: duplicate.policy,
              config: duplicate.config,
            },
          ],
        }),
      ),
    );
  });

  it("does not require live policies in the serialized manifest", () => {
    const manifest = normalizeSimulationManifest({
      schemaVersion: 1,
      requests: [input("serialized")],
    });

    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
    expect(JSON.stringify(manifest)).not.toContain("createAgent");
    expect(resolveSimulationRequest(manifest.requests[0]!).policy).toBe(
      nonProgressingPolicy,
    );
  });

  it("keeps report ordering stable when the runner completes work out of order", async () => {
    const actualRunner = createSimulationRunner(engine);
    const outOfOrderRunner: SimulationRunner = {
      run: (request) => actualRunner.run(request),
      async runBatch(requests) {
        const results = await Promise.all(
          [...requests].reverse().map(
            (request, reverseIndex) =>
              new Promise<RunResult>((resolve) => {
                setTimeout(
                  () => resolve(actualRunner.run(request)),
                  reverseIndex,
                );
              }),
          ),
        );
        return Object.freeze(results.reverse());
      },
    };
    const requests = [input("a"), input("b"), input("c")];
    const report = await createSimulationExperiment(outOfOrderRunner).run({
      schemaVersion: 1,
      requests,
    });

    expect(report.results.map((entry) => entry.requestIndex)).toEqual(
      [...report.results]
        .sort((left, right) =>
          left.requestFingerprint < right.requestFingerprint
            ? -1
            : left.requestFingerprint > right.requestFingerprint
              ? 1
              : 0,
        )
        .map((entry) => entry.requestIndex),
    );
  });
});
