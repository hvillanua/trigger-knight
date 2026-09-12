# Original artifacts and provenance

The repository tracks the normative Kongregate source artifact only. Do not
normalize, recompress, patch, or overwrite it. Verify it from this directory
with:

```bash
sha256sum -c SHA256SUMS
```

## Selected primary artifact

**CONFIRMED** `kongregate/MonotouchKong13APPSTORE.swf` was downloaded unchanged
from Kongregate's game CDN:

```text
https://game130517.konggames.com/gamez/0013/0517/live/MonotouchKong13APPSTORE.swf?kongregate_game_version=1333346831
```

Retrieval date: **2026-08-23**. The query string is retained because it binds
the request to Kongregate's recorded game-version timestamp; it is not part of
the local filename.

The URL was recovered from Kongregate's live wrapper for game ID `130517`.
Wrapper metadata identifies the game as Trigger Knight, version timestamp
`1333346831`, at 480x320. Kongregate's public game page identifies the release
as November 23, 2011 and the last update as April 1, 2012; its v1.3 change note
mentions the 10% critical-hit addition.

| Property | Value | Status |
|---|---|---|
| SHA-256 | `0f0630b981172fd2183b3a2ff890d98a178c11bc8e0aa3b5ed1be05c4ddb2c20` | CONFIRMED from preserved bytes |
| Compressed file size | 2,133,363 bytes | CONFIRMED |
| Signature/compression | `CWS`, ZLIB-compressed SWF | CONFIRMED from header |
| SWF version | 9 | CONFIRMED from header |
| ActionScript VM | AVM1 (`FileAttributes.actionScript3=false`) | CONFIRMED from tag data |
| Stage | 480x320 | CONFIRMED from header and wrapper |
| Frame rate | 30 fps | CONFIRMED from header |
| Main timeline | 10 frames | CONFIRMED from header |
| Game version | `v1.3` | CONFIRMED by embedded text ID 270 |
| Site lock | `kongregate.com` | CONFIRMED in frame 1 ActionScript |

The FFDec logical uncompressed SWF size is 2,653,849 bytes. That is metadata,
not a second artifact hash.

## Production asset source

This preserved SWF is the canonical source for original game visual and audio
assets. When an asset is needed by the browser runtime, extract or convert the
asset without altering this artifact, stage the reviewed production file under
`src/assets/`, and add neighboring provenance metadata. The metadata must link
the staged file to this artifact hash or an identifiable export.

The SWF remains an archival source record rather than a production module. Its
ActionScript and other decompiled material are behavioral research inputs and
must not be copied into the implementation. Asset use does not change the
underlying copyright or distribution terms.

## Comparison distributions

These were downloaded locally to compare portal wrappers and obfuscation. They
are intentionally excluded from Git because they are non-normative binary
artifacts; the exact source URLs and hashes below allow them to be recovered.

| File | Source | SHA-256 | Notes |
|---|---|---|---|
| `comparison/trigger-knight.iichan-preserved.swf` | <https://ii.yakuji.moe/gf/src/1530833624378.swf> | `ab090aa1aaf7521b2b0dae81c4fc227424274bfd0aa04acddfc3810b1b42ffdb` | Preserved third-party copy; byte-distinct |
| `comparison/triggerknight.flipline.swf` | <https://i.flipline.com/othergamefiles/triggerknight/triggerknight.swf> | `731c6f7646d0d458e56e811654439b8b1c1c13c231112c3941bb8711b373468f` | Flipline distribution; byte-distinct |

**DERIVED** The clean Kongregate ActionScript is the best normative source for
v1.3 mechanics. The comparison builds contain portal/Mochi integration and
obfuscation differences, while the primary exposes readable symbol and
variable names.

**UNKNOWN** Whether the Kongregate CDN file is byte-for-byte identical to the
developer's pre-upload master. It is, however, the exact preserved portal
payload served for the recorded Kongregate game version.

## External records

- Kongregate: <https://www.kongregate.com/en/games/mintsphere/trigger-knight>
- Flipline: <https://www.flipline.com/othergames/triggerknight/index.html>
- IIchan archive index: <https://ii.yakuji.moe/gf/>
- Newgrounds 1.3b NG record (separate portal build):
  <https://www.newgrounds.com/portal/view/586986>
