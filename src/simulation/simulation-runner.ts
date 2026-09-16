import type {
  GameEvent,
  GameplayTrace,
  GameplayEngine,
  ProfileInput,
  RunConfig,
  RunResult,
  SimulationRequest,
  SimulationRunner,
} from "../application/contracts.js";
import { SIMULATION_RUN_RESULT_SCHEMA_VERSION } from "../application/contracts.js";
import { createGameplayExecution } from "../application/gameplay-execution.js";
import {
  createCanonicalTraceHasher,
  fingerprintCanonicalJson,
} from "./canonical-json.js";
import { normalizePolicyDescriptor } from "./policy-descriptor.js";
import { createRunMetricsAccumulator } from "./simulation-report.js";
import {
  normalizeProfileInput,
  positiveSafeInteger,
} from "./simulation-validation.js";

// The trace header remains v2 so frozen original-v1.3 trace identities remain
// valid while the result envelope evolves to carry populated metrics.
const TRACE_RESULT_INPUT_SCHEMA_VERSION = 2;
const NO_EVENTS: readonly GameEvent[] = Object.freeze([]);

export interface SimulationRunnerOptions {
  /** Retains and forwards the complete host trace when provided. */
  readonly onTrace?: (trace: GameplayTrace) => void;
}

function snapshotProfile(profile: ProfileInput): ProfileInput {
  return normalizeProfileInput(profile);
}

function runSimulation(
  engine: GameplayEngine,
  request: SimulationRequest,
  options: SimulationRunnerOptions,
): RunResult {
  const maxSteps = positiveSafeInteger(request.maxSteps, "maxSteps");

  const policy = normalizePolicyDescriptor(request.policy.descriptor);
  const initialProfile = snapshotProfile(request.config.initialProfile);
  const config: RunConfig = Object.freeze({
    ruleset: request.config.ruleset,
    seed: request.config.seed,
    initialProfile,
    ...(request.config.startImmediately === undefined
      ? {}
      : { startImmediately: request.config.startImmediately }),
  });
  const initialProfileFingerprint = fingerprintCanonicalJson(initialProfile);
  const trace = createCanonicalTraceHasher();
  const agent = request.policy.createAgent();
  const execution = createGameplayExecution(engine, config, {
    retainDiagnostics: options.onTrace !== undefined,
  });
  let checkpoint = execution.readCurrentCheckpoint();
  let state = checkpoint.state;
  let observation = checkpoint.observation;
  let precedingEvents = NO_EVENTS;
  const metrics = createRunMetricsAccumulator();

  trace.add({
    schemaVersion: TRACE_RESULT_INPUT_SCHEMA_VERSION,
    ruleset: config.ruleset,
    seed: config.seed,
    initialProfile,
    policy,
    maxSteps,
  });
  trace.add({ observation, state });

  for (let step = 0; step < maxSteps; step += 1) {
    const commands = agent.decide(observation, precedingEvents);
    checkpoint = execution.dispatch(commands);
    const normalizedCommands = checkpoint.commands;
    state = checkpoint.state;
    observation = checkpoint.observation;
    precedingEvents = checkpoint.events;
    metrics.add(checkpoint.events);

    trace.add({
      commands: normalizedCommands,
      events: checkpoint.events,
      observation,
      state,
    });

    if (state.lifecycle.terminalReason !== null) {
      break;
    }
  }

  options.onTrace?.(execution.readDiagnostics());

  return Object.freeze({
    schemaVersion: SIMULATION_RUN_RESULT_SCHEMA_VERSION,
    ruleset: config.ruleset,
    seed: config.seed,
    initialProfileFingerprint,
    policy,
    maxSteps,
    steps: state.steps,
    activeTicks: state.activeTicks,
    terminalReason: state.lifecycle.terminalReason ?? "step-limit",
    score: state.score,
    day: state.day,
    distance: state.distance,
    gold: state.player.gold,
    traceHash: trace.digest(),
    metrics: metrics.finish(state),
  });
}

/** Creates a finite headless consumer around the shared gameplay engine. */
export function createSimulationRunner(
  engine: GameplayEngine,
  options: SimulationRunnerOptions = {},
): SimulationRunner {
  const run = (request: SimulationRequest): RunResult =>
    runSimulation(engine, request, options);

  return Object.freeze({
    run,
    runBatch(
      requests: readonly SimulationRequest[],
    ): Promise<readonly RunResult[]> {
      return Promise.resolve(Object.freeze(requests.map(run)));
    },
  });
}
