import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../../../src/lib/types.js";

/**
 * Spec #119 verification tests: config validation for flow.commands.context.search.mode
 */

describe("Spec #119: Config validation (R2, AC7)", () => {
  const baseConfig = {
    lang: "node",
    type: "cli",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  };

  it("AC7: rejects invalid mode value", () => {
    const config = {
      ...baseConfig,
      flow: { commands: { context: { search: { mode: "fuzzy" } } } },
    };
    assert.throws(() => validateConfig(config), /flow\.commands\.context\.search\.mode/);
  });

  it("R2.1: accepts 'ngram' mode", () => {
    const config = {
      ...baseConfig,
      flow: { commands: { context: { search: { mode: "ngram" } } } },
    };
    assert.doesNotThrow(() => validateConfig(config));
  });

  it("R2.1: accepts 'ai' mode", () => {
    const config = {
      ...baseConfig,
      flow: { commands: { context: { search: { mode: "ai" } } } },
    };
    assert.doesNotThrow(() => validateConfig(config));
  });

  it("R2.2: accepts missing flow.commands (defaults to ngram)", () => {
    const config = { ...baseConfig };
    assert.doesNotThrow(() => validateConfig(config));
  });
});
