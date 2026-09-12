# Original runtime assets

These files are reviewed copies of visual and audio exports from the preserved
Trigger Knight v1.3 SWF, staged for the browser presentation. The gameplay and
domain code remains a clean-room implementation.

- `key-sprites/` contains every exported frame for Hero, Dragon, Goblin, Golem,
  and Wolf.
- `images/` contains the original raster image exports, including the scene
  layers and interface art.
- `sounds/` contains the original exported music and sound entries.

The copy was made from `exports/assets/` without changing the preserved source
artifact. [`provenance.json`](provenance.json) records the source SWF hash,
export directories, extraction tool, and rights notice. The browser currently
loads the character frames directly from this directory through
`src/browser/visual-atlas.ts`; the remaining staged files are available to the
later presentation adapters.

The exported fonts are not copied here because their independent typeface
licenses need separate review. The original SWF and archival exports remain
unchanged in `original/` and `exports/`.
