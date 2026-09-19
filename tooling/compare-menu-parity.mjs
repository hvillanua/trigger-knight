import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const directory = process.argv[2] ?? "/tmp/trigger-knight-menu-parity";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const comparisons = [
    ["title", "title"],
    ["achievements", "status"],
    ["status", "status"],
  ];

  for (const [current, reference] of comparisons) {
    const [currentPng, referencePng] = await Promise.all([
      readFile(`${directory}/current-${current}.png`, "base64"),
      readFile(`${directory}/reference-${reference}.png`, "base64"),
    ]);
    const meanAbsoluteRgb = await page.evaluate(
      async ({ currentPng, referencePng }) => {
        const loadImage = async (base64) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          return image;
        };
        const pixels = async (base64) => {
          const image = await loadImage(base64);
          const canvas = document.createElement("canvas");
          canvas.width = 480;
          canvas.height = 320;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, 480, 320);
          return context.getImageData(0, 0, 480, 320).data;
        };
        const [actual, expected] = await Promise.all([
          pixels(currentPng),
          pixels(referencePng),
        ]);
        let difference = 0;
        for (let index = 0; index < actual.length; index += 4) {
          difference += Math.abs(actual[index] - expected[index]);
          difference += Math.abs(actual[index + 1] - expected[index + 1]);
          difference += Math.abs(actual[index + 2] - expected[index + 2]);
        }
        return difference / (480 * 320 * 3);
      },
      { currentPng, referencePng },
    );
    console.log(`${current}: ${meanAbsoluteRgb.toFixed(2)} mean absolute RGB`);
  }
} finally {
  await browser.close();
}
