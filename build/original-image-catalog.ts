import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { Plugin } from "vite";

const MODULE_ID = "virtual:trigger-knight/original-assets";
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`;
const ASSET_DIRECTORY = "src/assets/original";

interface OriginalAssetCatalogSourceOptions {
  readonly command: "build" | "serve";
  readonly base: string;
  readonly versions?: ReadonlyMap<string, string>;
}

function isRuntimeAssetPath(file: string): boolean {
  return /\.(?:png|jpe?g|svg|mp3|wav|ogg)$/.test(file);
}

export function originalAssetCatalogSource(
  files: readonly string[],
  options: OriginalAssetCatalogSourceOptions,
): string {
  const imports: string[] = [];
  const entries = [...files].sort().map((file, index) => {
    if (
      !isRuntimeAssetPath(file) ||
      file.includes("\\") ||
      file
        .split("/")
        .some((part) => part === "" || part === "." || part === "..")
    ) {
      throw new Error(`Invalid original asset path: ${file}`);
    }
    const key = JSON.stringify(`../assets/original/${file}`);
    if (options.command === "build") {
      imports.push(
        `import asset${index} from ${JSON.stringify(`/${ASSET_DIRECTORY}/${file}?url&no-inline`)};`,
      );
      return `${key}:asset${index}`;
    }
    const encodedPath = file.split("/").map(encodeURIComponent).join("/");
    const version = options.versions?.get(file);
    const query =
      version === undefined ? "" : `?v=${encodeURIComponent(version)}`;
    return `${key}:${JSON.stringify(`${options.base}${ASSET_DIRECTORY}/${encodedPath}${query}`)}`;
  });
  return [
    ...imports,
    `export default Object.freeze({${entries.join(",")}});`,
  ].join("\n");
}

async function assetPaths(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(
        ...(await assetPaths(path.join(directory, entry.name), `${relative}/`)),
      );
    } else if (entry.isFile() && isRuntimeAssetPath(relative)) {
      files.push(relative);
    }
  }
  return files;
}

async function assetVersions(
  directory: string,
  files: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const versions = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      const details = await stat(path.join(directory, file));
      versions.set(file, `${Math.trunc(details.mtimeMs)}-${details.size}`);
    }),
  );
  return versions;
}

export function originalAssetCatalog(projectRoot: string): Plugin {
  const assetRoot = path.resolve(projectRoot, ASSET_DIRECTORY);
  let command: "build" | "serve" = "serve";
  let base = "/";

  return {
    name: "trigger-knight-original-asset-catalog",
    configResolved(config) {
      command = config.command;
      base = config.base;
    },
    resolveId(id) {
      return id === MODULE_ID ? RESOLVED_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_MODULE_ID) return null;
      const approvedRoot = path.join(
        await realpath(projectRoot),
        ASSET_DIRECTORY,
      );
      if ((await realpath(assetRoot)) !== approvedRoot) {
        throw new Error(
          "Original asset catalog must use the approved staging directory",
        );
      }
      const files = await assetPaths(assetRoot);
      if (command === "serve") {
        return originalAssetCatalogSource(files, {
          command,
          base,
          versions: await assetVersions(assetRoot, files),
        });
      }
      return originalAssetCatalogSource(files, { command, base });
    },
    configureServer(server) {
      const assetPrefix = `${base.endsWith("/") ? base : `${base}/`}${ASSET_DIRECTORY}/`;
      server.middlewares.use((request, response, next) => {
        const requestUrl = request.url ?? "";
        const [pathname, query = ""] = requestUrl.split("?", 2);
        if (
          pathname?.startsWith(assetPrefix) &&
          new URLSearchParams(query).has("v")
        ) {
          response.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
        next();
      });

      const reloadCatalog = (file: string) => {
        const relative = path.relative(assetRoot, file);
        if (
          path.isAbsolute(relative) ||
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          !isRuntimeAssetPath(relative)
        )
          return;
        const module = server.moduleGraph.getModuleById(RESOLVED_MODULE_ID);
        if (module === undefined) return;
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", reloadCatalog);
      server.watcher.on("change", reloadCatalog);
      server.watcher.on("unlink", reloadCatalog);
    },
  };
}
