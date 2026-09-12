# Original runtime assets

These files are reviewed copies of visual, audio, and font exports from the preserved
Trigger Knight v1.3 SWF, staged for the browser presentation. The gameplay and
domain code remains a clean-room implementation.

- `key-sprites/` contains every exported frame for Hero, Dragon, Goblin, Golem,
  and Wolf.
- `images/` contains the original raster image exports, including the scene
  layers and interface art.
- `sounds/` contains the original exported music and sound entries.
- `fonts/` contains the eight original embedded TTF exports used by the browser
  UI and Canvas labels.

The copy was made from `exports/assets/` without changing the preserved source
artifact. [`provenance.json`](provenance.json) records the source SWF hash,
export directories, extraction tool, and asset-level rights notice.
[`fonts.provenance.json`](fonts.provenance.json) records each font export hash,
embedded attribution evidence, and its browser presentation role.

The browser loads the character frames and scene layers through
`src/browser/visual-atlas.ts`, and loads the font exports through
`src/browser/style.css` and `src/browser/canvas-presentation.ts`. The font role
mapping is a project presentation choice. The exact original SWF text-field
mapping has not been verified.

The font exports are included by project direction, but their redistribution
rights remain unverified. Embedded copyright notices and inclusion in the SWF
do not establish a separate license to redistribute the raw TTF files. The
original SWF and archival exports remain unchanged in `original/` and `exports/`.
