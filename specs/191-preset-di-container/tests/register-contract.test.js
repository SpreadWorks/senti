/**
 * spec 191-preset-di-container — register() contract test
 *
 * Verifies that every preset's data/*.js module exports a default function
 * (factory) that takes a Container-like object, and that invoking the factory
 * returns a class suitable for registration. Parent presets are bootstrapped
 * first so that child factories can resolve `container.getPreset(parent)`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";
import { container, initContainer } from "../../../src/lib/container.js";

initContainer();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const presetsDir = path.resolve(__dirname, "../../../src/presets");

function listPresets() {
  return fs
    .readdirSync(presetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function listDataFiles(presetName) {
  const dataDir = path.join(presetsDir, presetName, "data");
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"))
    .map((f) => path.join(dataDir, f));
}

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

function isClassSource(fn) {
  return /^\s*class\b/.test(Function.prototype.toString.call(fn));
}

async function registerPreset(presetName) {
  const files = listDataFiles(presetName);
  const dataSources = {};
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    const Source = mod.default;
    if (typeof Source !== "function") continue;
    const Cls = Source(container);
    const name = path.basename(file, ".js");
    dataSources[name] = Cls;
  }
  container.registerPreset(presetName, { dataSources });
}

describe("preset register() contract", () => {
  const presets = listPresets();

  for (const preset of presets) {
    const dataFiles = listDataFiles(preset);
    if (dataFiles.length === 0) continue;

    describe(`preset: ${preset}`, () => {
      for (const file of dataFiles) {
        it(`${path.basename(file)} exports a register() factory (not a class)`, async () => {
          // Bootstrap parent chain so child factories can resolve parents.
          const chain = buildChain(preset);
          for (const ancestor of chain.slice(0, -1)) {
            if (!container.getPreset(ancestor)) {
              await registerPreset(ancestor);
            }
          }

          const mod = await import(pathToFileURL(file).href);
          assert.equal(
            typeof mod.default,
            "function",
            `${file}: default export must be a function (register factory)`,
          );
          assert.ok(
            !isClassSource(mod.default),
            `${file}: default export must be a factory function, not a class`,
          );
          const Cls = mod.default(container);
          assert.equal(
            typeof Cls,
            "function",
            `${file}: register(container) must return a class`,
          );
        });
      }
    });
  }
});
