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
    "Usage: npm run simulate -- <single|batch> <input.json|->",
    "  single  execute one serializable simulation request",
    "  batch   execute a versioned simulation manifest",
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

async function runCommand(mode, input) {
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
    const canonical = await server.ssrLoadModule(
      "/src/simulation/canonical-json.ts",
    );
    const engine = application.createGameplayEngine(rulesets.ruleSetRegistry);
    const runner = runnerModule.createSimulationRunner(engine);

    if (mode === "single") {
      const request = experiment.normalizeSimulationRequestInput(input);
      const resolved = experiment.resolveSimulationRequest(request);
      return canonical.stringifyCanonicalJson(runner.run(resolved));
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
  if ((mode !== "single" && mode !== "batch") || inputPath === undefined) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  const input = readInput(inputPath);
  const output = await runCommand(mode, input);
  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Simulation command failed: ${message}\n`);
  process.exitCode = 1;
});
