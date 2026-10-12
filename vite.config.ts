import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { cleanRoomBoundary } from "./build/clean-room-boundary.js";
import { originalAssetCatalog } from "./build/original-image-catalog.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  plugins: [cleanRoomBoundary(projectRoot), originalAssetCatalog(projectRoot)],
  server: {
    host: "127.0.0.1",
  },
});
