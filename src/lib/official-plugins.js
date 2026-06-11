import fs from "fs";
import path from "path";
import { PKG_DIR } from "./cli.js";

function findSiblingPluginRoot(siblingName) {
  let current = path.resolve(PKG_DIR);
  while (true) {
    const candidate = path.join(current, siblingName);
    if (fs.existsSync(path.join(candidate, "plugin.json"))) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function officialPluginRoot(envName, siblingName, bundledName) {
  return process.env[envName]
    || findSiblingPluginRoot(siblingName)
    || bundledOfficialPluginRoot(bundledName);
}

function bundledOfficialPluginRoot(bundledName) {
  return path.join(PKG_DIR, "official-plugins", bundledName);
}

export function bundledOfficialPresetPluginRoot() {
  return bundledOfficialPluginRoot("senti-presets");
}

export function officialPresetPluginRoot() {
  return officialPluginRoot("SENTI_OFFICIAL_PRESETS_REPO", "senti-presets", "senti-presets");
}
