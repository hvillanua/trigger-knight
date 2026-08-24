import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { cleanRoomBoundary } from "./build/clean-room-boundary.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  plugins: [cleanRoomBoundary(projectRoot)],
  server: {
    host: "127.0.0.1",
  },
});
