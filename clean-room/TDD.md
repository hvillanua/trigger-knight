# Technical Design Document — Trigger Knight Browser Reimplementation

## 1. Purpose and scope

This document records the durable architecture and contracts for the browser reimplementation. It deliberately does not prescribe ticket-sized implementation choices such as package selection, source layout, algorithms, task order, CI commands, worker strategy, renderer math, or individual test cases. Those decisions belong in the implementation work that needs them.

The architecture must provide:

- one authoritative, deterministic gameplay engine shared by browser play and headless simulation;
- versioned rules that preserve the researched Trigger Knight behavior;
- stable boundaries between gameplay, presentation, persistence, input, sound, and simulation;
- replayable state and programmatic single-run and batch execution;
- replaceable adapters without turning the project into a generalized game engine.

## 2. Architecture

Use a TypeScript modular application with a pure gameplay domain and adapters around a shared application API.

```text
                    +-----------------------+
                    | Browser presentation  |
                    | view/input/sound/store|
                    +-----------+-----------+
                                |
                         commands/views/events
                                |
+-------------------+    +------v---------+
| Simulation runner |--->| Application API|
| policies/batches  |    | create/step/run|
+-------------------+    +------+---------+
                                |
                    +-----------v-----------+
                    |   Gameplay domain     |
                    | run and game rules    |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    | RuleSet + explicit RNG|
                    +-----------------------+
```

The browser and simulator call the same gameplay API. There is no reduced or approximate simulation model. Dependencies point inward: presentation, persistence, and simulation may depend on application and domain contracts; the domain must not depend on browser, rendering, storage, audio, filesystem, worker, or wall-clock APIs.

The domain uses game-oriented boundaries around run lifecycle, encounters, combat, economy, progression, rules, and randomness. These are logical modules inside one application, not separately deployed services.

## 3. Public contracts

The following contracts define what surrounding systems may rely on. Concrete types may gain fields as the model is implemented, but their responsibilities and dependency direction are architectural constraints.

### Gameplay engine

```ts
interface RunConfig {
  ruleset: RuleSetId;
  seed: string;
  initialProfile: ProfileState;
}

interface StepResult {
  state: RunState;
  events: readonly GameEvent[];
}

interface GameplayEngine {
  createRun(config: RunConfig): RunState;
  step(
    state: Readonly<RunState>,
    commands: readonly GameCommand[],
  ): StepResult;
  observe(state: Readonly<RunState>): GameObservation;
  view(state: Readonly<RunState>): GameView;
}
```

`step()` is a deterministic state transition for one 30 Hz logical opportunity. Commands express gameplay intent, such as buying, using an item, pausing, or dismissing a tutorial; they never contain device-specific input. Gates may prevent active gameplay systems from advancing while still allowing commands to be processed.

`GameEvent` reports authoritative outcomes such as encounter changes, damage, purchases, rewards, achievements, and death. `GameObservation` exposes the gameplay information available to an automated player, while `GameView` is the read-only world and HUD model exposed to presentation. Neither exposes mutable domain state. `RunState`, including its randomness state, must be serializable for checkpoints and exact replay.

### Presentation boundary

```ts
interface PresentationFrame {
  previous: Readonly<GameView>;
  current: Readonly<GameView>;
  interpolation: number;
  events: readonly GameEvent[];
}

interface PresentationPort {
  present(frame: PresentationFrame): void;
}
```

The presentation may interpolate between views, but only `current` is authoritative for displayed values and action eligibility. Visual animation never calls gameplay rules or decides when damage, purchases, rewards, or other domain transitions occur.

Input adapters translate pointer, touch, keyboard, or future devices into `GameCommand` values. A sound-effects adapter maps domain events and UI actions to semantic cues without putting file paths or playback operations in the domain. Background music is outside the initial scope; a future music controller can observe application or screen lifecycle without changing gameplay contracts or deterministic state.

Persistence is also an application boundary. It loads the initial profile and atomically stores completed progression and settings. Persistence timing and technology must not become gameplay rules.

### Simulation boundary

```ts
type SerializableValue =
  | null
  | boolean
  | number
  | string
  | readonly SerializableValue[]
  | Readonly<Record<string, SerializableValue>>;

type PolicyState = SerializableValue;

interface PolicyDescriptor {
  id: string;
  version: string;
  config: SerializableValue;
}

interface PolicyDecision {
  commands: readonly GameCommand[];
  state: PolicyState;
}

interface PlayerPolicy {
  readonly descriptor: PolicyDescriptor;
  createInitialState(): PolicyState;
  decide(
    observation: GameObservation,
    state: Readonly<PolicyState>,
  ): PolicyDecision;
}

interface SimulationRequest {
  config: RunConfig;
  policy: PlayerPolicy;
  maxSteps: number;
}

interface SimulationInputs {
  config: RunConfig;
  policy: PolicyDescriptor;
  initialPolicyState: PolicyState;
  maxSteps: number;
}

interface SimulationCheckpoint {
  runState: RunState;
  policyState: PolicyState;
  steps: number;
}

interface RunResult {
  schemaVersion: number;
  inputs: SimulationInputs;
  steps: number;
  activeTicks: number;
  terminalReason: "lifespan" | "combat" | "step-limit";
  score: number;
  day: number;
  distance: number;
  gold: number;
  traceHash: string;
  metrics: Readonly<Record<string, number>>;
}

interface SimulationRunner {
  run(request: SimulationRequest): RunResult;
  runBatch(
    requests: readonly SimulationRequest[],
  ): Promise<readonly RunResult[]>;
}
```

`PolicyState` and every value in `PolicyDescriptor` must be serializable. The descriptor contains a stable policy identity, an implementation version, and all normalized configuration that can affect decisions. `createInitialState()` must derive the same state from the same descriptor. `decide()` is a deterministic transition: given the same observation and policy state, it returns the same commands and next state without mutating either input. This permits policies with memory while preventing hidden object state from making results depend on policy reuse, worker scheduling, or batch order.

Simulation checkpoints contain the gameplay state, policy state, and consumed step count together. Restoring all three must produce the same remaining command stream and result as uninterrupted execution.

Every simulation requires a positive finite `maxSteps`. The budget counts every engine step, including paused or tutorial-gated steps, so a non-progressing policy cannot block a batch indefinitely. Reaching the budget returns `step-limit`; it is a runner termination, not a gameplay death.

Each result records the complete normalized inputs that identify its experiment: ruleset, seed, initial profile, policy descriptor and initial state, and step limit. Storage formats may replace a complete profile or policy-state snapshot with a versioned canonical fingerprint when the referenced input manifest is retained alongside the results; a standalone result must retain the snapshots themselves. A live policy object is never part of a serialized result.

Batch execution must be reproducible from the recorded inputs and must return normalized results independent of concurrency or completion order. Baseline and candidate rulesets can therefore be compared using the same seeds, profiles, policies, and step limits without records from different experiments sharing an apparent identity. Reporting formats and execution strategy are ticket-level decisions built on this contract.

## 4. Compatibility and modernization boundary

The compatibility target is gameplay behavior, not the limitations of the Flash container. Presentation adapters may modernize freely when the same initial state, seed, and command sequence still produce the same domain result.

| Concern | Preserve as gameplay behavior | Free to adapt outside the domain |
|---|---|---|
| Time | Fixed 30 Hz logical steps; active-tick lifespan, movement, score, delays, combat hit/finish points, pause and tutorial gates | Display refresh rate, interpolation, visibility handling, and visual-only timing |
| Space | Abstract world units using the original coordinate scale; mechanic-bearing positions, distances, speeds, and action thresholds | Camera projection, output resolution, pixel density, fullscreen, letterboxing, and responsive layout |
| Animation | Mechanic-bearing events occur at domain ticks | Menu motion, transitions, parallax treatment, particles, damage numbers, and fades |
| Input | Semantic commands and domain action eligibility | Input devices, bindings, accessible targets, and coordinate projection |
| HUD and screens | Gameplay-relevant information, available actions, pause/tutorial behavior, and final progression | Arrangement, typography, accessibility, navigation, and styling |
| Sound | Domain events expose outcomes without playback details | Sound-effect assets, decoding, mixing, levels, and focus behavior; music remains deferred |
| Persistence | Versioned profile meaning and progression results | Browser storage technology, migrations, and when presentation animations occur |
| Host integration | Nothing | Loading presentation, links, sharing, and optional future platform adapters |
| Cosmetic randomness | Must not perturb domain randomness or trace hashes | Separate presentation randomness and nondeterministic effects |

For `original-v1.3`, one original coordinate unit becomes one abstract world unit without conversion. The initial camera shows a 480x320-world-unit viewport, while world positions may exist outside it—for example, an encounter can enter at `x=600`. Those values belong to the ruleset, not to the physical canvas or CSS layout.

Rendering may run at any display rate, but it cannot make gameplay faster or slower. Combat visuals may be interpolated or redesigned while damage and attack completion remain tied to domain ticks. Non-interactive presentation delays may be shortened, skipped, or made accessibility-aware after their associated state has been committed.

## 5. Determinism and rulesets

The domain receives an explicit seeded random source whose complete state is serializable and stable across supported browser and headless runtimes. The concrete algorithm and seed-expansion scheme are selected during implementation and then versioned as part of the reproducibility contract. Domain code must never draw from ambient or presentation randomness.

The original Flash random sequence is unknown, so compatibility targets the confirmed ranges, probabilities, and gameplay draw order rather than claiming identical Flash seeds.

`original-v1.3` domain behavior becomes immutable after its compatibility baseline is established. Changes to gameplay behavior use a new ruleset identity. Unknown original behavior must remain labeled as an explicit decision rather than silently becoming a compatibility claim.

## 6. Technology selection

### Language and runtime

- **TypeScript** is used for the gameplay engine, application contracts, browser adapters, and simulator. Sharing one language and type system allows browser play and headless execution to use the same engine without a serialization or foreign-function boundary.
- **Node.js** hosts headless simulation so the TypeScript engine can run without a browser. How batches are parallelized remains an implementation decision.
- **Vite** provides the initial browser development and build environment because it has direct TypeScript support and integrates with the selected unit-test tooling without defining the application architecture.
- **No frontend framework initially.** The product has a small number of screens and one Canvas-centered game view. A framework can be introduced behind the browser adapter if later UI complexity justifies it.

### Rendering choice

| Option | Assessment | Decision |
|---|---|---|
| **Canvas 2D** | Directly supports the required 2D drawing, camera transforms, scaling, and drawing of interpolated views with a small runtime and dependency surface | **Selected for the initial renderer** |
| PixiJS | Adds a capable WebGL renderer, sprite batching, and richer display-object tooling, but that machinery is not yet required by the small fixed scene | Keep as a renderer replacement if measured visual or performance needs justify it |
| Phaser | Adds scenes, input, animation, physics, and a game loop, much of which overlaps the application and deterministic-engine boundaries already defined here | Do not adopt initially; reconsider only if future presentation requirements outweigh the additional framework surface |

Canvas 2D is selected because the initial rendering problem is modest and the main technical risk is gameplay correctness rather than rendering throughput. It also makes the separation between the authoritative engine and presentation explicit. Canvas remains behind `PresentationPort`, so choosing it now does not prevent a later PixiJS, Phaser, or other presentation adapter from consuming the same views and events.

### Testing frameworks

- **Vitest** is selected for gameplay, compatibility, deterministic simulation, and application-contract tests. It runs the TypeScript engine directly in a fast headless environment and shares the Vite transformation path.
- **Playwright** is selected for the browser boundary: input mapping, responsive presentation, Canvas integration, persistence, and browser/headless parity. Gameplay formulas and domain rules must not depend on browser tests.

Package versions, configuration, storage and sound APIs, directory layout, fixtures, individual test cases, and CI placement remain ticket-level decisions.

## 7. Verification responsibilities

Implementation work must provide evidence that:

- confirmed gameplay behavior and known gameplay-affecting quirks match the research specification;
- identical complete inputs reproduce identical state, results, and trace hashes;
- checkpoint replay, including policy state and the consumed step budget, matches uninterrupted execution;
- run results retain the normalized inputs needed to identify and reproduce their experiment;
- browser play and headless simulation use the same gameplay engine;
- presentation changes, output resolution, render rate, and input adapter do not change domain outcomes;
- a non-progressing policy terminates at its configured step limit;
- cosmetic randomness cannot consume domain randomness;
- profile progression is durable before optional result-counting animation completes.

The exact test cases, fixtures, tolerances, commands, and CI placement are decided in the implementation tickets.
