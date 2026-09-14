# Product Requirements Document — Trigger Knight Browser Reimplementation

## Objective

Build a native-browser reimplementation of Trigger Knight v1.3 that preserves
the researched gameplay experience, uses the original game assets in its
presentation where available, and creates a clean foundation that can evolve
independently over time.

The project is intended for local play and experimentation for fun. The initial
local-play version does not require public deployment or a formal release
certification process.

The behavioral specification in `research/` is the source of truth for original-game behavior. The implementation must remain inside the clean-room boundary and must not copy decompiled ActionScript.

### Original asset policy

The browser presentation uses original visual and font assets where available. The
original sound exports remain source and provenance records; this clean-room
implementation uses independently authored sound effects under
`src/assets/sound-effects/`. The preserved SWF in `original/` and its recorded
exports in `exports/` are source and provenance records; reviewed original
production copies belong under `src/assets/original/`, while authored sound files
carry their own generator, hash, rights, and review metadata. Font redistribution
rights are currently unverified, and the browser's font-role mapping is an
explicit presentation choice rather than confirmed original text-field behavior.
This policy does not permit copying decompiled ActionScript or generated
behavioral research into the implementation, and it does not transfer copyright
or grant a public license for the original assets.

## Product requirements

### 1. Reproduce the original gameplay loop

The game must reproduce the confirmed Trigger Knight v1.3 loop:

- endless automatic forward movement;
- a queued sequence of shops and battles;
- player interaction with in-range shops;
- automatic combat, with player-controlled item use;
- continuously draining lifespan during active gameplay;
- equipment, items, gold, score, day progression, profile progression, collections, and achievements;
- run termination from lifespan or combat death;
- post-run score/progression handling and replay.

Confirmed formulas, timing-sensitive mechanics, probabilities, encounter behavior, combat behavior, and known quirks documented in `research/` must be treated as compatibility requirements for the original-v1.3 ruleset unless this document explicitly classifies them as presentation or platform behavior to modernize.

Until controlled runtime evidence resolves the tier-10 GUI discrepancy, the
clean-room compatibility decision treats max-tier equipment shops as
unavailable actions. Public action eligibility must be false. An attempted
purchase cannot spend gold, heal HP, or mark the shop used. Browser presentation
must communicate that unavailable state; its exact visual treatment may differ
from the reported red cross.

### 2. Reproduce the browser play experience

The browser version must provide the main game screens, HUD information, interactions, transitions, feedback, sound effects and their controls, pause behavior, tutorials, and local progression needed to play the game without Flash.

The original coordinate scale is retained as abstract world units for the `original-v1.3` ruleset: one original stage coordinate unit equals one world unit, and the initial camera shows a 480x320-world-unit viewport. This preserves researched positions, distances, speeds, and thresholds without treating them as physical pixels. The renderer must project that camera into responsive, high-density, and fullscreen output while preserving the intended composition and mapping input back to world coordinates.

The original 30 fps timing remains a 30 Hz gameplay simulation requirement because mechanics are frame-based. Rendering may run at the display refresh rate and interpolate between logical ticks; changing render cadence must not change gameplay outcomes. The presentation should use the original game visual and font assets where available and the approved independently authored sound effects; asset loading and playback must remain outside authoritative gameplay state.

When reviewed references provide evidence, the initial title screen, player-status screen, gameplay HUD, tutorial and pause overlays, prompts, and run-result screen should keep the original 480x320 composition, art placement, bands, icons, and layer order as their presentation baseline. Responsive projection and parallel accessible text may scale or letterbox that composition, but they must continue to describe only public gameplay state. Visual details and animation timing without evidence remain documented implementation decisions rather than claims about original behavior.

### 3. Separate gameplay behavior from presentation

All gameplay rules and state transitions must be executable independently of rendering, audio, browser input, persistence, or browser timing APIs.

The same gameplay implementation used by the browser must be callable programmatically so complete runs and individual state transitions can be exercised without launching the visual interface.

The programmatic interface must support finite, deterministic single runs and batches. It must expose stable results suitable for comparing rulesets with the same seeds, initial profiles, policies, and execution limits.

### 4. Preserve reproducibility and compatibility

A run must be reproducible from its complete inputs, including its ruleset and randomness source.

Original behavior must remain available as an explicit versioned ruleset so future fixes, balance changes, or new features do not silently change the compatibility implementation.

Behavior that remains unknown or ambiguous in the research must be implemented through explicit documented decisions rather than presented as confirmed original behavior.

### 5. Support future evolution

The codebase must allow gameplay subsystems, presentation, and future rulesets to evolve without requiring a rewrite of unrelated parts of the game.

New gameplay content or balance changes must be able to coexist with the original-v1.3 behavior rather than replacing it.

### 6. Modernize non-gameplay behavior

Flash-container and presentation details that do not determine gameplay outcomes are not compatibility requirements. The initial browser version should modernize them directly rather than reproduce obsolete constraints.

This includes:

- responsive and high-density rendering instead of a fixed 480x320 physical surface;
- display-refresh-rate animation instead of tying drawing to the 30 Hz simulation;
- pointer, touch, keyboard, and remappable controls translated into the same gameplay commands;
- modern browser sound-effect decoding, mixing, mute, and volume controls rather than Flash-specific mixer behavior;
- durable, versioned browser storage with atomic progression updates rather than AVM1 `SharedObject` timing and its possible close-before-save data loss;
- accessible, responsive HUD and menus, while preserving all gameplay-relevant information and action availability;
- modern loading, navigation, and sharing behavior without SWF preload frames, portal site locks, Kongregate APIs, or obsolete promotional links;
- freely timed or redesigned visual-only transitions, parallax, particles, damage numbers, and menu animations.

Mechanic-bearing timing and coordinates are excluded from this freedom. Examples include active-tick lifespan drain, encounter movement and purchase windows, combat hit/finish ticks, and pause/tutorial gates. These remain domain rules even when their visuals are interpolated or redesigned.

## Acceptance criteria

The first complete implementation is acceptable when:

- the confirmed v1.3 gameplay loop can be played end-to-end in a modern browser;
- the confirmed mechanics and known compatibility quirks are covered by executable tests;
- a complete run can be executed headlessly through the same gameplay implementation used by the browser;
- deterministic batches terminate within their configured execution limits and produce stable comparison inputs;
- identical complete inputs reproduce identical game outcomes;
- original-v1.3 behavior remains selectable independently from later rulesets;
- presentation code can be changed without changing gameplay outcomes;
- physical resolution, device pixel ratio, render refresh rate, and supported input device do not change gameplay outcomes;
- profile and collection updates are committed durably without depending on score-count animation completion;
- unresolved research questions and implementation decisions remain explicitly documented.

## Out of scope for the initial local-play version

- new enemies, items, shops, progression systems, or other original content;
- intentional balance changes to the original-v1.3 ruleset;
- exact reproduction of Flash Player's unrecovered PRNG sequence;
- pixel-identical reproduction of the 480x320 SWF output, Flash sound latency/mixing, or timeline-only visual timing;
- background music playback, music assets, playlists, transitions, and music controls; the architecture must leave these straightforward to add later;
- Kongregate/Newgrounds integration, site locks, legacy promotional links, and obsolete social-sharing actions;
- multiplayer, accounts, or server-side progression.
