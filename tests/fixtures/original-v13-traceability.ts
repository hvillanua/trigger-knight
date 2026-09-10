export type TraceabilityClassification =
  | "confirmed"
  | "derived"
  | "compatibility-decision"
  | "presentation-modernization"
  | "excluded-scope"
  | "unresolved";

export type TraceabilityDisposition =
  | "covered"
  | "blocked"
  | "allowed-modernization"
  | "excluded"
  | "tracked-unknown";

export interface TraceabilityEvidence {
  readonly file: string;
  readonly test: string;
}

export interface TraceabilityEntry {
  readonly id: string;
  readonly source: string;
  readonly classification: TraceabilityClassification;
  readonly disposition: TraceabilityDisposition;
  readonly rationale: string;
  readonly evidence: readonly TraceabilityEvidence[];
  readonly blocker?: {
    readonly issue: number;
    readonly dependency: number;
  };
}

function evidence(file: string, test: string): TraceabilityEvidence {
  return Object.freeze({ file, test });
}

/**
 * This is an index of evidence, decisions, and explicit deferrals. The focused
 * tests named here establish behavior; the index test only makes omissions and
 * unclassified scope visible.
 */
export const originalV13Traceability = Object.freeze([
  {
    id: "prd.gameplay-loop",
    source: "clean-room/PRD.md#1-reproduce-the-original-gameplay-loop",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The complete run scenarios exercise running, encounters, combat, rewards, and both terminal paths.",
    evidence: [
      evidence(
        "tests/unit/milestone-4-combat-loop.test.ts",
        "Milestone 4 complete combat loop > preserves per-step invariants through $terminalReason death",
      ),
      evidence(
        "tests/unit/milestone-5-progression-persistence.test.ts",
        "Milestone 5 progression and persistence scenarios > settles a deterministic $name",
      ),
      evidence(
        "tests/unit/milestone-6-compatibility-corpus.test.ts",
        "original-v1.3 compatibility corpus > replays the retained $id result, trace, and representative checkpoints",
      ),
    ],
  },
  {
    id: "prd.shared-engine",
    source: "clean-room/PRD.md#3-separate-gameplay-behavior-from-presentation",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Contract, browser-session, and browser/headless trace tests identify one authoritative engine boundary.",
    evidence: [
      evidence(
        "tests/unit/public-contracts.test.ts",
        "public application contracts > exposes one gameplay engine boundary to browser and simulation consumers",
      ),
      evidence(
        "tests/unit/gameplay-diagnostics.test.ts",
        "gameplay diagnostics > records equal browser and headless checkpoints for one command schedule",
      ),
      evidence(
        "tests/unit/gameplay-diagnostics.test.ts",
        "gameplay diagnostics > reports a late checkpoint field before a deferred trace hash",
      ),
      evidence(
        "tests/browser/milestone-6-compatibility-corpus.spec.ts",
        "replays the retained compatibility corpus in Node and Chromium",
      ),
    ],
  },
  {
    id: "prd.reproducible-ruleset",
    source: "clean-room/PRD.md#4-preserve-reproducibility-and-compatibility",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Explicit ruleset identities, seeded draws, profile inputs, and trace hashes are asserted by focused tests.",
    evidence: [
      evidence(
        "tests/unit/rulesets.test.ts",
        "ruleset registry > owns the original-v1.3 foundation and its compatibility decisions",
      ),
      evidence(
        "tests/unit/deterministic-randomness.test.ts",
        "deterministic randomness > reproduces the versioned sequence for an equal seed",
      ),
      evidence(
        "tests/unit/simulation-runner.test.ts",
        "headless simulation runner > repeats normalized results and isolates mutable agent memory by run",
      ),
      evidence(
        "tests/unit/simulation-runner.test.ts",
        "headless simulation runner > fingerprints equivalent profile records canonically",
      ),
      evidence(
        "tests/unit/milestone-6-compatibility-corpus.test.ts",
        "original-v1.3 compatibility corpus > replays the retained $id result, trace, and representative checkpoints",
      ),
      evidence(
        "tests/browser/milestone-6-compatibility-corpus.spec.ts",
        "replays the retained compatibility corpus in Node and Chromium",
      ),
    ],
  },
  {
    id: "tdd.public-contracts",
    source: "clean-room/TDD.md#3-public-contracts",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The public observation, event, command, presentation, and policy contracts are type-checked and boundary-tested.",
    evidence: [
      evidence(
        "tests/unit/public-contracts.test.ts",
        "public application contracts > gives presentation the shared read-only game observation",
      ),
      evidence(
        "tests/unit/architecture-boundaries.test.ts",
        "architecture boundaries > rejects a transitive reference to an unapproved project type",
      ),
      evidence(
        "tests/browser/milestone-6-compatibility-corpus.spec.ts",
        "replays the retained compatibility corpus in Node and Chromium",
      ),
    ],
  },
  {
    id: "mechanics.initial-run-state",
    source: "research/mechanics.md#state-and-core-loop",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Initial gold, loadout, item, lifespan, score, distance, day, and public projections are asserted directly.",
    evidence: [
      evidence(
        "tests/unit/gameplay-economy-loadout.test.ts",
        "original-v1.3 economy and loadout > starts and observes the confirmed player-facing values",
      ),
      evidence(
        "tests/unit/gameplay-running-progression.test.ts",
        "original-v1.3 running progression > starts with the confirmed public running values",
      ),
      evidence(
        "tests/unit/gameplay-lifespan.test.ts",
        "original-v1.3 lifespan > starts at the confirmed public 99.99 percent",
      ),
    ],
  },
  {
    id: "mechanics.running-loop",
    source: "research/mechanics.md#state-and-core-loop",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Active running acceleration, speed cap, distance, day, score, and gate behavior have direct assertions.",
    evidence: [
      evidence(
        "tests/unit/gameplay-running-progression.test.ts",
        "original-v1.3 running progression > accelerates before moving and caps movement speed at 15",
      ),
      evidence(
        "tests/unit/gameplay-running-progression.test.ts",
        "original-v1.3 running progression > derives the observed day from authoritative distance",
      ),
    ],
  },
  {
    id: "mechanics.battle-running-separation",
    source: "research/mechanics.md#state-and-core-loop",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Battle entry preserves the crossing running tick, then freezes running systems while combat and lifespan continue.",
    evidence: [
      evidence(
        "tests/unit/gameplay-battle-entry.test.ts",
        "original-v1.3 battle entry > decays running speed during battle without advancing running systems",
      ),
      evidence(
        "tests/unit/gameplay-encounter-lifecycle.test.ts",
        "original-v1.3 encounter world lifecycle > starts battles below x=420 and freezes running systems afterward",
      ),
    ],
  },
  {
    id: "mechanics.endless-run",
    source: "research/mechanics.md#state-and-core-loop",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Only lifespan, combat, and configured simulation limits end a run; there is no win or final-day state.",
    evidence: [
      evidence(
        "tests/unit/combat-policy-runs.test.ts",
        "continuous combat policy runs > bounds gated and unfinished runs with the configured step limit",
      ),
      evidence(
        "tests/unit/milestone-2-lifecycle.test.ts",
        "Milestone 2 original lifecycle > matches browser-session and headless execution through lifespan death",
      ),
    ],
  },
  {
    id: "mechanics.distance-day-and-positions",
    source: "research/mechanics.md#distance-days-and-encounter-spacing",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Day calculation, distance counters, entry and departure positions, movement factors, and action bounds are asserted.",
    evidence: [
      evidence(
        "tests/unit/gameplay-encounter-lifecycle.test.ts",
        "original-v1.3 encounter world lifecycle > owns the confirmed initial and later distance ranges",
      ),
      evidence(
        "tests/unit/gameplay-encounter-lifecycle.test.ts",
        "original-v1.3 encounter world lifecycle > moves shops at half running speed and uses strict action bounds",
      ),
      evidence(
        "tests/unit/gameplay-encounter-lifecycle.test.ts",
        "original-v1.3 encounter world lifecycle > removes shops only below x=-100 and emits their departure",
      ),
    ],
  },
  {
    id: "mechanics.encounter-generation",
    source: "research/mechanics.md#encounter-queue-and-rng",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Queue length, shop roll boundaries, early voucher rerolls, duplicate rejection, item repetition, battle cycles, and cached generation values are covered.",
    evidence: [
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > creates three queued entries through the selected initial draw order",
      ),
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > maps roll state %i to boundary %i as %s",
      ),
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > rerolls an early-day Voucher candidate without accepting it",
      ),
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > rerolls duplicate equipment and Shrine candidates within a battle cycle",
      ),
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > allows item shops to repeat within a battle cycle",
      ),
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > keeps generation-time equipment prices on already queued entries",
      ),
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > queues a scaled enemy after the next-cycle shop-count draw",
      ),
    ],
  },
  {
    id: "mechanics.emergency-shrine",
    source: "research/mechanics.md#encounter-queue-and-rng",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Threshold ranges, one-chance behavior, restoration reset, and forced Shrine generation are asserted in state-transition scenarios.",
    evidence: [
      evidence(
        "tests/unit/gameplay-soul-shrine.test.ts",
        "original-v1.3 Soul Shrine behavior > forces one Shrine below the threshold and rerolls the threshold",
      ),
      evidence(
        "tests/unit/gameplay-soul-shrine.test.ts",
        "original-v1.3 Soul Shrine behavior > does not grant another forced Shrine after the first is passed",
      ),
      evidence(
        "tests/unit/gameplay-soul-shrine.test.ts",
        "original-v1.3 Soul Shrine behavior > makes another emergency Shrine eligible after a Shrine purchase",
      ),
    ],
  },
  {
    id: "mechanics.enemy-scaling",
    source: "research/mechanics.md#enemies-and-scaling",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Every enemy's HP, attack, gold, and profile EXP scaling is checked at generated and completed-run boundaries.",
    evidence: [
      evidence(
        "tests/unit/gameplay-enemy-generation.test.ts",
        "original-v1.3 enemy generation > uses the confirmed Dragon day boundary and selected draw order",
      ),
      evidence(
        "tests/unit/milestone-4-combat-loop.test.ts",
        "Milestone 4 complete combat loop > preserves per-step invariants through $terminalReason death",
      ),
    ],
  },
  {
    id: "mechanics.dragon-generation",
    source: "research/mechanics.md#dragon-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Dragon eligibility, threshold boundaries, queued-dragon suppression, scaling, rewards, and achievement hooks are exercised.",
    evidence: [
      evidence(
        "tests/unit/gameplay-enemy-generation.test.ts",
        "original-v1.3 enemy generation > prevents queued Dragons until an ordinary enemy becomes current",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > unlocks the Dragon achievement at the lethal hit and only once",
      ),
    ],
  },
  {
    id: "mechanics.combat-state-machine",
    source: "research/mechanics.md#combat-state-machine-and-timing",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Actor phases, range, movement, delay draws, attack counts, damage, criticals, knockback, lethal handling, and item modifiers have focused assertions.",
    evidence: [
      evidence(
        "tests/unit/gameplay-combat.test.ts",
        "automatic combat > decrements idle delay and uses strict horizontal range and ten-unit movement",
      ),
      evidence(
        "tests/unit/gameplay-combat.test.ts",
        "automatic combat > locks rounded bonuses, exact critical threshold, and uncapped Divine Edge damage",
      ),
      evidence(
        "tests/unit/gameplay-combat.test.ts",
        "automatic combat > interrupts simultaneous enemy hits, resets its counter, and applies flinch on later ticks",
      ),
    ],
  },
  {
    id: "presentation.combat-hit-finish-timing",
    source:
      "research/presentation.md#character-movieclips-and-combat-timelines",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Timeline hit and finish callbacks are represented as logical combat offsets, while browser tests vary rendering independently.",
    evidence: [
      evidence(
        "tests/unit/gameplay-combat.test.ts",
        "automatic combat > hits at offset six and finishes at the researched offset for %s",
      ),
      evidence(
        "tests/browser/milestone-4-combat-loop.spec.ts",
        "complete ${scenario.terminalReason} run matches Node across Canvas output settings",
      ),
    ],
  },
  {
    id: "mechanics.lifespan",
    source: "research/mechanics.md#lifespan",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Two-field drain, fractional carry, active-gate behavior, restoration, and lifespan terminal handling are asserted.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifespan.test.ts",
        "original-v1.3 lifespan > drains four fractional points per active tick and carries at zero",
      ),
      evidence(
        "tests/unit/gameplay-lifespan.test.ts",
        "original-v1.3 lifespan > ends once on the 2,500th active tick",
      ),
      evidence(
        "tests/unit/milestone-2-lifecycle.test.ts",
        "Milestone 2 original lifecycle > continues identically from serialized lifecycle and lifespan checkpoints",
      ),
    ],
  },
  {
    id: "mechanics.equipment",
    source: "research/mechanics.md#weapons-and-armor",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Tier names and values, formulas, cached prices, healing, caps, and unavailable max-tier actions are tested.",
    evidence: [
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > advances every weapon tier, recomputes attack, and preserves HP",
      ),
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > advances every armor tier, recomputes maximum HP, and fully heals",
      ),
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > keeps max-tier Bladesmith unavailable regardless of affordability",
      ),
    ],
  },
  {
    id: "mechanics.shops-and-items",
    source: "research/mechanics.md#shops-and-items",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "All shop effects and prices, inventory replacement, item consumption, battle-only use, and Shrine restoration are exercised.",
    evidence: [
      evidence(
        "tests/unit/gameplay-shop-purchases.test.ts",
        "original-v1.3 semantic shop purchases > buys a Soul Shrine through the same semantic purchase path",
      ),
      evidence(
        "tests/unit/gameplay-item-use.test.ts",
        "original-v1.3 carried item use > uses an Elixir only during an active battle",
      ),
      evidence(
        "tests/unit/gameplay-item-use.test.ts",
        "original-v1.3 carried item use > resets battle-scoped item effects when the next battle starts",
      ),
    ],
  },
  {
    id: "mechanics.gold-economy",
    source: "research/mechanics.md#gold-and-economy",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Integer purchase accounting, reward accounting, voucher multiplication, and the post-reward gold achievement boundary are asserted.",
    evidence: [
      evidence(
        "tests/unit/milestone-3-economy.test.ts",
        "Milestone 3 economy verification > purchases every affordable pre-combat shop type across a fixed seed set",
      ),
      evidence(
        "tests/unit/milestone-4-combat-loop.test.ts",
        "Milestone 4 complete combat loop > preserves per-step invariants through $terminalReason death",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > checks the post-reward gold threshold at $gold",
      ),
    ],
  },
  {
    id: "mechanics.score-and-profile",
    source: "research/mechanics.md#run-score-and-profile-progression",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Running and kill score, EXP, strict thresholds, multiplier changes, high-score comparison, and complete-run settlement are executable.",
    evidence: [
      evidence(
        "tests/unit/profile-settlement.test.ts",
        "completed-run profile settlement > preserves researched transfer behavior for $name",
      ),
      evidence(
        "tests/unit/milestone-5-progression-persistence.test.ts",
        "Milestone 5 progression and persistence scenarios > clean lifespan death replaces the empty high score and levels up repeatedly",
      ),
      evidence(
        "tests/unit/gameplay-battle-resolution.test.ts",
        "battle death and reward settlement > settles %s once after ten subsequent active fade ticks",
      ),
    ],
  },
  {
    id: "mechanics.persistence",
    source: "research/mechanics.md#persistence",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The versioned storage boundary retains the complete profile, migrates supported envelopes, and handles interrupted commits and retries.",
    evidence: [
      evidence(
        "tests/unit/profile-storage.test.ts",
        "versioned browser profile storage > round-trips the complete profile and supported tutorial setting",
      ),
      evidence(
        "tests/unit/profile-storage.test.ts",
        "versioned browser profile storage > atomically records completed-run identity and ignores an exact retry",
      ),
      evidence(
        "tests/unit/milestone-5-progression-persistence.test.ts",
        "Milestone 5 progression and persistence scenarios > keeps a failed completion retryable, deduplicates the retry, and ignores a step-limit run",
      ),
    ],
  },
  {
    id: "mechanics.achievements-and-collections",
    source: "research/mechanics.md#achievements-and-collections",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Defined achievement conditions, collection counts, progress totals, slot-five absence, and consecutive-run retention are tested.",
    evidence: [
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > computes fresh and complete researched progress without counting slot five",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > unlocks the Dragon achievement at the lethal hit and only once",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > checks the post-reward gold threshold at $gold",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > checks the day achievement at distance $distance",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > unlocks computed-hit damage from raw overkill damage",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > checks computed damage at the 70000 boundary for $weaponAttack attack",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > unlocks complete collection only when the last tier is discovered",
      ),
      evidence(
        "tests/unit/profile-achievements.test.ts",
        "profile collections and achievements > retains discoveries across consecutive settled runs",
      ),
      evidence(
        "tests/unit/milestone-5-progression-persistence.test.ts",
        "Milestone 5 progression and persistence scenarios > accumulates collections and achievements across runs without duplicate completion awards",
      ),
    ],
  },
  {
    id: "presentation.frame-gates",
    source: "research/presentation.md#swf-and-frame-timing",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The 30 Hz logical tick and 60-opportunity pregame gate are part of the lifecycle evidence; rendering cadence is tested separately.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifecycle.test.ts",
        "original-v1.3 lifecycle > uses 60 eligible logical opportunities for pregame before active ticks",
      ),
      evidence(
        "tests/browser/milestone-2-lifecycle.spec.ts",
        "proves the complete lifecycle across Node, Chromium, and Canvas variants",
      ),
    ],
  },
  {
    id: "presentation.hud-and-public-actions",
    source: "research/presentation.md#gameplay-hud",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The public observation carries the current and three queued encounters, public HUD values, battle values, and action eligibility without hidden enemy data.",
    evidence: [
      evidence(
        "tests/unit/gameplay-engine.test.ts",
        "gameplay engine > creates and observes a minimal run without exposing hidden state",
      ),
      evidence(
        "tests/unit/gameplay-enemy-generation.test.ts",
        "original-v1.3 enemy generation > keeps queued enemy identity hidden until the battle is current",
      ),
      evidence(
        "tests/unit/public-contracts.test.ts",
        "public application contracts > gives presentation the shared read-only game observation",
      ),
      evidence(
        "tests/browser/milestone-6-compatibility-corpus.spec.ts",
        "replays the retained compatibility corpus in Node and Chromium",
      ),
    ],
  },
  {
    id: "presentation.purchase-and-input-windows",
    source: "research/presentation.md#input",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Purchase windows, invalid-action outcomes, item-use eligibility, and device-independent command mapping are executable.",
    evidence: [
      evidence(
        "tests/unit/gameplay-shop-purchases.test.ts",
        "original-v1.3 semantic shop purchases > rejects $name without changing economy state",
      ),
      evidence(
        "tests/unit/browser-input.test.ts",
        "maps browser purchase activation to device-independent gameplay intent",
      ),
      evidence(
        "tests/browser/milestone-3-economy.spec.ts",
        "exposes a disabled purchase activation until public eligibility allows it",
      ),
    ],
  },
  {
    id: "presentation.pause-gate",
    source: "research/presentation.md#input",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Pause commands freeze active gameplay while remaining processable at the lifecycle boundary.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifecycle.test.ts",
        "original-v1.3 lifecycle > freezes active ticks while paused and resumes on the unpause step",
      ),
      evidence(
        "tests/unit/gameplay-battle-entry.test.ts",
        "original-v1.3 battle entry > freezes combat, speed decay, and lifespan behind pause and tutorial gates",
      ),
    ],
  },
  {
    id: "presentation.tutorial-page-zero",
    source: "research/presentation.md#tutorials",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Page 0 is unconditionally shown at run start, and dismissal plus saved preference behavior is asserted.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifecycle.test.ts",
        "original-v1.3 lifecycle > gates every new run on tutorial page 0 regardless of preference",
      ),
      evidence(
        "tests/unit/profile-settlement.test.ts",
        "completed-run profile settlement > keeps the unconditional introductory tutorial on the next run",
      ),
    ],
  },
  {
    id: "presentation.contextual-tutorial-gates",
    source: "research/presentation.md#tutorials",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Pages 1 through 5 are confirmed gameplay gates. Their clean-room trigger choices, thresholds, priority, repetition, and ordering are implemented behind the public lifecycle boundary and exercised in focused unit and browser/headless parity scenarios.",
    evidence: [
      evidence(
        "tests/unit/gameplay-tutorials.test.ts",
        "original-v1.3 contextual tutorial gates > opens page 1 when an unused shop enters the strict purchase window",
      ),
      evidence(
        "tests/unit/gameplay-tutorials.test.ts",
        "original-v1.3 contextual tutorial gates > shows the Shrine lesson after the general building lesson on the same persistent shop",
      ),
      evidence(
        "tests/unit/gameplay-tutorials.test.ts",
        "original-v1.3 contextual tutorial gates > keeps all active systems and randomness frozen while a contextual page is open",
      ),
      evidence(
        "tests/browser/milestone-6-tutorial-gates.spec.ts",
        "keeps contextual tutorial gates equivalent in Node and Chromium",
      ),
      evidence(
        "tests/unit/milestone-6-compatibility-corpus.test.ts",
        "original-v1.3 compatibility corpus > replays the retained $id result, trace, and representative checkpoints",
      ),
      evidence(
        "tests/browser/milestone-6-compatibility-corpus.spec.ts",
        "replays the retained compatibility corpus in Node and Chromium",
      ),
    ],
  },
  {
    id: "presentation.post-death-delay",
    source: "research/presentation.md#swf-and-frame-timing",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "The post-death delay affects only non-interactive presentation after terminal state; TDD permits redesign after settlement.",
    evidence: [],
  },
  {
    id: "presentation.screen-flow",
    source: "research/presentation.md#main-timeline-and-screens",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "Title, achievement, credits, and score layout and navigation are browser presentation work assigned to the later complete-browser milestone.",
    evidence: [],
  },
  {
    id: "presentation.parallax-and-cosmetics",
    source: "research/presentation.md#other-named-movieclips",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "Parallax, particles, damage numbers, effects, and transitions do not determine domain outcomes and may be redesigned.",
    evidence: [],
  },
  {
    id: "presentation.score-animation",
    source: "research/mechanics.md#run-score-and-profile-progression",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "Result counting may use a different visual cadence because committed progression is already settled before presentation.",
    evidence: [
      evidence(
        "tests/browser/milestone-5-progression-persistence.spec.ts",
        "browser and headless progression agree despite storage and presentation cadence",
      ),
    ],
  },
  {
    id: "presentation.audio-and-sound-controls",
    source: "research/presentation.md#audio",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "Semantic events can drive modern sound controls; codec, mixer timing, and music playback are outside domain compatibility.",
    evidence: [],
  },
  {
    id: "presentation.host-integration",
    source:
      "clean-room/PRD.md#out-of-scope-for-the-initial-compatibility-release",
    classification: "excluded-scope",
    disposition: "excluded",
    rationale:
      "Kongregate site locks, portal APIs, legacy sharing, and promotional links are explicitly outside the initial release.",
    evidence: [],
  },
  {
    id: "presentation.research-exports",
    source: "research/presentation.md#reference-exports",
    classification: "excluded-scope",
    disposition: "excluded",
    rationale:
      "Exported original artifacts remain research evidence and are not implementation inputs under the clean-room boundary.",
    evidence: [],
  },
  {
    id: "derived.lifespan-duration",
    source: "research/unknowns.md#derived-behavior",
    classification: "derived",
    disposition: "covered",
    rationale:
      "The duration follows from the tested drain and carry rules plus the 30 Hz logical tick.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifespan.test.ts",
        "original-v1.3 lifespan > ends once on the 2,500th active tick",
      ),
    ],
  },
  {
    id: "derived.encounter-spacing",
    source: "research/unknowns.md#derived-behavior",
    classification: "derived",
    disposition: "covered",
    rationale:
      "The tested later distance range yields the documented full-speed spacing without claiming a Flash wall-clock result.",
    evidence: [
      evidence(
        "tests/unit/gameplay-encounter-lifecycle.test.ts",
        "original-v1.3 encounter world lifecycle > owns the confirmed initial and later distance ranges",
      ),
    ],
  },
  {
    id: "derived.purchase-window-duration",
    source: "research/unknowns.md#derived-behavior",
    classification: "derived",
    disposition: "covered",
    rationale:
      "The tested strict x bounds and shop speed factor establish the documented full-speed window.",
    evidence: [
      evidence(
        "tests/unit/gameplay-encounter-lifecycle.test.ts",
        "original-v1.3 encounter world lifecycle > moves shops at half running speed and uses strict action bounds",
      ),
    ],
  },
  {
    id: "derived.enemy-fade-duration",
    source: "research/unknowns.md#derived-behavior",
    classification: "derived",
    disposition: "covered",
    rationale:
      "The tested ten-unit active fade and reward boundary establish the approximate duration.",
    evidence: [
      evidence(
        "tests/unit/gameplay-battle-resolution.test.ts",
        "battle death and reward settlement > settles %s once after ten subsequent active fade ticks",
      ),
    ],
  },
  {
    id: "derived.dragon-guarantee",
    source: "research/unknowns.md#derived-behavior",
    classification: "derived",
    disposition: "covered",
    rationale:
      "The day-threshold test covers the derived point that eligible day 41 and later rolls always select Dragon.",
    evidence: [
      evidence(
        "tests/unit/gameplay-enemy-generation.test.ts",
        "original-v1.3 enemy generation > uses the confirmed Dragon day boundary and selected draw order",
      ),
    ],
  },
  {
    id: "derived.persistence-loss-risk",
    source: "research/unknowns.md#derived-behavior",
    classification: "derived",
    disposition: "covered",
    rationale:
      "The original timing risk is retained as evidence while the product boundary commits progression before optional result animation.",
    evidence: [
      evidence(
        "tests/unit/completed-run.test.ts",
        "completed-run coordination > commits a terminal checkpoint before presenting it",
      ),
      evidence(
        "tests/unit/profile-storage.test.ts",
        "versioned browser profile storage > preserves the committed profile through an interrupted write and deduplicates its retry",
      ),
    ],
  },
  {
    id: "decision.random-sequence",
    source: "docs/compatibility-decisions.md#random-sequence",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "The clean-room seeded generator preserves researched ranges, probabilities, and draw order without claiming Flash seed equivalence.",
    evidence: [
      evidence(
        "tests/unit/deterministic-randomness.test.ts",
        "deterministic randomness > reproduces the versioned sequence for an equal seed",
      ),
      evidence(
        "tests/unit/rulesets.test.ts",
        "ruleset registry > owns the original-v1.3 foundation and its compatibility decisions",
      ),
    ],
  },
  {
    id: "decision.encounter-order",
    source:
      "docs/compatibility-decisions.md#initialization-and-encounter-refill-ordering",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "The chosen queue, distance, Shrine-threshold, promotion, and refill order is encoded in the ruleset and queue scenarios.",
    evidence: [
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > creates three queued entries through the selected initial draw order",
      ),
      evidence(
        "tests/unit/gameplay-encounter-queue.test.ts",
        "original-v1.3 encounter queue > queues a scaled enemy after the next-cycle shop-count draw",
      ),
    ],
  },
  {
    id: "decision.pregame-gates",
    source: "docs/compatibility-decisions.md#pregame-gates",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "Commands apply before the chosen pregame gate decision, and pregame opportunities remain outside active gameplay.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifecycle.test.ts",
        "original-v1.3 lifecycle > applies commands before deciding whether the same step is active",
      ),
      evidence(
        "tests/unit/gameplay-lifecycle.test.ts",
        "original-v1.3 lifecycle > uses 60 eligible logical opportunities for pregame before active ticks",
      ),
    ],
  },
  {
    id: "decision.battle-entry",
    source: "docs/compatibility-decisions.md#battle-entry-and-actor-positions",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "The threshold-crossing running tick and the fixed hero plus positioned-enemy actor placement are executable.",
    evidence: [
      evidence(
        "tests/unit/gameplay-battle-entry.test.ts",
        "original-v1.3 battle entry > starts active combat with initialized actors and a safe public projection",
      ),
    ],
  },
  {
    id: "decision.combat-order",
    source: "docs/compatibility-decisions.md#combat-ordering-and-interruption",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "Hero-first phase evaluation, interruption timing, and explicit random draw order are locked by combat scenarios.",
    evidence: [
      evidence(
        "tests/unit/gameplay-combat.test.ts",
        "automatic combat > interrupts simultaneous enemy hits, resets its counter, and applies flinch on later ticks",
      ),
      evidence(
        "tests/unit/gameplay-combat.test.ts",
        "automatic combat > freezes timing and RNG behind gates and replays immutable checkpoints",
      ),
    ],
  },
  {
    id: "decision.lifespan-precedence",
    source: "docs/compatibility-decisions.md#lifespan-precedence",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "Combat outcomes resolve before the selected lifespan terminal event on the same active step.",
    evidence: [
      evidence(
        "tests/unit/gameplay-combat.test.ts",
        "automatic combat > skips lethal knockback draws and resolves lethal hits before same-tick lifespan death",
      ),
      evidence(
        "tests/unit/gameplay-battle-resolution.test.ts",
        "battle death and reward settlement > lets lifespan end a fade and settles completed deaths before lifespan",
      ),
    ],
  },
  {
    id: "decision.death-fade-settlement",
    source: "docs/compatibility-decisions.md#death-fade-and-settlement",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "The chosen first-fade tick, zero-alpha settlement, reward boundary, and hero-death terminal behavior are tested.",
    evidence: [
      evidence(
        "tests/unit/gameplay-battle-resolution.test.ts",
        "battle death and reward settlement > settles %s once after ten subsequent active fade ticks",
      ),
      evidence(
        "tests/unit/gameplay-battle-resolution.test.ts",
        "battle death and reward settlement > ends hero death at fade completion without rewards and keeps terminal gameplay final",
      ),
    ],
  },
  {
    id: "decision.max-tier-availability",
    source: "clean-room/PRD.md#1-reproduce-the-original-gameplay-loop",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "The unresolved GUI report is represented by the explicit product decision that max-tier shops are publicly ineligible and inert.",
    evidence: [
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > reports a funded max-tier Bladesmith as unavailable",
      ),
      evidence(
        "tests/browser/milestone-3-economy.spec.ts",
        "exposes a disabled purchase activation until public eligibility allows it",
      ),
    ],
  },
  {
    id: "decision.coordinate-model",
    source: "clean-room/TDD.md#4-compatibility-and-modernization-boundary",
    classification: "compatibility-decision",
    disposition: "covered",
    rationale:
      "Original stage coordinates are kept as abstract world units while physical canvas projection varies independently.",
    evidence: [
      evidence(
        "tests/unit/world-camera.test.ts",
        "original-v1.3 world camera > publishes the initial reference view in world units",
      ),
      evidence(
        "tests/browser/foundation.spec.ts",
        "projects the complete 480x320 world camera into wide and tall output",
      ),
    ],
  },
  {
    id: "quirk.initial-lifespan-display",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale: "The 99.99% initial display is an explicit lifecycle assertion.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifespan.test.ts",
        "original-v1.3 lifespan > starts at the confirmed public 99.99 percent",
      ),
    ],
  },
  {
    id: "quirk.initial-profile-multiplier",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale: "Fresh profile level one keeps the explicit initial multiplier.",
    evidence: [
      evidence(
        "tests/unit/profile.test.ts",
        "versioned profiles > creates researched fresh progression with an independent stored multiplier",
      ),
    ],
  },
  {
    id: "quirk.strict-profile-threshold",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Threshold equality, strict crossing, and discarded excess are scenario-tested.",
    evidence: [
      evidence(
        "tests/unit/profile-settlement.test.ts",
        "completed-run profile settlement > preserves researched transfer behavior for $name",
      ),
    ],
  },
  {
    id: "quirk.kill-score-precedence",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The complete combat-loop reward assertion preserves multiplier application to the enemy-attack term.",
    evidence: [
      evidence(
        "tests/unit/milestone-4-combat-loop.test.ts",
        "Milestone 4 complete combat loop > preserves per-step invariants through $terminalReason death",
      ),
    ],
  },
  {
    id: "quirk.cached-shop-prices",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "Queue-time prices survive intervening upgrades in weapon and armor scenarios.",
    evidence: [
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > uses the same earlier cached price for upgrades queued across a battle",
      ),
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > preserves an earlier cached armor price across a queued battle",
      ),
    ],
  },
  {
    id: "quirk.max-tier-no-op",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The purchase routine remains inert at tier 10 while public eligibility follows the explicit compatibility decision.",
    evidence: [
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > reports a funded max-tier Armorsmith as unavailable without healing",
      ),
    ],
  },
  {
    id: "quirk.tutorial-page-zero",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "confirmed",
    disposition: "covered",
    rationale:
      "The implementation preserves the confirmed code behavior without claiming the unresolved original intent.",
    evidence: [
      evidence(
        "tests/unit/profile-settlement.test.ts",
        "completed-run profile settlement > keeps the unconditional introductory tutorial on the next run",
      ),
    ],
  },
  {
    id: "quirk.lifespan-battle-alpha",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "The alpha fade is visual feedback and does not change gameplay outcomes or public action eligibility.",
    evidence: [],
  },
  {
    id: "quirk.achievement-submission-defect",
    source: "research/unknowns.md#confirmed-quirks-not-unknown-mechanics",
    classification: "excluded-scope",
    disposition: "excluded",
    rationale:
      "The Kongregate stat submission defect is outside the initial release's host integration scope.",
    evidence: [],
  },
  {
    id: "unknown.flash-prng",
    source:
      "research/unknowns.md#unknowns-requiring-runtime-or-external-evidence",
    classification: "unresolved",
    disposition: "tracked-unknown",
    rationale:
      "The ruleset records a reproducible clean-room generator and does not claim identical Flash seed sequences.",
    evidence: [
      evidence(
        "tests/unit/rulesets.test.ts",
        "ruleset registry > owns the original-v1.3 foundation and its compatibility decisions",
      ),
    ],
  },
  {
    id: "unknown.tutorial-page-zero-intent",
    source:
      "research/unknowns.md#unknowns-requiring-runtime-or-external-evidence",
    classification: "unresolved",
    disposition: "tracked-unknown",
    rationale:
      "The code behavior is covered, while whether it was intended to bypass the preference remains open.",
    evidence: [
      evidence(
        "tests/unit/gameplay-lifecycle.test.ts",
        "original-v1.3 lifecycle > gates every new run on tutorial page 0 regardless of preference",
      ),
    ],
  },
  {
    id: "unknown.max-tier-gui-dispatch",
    source:
      "research/unknowns.md#unknowns-requiring-runtime-or-external-evidence",
    classification: "unresolved",
    disposition: "tracked-unknown",
    rationale:
      "Static purchase behavior and the explicit public eligibility choice are covered without claiming the preserved GUI dispatch.",
    evidence: [
      evidence(
        "tests/unit/gameplay-equipment-upgrades.test.ts",
        "original-v1.3 equipment upgrades > keeps max-tier Armorsmith unavailable regardless of affordability",
      ),
    ],
  },
  {
    id: "unknown.check-battle-resolution",
    source:
      "research/unknowns.md#unknowns-requiring-runtime-or-external-evidence",
    classification: "unresolved",
    disposition: "tracked-unknown",
    rationale:
      "The missing exported definition remains a tracked unknown with no compatibility choice. Existing combat scenarios cover the observed damage and AI paths, so it is not invented as a gameplay requirement.",
    evidence: [
      evidence(
        "tests/unit/milestone-4-combat-loop.test.ts",
        "Milestone 4 complete combat loop > preserves per-step invariants through $terminalReason death",
      ),
    ],
  },
  {
    id: "unknown.dynamic-composition",
    source:
      "research/unknowns.md#unknowns-requiring-runtime-or-external-evidence",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "Exact dynamic screen placement and transition composition do not constrain the domain result under the TDD boundary.",
    evidence: [],
  },
  {
    id: "unknown.sound-mixing",
    source:
      "research/unknowns.md#unknowns-requiring-runtime-or-external-evidence",
    classification: "presentation-modernization",
    disposition: "allowed-modernization",
    rationale:
      "Host decoder latency and Flash mixer behavior are outside deterministic gameplay compatibility.",
    evidence: [],
  },
  {
    id: "unknown.portal-api",
    source:
      "research/unknowns.md#unknowns-requiring-runtime-or-external-evidence",
    classification: "excluded-scope",
    disposition: "excluded",
    rationale:
      "Retired portal API behavior is external host integration and is explicitly outside the initial release.",
    evidence: [],
  },
] satisfies readonly TraceabilityEntry[]);
