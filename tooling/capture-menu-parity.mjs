import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [videoPath, outputDirectory = "/tmp/trigger-knight-menu-parity"] =
  process.argv.slice(2);

if (!videoPath) {
  throw new Error("Usage: node tooling/capture-menu-parity.mjs <video-path> [output-dir]");
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const game = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  await game.goto("http://127.0.0.1:5173/?manual=1");
  await game.getByRole("button", { name: "Dismiss tutorial" }).click();
  await game.keyboard.press("p");
  await game.getByRole("button", { name: "Main menu", exact: true }).click();
  await game.locator("#title-screen").screenshot({
    path: `${outputDirectory}/current-title.png`,
  });
  await game.getByRole("button", { name: "View achievements" }).click();
  await game.locator("main.foundation > section.screen:not([hidden])").screenshot({
    path: `${outputDirectory}/current-achievements.png`,
  });
  await game.getByRole("button", { name: "Back", exact: true }).click();
  await game.getByRole("button", { name: "View collections" }).click();
  await game.locator("main.foundation > section.screen:not([hidden])").screenshot({
    path: `${outputDirectory}/current-status.png`,
  });

  const reference = await browser.newPage({
    viewport: { width: 1286, height: 872 },
    deviceScaleFactor: 1,
  });
  await reference.goto(pathToFileURL(videoPath).href);
  const video = reference.locator("video");
  for (const [name, time] of [["title", 1], ["status", 6]]) {
    await video.evaluate(async (element, seconds) => {
      element.controls = false;
      element.currentTime = seconds;
      await new Promise((resolve) =>
        element.addEventListener("seeked", resolve, { once: true }),
      );
    }, time);
    await video.screenshot({
      path: `${outputDirectory}/reference-${name}.png`,
    });
  }
} finally {
  await browser.close();
}
