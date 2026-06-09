/**
 * src/presets/lib/composer-utils.js
 *
 * PHP プロジェクト共通のユーティリティ。
 * composer.json / .env ファイルの解析。
 */

import fs from "fs";
import path from "path";

/**
 * composer.json を解析し require / require-dev を返す。
 */
export function parseComposer(sourceRoot) {
  const composerPath = path.join(sourceRoot, "composer.json");
  if (!fs.existsSync(composerPath)) return { require: {}, requireDev: {} };
  try {
    const composer = JSON.parse(fs.readFileSync(composerPath, "utf8"));
    return {
      require: composer.require || {},
      requireDev: composer["require-dev"] || {},
    };
  } catch (_) {
    return { require: {}, requireDev: {} };
  }
}

/**
 * .env.example (Laravel) または .env (Symfony) から環境変数キーを抽出する。
 *
 * @param {string} sourceRoot - プロジェクトルート
 * @param {string[]} [fileNames] - 探索するファイル名の優先順リスト
 * @returns {Array<{key: string, defaultValue: string}>}
 */
export function parseEnvFile(sourceRoot, fileNames) {
  const candidates = fileNames || [".env.example", ".env"];
  let envPath;
  for (const name of candidates) {
    const p = path.join(sourceRoot, name);
    if (fs.existsSync(p)) {
      envPath = p;
      break;
    }
  }
  if (!envPath) return [];

  const content = fs.readFileSync(envPath, "utf8");
  const keys = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      const value = trimmed.slice(match[0].length);
      keys.push({ key: match[1], defaultValue: value });
    }
  }

  return keys;
}
