# Presentation, timing, and UI

## SWF and frame timing

| Property         | Value                               | Status                                          |
| ---------------- | ----------------------------------- | ----------------------------------------------- |
| Stage            | 480x320 pixels                      | CONFIRMED SWF header                            |
| Frame rate       | 30 fps                              | CONFIRMED SWF header                            |
| Main timeline    | 10 frames                           | CONFIRMED SWF header                            |
| SWF version      | 9, ZLIB compressed                  | CONFIRMED SWF header                            |
| Virtual machine  | AVM1                                | CONFIRMED `actionScript3=false` and action tags |
| Pregame delay    | 60 active frames, about 2.0 seconds | CONFIRMED value; DERIVED seconds                |
| Post-death delay | 60 active frames, about 2.0 seconds | CONFIRMED value; DERIVED seconds                |

**CONFIRMED** Timing is frame-based. The game does not read wall-clock delta
time. A faithful simulation therefore advances gameplay in 30 Hz logical
ticks; frame drops in the original player would slow game time rather than
cause delta-time catch-up.

## Main timeline and screens

| Frame | Label         | Content/state                                   | Status    |
| ----: | ------------- | ----------------------------------------------- | --------- |
|     1 | `preloader`   | Loading bar/percentage and Kongregate site lock | CONFIRMED |
|     2 | `loader`      | Initialization and all core functions/constants | CONFIRMED |
|     3 | `splash`      | Branding splash                                 | CONFIRMED |
|     4 | `title`       | Main menu                                       | CONFIRMED |
|     5 | `achievement` | Achievements and equipment collections          | CONFIRMED |
|     6 | `credits`     | Credits and links                               | CONFIRMED |
|     7 | `game`        | Dynamically constructed gameplay scene          | CONFIRMED |
|     8 | `score`       | End-of-run score/profile transfer               | CONFIRMED |
|     9 | `mokap`       | Static gameplay HUD mockup/debug composition    | CONFIRMED |
|    10 | unlabeled     | Continuation/remnant of mockup content          | CONFIRMED |

**CONFIRMED** Static rendering of frame 7 is black because `initGame()` creates
the scene and UI dynamically. It is not evidence that gameplay itself is
blank. Static frame 4 omits menu pieces that slide in under ActionScript.

## UI states and controls

### Title

**CONFIRMED** Title offers Start, Achievements, Credits, More Games, an App
Store promotional link, and a tutorial on/off control. Menu elements animate
into place. A valid Kongregate host is required by the site-lock code.

### Gameplay HUD

**CONFIRMED** The runtime creates:

- Bottom status area: hero HP, weapon and ATK, armor, score, day, and carried
  item.
- Top status area: lifespan, gold, one current-event slot, and three queued
  event slots. The current slot is blank while no event is active.
- Context cursor: building/item name, description, and cached price or warning.
- Battle overlay: enemy name and HP bar.
- Announcements/transitions: event names, purchases, item use, battle, and
  death.

**CONFIRMED** The HUD therefore displays up to four events: current plus the
three-entry queue. Shop price is stored with its queue entry, which is why its
display and eventual charge can lag behind intervening upgrades.

### Score

**CONFIRMED** Score screen counts profile EXP, updates high score/profile level,
then exposes Run Again, Achievements, Main Menu, More Games, and a Twitter
share action. It submits run score and progression stats to Kongregate.

### Input

| Input       | Action                                                                             | Status    |
| ----------- | ---------------------------------------------------------------------------------- | --------- |
| Mouse click | Buy from an in-range building; use carried item in battle; activate screen buttons | CONFIRMED |
| `P`         | Toggle pause in gameplay                                                           | CONFIRMED |
| `M`         | Toggle music                                                                       | CONFIRMED |
| `S`         | Toggle sound effects                                                               | CONFIRMED |

**CONFIRMED** Invalid building/item actions show error feedback rather than
changing state. Shop buildings are only actionable in their x-position window;
items are battle-only.

## Tutorials

The tutorial panel has six timeline pages:

| Index | Subject/trigger                     | Status    |
| ----: | ----------------------------------- | --------- |
|     0 | Basic survival/running introduction | CONFIRMED |
|     1 | Encounter and building interaction  | CONFIRMED |
|     2 | Soul Shrine/lifespan restoration    | CONFIRMED |
|     3 | Automatic battle and item use       | CONFIRMED |
|     4 | Low lifespan warning                | CONFIRMED |
|     5 | Low HP warning                      | CONFIRMED |

**CONFIRMED** Page 0 is invoked unconditionally at run initialization. Other
tutorial calls are gated by the saved tutorial preference. The score screen
sets that preference to off (`1`), so later contextual pages are disabled after
a completed first run unless the title toggle changes it.

**UNKNOWN** Whether unconditional page 0 was intended to ignore the preference
or is a bug. The code behavior itself is confirmed.

## Character MovieClips and combat timelines

| Symbol ID/name    | Frames | Labels                                               | Status    |
| ----------------- | -----: | ---------------------------------------------------- | --------- |
| 397 `EnemyDragon` |     53 | idle 1, move 17, attack 27, attackcont 40, flinch 47 | CONFIRMED |
| 421 `EnemyGoblin` |     53 | idle 1, move 14, attack 27, attackcont 40, flinch 47 | CONFIRMED |
| 446 `EnemyGolem`  |     57 | idle 1, move 18, attack 31, attackcont 44, flinch 51 | CONFIRMED |
| 477 `EnemyWolf`   |     55 | idle 1, move 18, attack 31, attackcont 42, flinch 49 | CONFIRMED |
| 497 `Hero`        |     62 | idle 1, move 17, attack 34, attackcont 49, flinch 56 | CONFIRMED |

Animation callbacks:

| Actor  | `ishit` frame | First `attackfinished`/stop | Additional finish | Status    |
| ------ | ------------: | --------------------------: | ----------------: | --------- |
| Dragon |            33 |                          39 |                46 | CONFIRMED |
| Goblin |            33 |                          39 |                46 | CONFIRMED |
| Golem  |            37 |                          43 |                50 | CONFIRMED |
| Wolf   |            37 |                          41 |                48 | CONFIRMED |
| Hero   |            40 |                          48 |                55 | CONFIRMED |

**CONFIRMED** All hit callbacks occur six frames after the attack label. The
first attack segment lasts through the stop/finish callback: Hero 15 displayed
frames, Dragon/Goblin/Golem 13, and Wolf 11 when counted inclusively.

## Other named MovieClips

| ID/name                  | Frames | Role                   | Status    |
| ------------------------ | -----: | ---------------------- | --------- |
| 7 `InterfaceAction`      |      1 | Action prompt          | CONFIRMED |
| 9 `EnemyHPBar`           |      1 | Enemy HP fill          | CONFIRMED |
| 24 `Cursor`              |      3 | Context cursor states  | CONFIRMED |
| 94 `DamageNum`           |     40 | Floating damage        | CONFIRMED |
| 118 `FXBuy`              |     30 | Purchase effect        | CONFIRMED |
| 133 `FXHit`              |      8 | Hit effect             | CONFIRMED |
| 151 `FXItem`             |     30 | Item-use effect        | CONFIRMED |
| 153 `FXUpgrade`          |     30 | Upgrade effect         | CONFIRMED |
| 189 `InterfaceAnnounce`  |    126 | Major announcement     | CONFIRMED |
| 193 `InterfaceAnnounce2` |     95 | Secondary announcement | CONFIRMED |
| 196 `InterfaceAvatar`    |      1 | Hero portrait/status   | CONFIRMED |
| 214 `InterfaceBottom`    |      1 | Bottom HUD             | CONFIRMED |
| 220 `InterfaceDead`      |      5 | Death overlay          | CONFIRMED |
| 223 `InterfaceEnemyHP`   |      1 | Enemy battle panel     | CONFIRMED |
| 231 `InterfaceExistence` |      1 | Lifespan display       | CONFIRMED |
| 235 `InterfaceGold`      |      1 | Gold display           | CONFIRMED |
| 241 `InterfaceHP`        |      1 | Hero HP display        | CONFIRMED |
| 245 `InterfaceInfo`      |     74 | Context information    | CONFIRMED |
| 250 `InterfaceInventory` |      1 | Item slot              | CONFIRMED |
| 259 `InterfaceLifespan2` |      1 | Alternate lifespan UI  | CONFIRMED |
| 264 `InterfaceNext`      |      1 | Encounter queue slot   | CONFIRMED |
| 267 `InterfaceScore`     |      1 | Score display          | CONFIRMED |
| 311 `MouseEffect`        |     60 | Click feedback         | CONFIRMED |
| 349 `PanelTutorial`      |      6 | Tutorial pages         | CONFIRMED |
| 353 `TransBlack`         |     10 | Black transition       | CONFIRMED |
| 355 `TransitionBattle`   |     35 | Battle transition      | CONFIRMED |
| 356 `TransWhite`         |     15 | White transition       | CONFIRMED |
| 359 `BGBack`             |      1 | Rear parallax layer    | CONFIRMED |
| 362 `BGFront`            |      1 | Front parallax layer   | CONFIRMED |
| 365 `BGMid`              |      1 | Middle parallax layer  | CONFIRMED |
| 368 `Building`           |      1 | Shop container         | CONFIRMED |
| 369 `Effect-Flash`       |     10 | Flash effect           | CONFIRMED |
| 499 `Transition`         |     25 | General transition     | CONFIRMED |
| 511 `InterfacePause`     |      1 | Pause overlay          | CONFIRMED |

This list prioritizes named gameplay symbols. Unnamed wrapper and decorative
sprites remain available in `swf.xml` and raw exports.

## Audio

**CONFIRMED** The primary export includes 17 sound entries. Gameplay BGM symbol
512 is started with 9,999 loops and faded toward volume 90. SFX symbols 513-527
cover UI/combat events and respect the saved sound toggle.

**UNKNOWN** Exact perceived audio timing and codec/player differences were not
validated in a live Flash runtime. Exported sound bytes are preserved under
`exports/assets/raw/sounds/` for later inspection.

## Reference exports

**CONFIRMED** `exports/screenshots/main-timeline/` contains all ten
deterministically rendered main frames. `exports/assets/key-sprites/` contains
every frame of Hero, Dragon, Goblin, Golem, and Wolf. The curated subset is in
`exports/assets/representative/`.

**UNKNOWN** A working live runtime screenshot was not obtained: the current
Kongregate wrapper rendered blank in the available Chromium environment and
modern browsers do not execute Flash. No blank/browser image is included as
evidence.
