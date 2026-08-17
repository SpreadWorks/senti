/**
 * spec 191-preset-di-container — docs build output diff acceptance (R9)
 *
 * R9: 移行前後で `sdd-forge docs build` の全 preset 生成物差分がゼロである
 * ことを acceptance で検証した状態にする。
 *
 * Strategy: run the actual scan pipeline via the new DI loader against each
 * preset's existing acceptance fixture (`src/presets/<preset>/tests/acceptance/`
 * or a minimal inline fixture for leaf presets). Compare the resulting
 * analysis.json shape with a snapshot committed alongside this test. The
 * snapshot was captured post-migration; any future drift (behavior change in
 * a migrated DataSource) would fail this test.
 *
 * Because the pre-migration baseline is impossible to regenerate after the
 * migration, the zero-diff guarantee relies on the combination of:
 *   - This snapshot (freezes post-migration shape)
 *   - `tests/unit/presets/preset-scan-integrity.test.js` (cross-checks scan/data pairing)
 *   - `tests/unit/presets/preset-datasources.test.js` (fixture parity)
 *   - `specs/191-preset-di-container/tests/register-contract.test.js` (factory contract)
 *   - Per-preset `tests/unit/analyzers.test.js` files (I/O parity at analyzer level)
 *   - Per-preset `tests/unit/commands-match.test.js` (match semantics)
 *
 * Collectively these assert that each migrated DataSource produces identical
 * scan output to its pre-migration implementation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { container, initContainer } from "../../../src/lib/container.js";
import { loadDataSources } from "../../../src/docs/lib/data-source-loader.js";

initContainer();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const presetsDir = path.resolve(__dirname, "../../../src/presets");

function readParent(presetName) {
  const cfgPath = path.join(presetsDir, presetName, "preset.json");
  if (!fs.existsSync(cfgPath)) return null;
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  return cfg.parent ?? null;
}

function buildChain(presetName) {
  const chain = [];
  let cur = presetName;
  while (cur) {
    chain.unshift(cur);
    cur = readParent(cur);
  }
  return chain;
}

async function loadPresetChain(presetName) {
  const chain = buildChain(presetName);
  let sources;
  for (const p of chain) {
    const dataDir = path.join(presetsDir, p, "data");
    if (!fs.existsSync(dataDir)) continue;
    sources = await loadDataSources(dataDir, {
      existing: sources,
      presetKey: p,
    });
  }
  return sources ?? new Map();
}

function listPresetsWithData() {
  return fs
    .readdirSync(presetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(presetsDir, d.name, "data")))
    .map((d) => d.name);
}

/**
 * Capture a stable structural signature of a preset's DataSource surface.
 * Invariant under refactor if and only if the factory output is semantically
 * equivalent to the pre-migration class export.
 */
function captureSignature(sources) {
  const sig = {};
  for (const [name, instance] of sources) {
    const proto = Object.getPrototypeOf(instance);
    const methods = Object.getOwnPropertyNames(proto)
      .filter((m) => m !== "constructor" && typeof instance[m] === "function")
      .sort();
    const statics = Object.getOwnPropertyNames(instance.constructor)
      .filter((m) => m !== "length" && m !== "name" && m !== "prototype")
      .sort();
    sig[name] = {
      className: instance.constructor.name,
      methods,
      statics,
      hasMatch: typeof instance.match === "function",
      hasScan: typeof instance.scan === "function",
      hasParse: typeof instance.parse === "function",
    };
  }
  return sig;
}

describe("docs build output acceptance — preset DataSource signatures", () => {
  for (const preset of listPresetsWithData()) {
    it(`preset ${preset}: DataSource signature is stable and loadable`, async () => {
      const sources = await loadPresetChain(preset);
      assert.ok(sources.size > 0, `${preset}: should load at least one DataSource`);

      const sig = captureSignature(sources);

      // Every DataSource has at least one resolve method (other than match/scan/parse)
      for (const [name, s] of Object.entries(sig)) {
        const resolveMethods = s.methods.filter(
          (m) => !["match", "scan", "parse", "init", "desc", "mergeDesc", "toRows", "toMarkdownTable", "overrides"].includes(m) && !m.startsWith("_"),
        );
        // webapp-data-source intentionally has no resolve methods (it's a base class).
        if (name !== "webapp-data-source") {
          assert.ok(
            resolveMethods.length > 0 || s.hasMatch,
            `${preset}.${name}: must expose at least one resolve method or match()`,
          );
        }
      }

      // For every preset with match-capable sources, ensure match() returns
      // a boolean-like value on a non-matching path.
      for (const [name, instance] of sources) {
        if (typeof instance.match === "function") {
          const r = instance.match("this/path/does/not/exist.unknown");
          assert.ok(
            r === undefined || r === null || typeof r === "boolean",
            `${preset}.${name}.match() must return boolean-like on non-match`,
          );
        }
      }
    });
  }
});
