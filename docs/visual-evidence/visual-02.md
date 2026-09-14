# Visual-02 comparison evidence

These recordings were captured from the corrected Visual-02 browser renderer
on 2026-09-14 with Playwright Chromium at 740x494. They are review artifacts
only; the runtime does not import them, and the preserved original recording
under `.local-references/visual-fidelity/trigger-knight.mp4` was not changed.

The clips use public `GameObservation` and `GameEvent` fixtures so each visual
transition can be replayed at a reviewable speed. The integrated browser and
headless parity suite separately drives the shared engine and verifies that
render cadence does not change its checkpoints. Frame ranges, cosmetic
lifetimes, and transition cadence below are derived presentation choices where
the supplied recording does not establish exact timeline values.

| Review area        | Source interval inspected              | Corrected browser recording                         | Evidence in the clip                                                                                                                                                                      |
| ------------------ | -------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Running and combat | Original recording around 7–23 seconds | [running and combat](visual-02-running-combat.webm) | A continuous clip moves from running through encounter approach into combat, with changing actor positions, complete 22-frame attack clips, health bar, hit flashes, and floating damage. |
| Armor purchase     | Original frames 28.00–29.50 seconds    | [armor upgrade](visual-02-armor-upgrade.webm)       | `392G` to `188G`, Clothing to Protector, yellow particles, `UPGRADE!`, `-Lost 204G!`, and the retained `Upgrade: Clothing > Protector` strip through later redraws.                       |
| Potion use         | Original frames 48.00–50.50 seconds    | [potion use](visual-02-potion-use.webm)             | Orange Elixir hint before use, blue particles, `ITEM USED!`, empty item slot and unavailable prompt after use, with combat phases continuing.                                             |

The existing result composition is implemented and covered by the browser
experience and persistence checks, but the Visual-01 reference capture suite
ends at pause. The available source material does not provide a frame-accurate
death-to-results interval, so this ticket records that timing as unresolved
rather than claiming a recovered original transition.

The generated clip hashes are:

```text
visual-02-armor-upgrade.webm  f2ba634d3535e96f864136c41f62716d78ed12b62d0ac4acc9c56ce4b5390831
visual-02-potion-use.webm     29e04f01e71bfb896197f595a9b6e066c0a961d6e158d29972c83252c4be9f18
visual-02-running-combat.webm bf18f470df68d3c5aae52772a06b3b48226a7b318d5f3b90ce30bc37c9d8febf
```
