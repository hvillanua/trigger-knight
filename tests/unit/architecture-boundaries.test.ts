import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ESLint } from "eslint";
import { cruise } from "dependency-cruiser";
import extractDepcruiseOptions from "dependency-cruiser/config-utl/extract-depcruise-options";
import { beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dependencyCruiser = path.join(
  repositoryRoot,
  "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
);
const eslintConfig = path.join(repositoryRoot, "eslint.config.mjs");
const publicContractChecker = path.join(
  repositoryRoot,
  "build/check-public-contracts.mjs",
);
const dependencyConfig = path.join(
  repositoryRoot,
  "dependency-cruiser.config.cjs",
);
const fixtures = path.join(repositoryRoot, "tests/architecture/fixtures");

interface ContractCheckerModule {
  checkPublicContracts(options?: { cwd?: string; project?: string }): {
    diagnostics: string;
    exitCode: number;
  };
}

let contractChecker: ContractCheckerModule | undefined;
let dependencyCruiseOptions:
  Awaited<ReturnType<typeof extractDepcruiseOptions>> | undefined;
let eslint: ESLint | undefined;

beforeAll(async () => {
  contractChecker = (await import(
    pathToFileURL(publicContractChecker).href
  )) as ContractCheckerModule;
  dependencyCruiseOptions = await extractDepcruiseOptions(dependencyConfig);
  eslint = new ESLint({
    cwd: repositoryRoot,
    overrideConfigFile: eslintConfig,
  });
});

async function cruiseFixture(name: string) {
  if (!dependencyCruiseOptions) {
    throw new Error("dependency-cruiser options were not initialized");
  }

  const result = await cruise(["src"], {
    ...dependencyCruiseOptions,
    baseDir: path.join(fixtures, name),
    outputType: "err",
  });
  if (typeof result.output !== "string") {
    throw new Error("dependency-cruiser did not return text output");
  }

  return {
    status: result.exitCode,
    stdout: result.output,
    stderr: "",
  };
}

function cruiseFixtureCli(name: string) {
  return spawnSync(
    process.execPath,
    [dependencyCruiser, "--config", dependencyConfig, "src"],
    {
      cwd: path.join(fixtures, name),
      encoding: "utf8",
    },
  );
}

async function lintDomain(source: string) {
  if (!eslint) {
    throw new Error("ESLint was not initialized");
  }

  const results = await eslint.lintText(source, {
    filePath: "src/domain/example.mjs",
  });
  const diagnostics = results
    .flatMap((result) =>
      result.messages.map(
        ({ message, severity }) =>
          `${severity === 2 ? "error" : "warning"}: ${message}`,
      ),
    )
    .join("\n");

  return {
    status: results.some((result) => result.errorCount > 0) ? 1 : 0,
    stdout: diagnostics,
    stderr: "",
  };
}

function checkPublicContractFixture(name: string) {
  if (!contractChecker) {
    throw new Error("public-contract checker was not initialized");
  }

  const result = contractChecker.checkPublicContracts({
    cwd: path.join(fixtures, name),
    project: "tsconfig.json",
  });

  return {
    status: result.exitCode,
    stdout: "",
    stderr: result.diagnostics,
  };
}

function checkPublicContractFixtureCli(name: string) {
  return spawnSync(
    process.execPath,
    [publicContractChecker, "--project", "tsconfig.json"],
    {
      cwd: path.join(fixtures, name),
      encoding: "utf8",
    },
  );
}

describe("architectural dependency rules", () => {
  it("accepts dependencies that point inward", async () => {
    const result = await cruiseFixture("valid-inward");

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
    [
      "an outward type-only dependency",
      "forbidden-type-only",
      "domain-does-not-depend-outward",
    ],
    [
      "application-layer ruleset composition",
      "forbidden-ruleset-composition",
      "application-does-not-compose-ruleset-registry",
    ],
  ])("rejects %s", async (_description, fixture, rule) => {
    const result = await cruiseFixture(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(rule);
  });

  it("keeps the dependency-cruiser CLI path covered", () => {
    const result = cruiseFixtureCli("valid-inward");

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no dependency violations found");
  });
});

describe("authoritative domain API rules", () => {
  it.each([
    ["ambient randomness", "export const roll = Math.random();"],
    ["wall-clock time", "export const now = Date.now();"],
    ["browser APIs", "export const title = document.title;"],
    ["browser storage", "export const saved = localStorage.length;"],
    ["unlisted browser observers", "export const observer = ResizeObserver;"],
    ["unlisted browser file APIs", "export const reader = FileReader;"],
    ["unlisted Node paths", "export const directory = __dirname;"],
    ["unlisted Node scheduling", "export const schedule = setImmediate;"],
  ])("rejects %s", async (_description, source) => {
    const result = await lintDomain(source);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("error");
  });

  it("accepts explicit randomness supplied to domain code", async () => {
    const result = await lintDomain(
      "export const roll = (nextRandom) => nextRandom();",
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});

describe("player-visible contract rules", () => {
  it("accepts a public projection that does not reference hidden state", () => {
    const result = checkPublicContractFixture("valid-public-contract");

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("rejects a transitive reference to an unapproved project type", () => {
    const result = checkPublicContractFixture("forbidden-public-contract");

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      "PlayerObservation -> EncounterObservation -> EnemySnapshot",
    );
    expect(result.stdout + result.stderr).toContain(
      "PresentationFrame -> RunState",
    );
    expect(result.stdout + result.stderr).toContain(
      "PresentationPort -> RunState",
    );
    expect(result.stdout + result.stderr).toContain(
      "CompletedRunPresentation -> RunState",
    );
    expect(result.stdout + result.stderr).toContain(
      "DeclarationObservation -> HiddenDeclarationState",
    );
    expect(result.stdout + result.stderr).toContain(
      "GameObservation -> MergeHiddenState",
    );
    expect(result.stdout + result.stderr).toContain("SoundPort -> RunState");
  });

  it("keeps the public-contract CLI path covered", () => {
    const result = checkPublicContractFixtureCli("forbidden-public-contract");

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      "PlayerObservation -> EncounterObservation -> EnemySnapshot",
    );
  });
});
