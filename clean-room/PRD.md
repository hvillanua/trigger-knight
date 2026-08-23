# Product Requirements Document — Trigger Knight Browser Reimplementation

## Objective

Build a native-browser reimplementation of Trigger Knight v1.3 that preserves the researched gameplay experience while creating a clean foundation that can evolve independently over time.

The behavioral specification in `research/` is the source of truth for original-game behavior. The implementation must remain inside the clean-room boundary and must not copy decompiled ActionScript.

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

Confirmed formulas, timing-sensitive mechanics, probabilities, encounter behavior, combat behavior, and known quirks documented in `research/` must be treated as compatibility requirements for the original-v1.3 ruleset.

### 2. Reproduce the browser play experience

The browser version must provide the main game screens, HUD information, interactions, transitions, feedback, audio controls, pause behavior, tutorials, and local progression needed to play the game without Flash.

The game should preserve the original 480x320 logical presentation and remain usable in modern browsers through appropriate scaling.

### 3. Separate gameplay behavior from presentation

All gameplay rules and state transitions must be executable independently of rendering, audio, browser input, persistence, or browser timing APIs.

The same gameplay implementation used by the browser must be callable programmatically so complete runs and individual state transitions can be exercised without launching the visual interface.

### 4. Preserve reproducibility and compatibility

A run must be reproducible from its complete inputs, including its ruleset and randomness source.

Original behavior must remain available as an explicit versioned ruleset so future fixes, balance changes, or new features do not silently change the compatibility implementation.

Behavior that remains unknown or ambiguous in the research must be implemented through explicit documented decisions rather than presented as confirmed original behavior.

### 5. Support future evolution

The codebase must allow gameplay subsystems, presentation, and future rulesets to evolve without requiring a rewrite of unrelated parts of the game.

New gameplay content or balance changes must be able to coexist with the original-v1.3 behavior rather than replacing it.

## Acceptance criteria

The first complete implementation is acceptable when:

- the confirmed v1.3 gameplay loop can be played end-to-end in a modern browser;
- the confirmed mechanics and known compatibility quirks are covered by executable tests;
- a complete run can be executed headlessly through the same gameplay implementation used by the browser;
- identical complete inputs reproduce identical game outcomes;
- original-v1.3 behavior remains selectable independently from later rulesets;
- presentation code can be changed without changing gameplay outcomes;
- unresolved research questions and implementation decisions remain explicitly documented.

## Out of scope for the initial compatibility release

- new enemies, items, shops, progression systems, or other original content;
- intentional balance changes to the original-v1.3 ruleset;
- exact reproduction of Flash Player's unrecovered PRNG sequence;
- multiplayer, accounts, or server-side progression.
