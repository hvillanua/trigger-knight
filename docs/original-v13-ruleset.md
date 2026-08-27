# Original-v1.3 ruleset foundation

`original-v1.3` is the only supported gameplay ruleset. Browser sessions and
headless simulations create it through the same `GameplayEngine`. Creation,
stepping, and observation each resolve the state's identity through the domain
ruleset registry. An unsupported identity, including the former
`walking-skeleton-v1` scaffold, throws a `RangeError` before the engine creates,
steps, or observes a run.

The registry currently has one entry. Its factory accepts any number of unique
ruleset implementations, so a later identity can coexist without changing the
`original-v1.3` object or its constants.

## Owned constants and decisions

The ruleset owns the confirmed compatibility values implemented so far:

| Group            | Values                                                                                                                     | Evidence                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Logical time     | 30 gameplay ticks per second                                                                                               | Confirmed original behavior                                                    |
| Pregame delay    | 60 logical opportunities                                                                                                   | Confirmed value; gate interaction is a clean-room decision                     |
| Running movement | Speed starts at 0, gains 1 per active tick, caps at 15, and contributes one distance unit per speed unit                   | Confirmed original behavior                                                    |
| Day and score    | 7,000 distance units per day; running score uses 10 points per speed unit before the profile multiplier                    | Confirmed original behavior                                                    |
| Economy          | A run starts with 300 integer-valued gold                                                                                  | Confirmed original behavior                                                    |
| Weapon           | Tier 1; attack is `129 + 87 * tier`, which starts at 216                                                                   | Confirmed original behavior                                                    |
| Armor and HP     | Tier 1; maximum HP is `1009 + 899 * tier`, which starts at 1,908; current HP starts full                                   | Confirmed original behavior                                                    |
| Inventory        | One item slot containing an Elixir                                                                                         | Confirmed original behavior                                                    |
| Encounter queue  | Three entries; zero to two initial shops before battle, then one to three; confirmed shop roll ranges and duplicate rules  | Confirmed original behavior                                                    |
| Shop prices      | Generation-time equipment formulas; Shrine 50, Pharmacy 150, Grim's Shop 200, and Voucher Store 500                        | Confirmed original behavior                                                    |
| Lifespan         | Starts at 99.99, drains the fractional field by 4 per active tick, resets the fraction to 99, and dies below whole value 0 | Confirmed original behavior                                                    |
| World camera     | One original stage unit maps to one world unit; initial camera is 480 by 320 world units                                   | Clean-room coordinate-model decision preserving confirmed original coordinates |
| Random sequence  | `mulberry32-fnv1a32-v1`                                                                                                    | Clean-room reproducibility decision                                            |

The compatibility target for randomness is the confirmed original ranges,
probabilities, and gameplay draw order. The Flash Player's PRNG and seed
sequence remain unrecovered. The chosen algorithm does not claim to reproduce
that sequence. The exact seed expansion and bounded integer mapping are in
[`deterministic-randomness.md`](deterministic-randomness.md).

## Lifecycle and fixed steps

Each `step(state, commands)` call is one 30 Hz logical opportunity. It accepts
no elapsed time or render information. `steps` increments for every call,
including calls made when pause, tutorial, pregame, or ended state prevents
active gameplay. `activeTicks` increments only when the run phase is `running`,
pause is off, no tutorial is open, and the pregame counter has reached zero.

Run state stores the base `running` or `ended` phase separately from the pause,
tutorial, and pregame gates. This allows pause to be toggled while tutorial page
0 remains open. The public observation reports those fields, whether active
gameplay can advance on the next step, and whether pause or tutorial dismissal
commands are currently eligible. It does not expose random state.

Commands are processed in list order before the same logical opportunity is
evaluated. A successful command emits `pause-toggled` or `tutorial-dismissed`,
followed by the step's `step-advanced` event. Commands do nothing after the run
phase becomes `ended`, but the host can still account for an attempted engine
step.

## Running progression

Every active running tick increases movement speed by 1 up to 15, then adds the
resulting speed to distance. Day is always `floor(distance / 7000) + 1`.
Running score adds `movementSpeed * 10 * scoreMultiplier` on the same tick.

The initial profile supplies `scoreMultiplier` explicitly. In particular, the
confirmed level-1 starting profile supplies `1.0`; the run does not derive
`1.1` from the profile level. The multiplier remains in authoritative run state
for checkpoint replay but is not part of `GameObservation`. Public observation
includes movement speed, distance, day, and score for presentation and ordinary
policies. It also includes the ruleset's initial 480x320-world-unit camera so
presentation does not need access to ruleset internals or `RunState`. The
headless result copies score, day, distance, and gold from the same state.

Tutorial, pregame, pause, and ended gates leave all four progression values
unchanged. They also prevent `activeTicks` from advancing. These values use
abstract world units and accept no Canvas size, CSS size, device-pixel-ratio,
render interpolation, or wall-clock input.

The browser projection and the distinction between world and physical values
are documented in [`world-camera.md`](world-camera.md).

## Economy and loadout state

The ruleset creates one authoritative `player` record in each fresh run. It
contains gold, weapon tier and attack, armor tier, current and maximum HP, and
the single inventory slot. `GameObservation.player` publishes the same current
values without exposing random state or future encounter-generation state.

The original-v1.3 constants own the starting tiers and the confirmed formulas.
The run derives attack 216 from `129 + 87 * 1`. It derives maximum HP 1,908
from `1009 + 899 * 1`, and current HP starts at that maximum. The inventory item
identifiers cover Elixir, Divine Edge, and Gold Voucher, but this slice only
initializes the confirmed starting Elixir. Purchases, item use, and other
mutations remain in later Milestone 3 and 4 tickets.

Player state and each nested equipment, HP, and inventory value are frozen.
Stepping a JSON-restored checkpoint copies those values back into frozen domain
state.

## Encounter generation

A fresh run first draws `random(3)` for the initial number of shops before a
battle. It then calls the encounter generator three times to fill the upcoming
queue. A count at or below zero consumes `random(3)`, queues a battle, resets
the next count to one through three, and clears the Bladesmith, Armorsmith, and
Soul Shrine duplicate flags. This battle entry is only `{ kind: "battle" }`.
Enemy identity and Dragon eligibility consume no draws yet. Milestone 4 will
add those draws when it implements enemy selection. The current sequence is
therefore not the final original battle draw order.

A shop generation call consumes `random(100)`. The exact accepted ranges are
66 through 99 for Bladesmith, 31 through 65 for Armorsmith, 26 through 30 for
Soul Shrine, 11 through 25 for Pharmacy, 6 through 10 for Grim's Shop, and 0
through 5 for Voucher Store. Voucher candidates reroll on days 1 through 3.
Accepted equipment and normal Shrine candidates set their per-cycle duplicate
flag; another candidate of the same type rerolls. Item shops can repeat.

Every accepted shop stores its integer price on the queue entry. Bladesmith
uses `200 + 36 * currentWeaponTier`; Armorsmith uses
`150 + 54 * currentArmorTier`. The initial Shrine price is 50, and the item
shop prices are 150, 200, and 500. Purchases and Shrine price progression remain
in later Milestone 3 tickets. Forced emergency Shrine state and its random
draws are also deferred to its behavior ticket.

The queue, duplicate flags, counter, and complete post-generation random state
are authoritative, serializable, and deeply frozen. Ordinary
`GameObservation` does not publish hidden duplicate or random state. The
player-facing current and upcoming encounter view belongs to the world-space
lifecycle ticket.

Run-state schema version 6 identifies the encounter queue addition. Gameplay
traces and run results remain at schema version 2. The locked seed
`encounter-host-parity` produces encounter hash
`sha256-v1:1466c6dbe82e210625dbc472789e4b86acb0190df26bd3568a6619f9d6ce8e4b`
and initial state hash
`sha256-v1:708f1fef6eabfa91020a7af87284cd874fe35fa32a39bc32aa5ee83438dc7400`
in both Node and Chromium.

## Lifespan and termination

A new run stores and publishes lifespan as the two confirmed integers `whole`
and `fraction`, both initialized to 99. Each active tick subtracts 4 from the
fraction. A value at or below zero resets the fraction to 99 and subtracts one
from the whole value. Tutorial, pregame, pause, and ended gates do not drain
lifespan.

At the derived 2,500-tick boundary, the state changes from `{ whole: 0,
fraction: 3 }` to `{ whole: -1, fraction: 99 }` and commits the lifecycle phase
`ended` with terminal reason `lifespan`. The research confirms that movement,
score, and lifespan are active-frame systems, but it does not establish their
ordering on the terminal frame. This implementation advances movement,
distance, day, and running score before committing lifespan death on the same
active tick. That ordering is a clean-room compatibility decision.

The terminal transition emits `lifespan-death` followed by `run-ended` with
reason `lifespan`. Later steps cannot drain lifespan or emit either terminal
event again. Lifecycle commands become ineligible as soon as the ended state is
observable.

The original artifact's 60-frame post-death delay is confirmed presentation
timing. It starts only after gameplay death has been committed and is not part
of `RunState`, active ticks, simulation results, or trace advancement. The
browser may shorten, skip, or redesign that non-interactive delay under the
presentation modernization boundary.

## Tutorial and pregame compatibility

Tutorial page 0 gates every newly created run, even when the supplied profile
stores a disabled tutorial preference. The unconditional page is confirmed
original behavior. Its intent remains unknown, so the implementation does not
describe it as a deliberate original design choice.

The original artifact confirms a 60-frame pregame value, but the research does
not establish how that counter interacts with overlapping pause and tutorial
gates. `original-v1.3` uses this explicit clean-room decision:

- The tutorial and pause gates freeze the pregame counter.
- The step that dismisses the tutorial or removes pause can consume a pregame
  opportunity because commands take effect first.
- Pregame opportunities do not increment `activeTicks`. The first active tick
  is the next eligible step after the counter reaches zero.

Encounter movement, purchases, item use, combat, and tutorial presentation
remain assigned to later tickets.

State, results, events, event lists, and observations are frozen. A
JSON-restored checkpoint produces the same next state, observation, and events
as uninterrupted execution. Browser and headless parity traces are described in
[`gameplay-diagnostics.md`](gameplay-diagnostics.md).

The complete no-gameplay-action lifecycle, including explicit tutorial and
pause release commands, is covered by the
[`Milestone 2 lifecycle verification`](milestone-2-lifecycle-verification.md).
