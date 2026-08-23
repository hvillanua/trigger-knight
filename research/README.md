# Trigger Knight v1.3 research index

This is a behavioral specification of the preserved Kongregate v1.3 SWF. It is
intended to support a later clean-room browser reimplementation; it is not an
implementation plan or source port.

## Evidence labels

- **CONFIRMED**: stated directly by AVM1 code, p-code, SWF tags, timelines, or
  an embedded asset in the primary artifact.
- **DERIVED**: calculated from confirmed values or inferred by combining
  multiple direct observations. The derivation is stated.
- **UNKNOWN**: not recoverable from the inspected artifact, ambiguous, or not
  validated in a working Flash runtime.

A table's `Status` column applies to every value in that row. A paragraph led
by a status applies until the next status label or heading.

## Documents

- [`mechanics.md`](mechanics.md): state, core loop, RNG, encounters, enemies,
  dragon, combat, lifespan, equipment, shops, items, economy, scoring, saves,
  and achievements.
- [`presentation.md`](presentation.md): frame rate, timing, MovieClips,
  timelines, UI states, controls, tutorials, audio, and extracted references.
- [`unknowns.md`](unknowns.md): consolidated inferred and unknown behavior,
  known quirks, and validation work for a future runtime harness.
- [`source-map.md`](source-map.md): where each class of evidence lives in the
  decompile.
- [`reproduction.md`](reproduction.md): pinned commands for re-verifying and
  regenerating the research exports.

## Method

**CONFIRMED** The primary artifact was inspected with FFDec 26.2.1 by exporting
decompiled ActionScript, AVM1 p-code, full SWF XML, raw assets, main-timeline
renders, and selected MovieClip frames. Constants and control flow were traced
from the code, while animation event timing was cross-checked against per-frame
scripts (`ishit`, `attackfinished`, and labels).

**DERIVED** Static FFDec renders are sufficient to catalog timeline content but
not to prove dynamic placement, portal APIs, audio mixing, or runtime-specific
AVM1 PRNG sequences. Those limits are called out explicitly.

## Scope result

**CONFIRMED** The SWF implements an endless auto-running survival game. The
player clicks passing buildings to buy equipment or a single carried item;
battles are automatic except for item use. Lifespan continuously drains during
active running and combat, and reaching a negative lifespan ends the run.

**CONFIRMED** No HTML, JavaScript, Canvas, or game-engine implementation files
were created during this research pass.
