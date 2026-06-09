import path from "path";
import { PKG_DIR } from "./cli.js";

export function officialPresetPluginRoot() {
  return path.join(PKG_DIR, "official-plugins", "senti-presets");
}

export function officialWorkflowPluginRoot() {
  return path.join(PKG_DIR, "official-plugins", "senti-workflow-plugin");
}
