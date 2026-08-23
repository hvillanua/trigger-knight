# Clean-room reimplementation plan

## Goal

Build a native browser reimplementation of Trigger Knight v1.3 whose gameplay
rules can be exercised without rendering, whose original-compatible behavior
is protected by tests, and whose later balance changes can be evaluated through
large deterministic batches.

This document is a plan only. No implementation begins until the first
milestone's tests and interfaces have been reviewed.

## Principles

1. **Test-driven development is mandatory for game rules.** Add a failing test
   from the behavioral specification, implement the smallest rule that passes,
   then refactor while the suite remains green.
2. **The simulation core never depends on the UI.** It must not import Canvas,
   DOM, audio, `window`, browser timers, or wall-clock time.
3. **Every run is reproducible.** A run is identified by rule-set version,
   seed, policy, initial profile, and finite runner step limit.
4. **The browser and batch runner use the same public core API.** There is no
   separate simplified simulation model.
5. **Original quirks remain explicit.** Compatibility behavior belongs in a
   versioned rule set, not scattered conditionals. Enhancements create a new
   rule-set version.
6. **Random comparisons use paired seeds.** Old and new rules run the same seed
   and policy, allowing per-run differences instead of comparing unrelated
   samples.
7. **Statistical tests must not be flaky.** Unit and compatibility tests use
   exact seeds or scripted RNG. Large distribution comparisons report metrics
   and use reviewed tolerances; they do not fail because of fresh random input.

## Lean technology choice

Use one TypeScript package rather than a monorepo:

- **Vite** for the browser development/build pipeline.
- **Vitest** for fast Node-based unit, compatibility, scenario, and simulation
  tests.
- **Playwright** only for the thin browser adapter and visual/input smoke tests.
- **Canvas 2D** for rendering unless later prototyping establishes a concrete
  need for a heavier renderer.
- **Node worker threads** for parallel batch execution, with a deterministic
  single-process fallback for debugging and constrained environments.

Vite and Vitest share the TypeScript transform/configuration path, keeping the
initial toolchain small. Playwright is deliberately excluded from core-rule
tests because those must run faster without starting a browser.

Official references: [Vite](https://vite.dev/guide/),
[Vitest](https://vitest.dev/guide/), and
[Playwright](https://playwright.dev/docs/intro).

Do not add a frontend framework initially. The game has one fixed scene and a
small set of screens; a framework would not improve the simulation boundary.

## Proposed repository layout

```text
clean-room/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  src/
    core/
      model.ts          # Serializable state and command types
      engine.ts         # createRun() and step()
      rng.ts            # Injected deterministic random source
      rules.ts          # RuleSet interface and v1.3 values
      encounters.ts
      combat.ts
      economy.ts
      progression.ts
      events.ts         # Domain event types
    policies/
      policy.ts         # Headless player-decision interface
      fixtures.ts       # Stable policies used by baselines
    sim/
      run.ts            # One headless run
      batch.ts          # Seed partitioning and worker orchestration
      metrics.ts
      compare.ts
      cli.ts
    browser/
      app.ts
      input.ts          # UI gestures to core commands
      renderer.ts       # State/events to Canvas
      audio.ts
      persistence.ts
  tests/
    unit/
    compatibility/
    scenarios/
    simulation/
    browser/
    fixtures/
  baselines/
    original-v1.3/
  reports/              # Generated and ignored
```

## Core API boundary

The core should be a deterministic state transition:

```ts
type Tick = number;

interface RunConfig {
  rules: RuleSetId;
  seed: string;
  initialProfile: ProfileState;
}

interface RunOptions {
  maxSteps: number;
}

interface RunState {
  config: RunConfig;
  game: GameState;
  rng: RandomState;
  tick: Tick;
}

interface StepResult {
  state: RunState;
  events: readonly GameEvent[];
}

function createRun(config: RunConfig): RunState;
function step(
  state: Readonly<RunState>,
  commands: readonly GameCommand[],
): StepResult;

function run(
  config: RunConfig,
  policy: PlayerPolicy,
  options: RunOptions,
): RunResult;
```

The exact shape may change during the first tests, but these constraints do
not:

- `step()` advances exactly one original 30 Hz logical tick.
- Tick count is the authoritative game clock. Rendering can interpolate but
  cannot change simulation results.
- Complete run state, including PRNG state, can be serialized to stable JSON
  for checkpoints, replay, migration tests, and debugging.
- Commands express intent such as `buyCurrentEncounter`, `useItem`, `pause`, or
  `dismissTutorial`; they contain no mouse coordinates.
- Domain events describe results such as damage, purchase, encounter, death,
  achievement, and score changes. Rendering and telemetry consume events.
- The core does no I/O and does not mutate module-global state.
- Presentation-only animation state stays in the browser layer unless a frame
  directly controls mechanics, such as the confirmed combat hit frame.
- The headless `run()` wrapper requires a positive finite `maxSteps` and counts
  every `step()` invocation, including paused or tutorial-gated steps. Exhausting
  that budget returns `step-limit` rather than leaving a worker blocked.

## Deterministic randomness

Use a pure random transition whose state is included in `RunState`:

```ts
interface RandomState {
  algorithm: string;
  words: readonly number[];
  draws: number;
}

interface RandomDraw {
  state: RandomState;
  value: number;
  context: RandomContext;
}

function nextInt(
  state: Readonly<RandomState>,
  exclusiveMax: number,
  context: RandomContext,
): RandomDraw;
```

Requirements:

- Choose and document one portable integer PRNG for the reimplementation.
- Never use `Math.random()` in core code.
- A seed produces identical results in Node and every supported browser.
- Restoring a serialized checkpoint reproduces the uninterrupted run exactly.
- Each draw records a semantic context such as `shop-type`, `dragon-roll`,
  `damage-roll`, or `attack-delay` in debug traces.
- Provide `ScriptedRandomState` for exact scenario tests and boundary cases.
- Record random-draw events to diagnose changes in draw order.

The test implementations may expose `ScriptedRandomState` and recording
wrappers, but production transitions never rely on hidden mutable RNG state.

The exact Flash Player PRNG is unknown, so compatibility means reproducing the
confirmed ranges, probabilities, and call order, not claiming identical Flash
seed sequences. That limitation remains recorded in `research/unknowns.md`.

## Headless player policies

Automated runs need explicit decision logic. A policy receives an observation
derived from public game state and returns commands for the next tick:

```ts
interface PlayerPolicy {
  readonly id: string;
  decide(observation: Observation): readonly GameCommand[];
}
```

Initial stable policies:

| Policy | Purpose |
|---|---|
| `no-actions` | Lifespan, encounter, combat, and death baseline |
| `buy-affordable` | Exercises all shop paths without strategy tuning |
| `survival-first` | Prioritizes shrine, armor, and healing |
| `damage-first` | Prioritizes weapons and Divine Edge |
| `voucher-economy` | Exercises reward multiplication and gold progression |
| `scripted-scenario` | Makes exact commands at exact ticks for fixtures |

Policies are versioned test inputs. Changing a baseline policy requires review
because it changes the meaning of historical comparison data.

## TDD workflow

For every mechanic:

1. Link the test to the relevant section in `research/mechanics.md` and label
   its evidence `CONFIRMED`, `DERIVED`, or `DECISION`.
2. Write the smallest failing test, preferably with a scripted RNG sequence.
3. Implement only enough production code to pass it.
4. Add boundary and invariant tests.
5. Refactor after the focused and fast suites pass.
6. Add or update a deterministic trace fixture if the rule affects cross-system
   behavior.
7. Run the simulation smoke comparison before merging.

Unknown behavior cannot silently become a compatibility test. It needs a
documented `DECISION`, a rule-set flag when relevant, and a note in the unknown
ledger.

## Test layers

### 1. Formula unit tests

Exact tests for equipment, enemy scaling, shop prices, damage ranges, lifespan,
day calculation, gold, score, profile XP, and achievements. These should be
pure, table-driven, and complete at important boundaries.

Examples:

- Tier 1 and tier 10 weapon/armor values match the SWF tables.
- Day changes at distances 6,999 and 7,000.
- Dragon chance is 0% on day 7, 3% on day 8, and guaranteed when eligible from
  day 41.
- Damage uses a 0-19% rounded bonus and hero critical chance boundaries.
- Lifespan death occurs at the confirmed tick boundary.

### 2. Compatibility characterization tests

Translate every confirmed rule and known quirk into a named test. These form
the executable v1.3 contract and must run without a browser.

Keep the original quirks in this suite: cached shop prices, 99.99% initial
lifespan, strict XP threshold, score precedence, and the one-time forced shrine
behavior. A future enhanced rule set can intentionally differ while v1.3 tests
continue to pass against the compatibility configuration.

The cached-price characterization must include the concrete cross-battle case:
two weapon shops queued at tier 1 both charge 236 while advancing to tiers 2
and 3; the equivalent armor shops both charge 204. This protects the observed
four-slot lookahead behavior from an accidental “fix.”

### 3. Scenario tests

Use scripted RNG and commands to test sequences involving multiple modules:

- Run to shop, purchase equipment, battle, receive reward, and resume running.
- Trigger emergency shrine, pass it, and prove another is not forced until a
  shrine purchase resets eligibility.
- Use Elixir, Divine Edge, and Gold Voucher in battle.
- Generate and kill a Dragon, then verify rewards and achievements.
- Die from combat versus lifespan and verify distinct terminal reasons.

Each scenario emits a compact golden trace of domain events, not a snapshot of
the entire state on every tick. Full state is included only at checkpoints.

### 4. Invariant and generated tests

Run many deterministic seeds and assert invariants rather than specific paths:

- RNG outputs always respect exclusive bounds.
- Equipment tiers remain in 1-10.
- Inventory contains zero or one valid item.
- Gold changes only through documented purchases and rewards.
- Dead runs cannot resume.
- Queue length remains three after initialization.
- A run with the same complete input produces identical result and trace hashes.

Start with simple seeded loops. Add a property-testing dependency only when the
invariants become difficult to cover with the existing runner.

### 5. Seeded Monte Carlo regression tests

Run fixed seed manifests against stable policies and compare results with
versioned baselines. These tests exercise balance and emergent progression,
not individual formulas.

Use two tiers:

- **Smoke:** tens or hundreds of paired seeds, fast enough for every pull
  request.
- **Full:** thousands or tens of thousands of paired seeds, scheduled or run
  explicitly for balance changes.

### 6. Browser adapter tests

Playwright verifies only integration responsibilities:

- A new run retains the original coordinate scale as abstract world units, uses
  an initial 480x320-world-unit camera, renders sharply at responsive/HiDPI
  output sizes, and advances through the same core API.
- Pointer/keyboard actions produce expected commands.
- Pause, menus, persistence adapter, audio toggles, and screen transitions work.
- A known seed reaches the same checkpoint in browser and Node.
- The same command schedule produces the same domain result at representative
  30, 60, and 120 Hz render cadences.
- Representative desktop/mobile screenshots contain no clipping or overlap.

Do not duplicate formula tests through browser clicks.

## Simulation result and telemetry

Every headless run returns a versioned record:

```ts
interface RunResult {
  schemaVersion: number;
  rules: RuleSetId;
  seed: string;
  policy: string;
  steps: number;
  activeTicks: number;
  terminalReason: "lifespan" | "combat" | "step-limit";
  score: number;
  day: number;
  distance: number;
  gold: number;
  profileExp: number;
  kills: Record<EnemyType, number>;
  dragonsSeen: number;
  dragonsKilled: number;
  purchases: Record<PurchaseType, number>;
  itemsUsed: Record<ItemType, number>;
  maxHit: number;
  traceHash: string;
}
```

Keep results compact enough that 10,000 runs are practical. Detailed traces
are opt-in for selected seeds or failures.

## Comparing rule versions

Given baseline `A` and candidate `B`:

1. Use the same seed manifest, initial profile, policy, and runner step limit.
2. Run each `(seed, policy)` pair under both rule sets.
3. Compare per-seed deltas for score, active gameplay ticks, day, gold, kills,
   purchase mix, dragon outcomes, and terminal reason.
4. Report mean, median, standard deviation, percentiles, min/max, and paired
   win/tie/loss counts.
5. Show distribution histograms and the largest divergent seeds.
6. Replay divergent seeds with debug traces to locate the first state or RNG
   draw-order difference.
7. Store summary JSON and Markdown; keep large raw reports out of Git.

Paired comparison separates actual rule changes from random sample noise. A
balance change should include its expected metric movement and reviewed
tolerance in the pull request.

## Baseline policy

Commit the following, because they define repeatability:

- Rule-set ID and rule data.
- Seed manifests.
- Stable policy versions.
- Compact aggregate summaries.
- A small set of per-seed expected `RunResult` fixtures.
- Trace hashes and detailed traces only for diagnostic reference seeds.

Do not commit bulk per-tick traces. Regenerate those through the CLI.

The first baseline is `original-v1.3`. Later versions use explicit identifiers
such as `enhanced-v1`, never mutable labels like `current` inside result data.

The initial Monte Carlo baseline is a regression reference, not independent
proof that the remake matches Flash. Compatibility confidence comes from the
SWF-grounded formula and scenario tests; the frozen baseline then detects later
behavioral drift.

## Planned commands

```text
npm test                    Watch-mode TDD loop
npm run test:run            All fast Node tests once
npm run test:compat         Original v1.3 executable contract
npm run test:sim            Fixed-seed simulation smoke suite
npm run test:browser        Playwright adapter tests
npm run sim -- [options]    Single or batch headless execution
npm run compare -- [args]   Paired rule-set comparison report
npm run check               Typecheck, lint, fast tests, and build
```

Exact CLI flags are defined in the scaffold milestone, before implementation.

## CI plan

Every pull request runs:

1. Type checking and linting.
2. Unit, compatibility, scenario, and invariant tests in Node.
3. Fixed-seed simulation smoke comparison.
4. Production browser build.
5. One Chromium Playwright project initially.

Scheduled or manually dispatched CI runs the full simulation matrix and the
additional Playwright browsers. Batch outputs are uploaded as CI artifacts,
with a concise comparison summary added to the job report.

The simulation runner partitions a sorted seed manifest into independent
chunks. Results are sorted by `(policy, seed)` before aggregation, so worker
count and completion order cannot alter output.

The same manifest must produce byte-identical normalized results with one
worker and with multiple workers. This is a required CI test for the batch
runner.

## Delivery milestones

### Milestone 0: Contract and scaffold

- Review this plan and choose the deterministic PRNG.
- Scaffold Vite, TypeScript, Vitest, and scripts.
- Define `GameState`, `RuleSet`, `RandomState`, commands, events, trace format,
  policy interface, and result schema through type tests.
- Add CI with a deliberately trivial passing test.

**Exit:** Node can create, serialize, and replay an empty seeded run; no UI is
required, and all planned test commands resolve.

### Milestone 1: Running clock, lifespan, and days

- Tests first for fixed 30 Hz ticks, acceleration, distance, day boundaries,
  score-per-tick, pause/tutorial gating, and lifespan death.
- Implement only these state transitions and telemetry.

**Exit:** `no-actions` runs deterministically to lifespan death and matches all
confirmed tick boundaries.

### Milestone 2: Encounter queue and economy

- Tests first for queue cycles, exact shop weights, duplicate rerolls, forced
  shrine, prices, click window, inventory, and equipment upgrades.
- Add scripted RNG traces for every event branch.

**Exit:** Headless policies can encounter and purchase every shop/item, with
queue and economy invariants holding across a fixed seed batch.

### Milestone 3: Combat and enemies

- Tests first for all enemy formulas, movement/range, animation hit ticks,
  attack delays, flinch, damage, critical hits, death, and rewards.
- Add Dragon eligibility, stats, reward, and achievement scenarios.

**Exit:** Complete headless runs alternate running, shops, and battles until a
terminal state, with deterministic trace replay.

### Milestone 4: Progression and v1.3 contract

- Tests first for score precedence, profile EXP transfer, strict thresholds,
  collections, achievements, persistence data, and known quirks.
- Complete the executable compatibility matrix for every confirmed mechanic.

**Exit:** All v1.3 compatibility tests pass and each confirmed research rule is
mapped to at least one test or an explicit presentation-only exclusion.

### Milestone 5: Batch simulation and baseline

- Implement CLI batches, policies, compact metrics, paired comparison, trace
  hashing, and parallel worker execution with a single-worker fallback.
- Establish reviewed seed manifests and `original-v1.3` summaries.
- Benchmark throughput and memory before choosing default worker counts.

**Exit:** One command compares two rule sets across at least 10,000 paired runs
and produces deterministic JSON/Markdown summaries plus replayable divergent
seeds. Normalized output is identical across configured worker counts.

### Milestone 6: Browser experience

- Build Canvas renderer, input adapter, screens, HUD, audio, and persistence on
  top of the completed core.
- Add Playwright functional and screenshot tests.

**Exit:** A browser run and Node run with the same seed, commands, and rule set
produce identical checkpoint states and trace hashes.

### Milestone 7: Parity calibration and enhancement gate

- Compare deterministic rule outputs with research fixtures.
- Validate presentation and unresolved behavior against a compatible Flash
  runtime where possible.
- Freeze the original v1.3 baseline before adding enhanced rules.

**Exit:** Compatibility limitations are documented, baseline results are
versioned, and enhancements can demonstrate their effects through paired batch
reports without changing the original contract.

## Definition of done for any rule change

A rule change is complete only when:

- Its failing test existed before the implementation change.
- Compatibility behavior remains available under `original-v1.3`.
- New or changed behavior has a rule-set version and evidence/decision label.
- Exact tests cover boundaries and at least one multi-system scenario.
- Deterministic replay passes in Node and, when applicable, the browser.
- Simulation comparison output explains material progression/balance changes.
- No core module imports browser APIs or performs I/O.
- Research documentation and uncertainty decisions remain synchronized.

## Deliberate non-goals for the first implementation pass

- Reproducing Adobe Flash's unknown PRNG sequence exactly.
- Optimizing simulation workers before measuring the single-process runner.
- Building a visual level editor or generalized engine.
- Adding new content or balance changes before the original-v1.3 baseline is
  frozen.
- Testing game formulas primarily through the UI.
