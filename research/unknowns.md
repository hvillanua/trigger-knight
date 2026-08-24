# Inference and unknown ledger

This file consolidates all non-confirmed points so they remain visible during a
future clean-room build and validation pass.

## Derived behavior

| Finding                                                               | Derivation                                                                                             | Confidence                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Lifespan without restoration lasts 2,500 active ticks / 83.33 s.      | Trace decrement by 4, fractional reset at `<=0`, 100 whole decrements, 30 fps.                         | High                                                      |
| Later encounter spacing is about 3.33-4.00 s at full speed.           | 1500-1799 distance divided by speed 15 and 30 fps.                                                     | High                                                      |
| Full-speed building click window is about 1.87 s.                     | Strict x range width 420 divided by building speed 7.5. Boundary tick can vary by initial subposition. | High                                                      |
| Enemy death fade takes about 0.33 s.                                  | Alpha decreases by 10 each tick from nominal 100.                                                      | High                                                      |
| Day 41+ eligible dragon rolls are guaranteed.                         | Threshold `3*(D-7)` is at least 102, above every integer 0-99.                                         | High                                                      |
| Closing before score counting finishes may lose current-run progress. | Durable save/flush is visible after score transfer, not at each unlock.                                | Medium; Flash host shutdown behavior is runtime-dependent |
| Kongregate build is the best normative v1.3 source.                   | Exact portal payload, embedded `v1.3`, readable unobfuscated core, and matching portal changelog.      | High                                                      |

## Unknowns requiring runtime or external evidence

| Unknown                                                         | Why it remains unknown                                                                                                                                    | Suggested validation                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Exact AVM1 PRNG algorithm and seed sequence                     | `random(n)` is a Flash Player primitive, not implemented in the SWF.                                                                                      | Compare Adobe projector versions or use a compatibility runtime with controlled launches.                   |
| Whether portal payload equals Mintsphere's private master bytes | Only distributed copies are publicly observable.                                                                                                          | Obtain a developer/archive master and compare SHA-256.                                                      |
| Intended purpose of achievement slot 5                          | Six slots are allocated/rendered but only indices 0-4 have names/unlock conditions.                                                                       | Search author source or developer notes; do not invent a sixth achievement.                                 |
| Intent of unconditional tutorial page 0                         | Code bypasses the tutorial preference only for page 0.                                                                                                    | Observe original projector and, if possible, consult author notes.                                          |
| Intent of dual `WeaponUnlocked` submission                      | Code sends armor and weapon counts to the same stat; wrapper defines `ArmorUnlocked`.                                                                     | Treat as a confirmed original defect; decide compatibility policy later.                                    |
| Intent of cached stale shop prices                              | Price belongs to the queued event, enabling two same-type shops visible across a battle boundary to grant successive upgrades at the same old-tier price. | Treat as confirmed original behavior; only the author's intent is unknown.                                  |
| Purpose of undefined `checkBattle()` call                       | A call is present, but no definition exists in any exported primary script.                                                                               | Check Flash global resolution in a runtime; apparent gameplay resolution is already in AI/damage functions. |
| Exact dynamic screen composition and transitions                | Static timeline renders do not run ActionScript placement.                                                                                                | Run SWF in a controlled Flash projector/Ruffle harness and capture frames.                                  |
| Exact sound latency/mixing                                      | Host decoder and Flash mixer behavior are outside code export.                                                                                            | Capture projector audio and compare exported streams.                                                       |
| Portal API behavior after Kongregate service retirement         | Calls are present, but current endpoint behavior is external and mutable.                                                                                 | Stub Kongregate API for deterministic local testing; preserve original call semantics in research only.     |

## Confirmed quirks, not unknown mechanics

These should not be “corrected” silently in a compatibility specification:

- Initial lifespan displays 99.99%, not 100%.
- Initial profile multiplier is 1.0 despite level 1; the formula is applied on
  later level-ups.
- Profile level-up requires XP strictly greater than the threshold and discards
  excess XP.
- Kill-score multiplier applies only to the enemy-ATK term.
- A queued shop retains the price calculated at generation time. Two visible
  same-type shops across a battle boundary can therefore sell successive tiers
  at the same cached price.
- At equipment tier 10, an adequately funded upgrade click silently does
  nothing and leaves the building actionable.
- Other tutorial pages honor the preference, while page 0 is called every run.
- Lifespan drains during battle, but low-lifespan hero alpha is updated only
  while running.
- The achievement screen submits both collection counts as `WeaponUnlocked`.
- `checkBattle()` is called without a recovered definition.

## Research boundary

**UNKNOWN** items are not license to choose arbitrary behavior yet. A future
implementation should isolate them behind compatibility decisions, record the
chosen behavior, and retain this original-evidence ledger unchanged.
