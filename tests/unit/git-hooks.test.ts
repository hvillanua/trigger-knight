import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

type ValidationStatus = "pass" | "fail";

function inTemporaryDirectory(run: (directory: string) => void) {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "trigger-knight-hooks-"),
  );

  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runGit(directory: string, ...arguments_: string[]) {
  return spawnSync("git", arguments_, {
    cwd: directory,
    encoding: "utf8",
  });
}

function expectGitSuccess(result: ReturnType<typeof runGit>) {
  expect(result.status, result.stdout + result.stderr).toBe(0);
}

function writePackage(
  directory: string,
  fastStatus: ValidationStatus,
  fullStatus: ValidationStatus,
) {
  const statusCode = (status: ValidationStatus) =>
    status === "pass" ? "0" : "1";

  writeFileSync(
    path.join(directory, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        scripts: {
          "validate:fast": `node -e "process.exit(${statusCode(fastStatus)})"`,
          validate: `node -e "process.exit(${statusCode(fullStatus)})"`,
        },
      },
      null,
      2,
    )}\n`,
  );
}

function installFixtureHooks(directory: string) {
  mkdirSync(path.join(directory, "build"));
  copyFileSync(
    path.join(repositoryRoot, "build/install-git-hooks.mjs"),
    path.join(directory, "build/install-git-hooks.mjs"),
  );
  cpSync(
    path.join(repositoryRoot, ".githooks"),
    path.join(directory, ".githooks"),
    {
      recursive: true,
    },
  );
  chmodSync(path.join(directory, ".githooks/pre-commit"), 0o755);
  chmodSync(path.join(directory, ".githooks/pre-push"), 0o755);

  const install = spawnSync(
    process.execPath,
    [path.join(directory, "build/install-git-hooks.mjs")],
    {
      cwd: directory,
      encoding: "utf8",
    },
  );
  expect(install.stderr).toBe("");
  expect(install.status).toBe(0);
}

function initializeRepository(directory: string) {
  expectGitSuccess(runGit(directory, "init", "--initial-branch=main"));
  expectGitSuccess(
    runGit(directory, "config", "user.email", "test@example.com"),
  );
  expectGitSuccess(runGit(directory, "config", "user.name", "Hook Test"));
}

describe("local validation hooks", () => {
  it("runs hook setup as part of a clean installation", () => {
    const packageManifest = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageManifest.scripts.prepare).toBe("npm run setup:hooks");
    expect(packageManifest.scripts["setup:hooks"]).toBe(
      "node build/install-git-hooks.mjs",
    );
  });

  it("activates the repository hook path during setup", () => {
    inTemporaryDirectory((directory) => {
      initializeRepository(directory);
      installFixtureHooks(directory);

      const hookPath = runGit(
        directory,
        "config",
        "--local",
        "--get",
        "core.hooksPath",
      );

      expect(hookPath.stdout.trim()).toBe(".githooks");
      expect(hookPath.status).toBe(0);
    });
  });

  it("blocks a commit when fast validation fails", () => {
    inTemporaryDirectory((directory) => {
      initializeRepository(directory);
      installFixtureHooks(directory);
      writePackage(directory, "fail", "pass");
      writeFileSync(path.join(directory, "change.txt"), "blocked\n");
      expectGitSuccess(runGit(directory, "add", "."));

      const blockedCommit = runGit(directory, "commit", "-m", "blocked");

      expect(blockedCommit.status).not.toBe(0);
      expect(blockedCommit.stdout + blockedCommit.stderr).toContain(
        "validate:fast",
      );

      writePackage(directory, "pass", "pass");
      expectGitSuccess(runGit(directory, "add", "package.json"));
      expectGitSuccess(runGit(directory, "commit", "-m", "accepted"));
    });
  });

  it("blocks a push when complete validation fails", () => {
    inTemporaryDirectory((directory) => {
      const localRepository = path.join(directory, "local");
      const remoteRepository = path.join(directory, "remote.git");
      mkdirSync(localRepository);
      mkdirSync(remoteRepository);
      initializeRepository(localRepository);
      expectGitSuccess(runGit(remoteRepository, "init", "--bare"));
      installFixtureHooks(localRepository);
      writePackage(localRepository, "pass", "pass");
      expectGitSuccess(runGit(localRepository, "add", "."));
      expectGitSuccess(runGit(localRepository, "commit", "-m", "initial"));
      expectGitSuccess(
        runGit(localRepository, "remote", "add", "origin", remoteRepository),
      );
      expectGitSuccess(
        runGit(localRepository, "push", "--set-upstream", "origin", "main"),
      );

      const remoteHeadBefore = readFileSync(
        path.join(remoteRepository, "refs/heads/main"),
        "utf8",
      );
      writePackage(localRepository, "pass", "fail");
      expectGitSuccess(runGit(localRepository, "add", "package.json"));
      expectGitSuccess(runGit(localRepository, "commit", "-m", "blocked push"));

      const blockedPush = runGit(localRepository, "push");

      expect(blockedPush.status).not.toBe(0);
      expect(blockedPush.stdout + blockedPush.stderr).toContain("validate");
      expect(
        readFileSync(path.join(remoteRepository, "refs/heads/main"), "utf8"),
      ).toBe(remoteHeadBefore);
    });
  });
});
