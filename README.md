# Trigger Knight browser reimplementation and research archive

This project preserves Trigger Knight v1.3 by Mintsphere and builds a browser
reimplementation using TypeScript, Vite, and Canvas 2D. Gameplay and domain
logic are reconstructed clean-room from behavioral evidence; the browser
presentation uses the original game assets where available, including the
reviewed font exports now staged under `src/assets/original/fonts/`.

## Run locally

With the repository's pinned Node.js and npm versions installed:

```sh
npm ci
npm run setup:browser
npm run dev
```

On a fresh Linux host that needs Chromium system dependencies, use
`npm run setup:browser -- --with-deps` for the browser setup step.

## Validation

Run commands from the repository root:

| Purpose                        | Command                      |
| ------------------------------ | ---------------------------- |
| Apply formatting               | `npm run format`             |
| Check formatting               | `npm run format:check`       |
| Lint                           | `npm run lint`               |
| Check architecture and imports | `npm run check:architecture` |
| Type-check                     | `npm run typecheck`          |
| Run unit tests                 | `npm run test:unit`          |
| Run browser tests              | `npm run test:browser`       |
| Build production output        | `npm run build`              |

Pass a test path after `--` to run focused tests. `npm ci` activates one
repository-owned Git hook: `.githooks/pre-push`, which runs the complete
validation gate before pushing code-affecting changes. Documentation-only pushes
skip code validation, and new branches use the complete gate because their
remote comparison is not yet known. There is no repository-owned commit hook or
other validation hook. Re-run `npm run setup:hooks` if local Git configuration
is replaced after installation. GitHub Actions is intentionally disabled and is
not a merge gate.

For the architecture and validation-runner tooling tests, use this focused
command:

```sh
npm run test:unit -- tests/unit/architecture-boundaries.test.ts tests/unit/validation-runner.test.ts --maxWorkers=1
```

These tests run checker cases in-process and keep representative CLI smoke
coverage. The production architecture command and the complete pre-push gate
remain enabled. See the [tooling test measurements](docs/test-performance.md#tooling-test-startup-measurement)
for the before-and-after process counts and timings.

Local test runs use at most four workers and at most half the available CPU
parallelism. Override Vitest with `VITEST_MAX_WORKERS` or
`npm run test:unit -- --maxWorkers=2`. Override Playwright with
`PLAYWRIGHT_WORKERS` or `npm run test:browser -- --workers=2`; Playwright also
accepts percentages such as `50%`. With `CI` set, Playwright defaults to `50%`
without the local cap. Vitest keeps its cap unless overridden. Choose higher
counts on dedicated runners only when their measurements show a benefit.
See the [test performance investigation](docs/test-performance.md) for measured
tradeoffs and the checkpoint transport change.

The default browser compatibility check replays every retained fixture with full
checkpoint comparison in the reference viewport. It uses the five-step gated
fixture for the responsive and device-pixel-ratio probe, while the unit corpus
continues to replay every fixture and checkpoint. Run the full two-variant
browser replay when reviewing compatibility changes:

```sh
TRIGGER_KNIGHT_FULL_COMPATIBILITY=1 npm run test:browser -- tests/browser/milestone-6-compatibility-corpus.spec.ts
```

The Milestone 4 browser check runs the lifespan policy to completion once. Its
combat policy probe stops after 3,000 steps, after tutorial dismissal, shop
purchase, battle start, reward, and item-use transitions, and compares every
checkpoint across two viewport, DPR, render-cadence, and redraw settings. The
full combat-death run remains in the compatibility corpus. For the focused
checks used by issue #136, run:

```sh
npm run test:unit -- tests/unit/milestone-4-combat-loop.test.ts tests/unit/combat-policy-runs.test.ts tests/unit/milestone-6-compatibility-corpus.test.ts --maxWorkers=1
npm run test:browser -- tests/browser/milestone-4-combat-loop.spec.ts --workers=1
npm run test:browser -- tests/browser/milestone-6-compatibility-corpus.spec.ts --workers=1
```

## Simulation and diagnostics

Call `createSimulationRunner` with an engine, run configuration, policy, and
finite `maxSteps`. Supply its optional `onTrace` callback to retain diagnostics.

Use `createFreshProfile()` from `src/domain/profile.ts` for new run inputs.
`normalizeProfile()` validates and copies a supplied profile into immutable
progression state. Earlier minimal run configurations receive fresh progression
defaults while retaining their explicit multiplier and tutorial preference.
These configurations are not historical browser saves. Unknown versions and
unsupported fields are rejected rather than discarded.

Simulation fingerprints retain the supplied profile version and every accepted
field. Property order does not affect identity. A minimal input and its expanded
profile have distinct input identities, even when their gameplay is equivalent.
Keep the original input with recorded results to reproduce their fingerprints.

Use `createCombatPolicy()` for continuous shopping and combat runs. It buys
eligible shops and uses battle items, saving Elixir until HP reaches the
configured `elixirHpFraction`. Results retain the policy identity and normalized
configuration.

### Run retained simulations

The headless command accepts JSON files or `-` for standard input:

`npm run simulate` first runs the incremental `build:simulation` TypeScript
build. It writes the NodeNext output to ignored `dist/simulation/`, so the
command runs the compiled gameplay and simulation modules without starting
Vite. The checked-in `build/run-simulation.mjs` entry point can also be called
directly after `npm run build:simulation`.

```sh
npm run simulate -- single tests/fixtures/simulation/minimal-request.json
npm run simulate -- batch tests/fixtures/simulation/manifest.json
```

A single request contains `config`, a policy descriptor, and a positive
`maxSteps`. A batch manifest has `schemaVersion: 1` and a `requests` array. The
config keeps the exact minimal or expanded `initialProfile` input. The existing
manifest policy identities are `non-progressing@1`,
`purchase-reachable-shops@2`, and `combat-shopper@1` with an explicit
`elixirHpFraction` configuration.

Batch output retains the manifest and links each result to its request with
`requestIndex` and a canonical request fingerprint. Results are sorted by that
fingerprint, so completion order cannot change the export. The command writes
one canonical JSON document to standard output and sends failures to standard
error. It does not include timings, progress messages, or full diagnostic
traces.

Run results use schema version 3 and carry a fixed `metrics` object. The metrics
count promoted shops and battles, completed purchases, combat hits and damage,
battle rewards, equipment and achievement discoveries, and the authoritative
profile EXP and Dragon-kill totals. Metric names are versioned by the result
schema. Report statistics round sums and means to six decimal places and use
zero, with null minimum and maximum, for an empty input.

### Compare retained simulations

Compare two retained manifests with:

```sh
npm run simulate -- compare tests/fixtures/simulation/comparison.json
```

The comparison input has `schemaVersion: 1`, `baseline`, `candidate`, and a
`policyComparison` value of `same-policy` or `allow-different`. Each side uses
the normal manifest format, so the candidate ruleset is selected by its own
request configs. Pairs require the same seed, exact initial-profile input,
policy descriptor, and positive step limit. `allow-different` explicitly omits
the policy descriptor from that pairing key. Missing or duplicate pairs fail.

The output includes a versioned report for each side, per-pair deltas, and
aggregate delta statistics. Step-limit runs are counted as truncated and are
excluded from completed-run progression statistics. A ruleset or trace-hash
change by itself is retained as an identifier but does not count as gameplay
divergence. Pair request fingerprints and indices identify the retained inputs
needed for replay. The frozen original-v1.3 corpus retains its v2 result and
trace evidence; current result schema 3 adds metrics without changing those
gameplay identities.

### Run the simulation benchmark

Run the checked-in workload with:

```sh
npm run simulate -- benchmark tests/fixtures/simulation/benchmark.json
```

The benchmark config declares two seed sets, minimal and expanded profiles,
the purchase, combat, and non-progressing policies, 512-step progressing runs,
128-step finite runs, two checked repetitions, comparisons, and batch sizes of
1 and 2. It currently supports the sequential strategy only. Parallel workers
remain optional because the declared sequential target is the supported
workload contract.

The config requires at least 10 runs per second and at most 80 MB of observed
heap growth across the complete workload, including comparisons. The command
uses explicit garbage collection between memory samples when the host exposes
it. The throughput floor is one third of the initial 512-step sequential
measurement. The heap ceiling covers the measured workload while rejecting
accidental retention of per-step traces. A missed target makes the command exit
nonzero.

Benchmark output keeps deterministic result and comparison fingerprints under
`deterministic`. Timing samples and the Node host description are separate
fields, so changing machines cannot change the identities of the simulation
results. Identical-input comparison pairs also report trace-identity
mismatches, which fail the benchmark even when their numeric outcomes match.
Ordinary benchmark batches do not retain diagnostic checkpoints. To inspect a
selected case, retain its batch export and use the `replay` command described
above.

Normal browser play advances automatically. Controls queue commands in activation
order for the next logical opportunity; rendering never adds gameplay steps.
Pause and tutorial gates keep receiving logical opportunities so their controls
can resume the run. Hiding the page or leaving gameplay clears queued input and
elapsed host time. Returning starts a fresh timing interval. Long frame gaps also
discard elapsed time and queued input; see `src/browser/gameplay-clock.ts` for the
host limits. These are browser presentation decisions, not original Flash behavior.

For deterministic manual browser tests, open `/?manual=1` on the development
server. This enables the Advance run control and immediate single-step command
dispatch. Production builds always use automatic scheduling.

The application shell provides an Enter fullscreen control when the host
supports the Fullscreen API. You can enter fullscreen from the gameplay,
result, menu, player-status, and settings screens. Fullscreen remains active
while the player moves between those screens. The shell-level Exit fullscreen
control and the browser's Escape key leave fullscreen. Entry, exit, denied
requests, and unsupported hosts are reported beside the control. Changing the
presentation size does not change the 480 by 320 world camera. The browser honors
`prefers-reduced-motion` by removing
optional world effects, interpolation, and result counting animation while
leaving logical timing, action eligibility, and committed results unchanged.
For deterministic development replays, `/?manual=1&seed=<seed>` selects the
first run seed in a development build only; production builds ignore this query
parameter.

Playwright is configured to retain a screenshot, error context, and trace for
each local failure under `test-results/`. The trace includes browser console and
page-error diagnostics and can be opened with `npx playwright show-trace`.

Screenshots attached by the browser visual-fidelity, world-presentation, and
session-over tests are human-review artifacts. They are not automated visual
regression guarantees. The world-presentation suite adds one fixed automated
visual probe for the initial frame. It uses the manual clock, a fixed 480 by
320 viewport at DPR 1, loaded original assets and fonts, and reduced motion
before checking six small canvas regions for the expected scene, hero, HUD, and
lifespan pixels. This keeps the visual check bounded and does not claim
pixel-identical Flash output.

`BrowserGameplaySessionOptions.onTransition` receives every step's public
observation and ordered events once, including steps between displayed frames.
Use it for event-driven consumers. Repeated `PresentationFrame` renders retain
the latest transition's events; they are not new event notifications. The existing
`observation.steps` identifies transitions within a session. Each new session
starts a fresh sequence. Automatic hosts disable dispatch-time rendering and
call `render` at display cadence.

For a development browser session that needs the complete gameplay trace, add
`diagnostics=1`, for example `/?manual=1&diagnostics=1`, then call
`window.triggerKnightDiagnostics.read()` in the console. Ordinary development
sessions do not retain historical checkpoints. This hook is absent from
production builds. Browser sessions also provide `readDiagnostics()` when
diagnostics were requested. `compareGameplayTraces` reports the first differing
execution field.

### Replay retained simulations

Replay a selected case from a retained batch export with:

```sh
npm run simulate -- replay tests/fixtures/simulation/replay-case.json
```

A replay input has `schemaVersion: 1`, `mode: "case"`, an `experiment` batch
export, and its `requestIndex`. The command reruns that request from its
retained initial profile and creates a fresh policy agent. It reports the
recorded and replayed results, whether their result and trace identities match,
and the hash of the newly retained host diagnostic trace.

Use `mode: "pair"` with `baseline`, `candidate`, their selected request indices,
and `policyComparison` set to `"same-policy"` or the explicit
`"allow-different"`. The selected requests must have the same seed, exact
initial-profile input, and step limit. Pair diagnostics compare their shared
checkpoint prefix and report the first command, authoritative state, public
observation or event, RNG, or termination difference. Ruleset labels are
reported as identity differences and do not count as behavioral differences by
themselves. Full state and randomness values exist only in this host diagnostic
path. A missing field is represented as `{ "kind": "missing" }` so the
diagnostic remains canonical JSON. Ordinary batch execution does not retain
replay histories.

The browser entry point loads its initial profile through
`createBrowserProfileStore(window.localStorage)`. An empty store returns fresh
defaults. A valid current record or a supported older envelope returns a
complete `ProfileState`, including the supported `tutorialPreference` setting.
Storage errors are returned to the caller and the browser marks the status
element instead of replacing the stored record. The adapter currently accepts
storage-envelope versions 1, 2, and 3, which are separate from the profile
schema version. Version 3 also retains completed-run identities so a repeated
terminal notification or retry cannot settle one run twice. The minimal
`schemaVersion: 1` `RunConfig` input is not a historical browser-save format
and is rejected when it appears where a persisted complete profile is required.
Completed runs go through the application coordinator, which settles both
gameplay death paths and commits the profile before the terminal checkpoint is
presented. A save whose final commit cannot be reconciled returns an uncertain
result; load the profile before retrying so the journal can resolve to the prior
or complete new record.

Browser menu preferences are stored separately under
`trigger-knight.settings`, using settings schema version 1. They contain the
keyboard binding codes and sound mute/volume settings; volume is normalized to
the range 0 through 1. The tutorial preference remains part of the progression
record. An absent settings record uses defaults. Invalid, unsupported, or
failing settings storage is reported in the browser and never replaces the
progression record under `trigger-knight.profile`.

The gameplay screen exposes the current player status, current and queued
encounters, contextual shop or item information, and battle HP as accessible
text alongside the Canvas scene. Keyboard bindings use `KeyboardEvent.code`;
open Settings to capture a new binding, press Escape to cancel, and save only
after resolving conflicts. Pointer and touch activation on the Canvas use the
same public shop eligibility as the buttons and ignore letterboxed space.

## Original game

Copyright remains with the original rights holders. The preserved material is
retained for interoperability, behavioral research, and production asset
provenance. The runtime asset policy is:

- Use original visual and font assets from the preserved SWF or its recorded
  exports where approved.
- Use the reviewed original music and sound exports from
  `src/assets/original/sounds/`; the browser adapter maps their recorded
  symbols to the original gameplay and screen call sites.
- The current reviewed production copies live under `src/assets/original/`; do
  not import directly from the archival `original/` or `exports/` directories.
- Add neighboring provenance metadata recording the source path, artifact hash
  or export identifier, extraction details, rights or license, and review date.
- Keep decompiled ActionScript, generated behavioral research, and other
  unapproved research outputs outside production.

The Canvas presentation plays staged original character sequences in numeric
file order and scrolls original scene layers. Missing or failed images are
omitted. It does not load replacement artwork. Animation ranges and exclusions
live in `src/browser/sprite-animation.ts`; playback cadence and the death fade
are presentation choices, not confirmed original timing. The browser font roles
are also a project mapping; exact original text-field usage remains unverified.

This project policy does not transfer copyright or grant a public license. Any
distribution of original assets remains subject to the rights holder's terms.
