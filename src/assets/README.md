# Approved runtime assets

The browser presentation uses the original Trigger Knight visual and font assets
where available. This directory is the production staging area for reviewed
asset files from the preserved game artifact and its recorded exports. The
currently staged original set is under [`original/`](original/): 280 character
animation frames, 138 raster image exports, 17 music or sound exports, and 8
font exports. The original sound exports remain provenance records and are not
production inputs. The browser sound adapter uses the independently authored
files under [`sound-effects/`](sound-effects/).

The Canvas presentation currently loads the original Hero, Dragon, Goblin,
Golem, and Wolf idle frames plus the sky, ground, mountain, and building scene
layers from that set. It also loads the staged font exports for browser text and
Canvas labels. Its authored `world-atlas.svg` remains the fallback for sprite
families that have not been mapped to an original export yet. Sound cue mapping
and playback live in `src/sound/` and do not affect gameplay state.

The font-to-presentation-role mapping is a compatibility choice made for this
browser implementation. It has not been verified against every original SWF
text field. See [`original/fonts.provenance.json`](original/fonts.provenance.json)
for the per-file hashes, export identifiers, embedded attribution evidence,
and rights status. The rights and redistribution permissions for these font
files are unverified; this repository does not grant a public license.

`tests/browser/original-fonts.spec.ts` verifies that all eight staged files load,
that the DOM roles request the mapped families, and that Canvas text uses the
mapped family names. It does not verify the original SWF's exact text-field
mapping or pixel-level visual fidelity. Those remain separate presentation
follow-up work.

Before adding an asset, preserve the source artifact and record the following
in a neighboring `*.provenance.json` file:

- source path and the source artifact hash or export identifier;
- extraction tool and settings, when applicable;
- original author or rights holder;
- applicable rights or license and distribution restrictions;
- review date and any transformations made for the browser.

The archival `original/` and `exports/` directories remain source and provenance
records. Production code must consume the reviewed staged copy in this
directory rather than importing those roots directly. Decompiled ActionScript,
generated behavioral research, and unreviewed exports are never production
inputs. Independently authored or separately licensed replacements may be used
when an original asset is unavailable or cannot be distributed.
