import { spawnSync } from "node:child_process";

const gates = Object.freeze({
  fast: Object.freeze([
    "format:check",
    "lint",
    "check:architecture",
    "typecheck",
    "test:unit",
  ]),
  full: Object.freeze([
    "format:check",
    "lint",
    "check:architecture",
    "typecheck",
    "test:unit",
    "test:browser",
    "build",
  ]),
});

const gateName = process.argv[2];
const scripts = gates[gateName];

if (!scripts) {
  process.stderr.write("Usage: node build/run-validation.mjs <fast|full>\n");
  process.exitCode = 2;
} else {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  for (const script of scripts) {
    const result = spawnSync(npmCommand, ["run", "--silent", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });

    if (result.error) {
      process.stderr.write(`${result.error.message}\n`);
      process.exitCode = 1;
      break;
    }

    if (result.status !== 0) {
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.status ?? 1;
      break;
    }

    process.stdout.write(`PASS ${script}\n`);
  }
}
