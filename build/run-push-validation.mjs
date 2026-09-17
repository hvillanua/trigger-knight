import { readFileSync } from "node:fs";
import process from "node:process";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DOCUMENTATION_PATH = /(?:^|\/)[^/]+\.(?:md|markdown|txt)$/i;

export function shouldSkipCodeValidation(changedFiles) {
  return (
    changedFiles.length > 0 &&
    changedFiles.every((file) => DOCUMENTATION_PATH.test(file))
  );
}

function readChangedFiles() {
  return readFileSync(0, "utf8")
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(
      (file, index, files) => file !== "" && files.indexOf(file) === index,
    );
}

function isMainModule() {
  return (
    process.argv[1] !== undefined &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  );
}

if (isMainModule()) {
  const changedFiles = readChangedFiles();
  if (shouldSkipCodeValidation(changedFiles)) {
    process.stdout.write("PASS documentation-only push\n");
    process.exit(0);
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "validate"], {
    stdio: "inherit",
  });

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
