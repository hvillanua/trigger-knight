import rawTutorialPages from "../assets/tutorial/tutorial-pages.json";
import type { TutorialPage } from "../application/contracts.js";

export interface TutorialContent {
  readonly title: string;
  readonly paragraphs: readonly [string, ...string[]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Tutorial ${field} must be a non-empty string`);
  }
  return value;
}

function requiredParagraphs(value: unknown): readonly [string, ...string[]] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("Tutorial paragraphs must be a non-empty array");
  }
  const paragraphValues: string[] = [];
  for (const paragraph of value) {
    paragraphValues.push(requiredString(paragraph, "paragraph"));
  }
  const [first, ...rest] = paragraphValues;
  if (first === undefined) {
    throw new TypeError("Tutorial paragraphs must include an introduction");
  }
  const normalized: [string, ...string[]] = [first, ...rest];
  return Object.freeze(normalized);
}

function parseTutorialContent(value: unknown): TutorialContent {
  if (!isRecord(value)) {
    throw new TypeError("Tutorial page must be an object");
  }
  return Object.freeze({
    title: requiredString(value.title, "title"),
    paragraphs: requiredParagraphs(value.paragraphs),
  });
}

function parseTutorialPages(
  value: unknown,
): Readonly<Record<TutorialPage, TutorialContent>> {
  if (!isRecord(value)) {
    throw new TypeError("Tutorial pages must be an object");
  }
  return Object.freeze({
    0: parseTutorialContent(value["0"]),
    1: parseTutorialContent(value["1"]),
    2: parseTutorialContent(value["2"]),
    3: parseTutorialContent(value["3"]),
    4: parseTutorialContent(value["4"]),
    5: parseTutorialContent(value["5"]),
  });
}

export const TUTORIAL_PAGES = parseTutorialPages(rawTutorialPages);
