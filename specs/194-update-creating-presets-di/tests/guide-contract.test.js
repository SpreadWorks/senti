/**
 * spec 194 — creating_presets.md guide contract test
 *
 * Verifies that the preset creation guide (ja + en) matches the current
 * DI factory contract introduced by spec 191. This test catches:
 *   - Stale legacy-contract examples (class default export, sdd-forge/api imports)
 *   - Missing current-contract elements (register factory, container.get,
 *     container.getPreset, peerDependencies guidance, Container key catalog)
 *   - ja/en heading drift
 *
 * The test intentionally fails initially (pre-implementation) and should
 * pass once the guide is rewritten per spec 194.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../");

const JA_GUIDE = path.join(repoRoot, ".sdd-forge/templates/ja/docs/creating_presets.md");
const EN_GUIDE = path.join(repoRoot, ".sdd-forge/templates/en/docs/creating_presets.md");
const CONTAINER_FILE = path.join(repoRoot, "src/lib/container.js");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function extractHeadings(markdown) {
  return markdown
    .split("\n")
    .filter((l) => /^#{1,3}\s/.test(l))
    .map((l) => l.replace(/^(#+)\s+/, "$1 "));
}

/**
 * Parse container.js and extract every string literal passed to
 * container.register("<key>", ...). This gives the authoritative list
 * of Container keys that the guide must document.
 */
function extractContainerKeys(containerSrc) {
  const keys = [];
  const re = /container\.register\(\s*"([^"]+)"\s*,/g;
  let m;
  while ((m = re.exec(containerSrc)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

const ja = read(JA_GUIDE);
const en = read(EN_GUIDE);
const containerSrc = read(CONTAINER_FILE);
const containerKeys = extractContainerKeys(containerSrc);

describe("creating_presets.md — spec 191 DI contract compliance", () => {
  describe("R1: factory entry form is the only shown pattern", () => {
    for (const [name, text] of [["ja", ja], ["en", en]]) {
      it(`${name}: shows register(container) factory pattern`, () => {
        assert.match(
          text,
          /register\(container\)/,
          `${name}: must include register(container) example`,
        );
      });
      it(`${name}: does not show legacy 'export default class ... extends DataSource' pattern`, () => {
        assert.doesNotMatch(
          text,
          /export\s+default\s+class\s+\w+\s+extends\s+(DataSource|Scannable|WebappDataSource|\w+Source)\b/,
          `${name}: legacy class-based default export must not appear as a recommended pattern`,
        );
      });
    }
  });

  describe("R2: base utilities obtained via container.get", () => {
    for (const [name, text] of [["ja", ja], ["en", en]]) {
      it(`${name}: shows container.get("base.DataSource") or equivalent`, () => {
        assert.match(
          text,
          /container\.get\(\s*["']base\.(DataSource|Scannable|AnalysisEntry)["']/,
          `${name}: must show container.get for base classes`,
        );
      });
    }
  });

  describe("R3: parent inheritance via container.getPreset", () => {
    for (const [name, text] of [["ja", ja], ["en", en]]) {
      it(`${name}: shows container.getPreset(...).dataSources`, () => {
        assert.match(
          text,
          /container\.getPreset\([^)]+\)\.dataSources/,
          `${name}: must show container.getPreset(...).dataSources inheritance`,
        );
      });
    }
  });

  describe("R4: legacy public entrypoints removed", () => {
    for (const [name, text] of [["ja", ja], ["en", en]]) {
      it(`${name}: no 'from "sdd-forge/api"' imports remain`, () => {
        assert.doesNotMatch(
          text,
          /from\s+["']sdd-forge\/api["']/,
          `${name}: sdd-forge/api was removed in spec 191 and must not appear`,
        );
      });
      it(`${name}: no 'from "sdd-forge/presets/*"' imports remain`, () => {
        assert.doesNotMatch(
          text,
          /from\s+["']sdd-forge\/presets\//,
          `${name}: sdd-forge/presets/* subpath exports were removed and must not appear`,
        );
      });
    }
  });

  describe("R6: ja/en heading structure parity", () => {
    it("same heading count", () => {
      const jaHeadings = extractHeadings(ja);
      const enHeadings = extractHeadings(en);
      assert.equal(
        jaHeadings.length,
        enHeadings.length,
        `heading count mismatch — ja=${jaHeadings.length}, en=${enHeadings.length}`,
      );
    });
    it("same heading level sequence", () => {
      const jaLevels = extractHeadings(ja).map((h) => h.match(/^#+/)[0].length);
      const enLevels = extractHeadings(en).map((h) => h.match(/^#+/)[0].length);
      assert.deepEqual(jaLevels, enLevels, "heading level sequence differs between ja and en");
    });
  });

  describe("R7: Container keys documented", () => {
    for (const key of containerKeys) {
      for (const [name, text] of [["ja", ja], ["en", en]]) {
        it(`${name}: lists container key "${key}"`, () => {
          assert.ok(
            text.includes(key),
            `${name}: guide must mention container key "${key}" (registered in src/lib/container.js)`,
          );
        });
      }
    }
    it("container key list is non-empty", () => {
      assert.ok(containerKeys.length > 0, "expected container.register calls in src/lib/container.js");
    });
  });

  describe("R8: external preset compatibility via peerDependencies only", () => {
    for (const [name, text] of [["ja", ja], ["en", en]]) {
      it(`${name}: mentions peerDependencies`, () => {
        assert.match(
          text,
          /peerDependencies/,
          `${name}: must describe peerDependencies for external preset compat`,
        );
      });
    }
  });
});
