# Approved runtime assets

The browser presentation uses the original Trigger Knight visual and audio
assets where available. This directory is the production staging area for
reviewed asset files from the preserved game artifact and its recorded exports.
The currently staged set is under [`original/`](original/): 280 character
animation frames, 138 raster image exports, and 17 music or sound exports.

The Canvas presentation currently loads the original Hero, Dragon, Goblin,
Golem, and Wolf idle frames plus the sky, ground, mountain, and building scene
layers from that set. Its authored `world-atlas.svg` remains the fallback for
sprite families that have not been mapped to an original export yet.

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
