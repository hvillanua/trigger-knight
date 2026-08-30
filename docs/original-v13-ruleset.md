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
| Economy          | A run starts with 300 integer gold; purchases require and subtract the encounter's cached price                            | Confirmed original behavior                                                    |
| Weapon           | Named tiers 1 through 10; attack is `129 + 87 * tier`, from Dagger at 216 through Astral Sword at 999                      | Confirmed original behavior                                                    |
| Armor and HP     | Named tiers 1 through 10; maximum HP is `1009 + 899 * tier`, from Clothing at 1,908 through Astral Armor at 9,999          | Confirmed original behavior                                                    |
| Inventory        | One slot; item-shop purchases replace it with Elixir, Divine Edge, or Gold Voucher                                         | Confirmed original behavior                                                    |
| Encounter queue  | Three entries; zero to two initial shops before battle, then one to three; confirmed shop roll ranges and duplicate rules  | Confirmed original behavior                                                    |
| Enemies          | Uniform Goblin, Golem, and Wolf selection; day-scaled HP, attack, gold, and profile EXP                                    | Confirmed original behavior                                                    |
| Dragon           | Day-based chance from day 8, guaranteed from day 41, with no consecutive queued Dragons                                    | Confirmed and derived original behavior                                        |
| Encounter world  | Initial spacing 1,000-1,999; later spacing 1,500-1,799; entry x 600; shop and battle speeds and strict thresholds          | Confirmed original behavior                                                    |
| Shop prices      | Generation-time equipment formulas; Shrine starts at 50 and gains 70 per purchase; item shops cost 150, 200, and 500       | Confirmed original behavior                                                    |
| Emergency Shrine | Threshold 40-49; one forced chance below it per restoration cycle when the battle cycle has no Shrine                      | Confirmed original behavior                                                    |
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
active gameplay. `activeTicks` increments when the run has not ended, pause is
off, no tutorial is open, and the pregame counter has reached zero. The
`running` phase advances distance and encounters. The `battle-handoff` phase
keeps active ticks and lifespan available while running systems wait for
Milestone 4 combat.

Run state stores the `running`, `battle-handoff`, or `ended` phase separately
from the pause, tutorial, and pregame gates. This allows pause to be toggled
while tutorial page 0 remains open. The public observation reports those fields,
whether active gameplay can advance on the next step, and whether pause,
tutorial dismissal, or a current shop purchase is eligible. It does not expose
random state or encounter generation bookkeeping.

Commands are processed in list order before the same logical opportunity is evaluated.
Purchase attempts emit `shop-purchased` or `purchase-rejected`; lifecycle
commands emit `pause-toggled` or `tutorial-dismissed`. The logical opportunity
then emits `step-advanced`. An ended run rejects a purchase through its
lifecycle gate and ignores lifecycle commands, while the host can still account
for the attempted engine step.

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
contains gold, weapon tier, name, and attack, armor tier and name, current and
maximum HP, and the single inventory slot. `GameObservation.player` publishes
the same current values without exposing random state or future
encounter-generation state.

The original-v1.3 constants own all ten names, the tier cap, and the confirmed
formulas. Weapon tiers are Dagger, Sword, Rapier, Falchion, Katana, Flamberge,
Zweihander, Broad Kris, Excalibur, and Astral Sword. Armor tiers are Clothing,
Protector, Breastplate, Chainmail, Fullplate, Samurai Mail, Valkyrie Garb, Odin
Garb, Avalon, and Astral Armor. The run derives attack 216 from `129 + 87 * 1`.
It derives maximum HP 1,908 from `1009 + 899 * 1`, and current HP starts at that
maximum. The inventory item identifiers cover Elixir, Divine Edge, and Gold
Voucher. Pharmacy, Grim's Shop, and Voucher Store purchases replace the one slot
with their corresponding item, including when the same item is already carried.
Item use remains in Milestone 4.

The device-independent `purchase-current-encounter` command contains no price,
effect, or coordinate. The domain accepts it only for an active, unused,
supported current shop strictly inside `0 < x < 420` when gold covers the
cached price. Success subtracts that exact integer once and marks the positioned
shop used. Public action eligibility runs the same validation. Rejections name
the failed check without mutating player economy or inventory.

A Bladesmith purchase advances one tier, recomputes attack, and leaves HP
unchanged. An Armorsmith purchase advances one tier, recomputes maximum HP, and
fully heals current HP. Both use the price stored when the encounter entered
the queue. Shops on opposite sides of an already queued battle can therefore
advance successive tiers at the same earlier price.

Static scripts confirm that the tier-10 purchase routine is a no-op when
invoked, but a player report describes an online GUI that shows a red cross and
does not dispatch the purchase. Until controlled runtime evidence resolves that
discrepancy, the clean-room ruleset treats both max-tier equipment shops as
ineligible. Public action eligibility is false, and a direct command emits
`maximum-tier` without spending gold, healing HP, or marking the shop used.
Presentation must show an unavailable cue, with the exact treatment deferred to
the browser milestone. A Soul Shrine purchase spends its cached price, restores
both lifespan integers to 99, increments the hidden extension count once, and
resets emergency eligibility. The active tick that follows command processing
then applies the ordinary lifespan drain.

Player state and each nested equipment, HP, and inventory value are frozen.
Stepping a JSON-restored checkpoint copies those values back into frozen domain
state.

## Encounter generation

A fresh run first draws `random(3)` for the initial number of shops before a
battle. It then calls the encounter generator three times to fill the upcoming
queue and draws `random(1000)` for the initial world-space counter. A count at
or below zero consumes `random(3)`, resets the next count to one through three,
and clears the Bladesmith, Armorsmith, and Soul Shrine duplicate flags. The same
generation call then selects and scales the battle enemy.

Ordinary battles consume `random(3)` for Goblin, Golem, or Wolf. From day 7
onward, when no Dragon is already queued, generation first consumes
`random(100)` and selects Dragon when the result is less than `3 * (day - 7)`.
Day 7 consumes the check with a zero-percent threshold, day 8 has a 3 percent
chance, day 40 has a 99 percent chance, and day 41 onward is guaranteed. A
successful Dragon check skips the ordinary-enemy draw. Days 1 through 6 and a
set Dragon flag skip the Dragon check and draw the ordinary enemy directly.

All enemy values are fixed when the battle enters the queue. Goblin uses HP
`600 + 60 * day`, attack `82 + 40 * day`, gold `70 + 12 * day`, and profile EXP
`10 + 3 * day`. Golem uses `860 + 120 * day`, `40 + 28 * day`,
`78 + 14 * day`, and `9 + 4 * day`. Wolf uses `450 + 44 * day`,
`94 + 56 * day`, `78 + 14 * day`, and `8 + 5 * day`. Dragon uses
`2400 + 300 * day`, `160 + 80 * day`, `350 + 60 * day`, and
`40 + 25 * day`.

Queueing a Dragon sets hidden generation state that blocks another Dragon. The
flag remains set while later ordinary battles wait in the queue. It clears when
an ordinary battle becomes current, before that promotion generates its
replacement. Authoritative state stores each queued enemy snapshot. Public
observation hides enemy identity on future battles and reveals it only on the
current positioned battle.

A shop generation call consumes `random(100)`. The exact accepted ranges are
66 through 99 for Bladesmith, 31 through 65 for Armorsmith, 26 through 30 for
Soul Shrine, 11 through 25 for Pharmacy, 6 through 10 for Grim's Shop, and 0
through 5 for Voucher Store. Voucher candidates reroll on days 1 through 3.
Accepted equipment and normal Shrine candidates set their per-cycle duplicate
flag; another candidate of the same type rerolls. Item shops can repeat.

Every accepted shop stores its integer price on the queue entry. Bladesmith
uses `200 + 36 * currentWeaponTier`; Armorsmith uses
`150 + 54 * currentArmorTier`. Shrine uses `50 + 70 * successfulPurchases`,
and the item shop prices are 150, 200, and 500.

The hidden Shrine state stores the successful-purchase count, an emergency
threshold from 40 through 49, and whether the current restoration cycle already
received its emergency chance. A shop is forced to Shrine when whole lifespan
is strictly below the threshold, no chance has been given, and the current
battle cycle has no Shrine. The force bypasses the ordinary shop roll, rerolls
the threshold with one `random(10)` draw, and records that the chance was given.
It does not set the normal Shrine duplicate flag, so one later normal Shrine can
still occur in that battle cycle. A battle clears the duplicate flag but not the
chance flag. Only a successful Shrine purchase clears the chance flag.

The queue, enemy snapshots, duplicate flags, Dragon flag, counters, positions,
and complete post-generation random state are authoritative, serializable, and
deeply frozen. Ordinary `GameObservation` publishes the current encounter and
three upcoming entry kinds, but not future enemy identity, the distance counter,
generation flags, or random state.

The research confirms the queue, distance, and emergency-threshold draws but
does not establish their relative order during initialization or refill. The
clean-room order fills the initial queue, draws its distance, and then draws the
initial emergency threshold. A promotion updates Dragon state for the promoted
battle, generates the replacement entry, and then draws the later distance.
This keeps the choice visible without claiming that the original Flash runtime
used the same initialization or refill order.

Run-state schema version 11 adds enemy snapshots and hidden Dragon state.
Version 10 added hidden Shrine extension and emergency state. Version 9 added
equipment names to the authoritative player state. Version 8 added the current
shop's one-use purchase state.
Gameplay traces and run results remain at schema version 2. The locked seed
`encounter-host-parity` produces encounter hash
`sha256-v1:c4bf0b847f029df30bc8eea291d4d6db844f2f4d3e76077e7de81c08552d2e46`
and initial state hash
`sha256-v1:c37275062ee662954667cef15c7974198ad97c011a7325860f3259644a18199d`
in both Node and Chromium.

## Encounter world lifecycle

The initial counter is `1000 + random(1000)`. Every promotion resets it to
`1500 + random(300)`. Active running ticks subtract the current movement speed.
When a due encounter can enter, the first queue entry becomes current at x 600
and one generated replacement restores the queue to three entries.

Shops move left by half the running speed. A supported current item shop is
purchase-eligible only during active running, while unused, while affordable,
and only while `0 < x < 420`. A shop departs below x -100 and emits
`shop-departed` whether it was used or passed.

Battles move left by the full running speed. Crossing below x 420 changes the
phase to `battle-handoff` and emits `battle-handoff`. Later steps freeze
distance, day, score, the encounter counter, and the current battle position.
They still advance active ticks and lifespan until pause, a tutorial, run death,
or future Milestone 4 combat changes the state. No enemy, reward, auto-win, or
battle resolution exists in this handoff.

Promotion emits `encounter-promoted` with the positioned current encounter.
All three encounter events are semantic domain outcomes. Canvas redraws and
interpolation consume observations without stepping or changing purchase
eligibility.

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

Item use, combat resolution, and tutorial presentation remain assigned to later
tickets.

State, results, events, event lists, and observations are frozen. A
JSON-restored checkpoint produces the same next state, observation, and events
as uninterrupted execution. Browser and headless parity traces are described in
[`gameplay-diagnostics.md`](gameplay-diagnostics.md).

The complete no-gameplay-action lifecycle, including explicit tutorial and
pause release commands, is covered by the
[`Milestone 2 lifecycle verification`](milestone-2-lifecycle-verification.md).
