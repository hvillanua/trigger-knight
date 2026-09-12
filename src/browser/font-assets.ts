export const ORIGINAL_FONT_FAMILIES = Object.freeze({
  calibri: "Trigger Knight Calibri",
  calibri12: "Trigger Knight Calibri 12",
  calibri14: "Trigger Knight Calibri 14",
  calibri16: "Trigger Knight Calibri 16",
  calisto5: "Trigger Knight Calisto 5",
  calisto224: "Trigger Knight Calisto 224",
  eurostile: "Trigger Knight Eurostile",
  hooge: "Trigger Knight Hooge",
} as const);

export const ORIGINAL_FONT_FAMILY_NAMES = Object.freeze([
  ORIGINAL_FONT_FAMILIES.calibri,
  ORIGINAL_FONT_FAMILIES.calibri12,
  ORIGINAL_FONT_FAMILIES.calibri14,
  ORIGINAL_FONT_FAMILIES.calibri16,
  ORIGINAL_FONT_FAMILIES.calisto5,
  ORIGINAL_FONT_FAMILIES.calisto224,
  ORIGINAL_FONT_FAMILIES.eurostile,
  ORIGINAL_FONT_FAMILIES.hooge,
]);

let originalFontsReady: Promise<boolean> | undefined;

/** Loads every staged original font once, then lets Canvas redraw with them. */
export function loadOriginalFonts(): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  originalFontsReady ??= Promise.all(
    ORIGINAL_FONT_FAMILY_NAMES.map((family) =>
      document.fonts.load(`1em "${family}"`).then(
        (faces) => faces.length > 0,
        () => false,
      ),
    ),
  ).then((loaded) => loaded.every(Boolean));
  return originalFontsReady;
}
