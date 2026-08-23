import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

export default async function startBrowserTestServer(): Promise<
  () => Promise<void>
> {
  const server = await createServer({
    root: projectRoot,
    configFile: resolve(projectRoot, "vite.config.ts"),
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
  });

  try {
    await server.listen();
  } catch (error: unknown) {
    await server.close();
    throw error;
  }

  return async () => {
    await server.close();
  };
}
