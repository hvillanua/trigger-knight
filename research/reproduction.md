# Reproducing the inspection outputs

Run these commands from the workspace root. They read the preserved SWF but do
not modify it. FFDec reports its version as 26.2.1 in command help and in the
generated XML.

```bash
JAVA=tooling/temurin-jre21/bin/java
FFDEC=tooling/ffdec-26.2.1/ffdec.jar
SWF=original/kongregate/MonotouchKong13APPSTORE.swf
```

## Integrity and header

```bash
(cd original && sha256sum -c SHA256SUMS)
"$JAVA" -jar "$FFDEC" -header "$SWF"
```

## ActionScript, p-code, and XML

```bash
"$JAVA" -jar "$FFDEC" \
  -export script decompiled/ffdec/actionscript "$SWF"

"$JAVA" -jar "$FFDEC" -format script:pcode \
  -export script decompiled/ffdec/pcode "$SWF"

"$JAVA" -jar "$FFDEC" \
  -swf2xml "$SWF" decompiled/ffdec/swf.xml
```

## Raw media and text

```bash
"$JAVA" -jar "$FFDEC" \
  -export image,font,sound,text exports/assets/raw "$SWF"
```

## Timeline and character renders

```bash
"$JAVA" -jar "$FFDEC" -format frame:png -select 0:1-10 \
  -export frame exports/screenshots/main-timeline "$SWF"

"$JAVA" -jar "$FFDEC" -format sprite:png \
  -select 397:1-53,421:1-53,446:1-57,477:1-55,497:1-62 \
  -export sprite exports/assets/key-sprites "$SWF"
```

FFDec may add one naming directory beneath the requested output directory,
depending on whether the target already exists. The checked-in structure is
the normalized generated result; normalization moved files/directories only
and did not alter the preserved SWF.

## Expected counts

| Output                          | Expected | Status                   |
| ------------------------------- | -------: | ------------------------ |
| Decompiled primary script files |       87 | CONFIRMED current export |
| Raw images                      |      138 | CONFIRMED current export |
| Raw fonts                       |        8 | CONFIRMED current export |
| Raw sound entries               |       17 | CONFIRMED current export |
| Raw text entries                |      119 | CONFIRMED current export |
| Main-timeline PNGs              |       10 | CONFIRMED current export |
| Character-frame PNGs            |      280 | CONFIRMED current export |

The curated files under `exports/assets/representative/` are copies of selected
generated PNGs. Their exact source frame is recorded in that directory's
README.
