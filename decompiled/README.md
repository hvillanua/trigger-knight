# Decompiled output

Everything here is generated from preserved SWFs and must remain separate from
future implementation code.

| Path | Contents |
|---|---|
| `ffdec/actionscript/scripts/` | 87 decompiled AVM1 ActionScript files from the primary Kongregate SWF |
| `ffdec/pcode/scripts/` | Corresponding AVM1 p-code exports for decompiler cross-checking |
| `ffdec/swf.xml` | Complete FFDec XML structural export; generated locally and excluded from Git because of its size |
| `comparison/flipline/scripts/` | Decompiled comparison distribution |
| `comparison/iichan/scripts/` | Decompiled comparison distribution |

The normative gameplay source is
[`ffdec/actionscript/scripts/frame_2/DoAction.as`](ffdec/actionscript/scripts/frame_2/DoAction.as).
Frame scripts 1 and 3-8 cover loading/site lock and screen-specific behavior.
MovieClip frame scripts define animation labels and hit callbacks.

Decompiler output is evidence, not clean-room implementation source. Any future
implementation should use the behavioral specification under `research/`.
