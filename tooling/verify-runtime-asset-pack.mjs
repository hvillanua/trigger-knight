import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

const packRoot = path.resolve(
  projectRoot,
  argumentValue("--pack", "src/assets/generated/swinir-2x"),
);
const originalRoot = path.resolve(
  projectRoot,
  argumentValue("--original", "src/assets/original"),
);

function fail(message) {
  throw new Error(message);
}

function isSafeRelativePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function imagePath(value) {
  return typeof value === "string" && /\.(?:png|jpe?g|svg)$/i.test(value);
}

function inside(root, relative) {
  const resolved = path.resolve(root, relative);
  const relation = path.relative(root, resolved);
  return relation !== "" && !relation.startsWith(`..${path.sep}`) && relation !== "..";
}

async function fileBytes(filePath) {
  const bytes = await fs.readFile(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes: bytes.length, sha256 };
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    fail(`Cannot read JSON ${path.relative(projectRoot, filePath)}: ${error.message}`);
  }
}

async function walkFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, filePath)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, filePath).split(path.sep).join("/"));
    }
  }
  return files;
}

async function verify() {
  try {
    await fs.access(packRoot);
  } catch {
    console.log(`Optional SwinIR 2x pack is not staged at ${path.relative(projectRoot, packRoot)}.`);
    return;
  }

  const manifestPath = path.join(packRoot, "manifest.json");
  const manifest = await readJson(manifestPath);
  if (
    manifest.schemaVersion !== 1 ||
    manifest.treatment !== "swinir-2x" ||
    manifest.status !== "generated" ||
    manifest.pixelDensity !== 2
  ) {
    fail("The runtime pack manifest does not describe SwinIR 2x.");
  }
  if (
    manifest.rightsStatus !==
    "Derived from staged assets; see assets/original/provenance.json."
  ) {
    fail("The runtime pack manifest has no approved provenance status.");
  }
  if (!manifest.generator || typeof manifest.reviewDate !== "string") {
    fail("The runtime pack manifest is missing generator or review metadata.");
  }
  if (manifest.source?.assetRoot !== "assets/original") {
    fail("The runtime pack manifest does not identify the staged original asset root.");
  }

  const sourceFiles = manifest.source.files;
  const outputFiles = manifest.outputs?.files;
  if (!Array.isArray(sourceFiles) || !Array.isArray(outputFiles) || outputFiles.length === 0) {
    fail("The runtime pack manifest has no complete source and output file lists.");
  }
  if (manifest.outputs.root !== "assets/generated/swinir-2x") {
    fail("The runtime pack manifest has an unexpected output root.");
  }

  const expectedOutputs = new Set();
  for (const entry of outputFiles) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !isSafeRelativePath(entry.path) ||
      !imagePath(entry.path) ||
      entry.pixelDensity !== 2 ||
      typeof entry.sha256 !== "string" ||
      typeof entry.bytes !== "number" ||
      expectedOutputs.has(entry.path)
    ) {
      fail("The runtime pack manifest contains an invalid or duplicate output entry.");
    }
    expectedOutputs.add(entry.path);
    if (!inside(packRoot, entry.path)) fail(`Output path escapes the pack: ${entry.path}`);
    const outputPath = path.join(packRoot, entry.path);
    const actual = await fileBytes(outputPath);
    if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) {
      fail(`Output hash or size does not match the manifest: ${entry.path}`);
    }
  }

  const actualImages = new Set(
    (await walkFiles(packRoot)).filter((file) => imagePath(file)),
  );
  if (actualImages.size !== expectedOutputs.size) {
    fail("The runtime pack contains image files that are not listed in the manifest.");
  }
  for (const file of actualImages) {
    if (!expectedOutputs.has(file)) fail(`Unlisted runtime image: ${file}`);
  }

  const expectedSources = new Set();
  for (const entry of sourceFiles) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !isSafeRelativePath(entry.path) ||
      typeof entry.sha256 !== "string" ||
      expectedSources.has(entry.path)
    ) {
      fail("The runtime pack manifest contains an invalid or duplicate source entry.");
    }
    expectedSources.add(entry.path);
    if (!inside(originalRoot, entry.path)) fail(`Source path escapes the original root: ${entry.path}`);
    const actual = await fileBytes(path.join(originalRoot, entry.path));
    if (actual.sha256 !== entry.sha256) {
      fail(`Source hash does not match the provenance record: ${entry.path}`);
    }
  }

  console.log(
    `Verified SwinIR 2x runtime pack with ${expectedOutputs.size} outputs and ${expectedSources.size} staged sources.`,
  );
}

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
