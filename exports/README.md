# Extracted original-game assets

All files here were generated from the primary Kongregate SWF. They are the
recorded source exports for the original visual and audio assets used by the
browser presentation where available.

| Path | Contents |
|---|---|
| `assets/raw/` | FFDec raw export: 138 images, 8 fonts, 17 sound entries, and 119 text entries (282 files total) |
| `assets/key-sprites/` | Every rendered frame for Hero, Dragon, Goblin, Golem, and Wolf |
| `assets/representative/` | Curated screenshots and animation frames with provenance notes |
| `screenshots/main-timeline/` | Deterministic renders of main timeline frames 1-10 |

These are FFDec renders/exports. They are not screenshots captured from a
running Flash Player unless a file is explicitly labeled as such; none in the
current set are live captures. To use an export in production, preserve this
source file, stage a reviewed copy under `src/assets/`, and record its source
path, export identifier, artifact hash, extraction details, rights or license,
and review date in neighboring provenance metadata. Production code must not
import the archival `exports/` directory directly.

The reviewed runtime copies currently live under `../src/assets/original/`.

This project policy does not create a new license or transfer copyright.
Distribution of these original assets remains subject to the rights holder's
terms.
