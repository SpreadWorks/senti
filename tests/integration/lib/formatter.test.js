import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pushSection, DIVIDER } from "../../../src/lib/formatter.js";

describe("formatter", () => {
  describe("DIVIDER", () => {
    it("is a non-empty string of dash-like characters", () => {
      assert.equal(typeof DIVIDER, "string");
      assert.ok(DIVIDER.length > 0);
    });
  });

  describe("pushSection", () => {
    it("appends blank line, indented title, and indented divider", () => {
      const lines = ["existing"];
      pushSection(lines, "Coverage");
      assert.equal(lines.length, 4);
      assert.equal(lines[0], "existing");
      assert.equal(lines[1], "");
      assert.equal(lines[2], `  Coverage`);
      assert.equal(lines[3], `  ${DIVIDER}`);
    });

    it("works on an empty array", () => {
      const lines = [];
      pushSection(lines, "Test");
      assert.equal(lines.length, 3);
      assert.equal(lines[0], "");
    });

    it("accepts a custom divider override", () => {
      const lines = [];
      pushSection(lines, "Section", "---");
      assert.equal(lines[2], "  ---");
    });
  });
});
