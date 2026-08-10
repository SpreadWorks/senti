import fs from "fs";
import path from "path";
import { PKG_DIR } from "./cli.js";
import { PRODUCT } from "./product.js";

const PRESETS_DIR = path.join(PKG_DIR, "presets");

function copyFile(src, dest, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function deployPresetCopies(workRoot, {
  presetKeys = ["base"],
  languages = ["en", "ja"],
  dryRun = false,
} = {}) {
  const results = [];
  for (const key of presetKeys) {
    const presetDir = path.join(PRESETS_DIR, key);
    const guardrailPath = path.join(presetDir, "guardrail.json");
    if (fs.existsSync(guardrailPath)) {
      const dest = path.join(workRoot, PRODUCT.managedPath("presets", key, "guardrail.json"));
      copyFile(guardrailPath, dest, dryRun);
      results.push(dest);
    }
    const rubricPath = path.join(presetDir, "guardrail-rewrite-rubric.md");
    if (key === "base" && fs.existsSync(rubricPath)) {
      const dest = path.join(workRoot, PRODUCT.managedPath("presets", key, "guardrail-rewrite-rubric.md"));
      copyFile(rubricPath, dest, dryRun);
      results.push(dest);
    }
  }
  return results;
}
