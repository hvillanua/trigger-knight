# Technical Design Document — Trigger Knight Browser Reimplementation

## 1. Purpose and scope

This document records the durable architecture and contracts for the browser reimplementation. It deliberately does not prescribe ticket-sized implementation choices such as package selection, source layout, algorithms, task order, CI commands, worker strategy, renderer math, or individual test cases. Those decisions belong in the implementation work that needs them.

The architecture must provide:

- one authoritative, deterministic gameplay engine shared by browser play and headless simulation;
- versioned rules that preserve the researched Trigger Knight behavior;
- stable boundaries between gameplay, presentation, persistence, input, sound, and simulation;
- reproducible complete runs and programmatic single-run and batch execution;
- replaceable adapters without turning the project into a generalized game engine.

## 2. Architecture

Use a TypeScript modular application with a pure gameplay domain and adapters around a shared application API.

```text
                    +-----------------------+
                    | Browser presentation  |
                    | observation/input/etc |
                    +-----------+-----------+
                                |
                     commands/observations/events
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

Adapters are peers and must not import one another. `src/main.ts` composes the
concrete adapters and rulesets; other layers must not import the composition
root. Code, configuration, and tests define the implemented contracts and
enforcement. This document guides architecture and future work.

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
  step(state: Readonly<RunState>, commands: readonly GameCommand[]): StepResult;
  observe(state: Readonly<RunState>): GameObservation;
}
```

`step()` is a deterministic state transition for one 30 Hz logical opportunity. Commands express gameplay intent, such as buying, using an item, pausing, or dismissing a tutorial; they never contain device-specific input. Gates may prevent active gameplay systems from advancing while still allowing commands to be processed.

`GameObservation` is the single read-only public gameplay model exposed to browser presentation, input adapters, and automated player policies. It contains all and only current public gameplay state and action eligibility. `GameEvent` reports authoritative public outcomes such as encounter changes, damage, purchases, rewards, achievements, and death. Each consumer may ignore observation fields or events it does not use. Engine hosts carry `RunState` for stepping and checkpoints, but player-facing consumers must not inspect its hidden mechanics or randomness state when presenting information or choosing commands. Complete runs are reproduced from their initial inputs and policy; mid-run checkpoint restoration is not required.

### Presentation boundary

```ts
interface PresentationFrame {
  previous: Readonly<GameObservation>;
  current: Readonly<GameObservation>;
  interpolation: number;
  events: readonly GameEvent[];
}

interface PresentationTransition {
  previous: Readonly<GameObservation>;
  current: Readonly<GameObservation>;
  events: readonly GameEvent[];
}

interface PresentationPort {
  present(frame: PresentationFrame): void;
  presentTransition?(transition: PresentationTransition): void;
}
```

The presentation may interpolate between observations, but only `current` is authoritative for displayed values and action eligibility. Visual animation never calls gameplay rules or decides when damage, purchases, rewards, or other domain transitions occur.

The browser session may call `presentTransition` once for each public logical
transition before a display render. Adapters can use it to retain exact public
transition timing when several logical steps are rendered together; it does not
draw, expose hidden state, or change gameplay.

#### Runtime asset inputs

Presentation adapters consume reviewed copies of the original game's visual,
font, music, and sound assets where available. The preserved SWF and recorded
exports are source records; original production files are staged under
`src/assets/original/` and carry provenance metadata linking them to the source
artifact hash or export identifier, extraction details, rights or license, and
review date. Missing or failed visual or audio assets remain non-fatal.
Character playback uses public active ticks and phases, preserves each entity's
exported frame canvas and a fixed origin, and never advances gameplay. Unverified
pose timing and visual transitions remain presentation choices. Event feedback is
retained only in the presentation adapter for bounded visual lifetimes, and its
particle placement is deterministic from the public event key without consuming
gameplay randomness.
Asset files must not carry gameplay decisions or hidden state. The
presentation boundary does not permit decompiled ActionScript, generated
behavioral research, or direct imports from archival source roots. Font files
may be reused when staged with their recorded rights status; an embedded SWF
copyright notice does not by itself establish redistribution rights.

Input adapters translate pointer, touch, keyboard, or future devices into `GameCommand` values. They must honor public action eligibility rather than recreate availability rules. A max-tier equipment shop is therefore ineligible before input mapping, and a direct invalid command cannot spend gold, heal HP, or consume the shop. Presentation chooses the unavailable cue but cannot display an ineligible shop as purchasable. The sound adapter maps public domain events, UI actions, and screen lifecycle hooks to the recorded original sound symbols without putting file paths or playback operations in the domain. Music and score-count playback remain browser presentation state and do not change gameplay contracts or deterministic state.

Persistence is also an application boundary. It loads the initial profile and atomically stores completed progression and settings. Persistence timing and technology must not become gameplay rules.

### Simulation boundary

```ts
interface PolicyDescriptor {
  id: string;
  version: string;
  config: PolicyConfig;
}

interface PlayerAgent {
  decide(
    observation: Readonly<GameObservation>,
    events: readonly GameEvent[],
  ): readonly GameCommand[];
}

interface PlayerPolicy {
  readonly descriptor: PolicyDescriptor;
  createAgent(): PlayerAgent;
}

interface SimulationRequest {
  config: RunConfig;
  policy: PlayerPolicy;
  maxSteps: number;
}

interface RunResult {
  schemaVersion: number;
  ruleset: RuleSetId;
  seed: string;
  initialProfileFingerprint: string;
  policy: PolicyDescriptor;
  maxSteps: number;
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

The policy descriptor contains a stable identity, an implementation version, and all normalized serializable configuration that can affect decisions. Changing policy behavior or configuration creates a different experiment. `PolicyConfig` is the policy-specific normalized configuration; its concrete representation is selected with the policy implementation.

`createAgent()` returns a fresh agent for every run. An agent may keep private memory during that run, but no mutable state is shared between runs. For each decision, the agent receives the current public observation and the events emitted by the preceding step; the initial decision receives an empty event list. Browser presentation receives the same observation and event sequence. Starting from a fresh agent, the same observation and event sequence must produce the same command sequence without ambient randomness, wall-clock input, worker identity, or batch-order dependence. If a future policy intentionally uses randomness, its explicit policy seed becomes part of the experiment inputs and remains separate from gameplay randomness.

A distinct observation model for privileged, diagnostic, or otherwise specialized automated agents is deferred. It may be introduced behind a separately named boundary only when a concrete requirement demonstrates that the shared public observation is insufficient. Ordinary `PlayerPolicy` implementations continue to receive the same public gameplay information as browser players.

Full host diagnostic traces are opt-in and are not retained by an ordinary gameplay execution. Browser development composition may request them for diagnostics, and the simulation runner requests them only when its `onTrace` callback is provided. The public `RunResult.traceHash` remains part of every simulation result and is computed independently of retaining the complete checkpoint trace.

Every simulation requires a positive finite `maxSteps`. The budget counts every engine step, including paused or tutorial-gated steps, so a non-progressing policy cannot block a batch indefinitely. Reaching the budget returns `step-limit`; it is a runner termination, not a gameplay death.

Every run starts from its initial configuration and executes continuously to gameplay termination or `step-limit`. Mid-run simulation persistence and resumption are not part of this boundary.

Each result directly identifies the inputs that produced it: ruleset, seed, a versioned canonical fingerprint of the initial profile, the policy descriptor, and the configured step limit. The profile snapshot corresponding to the fingerprint is retained with the simulation inputs rather than copied into every result. This keeps results compact while preventing records produced from different profiles, policies, or limits from sharing an apparent identity. A live policy or agent object is never serialized.

Batch execution must be reproducible from its requests and must return normalized results independent of concurrency or completion order. Its purpose is Monte Carlo analysis: vary gameplay seeds, complete every run, and aggregate metrics such as run length, score, progression, encounters, and terminal reasons to characterize the distribution produced by encounter randomness. Baseline and candidate rulesets or policies can use the same seeds, profiles, and step limits for paired per-seed comparisons that distinguish systematic changes from random variation. Reporting formats, shared-input deduplication, and execution strategy are ticket-level decisions built on this contract.

## 4. Compatibility and modernization boundary

The compatibility target is gameplay behavior, not the limitations of the Flash container. Presentation adapters may modernize freely when the same initial state, seed, and command sequence still produce the same domain result.

| Concern             | Preserve as gameplay behavior                                                                                                                                                                            | Free to adapt outside the domain                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Time                | Fixed 30 Hz logical steps; active-tick lifespan, movement, score, delays, combat hit/finish points, pause and tutorial gates                                                                             | Display refresh rate, interpolation, visibility handling, and visual-only timing                                |
| Space               | Abstract world units using the original coordinate scale; mechanic-bearing positions, distances, speeds, and action thresholds                                                                           | Camera projection, output resolution, pixel density, fullscreen, letterboxing, and responsive layout            |
| Animation           | Mechanic-bearing events occur at domain ticks                                                                                                                                                            | Menu motion, transitions, parallax treatment, particles, damage numbers, and fades                              |
| Input               | Semantic commands and domain action eligibility                                                                                                                                                          | Input devices, bindings, accessible targets, and coordinate projection                                          |
| HUD and screens     | Gameplay-relevant information, available actions, pause/tutorial behavior, final progression, and reference-backed original composition, layer order, asset use, and cue placement where evidence exists | Responsive projection, accessible parallel text, navigation, and typography or detail where evidence is missing |
| Sound               | Domain events expose outcomes without playback details                                                                                                                                                   | Sound-effect assets, decoding, mixing, levels, and focus behavior; music remains deferred                       |
| Persistence         | Versioned profile meaning and progression results                                                                                                                                                        | Browser storage technology, migrations, and when presentation animations occur                                  |
| Host integration    | Nothing                                                                                                                                                                                                  | Loading presentation, links, sharing, and optional future platform adapters                                     |
| Cosmetic randomness | Must not perturb domain randomness or trace hashes                                                                                                                                                       | Separate presentation randomness and nondeterministic effects                                                   |

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

| Option        | Assessment                                                                                                                                               | Decision                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Canvas 2D** | Directly supports the required 2D drawing, camera transforms, scaling, and drawing of interpolated frames with a small runtime and dependency surface    | **Selected for the initial renderer**                                                                                 |
| PixiJS        | Adds a capable WebGL renderer, sprite batching, and richer display-object tooling, but that machinery is not yet required by the small fixed scene       | Keep as a renderer replacement if measured visual or performance needs justify it                                     |
| Phaser        | Adds scenes, input, animation, physics, and a game loop, much of which overlaps the application and deterministic-engine boundaries already defined here | Do not adopt initially; reconsider only if future presentation requirements outweigh the additional framework surface |

Canvas 2D is selected because the initial rendering problem is modest and the main technical risk is gameplay correctness rather than rendering throughput. It also makes the separation between the authoritative engine and presentation explicit. Canvas remains behind `PresentationPort`, so choosing it now does not prevent a later PixiJS, Phaser, or other presentation adapter from consuming the same observations and events.

### Testing frameworks

- **Vitest** is selected for gameplay, compatibility, deterministic simulation, and application-contract tests. It runs the TypeScript engine directly in a fast headless environment and shares the Vite transformation path.
- **Playwright** is selected for the browser boundary: input mapping, responsive presentation, Canvas integration, persistence, and browser/headless parity. Gameplay formulas and domain rules must not depend on browser tests.

Package versions, configuration, storage and sound APIs, directory layout, fixtures, individual test cases, and CI placement remain ticket-level decisions.

## 7. Verification responsibilities

Implementation work must provide evidence that:

- confirmed gameplay behavior and known gameplay-affecting quirks match the research specification;
- identical complete inputs reproduce identical state, results, and trace hashes;
- browser presentation and ordinary player policies receive the same public observation and event sequence;
- fresh agents given the same observation and event sequence produce the same command sequence;
- retained simulation requests and run-result identifiers preserve the complete inputs needed to distinguish and reproduce runs;
- browser play and headless simulation use the same gameplay engine;
- presentation changes, output resolution, render rate, and input adapter do not change domain outcomes;
- a non-progressing policy terminates at its configured step limit;
- cosmetic randomness cannot consume domain randomness;
- profile progression is durable before optional result-counting animation completes.

The exact test cases, fixtures, tolerances, commands, and CI placement are decided in the implementation tickets.
