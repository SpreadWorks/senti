/**
 * src/lib/agents-md.js
 *
 * AGENTS.md の Spec-Driven Development セクションテンプレート読み込みユーティリティ。
 * setup.js から利用する。
 */

import fs from "fs";
import path from "path";
import { PRESETS_DIR, resolvePresetEntriesForSearch } from "./presets.js";
import { PRODUCT } from "./product.js";

/**
 * Spec-Driven Development セクションテンプレートを読み込む。
 * 指定ロケールが無ければ "en" にフォールバックする。
 *
 * @param {string} lang - ロケールコード
 * @returns {string} Spec-Driven Development セクション markdown（見つからなければ空文字列）
 */
export function loadSpecDrivenDevelopmentTemplate(lang, options = {}) {
  if (options.projectRoot && options.presetTypes) {
    for (const l of [lang, "en"]) {
      const projectPath = path.join(options.projectRoot, PRODUCT.managedPath("templates", l, "flow-agent-instructions.md"));
      if (fs.existsSync(projectPath)) return fs.readFileSync(projectPath, "utf8");
    }
    for (const preset of resolvePresetEntriesForSearch(options.presetTypes, options.projectRoot)) {
      for (const l of [lang, "en"]) {
        const p = path.join(preset.dir, "templates", l, "flow-agent-instructions.md");
        if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
      }
    }
    return "";
  }
  for (const l of [lang, "en"]) {
    const p = path.join(PRESETS_DIR, "base", "templates", l, "flow-agent-instructions.md");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "";
}
