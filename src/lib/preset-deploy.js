import fs from "fs";
import path from "path";
import { PKG_DIR } from "./cli.js";

const PRESETS_DIR = path.join(PKG_DIR, "presets");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function deployPresetCopies(workRoot, { presetKeys = ["base"], languages = ["en", "ja"] } = {}) {
  const results = [];
  for (const key of presetKeys) {
    const presetDir = path.join(PRESETS_DIR, key);
    const guardrailPath = path.join(presetDir, "guardrail.json");
    if (fs.existsSync(guardrailPath)) {
      const dest = path.join(workRoot, ".senrail", "presets", key, "guardrail.json");
      copyFile(guardrailPath, dest);
      results.push(dest);
    }
    const rubricPath = path.join(presetDir, "guardrail-rewrite-rubric.md");
    if (key === "base" && fs.existsSync(rubricPath)) {
      const dest = path.join(workRoot, ".senrail", "presets", key, "guardrail-rewrite-rubric.md");
      copyFile(rubricPath, dest);
      results.push(dest);
    }
  }
  return results;
}
