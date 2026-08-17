import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

describe("spec 246: commandId rename (R-05)", () => {
  const OLD_IDS = [
    "flow.impl.review.draft",
    "flow.draft.review",
    "flow.spec.review",
  ];

  const NEW_IDS = [
    "flow.impl.review.propose",
    "flow.draft.review.propose",
    "flow.spec.review.propose",
  ];

  it("R-05: old commandIds do not appear in src/flow/commands/review.js", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    for (const oldId of OLD_IDS) {
      const regex = new RegExp(`["'\`]${oldId.replace(/\./g, "\\.")}["'\`]`);
      assert.ok(
        !regex.test(reviewJs),
        `Old commandId "${oldId}" should not exist in review.js`
      );
    }
  });

  it("R-05: new commandIds are present in src/flow/commands/review.js", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    for (const newId of NEW_IDS) {
      const regex = new RegExp(`["'\`]${newId.replace(/\./g, "\\.")}["'\`]`);
      assert.ok(
        regex.test(reviewJs),
        `New commandId "${newId}" should exist in review.js`
      );
    }
  });

  it("R-05: old commandIds do not appear anywhere in src/", () => {
    for (const oldId of OLD_IDS) {
      const escaped = oldId.replace(/\./g, "\\.");
      const result = execSync(
        `grep -rP --include="*.js" '["'\\''\`]${escaped}["'\\''\`]' "${resolve(ROOT, "src/")}" || true`,
        { encoding: "utf-8" }
      );
      assert.equal(
        result.trim(),
        "",
        `Old commandId "${oldId}" should not appear in src/: ${result.trim()}`
      );
    }
  });
});

describe("spec 246: config.json commandId keys (R-07)", () => {
  const OLD_KEYS = [
    "flow.impl.review.draft",
    "flow.draft.review",
    "flow.spec.review",
  ];

  const NEW_KEYS = [
    "flow.impl.review.propose",
    "flow.draft.review.propose",
    "flow.spec.review.propose",
  ];

  it("R-07: config.json has no old commandId keys", () => {
    const config = JSON.parse(
      readFileSync(resolve(ROOT, ".sdd-forge/config.json"), "utf-8")
    );
    const profiles = config.agent?.profiles?.default || {};
    for (const oldKey of OLD_KEYS) {
      assert.ok(
        !(oldKey in profiles),
        `Old key "${oldKey}" should not exist in config.agent.profiles.default`
      );
    }
  });

  it("R-07: config.json has new commandId keys", () => {
    const config = JSON.parse(
      readFileSync(resolve(ROOT, ".sdd-forge/config.json"), "utf-8")
    );
    const profiles = config.agent?.profiles?.default || {};
    for (const newKey of NEW_KEYS) {
      assert.ok(
        newKey in profiles,
        `New key "${newKey}" should exist in config.agent.profiles.default`
      );
    }
  });
});
