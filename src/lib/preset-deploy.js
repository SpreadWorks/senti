import fs from "fs";
import path from "path";
import { PKG_DIR } from "./cli.js";

const PRESETS_DIR = path.join(PKG_DIR, "presets");

const CREATING_PRESETS_RUBRIC_NOTE = {
  en: [
    "## Guardrail Rewrite Rubric",
    "",
    "Use the guardrail rewrite rubric when updating preset guardrails.",
    "Each rewritten guardrail should define named violation sections, diff-verification condition bullets, and a severity-policy that distinguishes blocking from advisory findings.",
    "",
  ].join("\n"),
  ja: [
    "## Guardrail Rewrite Rubric",
    "",
    "プリセットの guardrail を更新するときは guardrail rewrite rubric を使う。",
    "各 guardrail は named violation、diff-verification condition、severity-policy を明示する。",
    "",
  ].join("\n"),
};

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function upsertText(dest, note) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const current = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";
  if (current.includes("guardrail rewrite rubric")) return;
  const next = current.trim() === "" ? note : `${current.trimEnd()}\n\n${note}`;
  fs.writeFileSync(dest, next, "utf8");
}

export function deployPresetCopies(workRoot, { presetKeys = ["base"], languages = ["en", "ja"] } = {}) {
  const results = [];
  for (const key of presetKeys) {
    const presetDir = path.join(PRESETS_DIR, key);
    const guardrailPath = path.join(presetDir, "guardrail.json");
    if (fs.existsSync(guardrailPath)) {
      const dest = path.join(workRoot, ".senti", "presets", key, "guardrail.json");
      copyFile(guardrailPath, dest);
      results.push(dest);
    }
    const rubricPath = path.join(presetDir, "guardrail-rewrite-rubric.md");
    if (fs.existsSync(rubricPath)) {
      const dest = path.join(workRoot, ".senti", "presets", key, "guardrail-rewrite-rubric.md");
      copyFile(rubricPath, dest);
      results.push(dest);
    }
  }
  for (const language of languages) {
    const dest = path.join(workRoot, ".senti", "templates", language, "docs", "creating_presets.md");
    upsertText(dest, CREATING_PRESETS_RUBRIC_NOTE[language] || CREATING_PRESETS_RUBRIC_NOTE.en);
    results.push(dest);
  }
  return results;
}
