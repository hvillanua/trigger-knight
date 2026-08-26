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

The ruleset owns the Milestone 2 values that later lifecycle tickets will use:

| Group            | Values                                                                                                                     | Evidence                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Logical time     | 30 gameplay ticks per second                                                                                               | Confirmed original behavior                                                    |
| Pregame delay    | 60 logical opportunities                                                                                                   | Confirmed value; gate interaction is a clean-room decision                     |
| Running movement | Speed starts at 0, gains 1 per active tick, caps at 15, and contributes one distance unit per speed unit                   | Confirmed original behavior                                                    |
| Day and score    | 7,000 distance units per day; running score uses 10 points per speed unit before the profile multiplier                    | Confirmed original behavior                                                    |
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
headless result copies score, day, and distance from the same state.

Tutorial, pregame, pause, and ended gates leave all four progression values
unchanged. They also prevent `activeTicks` from advancing. These values use
abstract world units and accept no Canvas size, CSS size, device-pixel-ratio,
render interpolation, or wall-clock input.

The browser projection and the distinction between world and physical values
are documented in [`world-camera.md`](world-camera.md).

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

Encounters, combat, and tutorial presentation remain assigned to later tickets.

State, results, events, event lists, and observations are frozen. A
JSON-restored checkpoint produces the same next state, observation, and events
as uninterrupted execution. Browser and headless parity traces are described in
[`gameplay-diagnostics.md`](gameplay-diagnostics.md).
