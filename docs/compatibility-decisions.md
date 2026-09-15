# Compatibility decisions for research gaps

This document records choices required by incomplete, missing, or ambiguous
evidence about the original game. These are clean-room decisions, not confirmed
original behavior. Read the relevant entry when a task touches that uncertainty.

Update this document only when making a new compatibility choice because the
original research does not settle the behavior. If new evidence supersedes an
entry, record the replacement choice and its evidence here. Ordinary features,
refactors, schema changes, hashes, test results, and milestone completion do not
require updates. Code and tests define implemented behavior; PRD and TDD define
product and architecture intent. Do not duplicate these explanations in code
comments.

## Random sequence

The [unknown ledger](../research/unknowns.md#unknowns-requiring-runtime-or-external-evidence)
does not recover Flash Player's PRNG or seed sequence. Use
`mulberry32-fnv1a32-v1` for reproducible clean-room runs, preserving researched
ranges and probabilities without claiming identical Flash seeds.

Implementation and evidence: [random.ts](../src/domain/random.ts),
[randomness tests](../tests/unit/deterministic-randomness.test.ts).

## Initialization and encounter refill ordering

The [encounter research](../research/mechanics.md#encounter-queue-and-rng)
identifies the draws but does not establish their relative order across queue
initialization, distance selection, and emergency-threshold initialization.
Fill the initial queue, draw its distance, then draw the emergency Shrine
threshold. On promotion, update Dragon state for the promoted battle, generate
the replacement entry, then draw the next distance. This fixes reproducible
ordering without claiming verified Flash scheduling.

Implementation and evidence: [encounters.ts](../src/domain/encounters.ts),
[queue tests](../tests/unit/gameplay-encounter-queue.test.ts),
[enemy-generation tests](../tests/unit/gameplay-enemy-generation.test.ts).

## Contextual tutorial gates

The tutorial research confirms six pages, the subjects of pages 1 through 5,
the unconditional page 0 call at run initialization, and preference gating for
the contextual calls. It does not settle the contextual thresholds, whether a
page repeats, overlap priority, or exact ordering around a logical tick. The
following choices make those gaps implementable without presenting them as
recovered Flash behavior.

| Page | Trigger boundary                                                                   | Threshold or scope                                      | Repetition   |
| ---: | ---------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------ |
|    0 | Run initialization                                                                 | Always, regardless of the saved preference              | Every run    |
|    1 | The first unused shop enters the strict public purchase window                     | Any building, including a Soul Shrine                   | Once per run |
|    2 | The first unused Soul Shrine enters the strict public purchase window              | The Shrine-specific restoration lesson                  | Once per run |
|    3 | The first battle is promoted to the current encounter                              | Open before the next active combat tick                 | Once per run |
|    4 | The first active update leaves the run at or below 25.00% lifespan                 | Applies in running or battle while the run is not ended | Once per run |
|    5 | The first nonlethal active combat update leaves the living hero at or below 25% HP | Applies only in battle                                  | Once per run |

Unshown contextual pages retain their eligibility after a different page opens.
When multiple pages qualify at one boundary, the lowest page index wins. Only
one contextual page opens for an opportunity. After dismissal, the remaining
pages are checked against the current public boundary on the next opportunity,
so a persistent shop, battle, or threshold can show its next lesson after the
current page is dismissed. The once-per-run markers are gameplay state and are
not part of the player-facing observation.

Commands are applied before an opportunity is judged. An open tutorial or pause
freezes active ticks, lifespan drain, encounter movement and countdowns, combat
progression, and gameplay random draws. Dismissing a tutorial clears only the
current page. If pause is still active, gameplay remains paused; otherwise the
next active opportunity starts from the gated state without replaying the
trigger. A disabled saved preference skips pages 1 through 5 without consuming
an active tick or changing domain randomness. Page 0 remains unconditional. If
page 1 and page 2 qualify on the same Shrine, page 1 is shown first and page 2
remains eligible after dismissal.

Implementation and evidence: [tutorial research](../research/presentation.md#tutorials),
[tutorial gate selection](../src/domain/tutorials.ts),
[tutorial gate tests](../tests/unit/gameplay-tutorials.test.ts), and
[browser parity](../tests/browser/milestone-6-tutorial-gates.spec.ts).

## Pregame gates

The [timing research](../research/presentation.md#swf-and-frame-timing) confirms
a pregame delay but does not settle overlapping pause and tutorial gates.
Both gates freeze the pregame counter. Commands apply first, so dismissing a
tutorial or unpausing can consume a pregame opportunity on that step. Pregame
does not count as active gameplay; the first active tick follows its completion.

Implementation and evidence: [run-state.ts](../src/domain/run-state.ts),
[lifecycle tests](../tests/unit/gameplay-lifecycle.test.ts).

The ruleset default remains the researched 60-step gate. The browser supplies
the explicit `RunConfig.startImmediately` choice for a player-triggered Start
run action, so the first active opportunity follows tutorial dismissal without
changing the default used by headless compatibility runs.

## Battle entry and actor positions

The [core-loop research](../research/mechanics.md#state-and-core-loop) and
[combat research](../research/mechanics.md#combat-state-machine-and-timing)
do not specify a complete logical ordering for battle entry or how to separate
the hero's cosmetic running wander from authoritative combat placement.
The threshold-crossing step completes running progression; combat and speed
decay begin on subsequent active battle ticks. Initialize the hero at x 50
and the enemy at its positioned encounter x, without cosmetic random draws.

Implementation and evidence: [battle.ts](../src/domain/battle.ts),
[battle-entry tests](../tests/unit/gameplay-battle-entry.test.ts).

## Combat ordering and interruption

The [combat state rules](../research/mechanics.md#combat-state-machine-and-timing)
and [timeline callbacks](../research/presentation.md#character-movieclips-and-combat-timelines)
do not settle same-tick actor scheduling or all interruption details.
Actors evaluate one phase per tick, hero first. Check range before movement.
An interrupted actor begins flinch movement on the next tick, returns to idle
when flinch ends, and retains its pre-interruption delay.

Draw the damage bonus, then the hero-only critical check, then nonlethal
knockback. Draw post-attack delay at uninterrupted attack completion. Lethal
hits skip the knockback draw and stop further attacks against the dead target.
Item use is ineligible after hero death, preventing Elixir from restoring a
dead hero's HP. The research does not settle that command boundary.

Implementation and evidence: [combat.ts](../src/domain/combat.ts),
[items.ts](../src/domain/items.ts),
[combat tests](../tests/unit/gameplay-combat.test.ts).

## Lifespan precedence

The [lifespan research](../research/mechanics.md#lifespan) does not establish
the ordering of active systems on the terminal frame. Running progression and
combat resolve before lifespan drain. A lethal hit on the lifespan boundary
therefore emits its combat outcomes before lifespan death commits the run's
terminal reason.

Implementation and evidence: [rulesets.ts](../src/domain/rulesets.ts),
[lifespan tests](../tests/unit/gameplay-lifespan.test.ts),
[combat tests](../tests/unit/gameplay-combat.test.ts).

## Death fade and settlement

The [combat research](../research/mechanics.md#combat-state-machine-and-timing)
confirms a ten-alpha-unit fade per active tick and reward settlement after the
fade. It does not settle the first fade tick or the exact zero-alpha boundary.
Begin fading on the active tick after a lethal hit and settle on reaching zero.
Hero fade completion commits combat death. The researched 60-frame post-death
screen delay is presentation timing after the terminal outcome, consistent with
[TDD's presentation timing boundary](../clean-room/TDD.md#4-compatibility-and-modernization-boundary).

Settlement precedes lifespan drain. A completed hero fade commits combat death
without a second lifespan terminal event. A completed enemy fade pays its reward
before same-tick lifespan death. Lifespan expiry earlier in either fade ends the
run immediately and prevents later settlement. These ordering choices extend
the lifespan precedence decision above, not confirmed Flash scheduling.

Implementation and evidence: [battle-resolution.ts](../src/domain/battle-resolution.ts),
[battle-resolution tests](../tests/unit/gameplay-battle-resolution.test.ts).
