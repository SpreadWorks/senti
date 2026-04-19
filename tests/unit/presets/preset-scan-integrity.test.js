/**
 * Preset scan integrity tests.
 *
 * Validates that:
 * 1. Every preset with scan patterns has at least one scan DataSource in its chain
 * 2. Every {{data}} directive in templates references a DataSource that can be populated
 * 3. Scan DataSources cover all analysis categories that data DataSources read
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadDataSources } from "../../../src/docs/lib/data-source-loader.js";
import { resolveChainSafe, PRESETS_DIR } from "../../../src/lib/presets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read preset.json for a given preset key */
function readPreset(key) {
  const p = path.join(PRESETS_DIR, key, "preset.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Discover all preset keys that have a preset.json */
function discoverPresetKeys() {
  return fs.readdirSync(PRESETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((key) => fs.existsSync(path.join(PRESETS_DIR, key, "preset.json")));
}

/** Load scan-capable DataSources for an entire chain */
async function loadChainScanSources(presetKey) {
  const chain = resolveChainSafe(presetKey);
  let dataSources = new Map();
  for (const p of chain) {
    dataSources = await loadDataSources(path.join(p.dir, "data"), {
      existing: dataSources,
      presetKey: p.key,
      onInstance: (instance) => typeof instance.scan === "function" && typeof instance.match === "function",
    });
  }
  return dataSources;
}

/** Common DataSource directory (src/docs/data/) */
const COMMON_DATA_DIR = path.resolve(__dirname, "../../../src/docs/data");

/** Load all DataSources (not just scan) for an entire chain, including common */
async function loadChainAllSources(presetKey) {
  let dataSources = await loadDataSources(COMMON_DATA_DIR, {});
  const chain = resolveChainSafe(presetKey);
  for (const p of chain) {
    dataSources = await loadDataSources(path.join(p.dir, "data"), {
      existing: dataSources,
      presetKey: p.key,
    });
  }
  return dataSources;
}

/** Extract {{data("preset.source.method", {opts})}} references from a template file.
 *  Supports multiline directives. Skips cross-preset references with ignoreError. */
function extractDataDirectives(templateContent, ownChainKeys) {
  // Match the full directive block (possibly multiline within <!-- --> comments)
  const re = /\{\{data\(\s*"([^"]+)"(?:[\s\S]*?\})?\s*\)\}\}/g;
  const refs = [];
  let m;
  while ((m = re.exec(templateContent)) !== null) {
    const fullMatch = m[0];
    const parts = m[1].split(".");
    let preset, source, method;
    if (parts.length >= 3) {
      [preset, source, method] = parts;
    } else if (parts.length === 2) {
      preset = parts[0]; source = parts[0]; method = parts[1];
    } else {
      continue;
    }

    // Skip cross-preset references with ignoreError (e.g. monorepo.monorepo.apps in base template)
    const isCrossPreset = ownChainKeys && !ownChainKeys.has(preset);
    const hasIgnoreError = /ignoreError\s*:\s*true/.test(fullMatch);
    if (isCrossPreset && hasIgnoreError) continue;

    refs.push({ preset, source, method });
  }
  return refs;
}

/** Collect all template files for a preset (all languages) */
function collectTemplateFiles(presetKey) {
  const templatesDir = path.join(PRESETS_DIR, presetKey, "templates");
  if (!fs.existsSync(templatesDir)) return [];
  const files = [];
  for (const lang of fs.readdirSync(templatesDir)) {
    const langDir = path.join(templatesDir, lang);
    if (!fs.statSync(langDir).isDirectory()) continue;
    for (const file of fs.readdirSync(langDir)) {
      if (!file.endsWith(".md")) continue;
      files.push({
        path: path.join(langDir, file),
        lang,
        file,
        content: fs.readFileSync(path.join(langDir, file), "utf8"),
      });
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// 1. Presets with scan patterns must have scan DataSources in their chain
// ---------------------------------------------------------------------------

describe("presets with scan patterns have scan DataSources in chain", () => {
  const allKeys = discoverPresetKeys();

  for (const key of allKeys) {
    const preset = readPreset(key);
    if (!preset?.scan?.include?.length) continue;

    it(`${key}: has scan DataSource(s) in chain`, async () => {
      const scanSources = await loadChainScanSources(key);
      assert.ok(
        scanSources.size > 0,
        `preset "${key}" defines scan.include patterns but no DataSource ` +
        `with scan()+match() exists in its chain. ` +
        `Files will be collected but never analyzed.`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Template {{data}} directives reference existing DataSource methods
// ---------------------------------------------------------------------------

describe("template data directives reference existing DataSource methods", () => {
  const allKeys = discoverPresetKeys();

  // Known missing methods — these are pre-existing gaps, tracked here for visibility.
  // When a DataSource method is implemented, remove it from this set and the test
  // will enforce that it stays implemented.
  // Known missing methods — exist in templates but not in the template's own chain.
  // These are cross-preset references without ignoreError, or genuinely missing methods.
  // When a DataSource method is implemented, remove it from this set.
  for (const key of allKeys) {
    const templates = collectTemplateFiles(key);
    if (templates.length === 0) continue;

    // Only test one language (ja preferred, else first available)
    const langs = [...new Set(templates.map((t) => t.lang))];
    const testLang = langs.includes("ja") ? "ja" : langs[0];
    const langTemplates = templates.filter((t) => t.lang === testLang);

    for (const tmpl of langTemplates) {
      const chain = resolveChainSafe(key);
      const chainKeys = new Set(chain.map((p) => p.key));
      const refs = extractDataDirectives(tmpl.content, chainKeys);
      if (refs.length === 0) continue;

      it(`${key}/templates/${testLang}/${tmpl.file}: data directives have matching DataSources`, async () => {
        const allSources = await loadChainAllSources(key);
        const missing = [];
        for (const ref of refs) {
          const ds = allSources.get(ref.source);
          if (!ds || typeof ds[ref.method] !== "function") {
            missing.push(`${ref.preset}.${ref.source}.${ref.method}`);
          }
        }
        assert.deepEqual(
          missing, [],
          `Template references DataSource methods that don't exist:\n` +
          missing.map((m) => `  - ${m}`).join("\n"),
        );
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Data DataSources that read analysis.X must have a scan DataSource
//    that writes category X somewhere in the preset ecosystem
// ---------------------------------------------------------------------------

describe("data DataSources have corresponding scan DataSources for analysis keys", () => {
  const allKeys = discoverPresetKeys();

  // Collect ALL scan DataSource names across the entire preset ecosystem.
  // Scan writes result[name], so the DataSource map key = analysis category.
  // Also include "package" which base always provides.
  const allScanCategoryNames = new Set(["package"]);

  // Analysis keys that are NOT populated by scan but by other means
  // (e.g., enrichedAt is set by enrich, not scan)
  const NON_SCAN_KEYS = new Set(["enrichedAt", "analyzedAt", "generatedAt"]);

  /** Extract analysis keys read by a DataSource file: analysis.XXX or analysis?.XXX
   *  Only matches property access in code, not comments or strings. */
  function extractAnalysisKeys(filePath) {
    const src = fs.readFileSync(filePath, "utf8");
    // Remove single-line comments and JSDoc/block comments
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    // Match analysis.key or analysis?.key (property access in code)
    const re = /analysis\??\.(\w+)/g;
    const keys = new Set();
    let m;
    while ((m = re.exec(noComments)) !== null) {
      if (!NON_SCAN_KEYS.has(m[1])) keys.add(m[1]);
    }
    return keys;
  }

  // Phase 1: build the set of all scan category names across all presets
  it("collect scan categories (setup)", async () => {
    for (const key of allKeys) {
      const scanSources = await loadChainScanSources(key);
      for (const name of scanSources.keys()) {
        allScanCategoryNames.add(name);
      }
    }
    // Sanity: we should have found some scan DataSources
    assert.ok(allScanCategoryNames.size > 1, "should discover scan DataSource categories");
  });

  // Phase 2: for each preset's data/ directory, check that every analysis key
  // it reads has a corresponding scan DataSource somewhere
  for (const key of allKeys) {
    const dataDir = path.join(PRESETS_DIR, key, "data");
    if (!fs.existsSync(dataDir)) continue;

    const dataFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith(".js"));

    for (const file of dataFiles) {
      const filePath = path.join(dataDir, file);
      const analysisKeys = extractAnalysisKeys(filePath);
      if (analysisKeys.size === 0) continue;

      it(`${key}/data/${file}: analysis keys have scan DataSource producers`, () => {
        const uncovered = [];
        for (const aKey of analysisKeys) {
          if (!allScanCategoryNames.has(aKey)) {
            uncovered.push(aKey);
          }
        }
        assert.deepEqual(
          uncovered, [],
          `${key}/data/${file} reads analysis keys with no scan DataSource producer:\n` +
          uncovered.map((k) => `  - analysis.${k} (no scan DataSource writes "${k}" category)`).join("\n"),
        );
      });
    }
  }
});
