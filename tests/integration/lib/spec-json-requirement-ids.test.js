import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { enumerateUsableRequirementIds } from "../../../src/lib/spec-json.js";

describe("enumerateUsableRequirementIds", () => {
  it("returns normal string IDs in first-seen order", () => {
    assert.deepEqual(
      enumerateUsableRequirementIds({
        requirements: [{ id: "R1" }, { id: "R2" }],
      }),
      ["R1", "R2"],
    );
  });

  it("trims IDs and omits whitespace-only IDs", () => {
    assert.deepEqual(
      enumerateUsableRequirementIds({
        requirements: [
          { id: " R1 " },
          { id: "\tR2\n" },
          { id: "   " },
        ],
      }),
      ["R1", "R2"],
    );
  });

  it("de-duplicates duplicate IDs in first-seen order", () => {
    assert.deepEqual(
      enumerateUsableRequirementIds({
        requirements: [
          { id: " R1 " },
          { id: "R2" },
          { id: "R1" },
          { id: " R2 " },
        ],
      }),
      ["R1", "R2"],
    );
  });

  it("returns empty for missing or empty requirements", () => {
    assert.deepEqual(enumerateUsableRequirementIds({}), []);
    assert.deepEqual(enumerateUsableRequirementIds({ requirements: [] }), []);
  });

  it("ignores malformed entries without throwing", () => {
    assert.deepEqual(
      enumerateUsableRequirementIds({
        requirements: [
          null,
          "R1",
          { id: 1 },
          {},
          { id: " R3 " },
        ],
      }),
      ["R3"],
    );
  });
});
