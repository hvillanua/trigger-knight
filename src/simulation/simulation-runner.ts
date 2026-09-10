import { normalizeProfile } from "../domain/profile.js";
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
import { createGameplayExecution } from "../application/gameplay-execution.js";
import {
  createCanonicalTraceHasher,
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
} from "./canonical-json.js";
import { normalizePolicyDescriptor } from "./policy-descriptor.js";

const RUN_RESULT_SCHEMA_VERSION = 2;
const NO_EVENTS: readonly GameEvent[] = Object.freeze([]);
const NO_METRICS = Object.freeze({});

export interface SimulationRunnerOptions {
  readonly onTrace?: (trace: GameplayTrace) => void;
}

function assertStepLimit(maxSteps: number): void {
  if (!Number.isSafeInteger(maxSteps) || maxSteps <= 0) {
    throw new RangeError("maxSteps must be a positive safe integer");
  }
}

function snapshotProfile(profile: ProfileInput): ProfileInput {
  const normalized = normalizeCanonicalJson(profile);

  normalizeProfile(normalized);

  return normalized as unknown as ProfileInput;
}

function runSimulation(
  engine: GameplayEngine,
  request: SimulationRequest,
  options: SimulationRunnerOptions,
): RunResult {
  const maxSteps = request.maxSteps;
  assertStepLimit(maxSteps);

  const policy = normalizePolicyDescriptor(request.policy.descriptor);
  const initialProfile = snapshotProfile(request.config.initialProfile);
  const config: RunConfig = Object.freeze({
    ruleset: request.config.ruleset,
    seed: request.config.seed,
    initialProfile,
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

  trace.add({
    schemaVersion: RUN_RESULT_SCHEMA_VERSION,
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
    schemaVersion: RUN_RESULT_SCHEMA_VERSION,
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
    metrics: NO_METRICS,
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
