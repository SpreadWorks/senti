import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EXIT_SUCCESS, EXIT_ERROR } from "../../../src/lib/exit-codes.js";

describe("exit-codes constants", () => {
  it("EXIT_SUCCESS is 0", () => {
    assert.equal(EXIT_SUCCESS, 0);
  });

  it("EXIT_ERROR is 1", () => {
    assert.equal(EXIT_ERROR, 1);
  });

  it("exports are numbers", () => {
    assert.equal(typeof EXIT_SUCCESS, "number");
    assert.equal(typeof EXIT_ERROR, "number");
  });
});
