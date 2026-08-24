import type {
  GameEvent,
  GameplayEngine,
  PlayerPolicy,
  PolicyConfig,
  PolicyDescriptor,
  ProfileState,
  RunConfig,
  RunResult,
  SimulationRequest,
  SimulationRunner,
} from "../application/contracts.js";
import {
  createCanonicalTraceHasher,
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
} from "./canonical-json.js";

const RUN_RESULT_SCHEMA_VERSION = 1;
const NO_EVENTS: readonly GameEvent[] = Object.freeze([]);
const NO_METRICS = Object.freeze({});

function assertStepLimit(maxSteps: number): void {
  if (!Number.isSafeInteger(maxSteps) || maxSteps <= 0) {
    throw new RangeError("maxSteps must be a positive safe integer");
  }
}

function normalizePolicy(policy: PlayerPolicy): PolicyDescriptor {
  const config = normalizeCanonicalJson(policy.descriptor.config);

  if (config === null || Array.isArray(config) || typeof config !== "object") {
    throw new TypeError("Policy config must be a plain record");
  }

  return Object.freeze({
    id: policy.descriptor.id,
    version: policy.descriptor.version,
    config: config as PolicyConfig,
  });
}

function normalizeProfile(profile: ProfileState): ProfileState {
  const normalized = normalizeCanonicalJson(profile);

  if (
    normalized === null ||
    Array.isArray(normalized) ||
    typeof normalized !== "object"
  ) {
    throw new TypeError("Initial profile must be a plain record");
  }

  return normalized as unknown as ProfileState;
}

function runSimulation(
  engine: GameplayEngine,
  request: SimulationRequest,
): RunResult {
  const maxSteps = request.maxSteps;
  assertStepLimit(maxSteps);

  const policy = normalizePolicy(request.policy);
  const initialProfile = normalizeProfile(request.config.initialProfile);
  const config: RunConfig = Object.freeze({
    ruleset: request.config.ruleset,
    seed: request.config.seed,
    initialProfile,
  });
  const initialProfileFingerprint = fingerprintCanonicalJson(initialProfile);
  const trace = createCanonicalTraceHasher();
  const agent = request.policy.createAgent();
  let state = engine.createRun(config);
  let observation = engine.observe(state);
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
    const normalizedCommands = normalizeCanonicalJson(commands);
    const result = engine.step(state, commands);
    state = result.state;
    observation = engine.observe(state);
    precedingEvents = result.events;

    trace.add({
      commands: normalizedCommands,
      events: result.events,
      observation,
      state,
    });
  }

  return Object.freeze({
    schemaVersion: RUN_RESULT_SCHEMA_VERSION,
    ruleset: config.ruleset,
    seed: config.seed,
    initialProfileFingerprint,
    policy,
    maxSteps,
    steps: maxSteps,
    activeTicks: 0,
    terminalReason: "step-limit",
    score: 0,
    day: 0,
    distance: 0,
    gold: 0,
    traceHash: trace.digest(),
    metrics: NO_METRICS,
  });
}

/** Creates a finite headless consumer around the shared gameplay engine. */
export function createSimulationRunner(
  engine: GameplayEngine,
): SimulationRunner {
  const run = (request: SimulationRequest): RunResult =>
    runSimulation(engine, request);

  return Object.freeze({
    run,
    runBatch(
      requests: readonly SimulationRequest[],
    ): Promise<readonly RunResult[]> {
      return Promise.resolve(Object.freeze(requests.map(run)));
    },
  });
}
