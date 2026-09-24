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
  argumentValue("--pack", "src/assets/generated/high-res"),
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
    console.log(`Optional high-resolution pack is not staged at ${path.relative(projectRoot, packRoot)}.`);
    return;
  }

  const manifestPath = path.join(packRoot, "manifest.json");
  const manifest = await readJson(manifestPath);
  if (
    manifest.schemaVersion !== 1 ||
    typeof manifest.treatment !== "string" ||
    !/^[a-z0-9][a-z0-9._-]*$/i.test(manifest.treatment) ||
    manifest.status !== "generated" ||
    ![2, 4].includes(manifest.pixelDensity) ||
    !["filtered", "linear", "nearest"].includes(manifest.filtering)
  ) {
    fail("The runtime pack manifest does not describe a valid high-resolution pack.");
  }
  if (
    typeof manifest.rightsStatus !== "string" ||
    manifest.rightsStatus.trim() === ""
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
  if (!isSafeRelativePath(manifest.outputs.root)) {
    fail("The runtime pack manifest has an unexpected output root.");
  }

  const expectedOutputPaths = new Set();
  const imageOutputEntries = [];
  const expectedImages = new Set();
  for (const entry of outputFiles) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !isSafeRelativePath(entry.path) ||
      typeof entry.sha256 !== "string" ||
      typeof entry.bytes !== "number" ||
      expectedOutputPaths.has(entry.path)
    ) {
      fail("The runtime pack manifest contains an invalid or duplicate output entry.");
    }
    expectedOutputPaths.add(entry.path);
    if (imagePath(entry.path)) {
      if (
        ![1, 2, 4].includes(entry.pixelDensity) ||
        (entry.pixelDensity !== 1 && entry.pixelDensity !== manifest.pixelDensity)
      ) {
        fail(`Image density does not match the manifest: ${entry.path}`);
      }
      imageOutputEntries.push(entry);
      expectedImages.add(entry.path);
    }
  }
  if (imageOutputEntries.length === 0) {
    fail("The runtime pack manifest has no image outputs.");
  }
  for (const entry of imageOutputEntries) {
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
  if (actualImages.size !== expectedImages.size) {
    fail("The runtime pack image list does not match the manifest.");
  }
  for (const file of actualImages) {
    if (!expectedImages.has(file)) fail(`Unlisted runtime image: ${file}`);
  }

  const expectedSources = new Set();
  let verifiedSourceCount = 0;
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
    if (!imagePath(entry.path)) continue;
    if (!inside(originalRoot, entry.path)) fail(`Source path escapes the original root: ${entry.path}`);
    const actual = await fileBytes(path.join(originalRoot, entry.path));
    if (actual.sha256 !== entry.sha256) {
      fail(`Source hash does not match the provenance record: ${entry.path}`);
    }
    verifiedSourceCount += 1;
  }
  if (verifiedSourceCount === 0) fail("The runtime pack has no image source records.");

  console.log(
    `Verified high-resolution ${manifest.treatment} pack at ${manifest.pixelDensity}x with ${expectedImages.size} images and ${verifiedSourceCount} staged image sources.`,
  );
}

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
