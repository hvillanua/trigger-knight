# Milestone 2 lifecycle verification

Milestone 2 has one deterministic acceptance scenario shared by the Node and
Chromium checks. The scenario uses `original-v1.3`, holds tutorial page 0 for
one elapsed step, dismisses it, completes the pregame gate, pauses after ten
active ticks, holds that pause for two more steps, resumes, and takes no other
actions. Lifespan death occurs at active tick 2,500 and elapsed step 2,564.

The scenario is test infrastructure, not a second gameplay implementation. It
drives `BrowserGameplaySession` and `SimulationRunner`, which both use the same
`GameplayEngine` and ruleset registry.

## Reproducible result

The terminal values are:

| Field           | Value      |
| --------------- | ---------- |
| Elapsed steps   | 2,564      |
| Active ticks    | 2,500      |
| Terminal reason | `lifespan` |
| Score           | 373,950    |
| Day             | 6          |
| Distance        | 37,395     |
| Gold            | 300        |

The locked host-neutral gameplay trace hash is
`sha256-v1:276ea9d0deb25b5dcbaeeec8cdc9ded6cbfac22cf093c9a20f1d357ca9b0f0ca`.
The terminal checkpoint hash is
`sha256-v1:4e5f36dd56921a66f0456531cd58f3e2a7ed66104d1e93165a2c2f1030245661`.
The simulation result trace hash, which also covers policy identity and the
3,000-step budget, is
`sha256-v1:8210a4ccc83aec221ebe896bdabfcd07b8f2b02d915997d7f1ae86724fcafc44`.

Issue #40 added version-5 economy and loadout state, version-2 gameplay traces
with player observations, and authoritative gold in version-2 run results. The
scenario and command schedule are unchanged. The added serializable fields
changed the locked hashes above.

The unit check compares every browser-session checkpoint with the headless
trace. This includes commands, complete state, public observations, events,
checkpoint hashes, and the final trace hash. It also repeats the simulation
result to prove that its result fields and hash remain stable.

The Chromium check compares its complete trace with the Node headless trace.
It repeats the same run with different interpolation schedules, Canvas sizes,
and device pixel ratios. One resize occurs during each run. All variants retain
the same terminal state, events, checkpoint hash, and trace hash.

## Checkpoint continuation

Both Node and Chromium serialize authoritative state to JSON and continue from
representative boundaries:

- tutorial page 0 still open;
- pregame complete and before the first active tick;
- paused after ten active ticks;
- the first lifespan fractional carry;
- one active tick before lifespan death.

Every restored path reaches the uninterrupted terminal state, observation,
events, and checkpoint hash. This uses the public engine `step()` and
`observe()` operations. It does not add mid-run persistence to the simulation
request contract, which the TDD leaves out of scope.

## Compatibility labels

The implementation and verification keep the research labels separate:

- **CONFIRMED:** gameplay uses 30 Hz logical opportunities; pause and tutorial
  gates freeze active systems; movement accelerates to 15; distance determines
  the day; running score uses speed and the supplied multiplier; lifespan is
  the two-integer 99.99 value and drains by 4 per active tick; and the preserved
  stage is 480x320.
- **DERIVED:** with no lifespan restoration, death occurs after exactly 2,500
  active ticks. This follows from the confirmed integer drain and carry rules.
- **UNKNOWN:** the intent behind unconditional tutorial page 0 remains unknown.
  The original evidence also does not settle gate overlap behavior or active
  system ordering on the terminal frame.
- **CLEAN-ROOM DECISION:** commands take effect before gate evaluation, pause
  and tutorial freeze pregame, pregame does not count as active gameplay,
  running progression occurs before lifespan death on the terminal tick, one
  original stage unit equals one world unit, and the explicit random algorithm
  is `mulberry32-fnv1a32-v1`.

Encounter queues, shops, combat, persistence, final presentation, and batch
comparison tooling remain in later milestones.
