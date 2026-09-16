export const SIMULATION_COMMANDS = Object.freeze([
  "single",
  "batch",
  "benchmark",
  "compare",
  "replay",
]);

const MODULE_PATHS = Object.freeze({
  application: "application/gameplay-engine.js",
  rulesets: "domain/rulesets.js",
  canonical: "simulation/canonical-json.js",
  runner: "simulation/simulation-runner.js",
  experiment: "simulation/simulation-experiment.js",
  comparison: "simulation/simulation-comparison.js",
  replay: "simulation/simulation-replay.js",
  benchmark: "simulation/simulation-benchmark.js",
});

export function isSimulationCommand(mode) {
  return typeof mode === "string" && SIMULATION_COMMANDS.includes(mode);
}

function assertSimulationCommand(mode) {
  if (!isSimulationCommand(mode)) {
    throw new RangeError(`Unsupported simulation command "${String(mode)}"`);
  }
}

/**
 * Loads the common runtime modules and only the command implementation needed
 * for the selected mode. The loader is injected so dispatch can be tested
 * without starting a process or a module-transform server.
 */
export async function loadSimulationCommandModules(mode, loadModule) {
  assertSimulationCommand(mode);

  const [application, rulesets, canonical] = await Promise.all([
    loadModule(MODULE_PATHS.application),
    loadModule(MODULE_PATHS.rulesets),
    loadModule(MODULE_PATHS.canonical),
  ]);
  const common = { application, rulesets, canonical };

  if (mode === "single" || mode === "batch") {
    const [runner, experiment] = await Promise.all([
      loadModule(MODULE_PATHS.runner),
      loadModule(MODULE_PATHS.experiment),
    ]);
    return Object.freeze({ ...common, runner, experiment });
  }

  if (mode === "compare") {
    const [runner, comparison] = await Promise.all([
      loadModule(MODULE_PATHS.runner),
      loadModule(MODULE_PATHS.comparison),
    ]);
    return Object.freeze({ ...common, runner, comparison });
  }

  if (mode === "replay") {
    const replay = await loadModule(MODULE_PATHS.replay);
    return Object.freeze({ ...common, replay });
  }

  const [runner, benchmark] = await Promise.all([
    loadModule(MODULE_PATHS.runner),
    loadModule(MODULE_PATHS.benchmark),
  ]);
  return Object.freeze({ ...common, runner, benchmark });
}

/** Dispatches one command using already-loaded modules and injected adapters. */
export async function dispatchSimulationCommand(mode, input, dependencies) {
  assertSimulationCommand(mode);

  const {
    benchmark,
    benchmarkEnvironment,
    canonical,
    comparison,
    engine,
    experiment,
    policyRegistry,
    replay,
    runner,
  } = dependencies;

  if (mode === "single") {
    const request = experiment.normalizeSimulationRequestInput(input);
    const resolved = experiment.resolveSimulationRequest(
      request,
      policyRegistry,
    );
    return canonical.stringifyCanonicalJson(runner.run(resolved));
  }

  if (mode === "batch") {
    const report = await experiment
      .createSimulationExperiment(runner, policyRegistry)
      .run(input);
    return experiment.stringifySimulationBatchExport(report);
  }

  if (mode === "compare") {
    const report = await comparison
      .createSimulationComparison(runner, policyRegistry)
      .run(input);
    return canonical.stringifyCanonicalJson(report);
  }

  if (mode === "replay") {
    const report = await replay
      .createSimulationReplay(engine, policyRegistry)
      .run(input);
    return canonical.stringifyCanonicalJson(report);
  }

  const report = await benchmark
    .createSimulationBenchmark(runner, policyRegistry, benchmarkEnvironment)
    .run(input);
  return canonical.stringifyCanonicalJson(report);
}
