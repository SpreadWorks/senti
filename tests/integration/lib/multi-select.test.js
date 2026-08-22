import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTreeItems, formatSelectLine } from "../../../src/lib/multi-select.js";

describe("multi-select tree rendering", () => {
  it("keeps a focused item's connector aligned with its siblings", () => {
    const items = buildTreeItems([
      { key: "base", parent: null, label: "Base" },
      { key: "api", parent: "base", label: "API" },
      { key: "graphql", parent: "api", label: "GraphQL" },
    ]);

    assert.equal(
      formatSelectLine(items[1], 1, 1, "multi", new Set()),
      " └── > [ ] api (API)",
    );
    assert.equal(
      formatSelectLine(items[2], 1, 2, "multi", new Set()),
      "     └──   [ ] graphql (GraphQL)",
    );
  });
});
