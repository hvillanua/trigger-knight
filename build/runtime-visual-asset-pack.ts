import { promises as fs } from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

const RUNTIME_ASSET_PREFIX = "/assets/generated/high-res/";
const PACK_RELATIVE_ROOT = "src/assets/generated/high-res";

function isSafeRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function isImagePath(value: string): boolean {
  return /\.(?:png|jpe?g|svg)$/i.test(value);
}

function isRuntimeAssetPath(value: string): boolean {
  return value === "manifest.json" || isImagePath(value);
}

function contentType(value: string): string {
  if (value.endsWith(".json")) return "application/json; charset=utf-8";
  if (value.endsWith(".svg")) return "image/svg+xml";
  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return "image/png";
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".."
  );
}

async function filesUnder(root: string, current = root): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(root, absolute)));
    } else if (entry.isFile()) {
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (isRuntimeAssetPath(relative)) files.push(relative);
    }
  }
  return files.sort();
}

function requestedRelativePath(requestUrl: string): string | undefined {
  const rawPath = requestUrl.split("?", 1)[0];
  if (rawPath === undefined || !rawPath.startsWith(RUNTIME_ASSET_PREFIX)) {
    return undefined;
  }
  try {
    return decodeURIComponent(rawPath.slice(RUNTIME_ASSET_PREFIX.length));
  } catch {
    return undefined;
  }
}

/** Serves only the approved optional high-resolution pack without publicDir. */
export function runtimeVisualAssetPack(projectRoot: string): Plugin {
  const packRoot = path.resolve(projectRoot, PACK_RELATIVE_ROOT);

  return {
    name: "trigger-knight-runtime-visual-asset-pack",

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const relative = requestedRelativePath(request.url ?? "");
        if (relative === undefined) {
          next();
          return;
        }
        if (!isSafeRelativePath(relative) || !isRuntimeAssetPath(relative)) {
          response.statusCode = 400;
          response.end("Invalid runtime asset path");
          return;
        }

        const absolute = path.resolve(packRoot, relative);
        if (!inside(packRoot, absolute)) {
          response.statusCode = 400;
          response.end("Invalid runtime asset path");
          return;
        }

        void fs
          .readFile(absolute)
          .then((data) => {
            response.statusCode = 200;
            response.setHeader("Content-Type", contentType(relative));
            response.setHeader("Cache-Control", "no-cache");
            response.end(data);
          })
          .catch(() => next());
      });
    },

    async generateBundle() {
      for (const relative of await filesUnder(packRoot)) {
        this.emitFile({
          type: "asset",
          fileName: `${RUNTIME_ASSET_PREFIX.slice(1)}${relative}`,
          source: await fs.readFile(path.join(packRoot, relative)),
        });
      }
    },
  };
}
