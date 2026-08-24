# Evidence source map

Paths are relative to the workspace root.

| Evidence                           | Primary source                                                        | Status                                       |
| ---------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Core game functions/constants      | `decompiled/ffdec/actionscript/scripts/frame_2/DoAction.as`           | CONFIRMED                                    |
| Loading and Kongregate site lock   | `decompiled/ffdec/actionscript/scripts/frame_1/DoAction.as`           | CONFIRMED                                    |
| Title                              | `decompiled/ffdec/actionscript/scripts/frame_4/DoAction.as`           | CONFIRMED                                    |
| Achievement/collection screen      | `decompiled/ffdec/actionscript/scripts/frame_5/DoAction.as`           | CONFIRMED                                    |
| Credits                            | `decompiled/ffdec/actionscript/scripts/frame_6/DoAction.as`           | CONFIRMED                                    |
| Game entry                         | `decompiled/ffdec/actionscript/scripts/frame_7/DoAction.as`           | CONFIRMED                                    |
| Score/profile transfer             | `decompiled/ffdec/actionscript/scripts/frame_8/DoAction.as`           | CONFIRMED                                    |
| Hero animation events              | `decompiled/ffdec/actionscript/scripts/DefineSprite_497_Hero/`        | CONFIRMED                                    |
| Dragon animation events            | `decompiled/ffdec/actionscript/scripts/DefineSprite_397_EnemyDragon/` | CONFIRMED                                    |
| Goblin animation events            | `decompiled/ffdec/actionscript/scripts/DefineSprite_421_EnemyGoblin/` | CONFIRMED                                    |
| Golem animation events             | `decompiled/ffdec/actionscript/scripts/DefineSprite_446_EnemyGolem/`  | CONFIRMED                                    |
| Wolf animation events              | `decompiled/ffdec/actionscript/scripts/DefineSprite_477_EnemyWolf/`   | CONFIRMED                                    |
| Full tag/symbol/timeline structure | `decompiled/ffdec/swf.xml`                                            | CONFIRMED                                    |
| Raw exported media/text            | `exports/assets/raw/`                                                 | CONFIRMED                                    |
| Deterministic reference renders    | `exports/screenshots/` and `exports/assets/key-sprites/`              | CONFIRMED exports; not runtime captures      |
| Portal comparison code             | `decompiled/comparison/`                                              | CONFIRMED comparison evidence; non-normative |

## Core function locations

FFDec's primary source file is about 2,000 lines. Useful entry points are:

| Function/block      | Approximate line | Purpose                              |
| ------------------- | ---------------: | ------------------------------------ |
| `saveFile`          |                1 | SharedObject persistence             |
| `initGame`          |               44 | Initial run state, UI, event queue   |
| `useItem`           |              428 | Elixir, Divine Edge, Voucher         |
| `startBattle`       |              445 | Combat reset and state transition    |
| `spawnEvent`        |              470 | Materialize queued encounter         |
| `randomizeEvent`    |              602 | Queue generation and dragon roll     |
| `spawnBuilding`     |              707 | Shop construction and pricing        |
| `checkExistence`    |              764 | Lifespan drain/death                 |
| `updateEnemyLevel`  |              808 | Day scaling                          |
| `updateInterface`   |              822 | HUD state                            |
| `updateEvent`       |              937 | Passing buildings/enemies            |
| Main `onEnterFrame` |             1065 | Frame loop and state dispatch        |
| `behaveAI`          |             1173 | Automatic combat state machine       |
| `attackChara`       |             1366 | Damage, death, rewards               |
| `actBuilding`       |             1508 | Purchases and upgrades               |
| Constant tables     |      1653 onward | Names, formulas, assets, cursor text |

Line numbers are navigation aids tied to this FFDec version. P-code exports are
the fallback whenever reconstructed ActionScript precedence is in doubt.
