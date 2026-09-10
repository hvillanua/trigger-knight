import { describe, expect, it } from "vitest";

import { originalV13Traceability } from "../fixtures/original-v13-traceability.js";

const classifications = [
  "confirmed",
  "derived",
  "compatibility-decision",
  "presentation-modernization",
  "excluded-scope",
  "unresolved",
] as const;

describe("Milestone 6 original-v1.3 traceability", () => {
  it("classifies every source claim and points covered claims at focused evidence", () => {
    expect(originalV13Traceability.length).toBeGreaterThan(0);

    const ids = originalV13Traceability.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      new Set(originalV13Traceability.map((entry) => entry.classification)),
    ).toEqual(new Set(classifications));

    for (const entry of originalV13Traceability) {
      expect(classifications).toContain(entry.classification);
      expect(entry.source).toMatch(/\.(?:md|ts)#/);
      expect(entry.rationale.length).toBeGreaterThan(0);

      if (entry.disposition === "covered") {
        expect(entry.evidence.length).toBeGreaterThan(0);
      }
      if (entry.disposition === "blocked") {
        expect(entry.blocker).toBeDefined();
      } else {
        expect(entry.blocker).toBeUndefined();
      }
    }
  });

  it("requires an explicit dependency-linked ticket for every uncovered gameplay requirement", () => {
    const blockers = originalV13Traceability
      .filter((entry) => entry.disposition === "blocked")
      .map((entry) => ({
        id: entry.id,
        blocker: entry.blocker,
      }));

    expect(blockers).toEqual([
      {
        id: "presentation.contextual-tutorial-gates",
        blocker: { issue: 92, dependency: 91 },
      },
    ]);
  });
});
