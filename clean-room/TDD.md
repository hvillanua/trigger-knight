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

- **Browser presentation:** Canvas rendering, animation interpolation, HUD, screens, pointer/keyboard input, and sound effects. Background music is deferred.
- **Persistence adapter:** browser-local profile/settings storage and migrations.
- **Simulation tooling:** automated policies, batch orchestration, metrics, comparisons, CLI/reporting.

## 4. Core execution API

The core advances in discrete 30 Hz logical ticks, matching the researched game timing. Wall-clock time may control how often the browser asks for ticks, but it must never alter the result of a tick.

```ts
interface RunConfig {
  ruleset: RuleSetId;
  seed: string;
  initialProfile: ProfileState;
}

interface RunOptions {
  maxSteps: number;
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

Commands express gameplay intent (`buy`, `useItem`, `pause`, `dismissTutorial`) rather than screen coordinates. Domain events describe observable results such as encounter changes, damage, purchases, rewards, achievements, and death.

`RunState`, including RNG state, must be serializable so a run can be checkpointed and replayed exactly.

Every headless `run()` call requires a positive finite `maxSteps`. The runner consumes one step from this budget for every `step()` invocation, including invocations during pause or tutorial gates where active gameplay does not advance. Reaching the budget returns a normal result with terminal reason `step-limit`. This runner-level budget is deliberately distinct from active gameplay ticks, so a policy that pauses forever, never dismisses a tutorial, or otherwise makes no progress cannot block a batch worker or CI job indefinitely.

## 5. Compatibility and modernization boundary

The compatibility target is the gameplay model, not the limitations of the Flash container. Presentation adapters may modernize freely provided that the same initial state, seed, and command sequence produce the same domain result.

| Concern | Preserve as gameplay behavior | Abstract or modernize in adapters |
|---|---|---|
| Time | Fixed 30 Hz logical steps; active-tick lifespan, movement, score, delays, combat hit/finish points, pause and tutorial gating | Render with `requestAnimationFrame` at any refresh rate and interpolate visuals; do not advance gameplay from render-frame counts or animation callbacks |
| Space | Abstract world units using the original coordinate scale for `original-v1.3`, plus mechanic-bearing thresholds such as encounter positions, movement distances, and purchase windows | A camera initially showing 480x320 world units; responsive CSS size, device-pixel-ratio backing resolution, fullscreen, letterboxing/layout, and camera transforms |
| Animation | Domain emits mechanic-bearing events at the required logical tick | Menu motion, transitions, parallax treatment, particles, damage numbers, fades, and other visual-only timing |
| Input | Commands and their domain eligibility, including whether a shop or item can currently be used | Mouse, pointer, touch, keyboard, remapping, larger accessible hit targets, and gamepad later; all map to the same commands |
| HUD and screens | Gameplay-relevant values, available actions, pause/tutorial behavior, and final progression result | Responsive arrangement, typography, accessibility semantics, navigation, and visual styling; the SWF's ten-frame main timeline is not an application architecture |
| Audio | Domain events expose gameplay outcomes without naming files, codecs, or playback operations | An audio port maps relevant events to sound-effect cues; Web Audio/HTML media implementation, codecs, latency, mixing, SFX level, and focus behavior remain replaceable; background music is deferred |
| Persistence | Versioned profile meaning, progression formulas, collections, achievements, settings, migrations, and deterministic initial profile input | `localStorage` or IndexedDB instead of `SharedObject`; commit final progression atomically before optional score/EXP count-up animation |
| Host integration | Nothing is required by the gameplay domain | Remove Flash preload mechanics, portal site locks, Kongregate/Newgrounds APIs, store/more-games links, and legacy share actions; add modern integrations only from a separate adapter when justified |
| Cosmetic randomness | No cosmetic draw may perturb domain RNG state or deterministic trace hashes | Use a separate presentation RNG or nondeterministic effects for cosmetic motion and particles |

The original coordinate values become world units without conversion: for example, an encounter can still enter at world `x=600`, become actionable below world `x=420`, and move by the researched number of world units per active tick. World space is not bounded to the visible viewport; `x=600` is valid even though the initial camera shows world `x=0..480`. The numbers belong to the ruleset and are not CSS or backing-store pixels.

The initial camera viewport covers 480x320 world units, but the output bitmap is unrestricted. A renderer may keep a 3:2 game viewport, rearrange surrounding controls at narrow sizes, or render at higher resolution. Pointer positions are transformed through the inverse camera projection before the adapter identifies an intended action, while the domain remains authoritative for whether that action is valid.

### Canvas viewport adapter

The selected browser stack supplies the platform primitives, while a small adapter owns the policy:

- `ResizeObserver` measures the available CSS viewport and `devicePixelRatio` selects a sharp Canvas backing-store size;
- a contain-fit camera computes scale and letterbox offsets from the 480x320-world-unit reference viewport;
- the Canvas 2D transform projects world coordinates to backing pixels, and its inverse maps pointer coordinates back to world space;
- `requestAnimationFrame` supplies render opportunities, while a fixed-step accumulator independently requests 30 Hz domain steps and computes an interpolation fraction;
- render snapshots interpolate only visual transforms; the current authoritative state supplies HUD values and action eligibility;
- Vitest covers camera/inverse-camera math and tick-rate invariance, while Playwright covers representative viewport sizes and device pixel ratios.

Canvas 2D does not provide the fixed-step loop or state interpolation automatically; those are small application adapters rather than domain concerns. Vite provides the browser build and development loop, not game timing. If the presentation later moves to PixiJS or Phaser, the world-unit, camera, command, and domain-event contracts remain unchanged.

### Audio extension point

The initial browser adapter implements sound effects only. It maps domain events and UI actions to semantic cues through a small presentation-layer audio port; the domain never emits file paths or playback commands. No background-music assets, player, sequencing, fades, or music settings are required initially.

A future music controller can observe application lifecycle and screen changes, own its playlist and transitions, and use the same browser audio infrastructure without changing the domain API, deterministic state, or trace hashes. Until that work is selected, no placeholder music state is added to `RunState` or `RuleSet`.

Browser scheduling must not turn a high-refresh display into faster gameplay. The adapter accumulates time and requests 30 Hz logical steps independently of rendering. It must also apply an explicit visibility/suspension policy rather than replaying an unbounded backlog after a tab was hidden; that policy affects browser scheduling only and cannot change `step()` semantics.

Combat sprites may be redrawn, resampled, or interpolated, but damage and attack completion stay tied to their compatibility tick offsets in the domain. Conversely, pregame/post-death waits, score-count animations, menu tweens, visual fades, and similar non-interactive presentation delays may be shortened, skipped, or made accessibility-aware once any associated state has already been committed.

## 6. Randomness and reproducibility

Do not use `Math.random()` inside the domain.

Use a small explicit seeded PRNG with stable integer behavior across Node and browsers. The initial choice is **xoshiro128\*\*** with a documented 128-bit seed expansion because it has compact state, good statistical quality for this use case, and can be implemented entirely with deterministic 32-bit integer operations in JavaScript.

The original Flash PRNG sequence is unknown, so the compatibility target is the confirmed random ranges, probabilities, and draw order—not identical Adobe Flash seed sequences.

Every random draw should have an optional semantic context (`shop-type`, `dragon-roll`, `damage-roll`, `attack-delay`, etc.) for diagnostic traces. Tests must also support scripted random values for exact boundary scenarios.

## 7. Monte Carlo and headless simulation

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
- steps executed, active gameplay ticks, and run duration;
- score;
- final day and distance;
- gold;
- terminal reason (`lifespan`, `combat`, or `step-limit`);
- enemies/dragons encountered and killed;
- purchase/item-use counts;
- selected progression metrics;
- deterministic trace/result hash.

For rule or feature changes, baseline and candidate rulesets should normally be evaluated with the same seed set and policy so per-seed deltas can be compared directly.

Reports should provide aggregate statistics such as mean, median, percentiles, spread, terminal-reason mix, and largest divergent seeds. Detailed traces remain opt-in and are used to replay interesting failures or balance changes.

Use Node `worker_threads` to parallelize large batches only above the domain layer. A single-thread execution path remains authoritative for debugging, and normalized output must not depend on worker count or completion order.

## 8. Technology choices considered

| Option | Advantages | Drawbacks | Decision |
|---|---|---|---|
| **TypeScript pure core + Canvas 2D + Vite/Vitest/Playwright** | One language in browser and Node; direct headless execution; minimal runtime; easy deterministic tests; simple deployment | More rendering code must be written directly | **Selected** |
| TypeScript pure core + Phaser or PixiJS presentation | Better sprite/animation tooling; useful if presentation grows substantially | More dependency/runtime surface; Phaser can encourage gameplay/UI coupling; unnecessary for the current fixed 2D scene | Keep as renderer-adapter upgrade path |
| Rust core compiled to WebAssembly + TypeScript UI | High simulation throughput; strong type/control over numeric behavior | Extra language/toolchain, WASM boundary and serialization complexity, slower iteration for a small project | Not justified initially |
| Godot/Unity web export | Rich editor, animation and asset workflows | Larger browser runtime; awkward Node/headless API; harder to keep the authoritative rules engine independent and cheaply batchable | Rejected for this project |

### Why the selected combination

The game is mechanically small but rule-dense. The main technical risk is behavioral correctness and future balance analysis, not high-end rendering.

A pure TypeScript core therefore gives the shortest path between researched rules, executable tests, the browser, and headless simulations. Canvas 2D is sufficient for a responsive renderer using the original coordinate scale and an initial 480x320-world-unit camera, and it keeps rendering replaceable. Its backing surface should follow CSS size and device pixel ratio rather than remaining a 480x320 physical bitmap. If visual requirements later exceed Canvas ergonomics, PixiJS or Phaser can be introduced behind the presentation boundary without changing the gameplay domain.

## 9. Toolchain

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

## 10. Testing strategy

- **Formula/unit tests:** exact formulas and boundaries from `research/mechanics.md`.
- **Compatibility characterization tests:** every confirmed original rule and known quirk that affects gameplay.
- **Scenario tests:** scripted RNG plus commands across encounters, purchases, battles, rewards, items, dragon behavior, and death.
- **Determinism tests:** identical complete inputs produce identical states, results, and trace hashes; checkpoint replay matches uninterrupted execution.
- **Simulation regression:** stable seed manifests and policies detect emergent balance/progression changes; a non-progressing policy terminates at the configured step limit.
- **Browser adapter tests:** confirm input mapping, responsive/HiDPI rendering, persistence, and browser/headless state parity across different viewport sizes and render refresh rates without duplicating domain formula tests.
- **Presentation-boundary tests:** visual-only animation and cosmetic randomness cannot consume domain RNG or trigger domain transitions; final progression is durable before score-count animation completes.

Unknown original behavior must be labeled as an explicit design decision before it becomes a compatibility expectation.

## 11. Evolution rules

- `original-v1.3` domain behavior remains immutable once the compatibility baseline is established; renderer, device, storage technology, and host integration are not part of that ruleset identity.
- Later fixes or balance changes use new ruleset identifiers.
- Domain changes must remain exercisable through the headless API.
- Presentation changes must not alter domain results.
- Physical resolution, render refresh rate, accessibility settings, and input adapter must not become ruleset inputs.
- Simulation metrics and baseline policies are versioned when their meaning changes.
- Add a heavier renderer, property-testing library, database, backend, or additional language only after a concrete requirement justifies it.
