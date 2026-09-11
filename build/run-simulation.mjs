import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function usage() {
  return [
    "Usage: npm run simulate -- <single|batch|compare|replay> <input.json|->",
    "  single  execute one serializable simulation request",
    "  batch   execute a versioned simulation manifest",
    "  compare execute two retained manifests and report paired differences",
    "  replay  replay a retained case or pair with first-divergence diagnostics",
    "  -       read JSON input from stdin",
  ].join("\n");
}

function readInput(inputPath) {
  const raw =
    inputPath === "-"
      ? readFileSync(0, "utf8")
      : readFileSync(path.resolve(process.cwd(), inputPath), "utf8");

  return JSON.parse(raw);
}

/**
 * Runs the simulation command. Optional registries are used by in-process
 * integration tests to exercise candidate dispatch without adding a
 * production ruleset.
 */
export async function runSimulationCommand(mode, input, options = {}) {
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root: repositoryRoot,
    server: { middlewareMode: true },
  });

  try {
    const application = await server.ssrLoadModule(
      "/src/application/gameplay-engine.ts",
    );
    const rulesets = await server.ssrLoadModule("/src/domain/rulesets.ts");
    const runnerModule = await server.ssrLoadModule(
      "/src/simulation/simulation-runner.ts",
    );
    const experiment = await server.ssrLoadModule(
      "/src/simulation/simulation-experiment.ts",
    );
    const comparison = await server.ssrLoadModule(
      "/src/simulation/simulation-comparison.ts",
    );
    const replay = await server.ssrLoadModule(
      "/src/simulation/simulation-replay.ts",
    );
    const canonical = await server.ssrLoadModule(
      "/src/simulation/canonical-json.ts",
    );
    const engine = application.createGameplayEngine(
      options.ruleSetRegistry ?? rulesets.ruleSetRegistry,
    );
    const runner = runnerModule.createSimulationRunner(engine);

    if (mode === "replay") {
      return canonical.stringifyCanonicalJson(
        await replay
          .createSimulationReplay(engine, options.policyRegistry)
          .run(input),
      );
    }

    if (mode === "single") {
      const request = experiment.normalizeSimulationRequestInput(input);
      const resolved = experiment.resolveSimulationRequest(request);
      return canonical.stringifyCanonicalJson(runner.run(resolved));
    }

    if (mode === "compare") {
      return canonical.stringifyCanonicalJson(
        await comparison
          .createSimulationComparison(runner, options.policyRegistry)
          .run(input),
      );
    }

    const report = await experiment
      .createSimulationExperiment(runner)
      .run(input);
    return experiment.stringifySimulationBatchExport(report);
  } finally {
    await server.close();
  }
}

async function main() {
  const [mode, inputPath] = process.argv.slice(2);
  if (
    (mode !== "single" &&
      mode !== "batch" &&
      mode !== "compare" &&
      mode !== "replay") ||
    inputPath === undefined
  ) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  const input = readInput(inputPath);
  const output = await runSimulationCommand(mode, input);
  process.stdout.write(`${output}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Simulation command failed: ${message}\n`);
    process.exitCode = 1;
  });
}
