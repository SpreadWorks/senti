import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as graphql from "../../src/workflow/lib/graphql.js";

describe("workflow graphql: SingleSelect option creation", () => {
  it("exports addSingleSelectOption function", () => {
    assert.equal(
      typeof graphql.addSingleSelectOption,
      "function",
      "addSingleSelectOption must be exported as a function",
    );
  });

  it("addSingleSelectOption accepts (fieldId, optionName)", () => {
    assert.equal(
      graphql.addSingleSelectOption.length,
      2,
      "addSingleSelectOption must accept 2 positional parameters",
    );
  });
});
