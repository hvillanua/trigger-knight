# World camera and Canvas projection

## Ruleset space

The `original-v1.3` ruleset treats one original stage coordinate unit as one
abstract world unit. Its initial camera starts at `(0, 0)` and covers 480 by 320
world units. `GameObservation.camera` publishes that view to browser presentation
and automated policies. The camera contains no CSS size, backing-store size, or
device-pixel-ratio value.

The preserved artifact confirms a 480x320 stage and mechanic-bearing positions
such as an encounter entering at x 600. Treating those coordinates as world
units is the clean-room product decision recorded in the PRD and TDD. It does
not claim that the original Flash implementation had a separate camera model.

World positions may sit outside the camera. Encounter promotion therefore uses
x 600 without expanding the 480-world-unit view or converting the position to
a physical pixel value.

## Browser projection

`CanvasPresentation` fits the complete observed camera into the Canvas backing
store with one uniform scale. Extra width or height becomes centered
letterboxing. The adapter performs these steps:

1. Multiply the Canvas CSS content dimensions by the current device pixel ratio
   and round them to the backing-store dimensions.
2. Choose the smaller of the horizontal and vertical backing-store scales.
3. Center the resulting world viewport on the unused physical axis.
4. Clip drawing to that viewport and draw in world coordinates.

For example, a 640x360 backing store displays the 480x320 camera in a 540x360
rectangle at x 50. A 360x480 backing store displays it in a 360x240 rectangle
at y 120. A higher device pixel ratio scales those physical rectangles without
changing the camera or gameplay coordinates.

`CanvasPresentation.resize()` recalculates the physical projection and redraws
the stored `PresentationFrame`. It does not call the gameplay engine. The
browser session can also present its latest transition at interpolation values
between 0 and 1 without dispatching another logical step. Dispatch publishes a
new transition at 0 so a display loop can move monotonically toward 1. The
manual browser control completes that presentation immediately. Interpolation
uses the observed distance to move a presentation marker; displayed
authoritative values and action eligibility still come from
`PresentationFrame.current`.

Canvas data attributes expose the observed camera, physical projection,
interpolation amount, and authoritative gameplay values for browser checks.
These are presentation diagnostics. They do not enter `RunState`, gameplay
events, checkpoint hashes, or trace hashes.
