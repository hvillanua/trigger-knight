# Implementation TODO — Milestone Roadmap

## Purpose

This document orders the capability milestones for the clean-room browser reimplementation. It describes what each milestone must establish and why it must precede the next one. Individual tickets will be created later.

The product requirements in [`PRD.md`](PRD.md), architecture and contracts in [`TDD.md`](TDD.md), and behavioral evidence in [`../research/`](../research/README.md) remain authoritative. This roadmap does not replace them or prescribe ticket-level implementation details.

## Delivery rules

- Complete milestones in order. A later milestone may rely only on capabilities established by completed earlier milestones.
- Use dependency links between tickets when the tickets are created. A ticket is ready only when its actual blockers are complete.
- Write tickets around one meaningful outcome. Tickets state **what** must exist and **why**, with observable acceptance criteria, constraints, non-goals, required evidence, and links to the relevant PRD, TDD, and research sections. They do not prescribe **how** to implement the outcome.
- Follow test-driven development for every behavior change: establish a failing test for the intended behavior, implement the smallest passing change, then refactor while the suite remains green. Tests are part of the behavior ticket and are never deferred to a later ticket.
- Run only the smallest focused red and green checks locally. GitHub Actions is the sole complete validation gate for code-affecting changes.
- Preserve the clean-room boundary. Implementation work uses the behavioral specification and approved clean-room assets, not copied decompiled source or unapproved original artifacts.
- Keep the repository runnable, deterministic, and inspectable at the end of every milestone.

## Milestone 0 — Agent-ready repository

### Builds

A reproducible repository harness that lets an agent discover the project rules, make a small change, and receive fast, trustworthy feedback without undocumented setup.

This milestone establishes:

- a concise root `AGENTS.md` that maps the repository, sources of truth, clean-room constraints, required workflow, and validation commands;
- the initial TypeScript, Vite, Vitest, Playwright, Canvas 2D, and Node-capable project scaffold;
- the latest stable, mutually compatible dependency versions available when installation begins, followed by pinned runtime/tool versions and a committed lockfile;
- stable install, development, formatting, linting, type-checking, unit-test, browser-test, build, and aggregate validation commands;
- mandatory red-green-refactor expectations and pull-request evidence for test-driven work;
- focused local validation and a complete CI validation gate;
- CI that performs a clean install and invokes the same repository validation commands used locally;
- mechanically enforced clean-room, dependency-direction, deterministic-randomness, and generated-file boundaries;
- milestone, issue, and pull-request templates suitable for the later ticket workflow.

### Complete when

- a fresh checkout can be installed and fully validated using only documented commands;
- focused local checks provide red-green evidence without repeating the complete gate;
- CI passes from the committed lockfile and rejects representative formatting, type, test, and architectural failures;
- dependency and runtime versions used by the scaffold are recorded and reproducible;
- the repository contains a minimal passing test and production build without claiming that gameplay has been implemented.

## Milestone 1 — Browser/engine/simulator walking skeleton

### Builds

The thinnest end-to-end implementation of the TDD contracts, proving that browser play and headless execution can share one authoritative engine before gameplay complexity is added.

This milestone establishes:

- the public run configuration, state-transition, command, event, observation, presentation, policy, and simulation boundaries;
- a serializable minimal run state with ruleset identity and explicit seeded randomness state;
- one deterministic state transition developed test-first;
- a minimal Canvas presentation consuming `GameObservation` through the presentation boundary;
- a minimal headless policy and finite simulation run consuming the same engine;
- structured development/test visibility into current state and emitted events;
- browser/headless parity for the same initial state and command sequence.

### Complete when

- the browser and simulator demonstrably call the same gameplay implementation;
- browser presentation and ordinary player policies receive the same public observation and event sequence;
- identical inputs reproduce identical state and result hashes;
- a non-progressing policy terminates at its configured step limit;
- the minimal state can be serialized, restored, and advanced without changing its outcome;
- presentation code can be replaced or disabled without changing the domain result.

## Milestone 2 — Original ruleset, time, and run lifecycle

### Builds

The deterministic foundation of an `original-v1.3` run, including the frame-based rules on which all later encounters and combat depend.

This milestone establishes:

- versioned ruleset ownership of original gameplay constants and compatibility decisions;
- an explicit ruleset registry, valid with one entry, that maps every accepted identity to its implementation and rejects unsupported identities;
- deterministic seeded randomness suitable for browser and headless replay;
- fixed 30 Hz logical opportunities and the distinction between elapsed steps and active gameplay ticks;
- running, paused, tutorial-gated, and ended lifecycle behavior;
- movement acceleration, abstract world position, distance, day, running score, and lifespan progression;
- lifespan death and its terminal result;
- the original coordinate scale as abstract world units and an initial 480x320-world-unit camera independent of physical resolution.

### Complete when

- a test-driven no-action run advances through the lifecycle and ends at the researched lifespan boundary;
- pause and tutorial gates freeze the correct active systems without preventing later commands;
- browser render cadence and physical viewport size cannot change the run outcome;
- checkpoint replay matches uninterrupted execution across supported runtimes.

The integrated Node and Chromium evidence, locked hashes, research labels, and
clean-room decisions are recorded in
[`../docs/milestone-2-lifecycle-verification.md`](../docs/milestone-2-lifecycle-verification.md).

## Milestone 3 — Encounter queue, shops, and economy

### Builds

The complete non-combat encounter loop so deterministic runs can generate, approach, interact with, and leave every shop type.

This milestone establishes:

- the three-entry encounter queue and current-encounter lifecycle;
- deterministic encounter generation, spacing, duplicate rules, battle placement, and forced-shrine behavior;
- mechanic-bearing world positions and action windows;
- gold, cached prices, purchases, equipment tiers, max-tier equipment
  ineligibility, inventory replacement, and lifespan restoration;
- original-v1.3 economy quirks that are observable in the researched behavior;
- public observations and events sufficient for browser controls and automated purchasing policies.

### Complete when

- deterministic headless policies can encounter and purchase every shop, equipment upgrade, and item reachable before combat;
- focused deterministic state-transition scenarios cover later-day, higher-cost, and post-battle-dependent shop and economy behavior until Milestone 4 supplies battle resolution and rewards;
- queue, inventory, tier, price, and gold invariants hold across a fixed seed set;
- known cached-price, max-tier equipment availability, and forced-shrine
  behaviors have compatibility coverage;
- the browser can issue the same semantic purchase commands without owning purchase rules.

## Milestone 4 — Combat, enemies, items, and rewards

### Builds

The battle portion of the gameplay loop, allowing complete runs to alternate between running, shopping, and combat until death.

This milestone establishes:

- ordinary enemy and Dragon selection and scaling;
- actor idle, movement, attack, flinch, and death states;
- mechanic-bearing attack hit and finish timing at logical ticks;
- damage, critical hits, attack delays, knockback, HP, and combat death;
- battle-only item use and its exact effects;
- enemy fade completion, rewards, score, profile EXP earnings, and Dragon hooks;
- separation between authoritative combat events and interpolated visual animation.

### Complete when

- complete deterministic runs can reach shops and battles repeatedly, earn and spend rewards, and terminate from either lifespan or combat death;
- deterministic purchasing policies extend the Milestone 3 scenarios through every shop, equipment upgrade, and item in continuously generated runs;
- all enemies, the Dragon, and every item are exercised by deterministic scenarios;
- visual animation rate cannot alter hit timing, damage, rewards, or RNG consumption;
- browser and headless executions remain state- and trace-equivalent.

## Milestone 5 — Profile progression and durable persistence

### Builds

The complete post-run and between-run progression loop while modernizing storage reliability outside gameplay compatibility.

This milestone establishes:

- profile EXP transfer, levels, multiplier, high score, collections, and achievements;
- the confirmed original formulas, thresholds, precedence, and gameplay-affecting quirks;
- a versioned browser persistence boundary with migration support;
- atomic commitment of final progression before optional score-count presentation;
- replay with an explicit initial profile independent of ambient browser storage;
- score and progression screens consuming committed results rather than controlling them.

### Complete when

- a completed run produces the expected profile result and the next run can consume it;
- closing or navigating during result animation cannot lose committed progress;
- persistence technology does not affect deterministic run outcomes;
- collection, achievement, high-score, and multi-level progression scenarios pass from clean profiles and migrated profiles.

## Milestone 6 — Original-v1.3 compatibility baseline

### Builds

An auditable executable contract for the complete researched gameplay model before any enhanced rules or new content are allowed.

This milestone establishes:

- traceability from every confirmed gameplay requirement and known gameplay-affecting quirk to executable evidence;
- explicit documented decisions for unknown or ambiguous behavior used by the implementation;
- stable ruleset, seed, profile, result, and trace fixtures for representative runs;
- a frozen `original-v1.3` compatibility baseline;
- clear separation between compatibility behavior and presentation/platform modernization.

### Complete when

- every confirmed gameplay rule is covered or explicitly classified as presentation-only;
- all implementation decisions for unresolved behavior are visible and reviewable;
- the compatibility suite passes identically in browser-capable and headless environments where applicable;
- later ruleset changes can be detected without mutating the original baseline.

## Milestone 7 — Batch simulation and ruleset comparison

### Builds

The analysis surface needed to execute many deterministic runs, compare rule or feature changes, and reproduce meaningful differences.

This milestone establishes:

- reusable versioned player policies and seed manifests;
- finite single-run and batch execution through the public simulator contract;
- compact versioned results and aggregate statistics;
- paired baseline/candidate comparison using identical inputs;
- normalized output independent of concurrency and completion order;
- replay and first-divergence diagnostics for interesting seeds;
- performance sufficient for practical Monte Carlo and regression analysis.

### Complete when

- one command can compare two rulesets across a reviewed seed and policy set;
- repeated runs produce byte-stable normalized results;
- execution strategy cannot change results;
- divergent seeds can be replayed to the first meaningful state or randomness difference;
- non-progressing policies terminate without blocking a batch.

## Milestone 8 — Complete browser play experience

### Builds

The full player-facing browser experience on top of the frozen gameplay engine, without reintroducing presentation dependencies into the domain.

This milestone establishes:

- title, gameplay, tutorial, pause, achievement/collection, score, replay, and navigation flows;
- the complete HUD, encounter information, battle feedback, action feedback, and required controls;
- clear unavailable-shop feedback driven by public action eligibility;
- responsive, high-density, fullscreen-capable Canvas presentation using the 480x320-world-unit reference camera;
- pointer, touch, keyboard, and remappable input adapters;
- display-rate visual interpolation and presentation-only transitions and effects;
- clean-room-safe visual assets with recorded provenance;
- sound effects and their controls behind the presentation boundary;
- accessible controls and readable information across representative viewport and input configurations.

Background music, music assets, playlists, transitions, and music controls remain out of scope.

### Complete when

- the complete original-v1.3 gameplay loop can be played end to end in a modern browser;
- representative desktop and mobile viewports remain usable without clipping or inaccessible actions;
- structured state, browser logs, screenshots, and traces make failures reproducible by an agent;
- the same seed and command schedule produce the same domain checkpoints in browser and headless execution;
- presentation settings and supported input devices cannot change gameplay outcomes.

## Milestone 9 — Release readiness

### Builds

A releasable initial compatibility version with known limitations documented and every product acceptance criterion demonstrated.

This milestone establishes:

- complete PRD acceptance coverage;
- supported-browser validation and production build verification;
- performance and stability checks for browser play and supported simulation workloads;
- persistence migration, failure recovery, and corrupted-data behavior;
- accessibility and responsive-presentation review;
- deployment and release documentation;
- documented compatibility limitations, deferred behavior, and future extension points;
- final confirmation that original artifacts and implementation outputs remain inside their intended boundaries.

### Complete when

- every PRD acceptance criterion has reproducible evidence;
- focused local evidence and the complete CI gate pass from a clean checkout;
- a release build can be produced and exercised using documented commands;
- no unresolved issue blocks the declared compatibility scope;
- deferred work, including background music and any enhanced rulesets, remains clearly outside the initial release.

## Milestone completion rule

A milestone is complete only when all of its eventual tickets and blockers are complete, its exit conditions have reproducible evidence, focused local checks and the complete CI validation gate pass, and the repository documentation reflects the delivered behavior. A milestone may not pass known failures or architectural decisions forward implicitly; any intentional deferral must be visible and assigned to a later milestone before completion.
