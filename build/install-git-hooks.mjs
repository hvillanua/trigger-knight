import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repository = spawnSync(
  "git",
  ["-C", packageRoot, "rev-parse", "--show-toplevel"],
  { encoding: "utf8" },
);

if (repository.status === 0) {
  const repositoryRoot = path.resolve(repository.stdout.trim());

  if (repositoryRoot === packageRoot) {
    const result = spawnSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "config",
        "--local",
        "core.hooksPath",
        ".githooks",
      ],
      { encoding: "utf8" },
    );

    if (result.status !== 0) {
      process.stderr.write(result.stderr);
      process.exitCode = result.status ?? 1;
    }
  }
}
