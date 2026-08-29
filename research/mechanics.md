# Mechanics specification

## State and core loop

| Rule/value                                                                                                                                                     | Status    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Screen states are title, achievement, credits, game, and score.                                                                                                | CONFIRMED |
| Gameplay states are running, battling, and end; pause and tutorial are additional gates.                                                                       | CONFIRMED |
| A run starts with 300 gold, score 0, distance 0, day/enemy level 1, weapon tier 1, armor tier 1, one Elixir, and lifespan `99.99%`.                            | CONFIRMED |
| The first three queue slots are filled by three calls to `randomizeEvent()`.                                                                                   | CONFIRMED |
| Movement speed starts at 0 and gains 1 per active running frame to a maximum of 15.                                                                            | CONFIRMED |
| During running, each active frame adds movement speed to distance and subtracts it from the next-event counter.                                                | CONFIRMED |
| During battle, distance, day advancement, encounter movement, and event countdown stop; lifespan and combat continue. Parallax briefly coasts as speed decays. | CONFIRMED |
| Pausing or showing a tutorial stops the active gameplay update, including lifespan drain and combat animation progression.                                     | CONFIRMED |
| The game is endless; there is no final day, dragon ending, or win state in the game logic.                                                                     | CONFIRMED |

**CONFIRMED** Running parallax moves the rear layer at `speed/10`, middle at
`speed/5`, and front at full movement speed. The hero runs near `(50, 200)`,
selecting a cosmetic target at x 50-149 and y 200-214 every 60-89 frames.

**CONFIRMED** On entering battle, movement speed falls by 1 per active frame
until zero while parallax continues to use that declining value. After victory,
running acceleration starts again from zero. **DERIVED** A full-speed battle
entry therefore coasts for 15 frames (0.5 seconds) before scenery fully stops.

## Distance, days, and encounter spacing

| Rule/value                                                                                                                       | Status                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Day `D = floor(distance / 7000) + 1`.                                                                                            | CONFIRMED                                         |
| The initial event counter is `1000 + random(1000)`, hence 1000-1999 distance units.                                              | CONFIRMED                                         |
| Each later event counter is `1500 + random(300)`, hence 1500-1799 distance units.                                                | CONFIRMED                                         |
| At maximum speed, later events begin every 100-120 running frames, about 3.33-4.00 seconds.                                      | DERIVED from distance range, speed 15, and 30 fps |
| Buildings enter at x=600, move left at half running speed, accept clicks only while `0 < x < 420`, and are removed below x=-100. | CONFIRMED                                         |
| At speed 15, the strict building click interval lasts approximately 56 frames or 1.87 seconds.                                   | DERIVED from 420 units / 7.5 units per frame      |
| Enemies enter at x=600, move left at full running speed, and start battle below x=420.                                           | CONFIRMED                                         |

## Encounter queue and RNG

**CONFIRMED** AVM1 `random(n)` returns an integer in `0..n-1`. The game uses
that primitive directly. The exact pseudorandom generator and seed are runtime
properties and are **UNKNOWN** from the SWF alone.

Event IDs are:

|  ID | Encounter                    | Status    |
| --: | ---------------------------- | --------- |
|   1 | Bladesmith (weapon upgrade)  | CONFIRMED |
|   2 | Armorsmith (armor upgrade)   | CONFIRMED |
|   3 | Soul Shrine                  | CONFIRMED |
|   4 | Pharmacy (Elixir)            | CONFIRMED |
|   5 | Grim's Shop (Divine Edge)    | CONFIRMED |
|   6 | Voucher Store (Gold Voucher) | CONFIRMED |
|   7 | Battle                       | CONFIRMED |
|   8 | Empty/no event sentinel      | CONFIRMED |

**CONFIRMED** `encountercount` starts as `random(3)` (0-2). Whenever it is at
or below zero, generation resets it to `random(3)+1` (1-3), queues a battle,
and clears the per-cycle weapon, armor, and shrine duplicate flags. Otherwise a
shop is queued and the counter decrements. Therefore each cycle places one to
three shops between battles, subject to the initial counter and forced shrine.

Normal shop roll (`rand = random(100)`):

| Integer range | Probability | Result                                       | Status    |
| ------------- | ----------: | -------------------------------------------- | --------- |
| 66-99         |         34% | Bladesmith                                   | CONFIRMED |
| 31-65         |         35% | Armorsmith                                   | CONFIRMED |
| 26-30         |          5% | Soul Shrine                                  | CONFIRMED |
| 11-25         |         15% | Pharmacy                                     | CONFIRMED |
| 6-10          |          5% | Grim's Shop                                  | CONFIRMED |
| 0-5           |          6% | Voucher Store from day 4; reroll on days 1-3 | CONFIRMED |

**CONFIRMED** A weapon shop, armor shop, and normal Soul Shrine can each occur
at most once between generated battles. A duplicate candidate recursively
rerolls. Item shops can repeat.

**DERIVED** On days 1-3, ignoring duplicate rejection and forced shrines, the
Voucher branch rerolls and normalizes the allowed weights to: weapon `34/94`,
armor `35/94`, shrine `5/94`, Pharmacy `15/94`, and Grim `5/94`. Full queue
probabilities are history-dependent because duplicate rejection also rerolls.

**CONFIRMED** `lastchancerate` starts at 40-49. If current whole lifespan is
below it, no emergency chance has been given since the last restoration, and a
shrine is not already in the cycle, the next shop is forced to Soul Shrine.
The threshold is then rerolled and `hasgivenchance` becomes true. It resets only
after buying a Soul Shrine, so passing the forced shrine does not grant another
emergency shrine in that restoration cycle.

## Enemies and scaling

All formulas use current day `D`. All enemies have movement speed 10 and use
the same combat state machine; there is no defense stat.

| Enemy  | Type |        Max HP |         ATK |        Gold | Profile EXP | Status    |
| ------ | ---: | ------------: | ----------: | ----------: | ----------: | --------- |
| Goblin |    0 |   `600 + 60D` |  `82 + 40D` |  `70 + 12D` |   `10 + 3D` | CONFIRMED |
| Golem  |    1 |  `860 + 120D` |  `40 + 28D` |  `78 + 14D` |    `9 + 4D` | CONFIRMED |
| Wolf   |    2 |   `450 + 44D` |  `94 + 56D` |  `78 + 14D` |    `8 + 5D` | CONFIRMED |
| Dragon |    3 | `2400 + 300D` | `160 + 80D` | `350 + 60D` |  `40 + 25D` | CONFIRMED |

**CONFIRMED** Goblin, Golem, and Wolf are selected uniformly with
`random(3)` whenever an ordinary battle is generated.

## Dragon mechanics

**CONFIRMED** Before day 7, and whenever `dragonspawned` is already true, the
next battle is an ordinary enemy. Otherwise generation rolls `random(100)` and
selects Dragon when `rand < 3 * (D - 7)`; a failed roll is ordinary.

| Day | Dragon chance when eligible | Status                                                           |
| --: | --------------------------: | ---------------------------------------------------------------- |
|   7 |                          0% | CONFIRMED                                                        |
|   8 |                          3% | CONFIRMED                                                        |
|   9 |                          6% | CONFIRMED                                                        |
|  10 |                          9% | CONFIRMED                                                        |
|  20 |                         39% | CONFIRMED                                                        |
|  40 |                         99% | CONFIRMED                                                        |
| 41+ |                        100% | DERIVED because the threshold exceeds every `random(100)` result |

**CONFIRMED** This chance is evaluated when a battle entry is generated, not
on every frame or shop. The dragon flag prevents consecutive queued dragons;
an ordinary enemy becoming current clears the flag. Dragon combat has no
special attacks, resistances, or phases: its differences are stats, sprite,
reward, and achievement/stat hooks.

**CONFIRMED** Killing a Dragon unlocks internal achievement 0 and submits
Kongregate `HasKilledDragon=1` and additive `DragonKilled=1`. Killing a dragon
does not end the run.

## Combat state machine and timing

**CONFIRMED** `startBattle()` sets both actors idle, resets the hero's attack
delay to zero, resets the hero attack multiplier to 1, and exposes the carried
item. Actor AI proceeds through idle, move, attack, flinch, and dead states.

| State rule                                                                                                             | Status    |
| ---------------------------------------------------------------------------------------------------------------------- | --------- |
| Idle decrements `attackdelay`; at zero or below, the actor changes to move.                                            | CONFIRMED |
| Move advances hero +10 x or enemy -10 x each active frame until horizontal separation is below 30, then starts attack. | CONFIRMED |
| An animation frame sets `ishit`; AI then calls the damage routine.                                                     | CONFIRMED |
| An animation frame sets `attackfinished`; AI returns the actor to idle after applying its post-attack delay.           | CONFIRMED |
| Each hit increments attacker `numattack` and resets defender `numattack` to zero.                                      | CONFIRMED |
| Hero delay is `random(24) + 4*numattack`; enemy delay is `random(24) + 12*numattack`.                                  | CONFIRMED |
| Flinch knockback starts at `10 + random(7)` (10-16) and is multiplied by 0.8 each frame until below 1.                 | CONFIRMED |
| Hero is knocked left; enemy is knocked right. Flinch temporarily prevents that actor from attacking.                   | CONFIRMED |

Animation-driven hit and completion points at 30 fps:

| Actor  | Attack label | Hit frame | Finish/stop frame |       Hit latency | Status    |
| ------ | -----------: | --------: | ----------------: | ----------------: | --------- |
| Hero   |           34 |        40 |                48 | 6 frames / 0.20 s | CONFIRMED |
| Dragon |           27 |        33 |                39 | 6 frames / 0.20 s | CONFIRMED |
| Goblin |           27 |        33 |                39 | 6 frames / 0.20 s | CONFIRMED |
| Golem  |           31 |        37 |                43 | 6 frames / 0.20 s | CONFIRMED |
| Wolf   |           31 |        37 |                41 | 6 frames / 0.20 s | CONFIRMED |

**CONFIRMED** The damage calculation is:

```text
base   = attacker.ATK * attacker.attackFactor
damage = base + round(random(20) / 100 * base)
```

`random(20)` is 0-19, so normal random bonus is 0%-19% of base, rounded to an
integer. For hero attacks only, `random(100)+1 > 90` doubles final damage: an
exact 10% critical chance. There are no misses, armor reductions, or damage
caps.

**CONFIRMED** Attack range tests horizontal x separation only; actor y position
does not affect targeting, hit chance, or damage.

**CONFIRMED** A Divine Edge sets hero `attackFactor=100`; it can also crit, for
200 times the pre-item base before the 0%-19% bonus. The factor lasts for the
current battle because the next `startBattle()` resets it.

**CONFIRMED** Lethal damage sets the attacker's delay to 600, marks the target
dead, and begins an alpha fade of 10 per active frame. An enemy reward is paid
after the fade; hero death enters the run-end transition. **DERIVED** From an
initial alpha of 100, the fade is about 10 active frames (0.33 seconds).

## Lifespan

**CONFIRMED** Lifespan uses two integers: `existence=99` and
`existencedec=99`. Each active running or battle frame subtracts 4 from the
fraction. At zero or below, the fraction resets to 99 and whole existence
decrements. Death occurs when whole existence becomes negative.

| Rule/value                                                                                                        | Status                                      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Display starts at `99.99%`, not 100%.                                                                             | CONFIRMED                                   |
| One displayed whole percentage is lost every 25 active frames.                                                    | DERIVED from decrement 4 and reset behavior |
| With no shrine or pauses, death occurs after 2,500 active gameplay frames, approximately 83.33 seconds at 30 fps. | DERIVED by tracing 100 groups of 25 frames  |
| Lifespan drains in both running and battle.                                                                       | CONFIRMED                                   |
| Lifespan does not drain while paused or while a tutorial panel gates gameplay.                                    | CONFIRMED                                   |
| Buying a Soul Shrine restores both fields to 99 and resets emergency-shrine eligibility.                          | CONFIRMED                                   |
| Under 25%, running-state hero alpha is calculated from remaining lifespan, producing a fade toward zero.          | CONFIRMED                                   |
| The under-25% alpha update is made only in running state even though lifespan continues falling in combat.        | CONFIRMED                                   |

## Weapons and armor

**CONFIRMED** Weapon attack is `129 + 87L`; armor maximum HP is
`1009 + 899L`, for tier `L`. The price shown is the price to advance from the
prior tier when a fresh shop entry is queued.

| Tier | Weapon       | ATK | Fresh price to reach | Armor         | Max HP | Fresh price to reach | Status    |
| ---: | ------------ | --: | -------------------: | ------------- | -----: | -------------------: | --------- |
|    1 | Dagger       | 216 |                Start | Clothing      |  1,908 |                Start | CONFIRMED |
|    2 | Sword        | 303 |                  236 | Protector     |  2,807 |                  204 | CONFIRMED |
|    3 | Rapier       | 390 |                  272 | Breastplate   |  3,706 |                  258 | CONFIRMED |
|    4 | Falchion     | 477 |                  308 | Chainmail     |  4,605 |                  312 | CONFIRMED |
|    5 | Katana       | 564 |                  344 | Fullplate     |  5,504 |                  366 | CONFIRMED |
|    6 | Flamberge    | 651 |                  380 | Samurai Mail  |  6,403 |                  420 | CONFIRMED |
|    7 | Zweihander   | 738 |                  416 | Valkyrie Garb |  7,302 |                  474 | CONFIRMED |
|    8 | Broad Kris   | 825 |                  452 | Odin Garb     |  8,201 |                  528 | CONFIRMED |
|    9 | Excalibur    | 912 |                  488 | Avalon        |  9,100 |                  582 | CONFIRMED |
|   10 | Astral Sword | 999 |                  524 | Astral Armor  |  9,999 |                  636 | CONFIRMED |

**CONFIRMED** The constant name arrays also contain index-zero `Barehand` and
`Barebody`, but normal initialization begins at tier 1. Tiers cap at 10.

**CONFIRMED** Weapon shop price is `200 + 36*currentWeaponTier`; armor shop
price is `150 + 54*currentArmorTier`. The price is cached when the encounter is
queued, not recalculated when clicked. An armor upgrade recomputes maximum HP
and fully heals; a weapon upgrade only recomputes attack.

**CONFIRMED** The HUD has one current-event slot plus three queued-event slots.
The same-type duplicate flags reset as soon as a battle is _queued_, so this
four-slot window can show two weapon shops or two armor shops when the entries
are separated by that battle boundary. Both shops may have been priced before
the first upgrade is purchased.

For example, if two visible weapon shops were queued while the player was at
weapon tier 1, both cache `200 + 36*1 = 236`. Buying the first advances to tier
2 for 236 gold; buying the already-queued second advances to tier 3 for another
236 gold. A weapon shop generated after reaching tier 2 would instead cost 272.
The equivalent armor case charges 204 twice rather than 204 then 258. All
values and the cache behavior are **CONFIRMED** directly from the SWF.

**CONFIRMED** At tier 10 the cursor appends `(LV MAX)`. A click with enough gold
enters the purchase function but performs no upgrade, spends no gold, and does
not mark the building used; with insufficient gold it plays the normal error.

**UNKNOWN** Whether the preserved online GUI dispatches that click at tier 10
is not established by the static scripts. A player report describes a red-cross
cursor and no interaction for max-tier equipment shops. That runtime report has
not yet been reproduced against the preserved Kongregate artifact.

**CONFIRMED** Buying a cached shop after another same-type shop can therefore
use an earlier tier's cheaper price. This is observable code behavior, likely a
pricing bug rather than an intended discount.

## Shops and items

| Shop          |                Price | Effect                                             | Status    |
| ------------- | -------------------: | -------------------------------------------------- | --------- |
| Soul Shrine   | `50 + 70*xextension` | Restore lifespan to 99.99%; increment `xextension` | CONFIRMED |
| Pharmacy      |                  150 | Replace carried item with Elixir                   | CONFIRMED |
| Grim's Shop   |                  200 | Replace carried item with Divine Edge              | CONFIRMED |
| Voucher Store |                  500 | Replace carried item with Gold Voucher             | CONFIRMED |

**CONFIRMED** Soul Shrine prices across successful purchases are 50, 120, 190,
260, and so on. The game has one inventory slot. A purchase overwrites the
current item, including buying the same item again. Weapon and armor shops have
the formulas in the prior section.

| Item         | Exact effect                                     | Use restriction | Status    |
| ------------ | ------------------------------------------------ | --------------- | --------- |
| Elixir       | Set hero HP to current maximum HP                | Battle only     | CONFIRMED |
| Divine Edge  | Set hero attack factor to 100 for current battle | Battle only     | CONFIRMED |
| Gold Voucher | Multiply current enemy gold reward by 10         | Battle only     | CONFIRMED |

**CONFIRMED** Items are consumed immediately on valid use. They cannot be used
outside battle. The cursor descriptions are “Full HP Recovery,” “10000%
Damage,” and “1000% Gold,” which agree with the code factors.

**CONFIRMED** The Pharmacy purchase announcement says `Potion`, while the
inventory, battle hint, and item table call the resulting item `Elixir`.

## Gold and economy

**CONFIRMED** A run begins with 300 gold. Enemy gold follows the enemy table;
there is no gold drop roll. Gold Voucher multiplies the already-scaled enemy
reward by 10. Shop spending and enemy rewards are the only gold mutations in
the gameplay code.

**CONFIRMED** Purchases require `gold >= cachedPrice`, subtract exactly that
integer, and have no resale, interest, or refund. Gold is integer-valued.

**CONFIRMED** The 3,000-gold internal achievement check occurs after an enemy
reward. Since combat rewards are the only income source, this normally detects
the first reward that leaves the balance at or above 3,000.

## Run score and profile progression

**CONFIRMED** Let `M` be the stored profile score multiplier.

| Rule                           | Formula/value                              | Status                                   |
| ------------------------------ | ------------------------------------------ | ---------------------------------------- |
| Running score per active frame | `movementSpeed * 10 * M`                   | CONFIRMED                                |
| Kill score                     | `enemy.maxHP * 10 + enemy.ATK * 60 * M`    | CONFIRMED, including operator precedence |
| Profile EXP reward             | Enemy-specific formula in enemy table      | CONFIRMED                                |
| Level threshold                | `100 + profileLevel * 30`                  | CONFIRMED                                |
| Level-up condition             | Strictly `profileXP > threshold`, not `>=` | CONFIRMED                                |
| New multiplier                 | `1 + newProfileLevel / 10`                 | CONFIRMED                                |

**CONFIRMED** The multiplier applies only to the enemy-ATK term of kill score,
not the max-HP term. Initial profile data is level 1, XP 0, multiplier 1.0;
this is an explicit special initial value rather than 1.1.

**CONFIRMED** At the score screen, earned EXP transfers into the profile at up
to 3 points per frame. On level-up, XP resets to zero and excess is discarded.
Long transfers may cause multiple level-ups. The run score is submitted to
Kongregate and compared with the local high score.

**CONFIRMED** Displayed score advances by `round(finalScore/90)` per frame and
caps at the final value. Score and EXP count simultaneously; navigation buttons
remain hidden/disabled until both counts finish.

## Persistence

**CONFIRMED** The game uses AVM1 `SharedObject.getLocal("tksave", "/")`.
Persistent data contains profile level, XP, multiplier, high score, tutorial
preference, ten weapon discoveries, ten armor discoveries, and six achievement
slots.

**CONFIRMED** Normal save is invoked after score/EXP counting completes.
**DERIVED** Closing the player before that completion can lose discoveries or
achievements from the current run because no earlier durable flush is visible
in the gameplay path.

## Achievements and collections

Internal achievements defined by name and unlock code:

| Index | Name                      | Condition                                 | Status                                                        |
| ----: | ------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
|     0 | Slay a Dragon             | Kill any Dragon                           | CONFIRMED                                                     |
|     1 | Stashed 3000 Gold         | Reach at least 3,000 gold after a reward  | CONFIRMED                                                     |
|     2 | Reach Day #10             | Day becomes 10 or higher                  | CONFIRMED                                                     |
|     3 | Get all Collection        | Discover all 10 weapons and all 10 armors | CONFIRMED                                                     |
|     4 | Perform 70000+ Damage     | One computed hit is at least 70,000       | CONFIRMED                                                     |
|     5 | No defined name/condition | Allocated but unused                      | UNKNOWN intended purpose; CONFIRMED absence in inspected code |

**CONFIRMED** Tier 1 weapon and armor begin discovered. Purchasing a tier marks
it discovered. Collection progress is `(weaponCount + armorCount) * 3.5`, for
70 total points. Each of the five defined achievements contributes 6 points,
for 30 more. Total game progress is therefore 100%; a new profile starts at 7%.

Kongregate-facing badges/stats embedded in the wrapper:

| Badge/stat                     | Condition/type                                                                 | Status                              |
| ------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------- |
| Gearing Up (5 points)          | `ArmorUnlocked >= 3` and `WeaponUnlocked >= 3`                                 | CONFIRMED wrapper metadata          |
| Run Fast, Die Old (15 points)  | `Day >= 10`                                                                    | CONFIRMED wrapper metadata          |
| Dragon Age Endings (30 points) | `HasKilledDragon >= 1`                                                         | CONFIRMED wrapper metadata          |
| Other submitted stats          | `DragonKilled` additive; `GameProgress`, `Level`, `Score`, weapon/armor counts | CONFIRMED code and wrapper metadata |

**CONFIRMED** The achievement screen contains a submission defect: both the
armor count and weapon count are submitted to `WeaponUnlocked`; the first call
appears intended for `ArmorUnlocked`. This can affect the Gearing Up badge.

**CONFIRMED** Newgrounds lists a separate “1.3b NG” portal build with medals.
Those medals are not treated as authoritative for this Kongregate artifact.
