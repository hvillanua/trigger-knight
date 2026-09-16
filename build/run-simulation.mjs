import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  dispatchSimulationCommand,
  isSimulationCommand,
  loadSimulationCommandModules,
} from "./simulation-command.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const compiledSourceRoot = path.join(
  repositoryRoot,
  "dist",
  "simulation",
  "src",
);

function usage() {
  return [
    "Usage: npm run simulate -- <single|batch|benchmark|compare|replay> <input.json|->",
    "  single  execute one serializable simulation request",
    "  batch   execute a versioned simulation manifest",
    "  benchmark run the configured host benchmark and target checks",
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

async function loadCompiledModule(modulePath) {
  return import(pathToFileURL(path.join(compiledSourceRoot, modulePath)).href);
}

/**
 * Runs the simulation command. Optional registries are used by in-process
 * integration tests to exercise candidate dispatch without adding a
 * production ruleset.
 */
export async function runSimulationCommand(mode, input, options = {}) {
  const modules = await loadSimulationCommandModules(mode, loadCompiledModule);
  const engine = modules.application.createGameplayEngine(
    options.ruleSetRegistry ?? modules.rulesets.ruleSetRegistry,
  );
  const runner =
    modules.runner === undefined
      ? undefined
      : modules.runner.createSimulationRunner(engine);
  const benchmarkEnvironment =
    mode === "benchmark"
      ? {
          now: () => performance.now(),
          readHeapUsedBytes: () => process.memoryUsage().heapUsed,
          collectGarbage: () => globalThis.gc?.(),
          host: {
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            cpuCount: availableParallelism(),
          },
        }
      : undefined;

  return dispatchSimulationCommand(mode, input, {
    ...modules,
    engine,
    runner,
    policyRegistry: options.policyRegistry,
    benchmarkEnvironment,
  });
}

async function main() {
  const [mode, inputPath] = process.argv.slice(2);
  if (!isSimulationCommand(mode) || inputPath === undefined) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  const input = readInput(inputPath);
  const output = await runSimulationCommand(mode, input);
  process.stdout.write(`${output}\n`);
  if (mode === "benchmark" && JSON.parse(output).targets.met === false) {
    process.stderr.write("Simulation benchmark targets were not met\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Simulation command failed: ${message}\n`);
    process.exitCode = 1;
  });
}
