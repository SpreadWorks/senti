/**
 * tests/unit/lib/config-schema-commands-test.test.js
 *
 * Tests for `commands.test` schema validation (REQ-P1-3).
 * Spec: 198-test-first-determinism-core.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate as validateConfig } from "../../../src/lib/config.js";

function baseConfig(overrides = {}) {
  return {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    ...overrides,
  };
}

describe("config.commands.test schema", () => {
  it("accepts {task, parent} both defined", () => {
    assert.doesNotThrow(() => validateConfig(baseConfig({
      commands: { test: { task: "npm run test:unit", parent: "npm test" } },
    })));
  });

  it("rejects commands.test with only task defined", () => {
    assert.throws(() => validateConfig(baseConfig({
      commands: { test: { task: "npm run test:unit" } },
    })), /parent|required/i);
  });

  it("rejects commands.test as a bare string", () => {
    assert.throws(() => validateConfig(baseConfig({
      commands: { test: "npm test" },
    })));
  });

  it("accepts commands without test (optional field)", () => {
    assert.doesNotThrow(() => validateConfig(baseConfig({
      commands: { gh: "enable" },
    })));
  });
});
