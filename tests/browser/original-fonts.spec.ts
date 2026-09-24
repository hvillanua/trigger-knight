import { expect, test } from "@playwright/test";
import {
  ORIGINAL_FONT_FAMILIES,
  ORIGINAL_FONT_FAMILY_NAMES,
} from "../../src/browser/font-assets.js";
import type * as CanvasPresentationModule from "../../src/browser/canvas-presentation.js";

test("loads and uses the staged original fonts in browser presentation", async ({
  page,
}) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(
    page.getByRole("img", { name: "Trigger Knight game view" }),
  ).toHaveAttribute("data-font-status", "ready");

  const result = await page.evaluate(
    async ({ familyNames, modulePath }) => {
      const loaded = await Promise.all(
        familyNames.map(async (family) => {
          const faces = await document.fonts.load(`16px "${family}"`);
          return {
            family,
            faceCount: faces.length,
            available: document.fonts.check(`16px "${family}"`),
          };
        }),
      );

      const bodyFont = getComputedStyle(document.body).fontFamily;
      const title = document.querySelector("h1");
      const button = document.querySelector("button");
      if (title === null || button === null) {
        throw new Error("Expected the browser presentation text elements");
      }

      const { CanvasPresentation } = (await import(
        modulePath
      )) as typeof CanvasPresentationModule;
      const base =
        window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
      if (base === undefined)
        throw new Error("Expected the initial observation");

      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 320;
      document.body.append(canvas);
      const presentation = new CanvasPresentation(canvas);
      const fillTextDescriptor = Object.getOwnPropertyDescriptor(
        CanvasRenderingContext2D.prototype,
        "fillText",
      );
      if (typeof fillTextDescriptor?.value !== "function") {
        throw new Error("Expected the Canvas fillText method");
      }
      const originalFillText = fillTextDescriptor.value as (
        this: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth?: number,
      ) => void;
      const canvasFonts = new Set<string>();
      CanvasRenderingContext2D.prototype.fillText = function (
        text,
        x,
        y,
        maxWidth,
      ): void {
        canvasFonts.add(this.font);
        if (maxWidth === undefined) {
          originalFillText.call(this, text, x, y);
        } else {
          originalFillText.call(this, text, x, y, maxWidth);
        }
      };
      try {
        presentation.present({
          previous: base,
          current: base,
          interpolation: 1,
          events: [],
        });
      } finally {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
        canvas.remove();
      }

      return {
        loaded,
        bodyFont,
        titleFont: getComputedStyle(title).fontFamily,
        buttonFont: getComputedStyle(button).fontFamily,
        canvasFonts: [...canvasFonts],
      };
    },
    {
      familyNames: ORIGINAL_FONT_FAMILY_NAMES,
      modulePath: "/src/browser/canvas-presentation.ts",
    },
  );

  expect(result.loaded).toHaveLength(ORIGINAL_FONT_FAMILY_NAMES.length);
  expect(result.loaded).toEqual(
    expect.arrayContaining(
      ORIGINAL_FONT_FAMILY_NAMES.map((family) =>
        expect.objectContaining({ family, faceCount: 1, available: true }),
      ),
    ),
  );
  expect(result.bodyFont).toContain(ORIGINAL_FONT_FAMILIES.calibri);
  expect(result.titleFont).toContain(ORIGINAL_FONT_FAMILIES.eurostile);
  expect(result.buttonFont).toContain(ORIGINAL_FONT_FAMILIES.hooge);
  expect(result.canvasFonts).toEqual(
    expect.arrayContaining([
      expect.stringContaining(ORIGINAL_FONT_FAMILIES.calibri),
      expect.stringContaining(ORIGINAL_FONT_FAMILIES.eurostile),
    ]),
  );
});
