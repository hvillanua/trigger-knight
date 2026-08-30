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
| Score           | 28,950     |
| Day             | 1          |
| Distance        | 2,895      |
| Gold            | 300        |

The locked host-neutral gameplay trace hash is
`sha256-v1:85d3d8eb822ee80a510ddce6cd7a20810fe9cef45a4f9e63950a1ed27282a012`.
The terminal checkpoint hash is
`sha256-v1:7dbb8f459165f30a229b7b79ea0d2804522c1d4deffbd1e9f4d2c8a2209039b8`.
The simulation result trace hash, which also covers policy identity and the
3,000-step budget, is
`sha256-v1:979efa3772f62bc32e2cacd9b7f33ac5c8b98c613b64994870474074847e8c8a`.

Issue #42 advances the version-7 encounter queue through world space. Issue #43
adds the version-8 current-shop use state. Issue #44 adds the version-9
equipment names used by upgrade transitions. Issue #45 adds the version-10
hidden Soul Shrine state and its initial threshold draw. The scenario and
command schedule are unchanged. It reaches its first battle at distance 2,895.
It then waits at the battle handoff while active-tick lifespan continues to
death. The serializable state change updates the locked hashes above. Gameplay
traces and run results remain at version 2.

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
  original stage unit equals one world unit, the explicit random algorithm is
  `mulberry32-fnv1a32-v1`, queue/refill draws precede their associated distance
  draws, and the initial emergency Shrine threshold draw follows the initial
  queue and distance draws.

Combat resolution, persistence, final presentation, and batch comparison
tooling remain in later milestones.
