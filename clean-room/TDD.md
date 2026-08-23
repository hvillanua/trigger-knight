# Technical Design Document — Trigger Knight Browser Reimplementation

## 1. Design goals

The implementation must have one authoritative gameplay engine that:

- reproduces the versioned Trigger Knight rules;
- runs identically with or without the browser UI;
- is deterministic and replayable;
- can execute large numbers of runs programmatically;
- keeps rendering, audio, persistence, and input outside gameplay logic;
- remains easy to extend without turning the project into a generalized game engine.

The design uses DDD selectively: domain language and boundaries should match the game, but the code remains a single modular application rather than a collection of services.

## 2. Selected architecture

Use a **TypeScript modular monolith** with a pure deterministic domain core and separate adapters for browser presentation and batch simulation.

```text
                         +----------------------+
                         |   Browser adapters   |
                         | render/input/audio   |
                         | persistence/scaling  |
                         +----------+-----------+
                                    |
                              commands/events
                                    |
+-------------------+      +--------v---------+
| Headless runners  |----->| Application API  |
| policies/batches  |      | create/step/run  |
+-------------------+      +--------+---------+
                                    |
                         +----------v-----------+
                         |    Gameplay domain   |
                         | Run aggregate        |
                         | encounters/combat    |
                         | economy/progression  |
                         +----------+-----------+
                                    |
                         +----------v-----------+
                         | RuleSet + seeded RNG |
                         +----------------------+
```

The browser and simulation tooling must call the same application/domain API. There is no simplified simulation implementation.

## 3. Domain model and boundaries

### Run aggregate

`Run` is the aggregate root for one playthrough. It owns authoritative run state and coordinates gameplay transitions.

Representative state includes:

- lifecycle state: running, battle, paused/tutorial-gated, ended;
- tick, distance, day, score, lifespan, gold;
- hero equipment, HP, inventory, and combat state;
- encounter queue and current encounter;
- enemy and battle state;
- per-run progression and achievement state;
- ruleset identity and RNG state.

### Domain modules

Use game-oriented modules rather than enterprise-style service boundaries:

- **Run** — lifecycle, fixed-tick progression, movement, lifespan, score, death;
- **Encounters** — queue generation, shops, enemies, dragon eligibility;
- **Combat** — actor state machine, attack timing, damage, items, rewards;
- **Economy** — gold, prices, purchases, equipment and inventory;
- **Progression** — profile EXP, collections, achievements, high score;
- **Rules** — versioned constants, formulas, compatibility switches;
- **Randomness** — deterministic random state and semantic draw contexts.

These are logical domain boundaries inside one package. They should depend on shared domain types and rules, not on browser or filesystem code.

### Outside the domain

- **Browser presentation:** Canvas rendering, animation interpolation, HUD, screens, pointer/keyboard input, audio.
- **Persistence adapter:** browser-local profile/settings storage and migrations.
- **Simulation tooling:** automated policies, batch orchestration, metrics, comparisons, CLI/reporting.

## 4. Core execution API

The core advances in discrete 30 Hz logical ticks, matching the researched game timing. Wall-clock time may control how often the browser asks for ticks, but it must never alter the result of a tick.

```ts
interface RunConfig {
  ruleset: RuleSetId;
  seed: string;
  initialProfile: ProfileState;
  maxTicks?: number;
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
): RunResult;
```

Commands express gameplay intent (`buy`, `useItem`, `pause`, `dismissTutorial`) rather than screen coordinates. Domain events describe observable results such as encounter changes, damage, purchases, rewards, achievements, and death.

`RunState`, including RNG state, must be serializable so a run can be checkpointed and replayed exactly.

## 5. Randomness and reproducibility

Do not use `Math.random()` inside the domain.

Use a small explicit seeded PRNG with stable integer behavior across Node and browsers. The initial choice is **xoshiro128\*\*** with a documented 128-bit seed expansion because it has compact state, good statistical quality for this use case, and can be implemented entirely with deterministic 32-bit integer operations in JavaScript.

The original Flash PRNG sequence is unknown, so the compatibility target is the confirmed random ranges, probabilities, and draw order—not identical Adobe Flash seed sequences.

Every random draw should have an optional semantic context (`shop-type`, `dragon-roll`, `damage-roll`, `attack-delay`, etc.) for diagnostic traces. Tests must also support scripted random values for exact boundary scenarios.

## 6. Monte Carlo and headless simulation

Simulation is an application-layer consumer of the gameplay API.

A `PlayerPolicy` converts public game observations into commands:

```ts
interface PlayerPolicy {
  readonly id: string;
  decide(observation: Observation): readonly GameCommand[];
}
```

Initial reusable policies should include at least:

- no actions;
- buy affordable upgrades/items;
- survival-oriented purchasing;
- damage-oriented purchasing;
- scripted scenario policy.

A batch runner must be able to execute a configurable number of seeded runs without creating a browser or renderer. Each run produces a compact result record including at least:

- seed and ruleset;
- survival ticks/run duration;
- score;
- final day and distance;
- gold;
- terminal reason;
- enemies/dragons encountered and killed;
- purchase/item-use counts;
- selected progression metrics;
- deterministic trace/result hash.

For rule or feature changes, baseline and candidate rulesets should normally be evaluated with the same seed set and policy so per-seed deltas can be compared directly.

Reports should provide aggregate statistics such as mean, median, percentiles, spread, terminal-reason mix, and largest divergent seeds. Detailed traces remain opt-in and are used to replay interesting failures or balance changes.

Use Node `worker_threads` to parallelize large batches only above the domain layer. A single-thread execution path remains authoritative for debugging, and normalized output must not depend on worker count or completion order.

## 7. Technology choices considered

| Option | Advantages | Drawbacks | Decision |
|---|---|---|---|
| **TypeScript pure core + Canvas 2D + Vite/Vitest/Playwright** | One language in browser and Node; direct headless execution; minimal runtime; easy deterministic tests; simple deployment | More rendering code must be written directly | **Selected** |
| TypeScript pure core + Phaser or PixiJS presentation | Better sprite/animation tooling; useful if presentation grows substantially | More dependency/runtime surface; Phaser can encourage gameplay/UI coupling; unnecessary for the current fixed 2D scene | Keep as renderer-adapter upgrade path |
| Rust core compiled to WebAssembly + TypeScript UI | High simulation throughput; strong type/control over numeric behavior | Extra language/toolchain, WASM boundary and serialization complexity, slower iteration for a small project | Not justified initially |
| Godot/Unity web export | Rich editor, animation and asset workflows | Larger browser runtime; awkward Node/headless API; harder to keep the authoritative rules engine independent and cheaply batchable | Rejected for this project |

### Why the selected combination

The game is mechanically small but rule-dense. The main technical risk is behavioral correctness and future balance analysis, not high-end rendering.

A pure TypeScript core therefore gives the shortest path between researched rules, executable tests, the browser, and headless simulations. Canvas 2D is sufficient for the original 480x320 presentation and keeps rendering replaceable. If visual requirements later exceed Canvas ergonomics, PixiJS or Phaser can be introduced behind the presentation boundary without changing the gameplay domain.

## 8. Toolchain

Selected initial stack:

- **TypeScript** — domain, simulation, browser adapters;
- **Vite** — browser development/build;
- **Vitest** — unit, compatibility, scenario, deterministic simulation tests;
- **Canvas 2D** — initial renderer;
- **Playwright** — thin browser integration and visual/input smoke tests;
- **Node.js worker_threads** — parallel batch execution;
- no frontend framework initially.

Suggested structure:

```text
clean-room/
  src/
    domain/
      run/
      encounters/
      combat/
      economy/
      progression/
      rules/
      randomness/
    application/
      game-api/
      policies/
      simulation/
    adapters/
      browser/
      persistence/
      cli/
  tests/
    unit/
    compatibility/
    scenarios/
    simulation/
    browser/
  baselines/
```

Dependency direction is always inward: adapters -> application -> domain. Domain code must not import browser, Node filesystem, renderer, audio, persistence, or worker APIs.

## 9. Testing strategy

- **Formula/unit tests:** exact formulas and boundaries from `research/mechanics.md`.
- **Compatibility characterization tests:** every confirmed original rule and known quirk that affects gameplay.
- **Scenario tests:** scripted RNG plus commands across encounters, purchases, battles, rewards, items, dragon behavior, and death.
- **Determinism tests:** identical complete inputs produce identical states, results, and trace hashes; checkpoint replay matches uninterrupted execution.
- **Simulation regression:** stable seed manifests and policies detect emergent balance/progression changes.
- **Browser adapter tests:** confirm input mapping, rendering integration, persistence, and browser/headless state parity without duplicating domain formula tests.

Unknown original behavior must be labeled as an explicit design decision before it becomes a compatibility expectation.

## 10. Evolution rules

- `original-v1.3` remains immutable once the compatibility baseline is established.
- Later fixes or balance changes use new ruleset identifiers.
- Domain changes must remain exercisable through the headless API.
- Presentation changes must not alter domain results.
- Simulation metrics and baseline policies are versioned when their meaning changes.
- Add a heavier renderer, property-testing library, database, backend, or additional language only after a concrete requirement justifies it.
