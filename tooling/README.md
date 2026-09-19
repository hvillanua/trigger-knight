# Pinned tooling

The analysis uses JPEXS Free Flash Decompiler (FFDec) 26.2.1 and an Adoptium
Temurin Java 21 runtime. The archives and extracted tools remain local but are
excluded from Git; their hashes and upstream download locations are recorded so
the exports can be repeated.

| Local archive | SHA-256 | Upstream source |
|---|---|---|
| `ffdec_26.2.1.zip` | `0333b56998a55bd83f4e0deb678a811fcdc45607582b4f5dd438309c8c3ad5ce` | <https://github.com/jindrapetrik/jpexs-decompiler/releases/tag/version26.2.1> |
| `temurin-jre21-linux-x64.tar.gz` | `2413149700df0f7d440500a84a8f764c535f21e5a5e87d38328b64eec2c5b500` | <https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1> |

FFDec release source: <https://github.com/jindrapetrik/jpexs-decompiler/releases>

The ignored `ffdec-runtime/` directory contains FFDec-generated cache/log data
and is not part of the original artifact. Local extracted copies are under
`ffdec-26.2.1/` and `temurin-jre21/`.

## Menu parity capture

With the development server running on `http://127.0.0.1:5173`, capture the
current title and player-status screens beside frames from a reference video:

```sh
node tooling/capture-menu-parity.mjs /path/to/reference.mp4 /tmp/menu-parity
```

Compare the captures after both sets of images exist:

```sh
node tooling/compare-menu-parity.mjs /tmp/menu-parity
```

The comparison prints the mean absolute RGB difference after normalizing each
image to the game's 480 by 320 stage. Use the images for visual review because
the number alone cannot distinguish intended animation or profile-data changes.
