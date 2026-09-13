# Project-authored sound effects

These short WAV files are independently authored additive-synthesis cues for
the browser presentation. They do not copy or process the original SWF sound
exports. `build/generate-sound-effects.mjs` creates the deterministic PCM files
from the frequencies and envelopes recorded in the generator.

`provenance.json` records the generator, hashes, author, rights, and review date
for every runtime file. The files are presentation inputs only. They do not
carry gameplay decisions or consume gameplay randomness. Cue assignments are a
browser presentation choice and do not claim exact original audio timing.
