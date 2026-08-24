import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dependencyCruiser = path.join(
  repositoryRoot,
  "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
);
const eslint = path.join(repositoryRoot, "node_modules/eslint/bin/eslint.js");
const dependencyConfig = path.join(
  repositoryRoot,
  "dependency-cruiser.config.cjs",
);
const fixtures = path.join(repositoryRoot, "tests/architecture/fixtures");

function cruiseFixture(name: string) {
  return spawnSync(
    process.execPath,
    [dependencyCruiser, "--config", dependencyConfig, "src"],
    {
      cwd: path.join(fixtures, name),
      encoding: "utf8",
    },
  );
}

function lintDomain(source: string) {
  return spawnSync(
    process.execPath,
    [eslint, "--stdin", "--stdin-filename", "src/domain/example.mjs"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      input: source,
    },
  );
}

describe("architectural dependency rules", () => {
  it("accepts dependencies that point inward", () => {
    const result = cruiseFixture("valid-inward");

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it.each([
    [
      "an outward domain dependency",
      "forbidden-outward",
      "domain-does-not-depend-outward",
    ],
    [
      "an import of a prohibited artifact",
      "forbidden-artifact",
      "production-does-not-import-prohibited-inputs",
    ],
    [
      "a runtime dependency in the domain",
      "forbidden-runtime",
      "domain-does-not-use-runtime-builtins",
    ],
    [
      "an inward dependency on the composition root",
      "forbidden-composition-root",
      "layers-do-not-depend-on-composition-root",
    ],
  ])("rejects %s", (_description, fixture, rule) => {
    const result = cruiseFixture(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(rule);
  });
});

describe("authoritative domain API rules", () => {
  it.each([
    ["ambient randomness", "export const roll = Math.random();"],
    ["wall-clock time", "export const now = Date.now();"],
    ["browser APIs", "export const title = document.title;"],
    ["browser storage", "export const saved = localStorage.length;"],
  ])("rejects %s", (_description, source) => {
    const result = lintDomain(source);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("error");
  });

  it("accepts explicit randomness supplied to domain code", () => {
    const result = lintDomain(
      "export const roll = (nextRandom) => nextRandom();",
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
