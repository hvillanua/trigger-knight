import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
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

function spawnValidationCommand(command, arguments_, options) {
  return spawnSync(command, arguments_, options);
}

export function runValidation(
  gateName,
  { cwd = process.cwd(), runCommand = spawnValidationCommand } = {},
) {
  const scripts = gates[gateName];

  if (!scripts) {
    return {
      status: 2,
      stdout: "",
      stderr: "Usage: node build/run-validation.mjs <fast|full>\n",
    };
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  let stdout = "";
  let stderr = "";

  for (const script of scripts) {
    const result = runCommand(npmCommand, ["run", "--silent", script], {
      cwd,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });

    if (result.error) {
      stderr += `${result.error.message}\n`;
      return { status: 1, stdout, stderr };
    }

    if (result.status !== 0) {
      stdout += result.stdout;
      stderr += result.stderr;
      return { status: result.status ?? 1, stdout, stderr };
    }

    stdout += `PASS ${script}\n`;
  }

  return { status: 0, stdout, stderr };
}

function isMainModule() {
  return (
    process.argv[1] !== undefined &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  );
}

if (isMainModule()) {
  const result = runValidation(process.argv[2]);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.status;
}
