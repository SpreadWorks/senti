/**
 * senrail/docs/lib/review-parser.js
 *
 * Review output parsing for the forge command.
 */

import path from "path";

export function extractNeedsInput(out) {
  const text = String(out || "");
  const idx = text.indexOf("NEEDS_INPUT");
  if (idx < 0) return [];
  const tail = text.slice(idx).split("\n");
  const qs = [];
  for (const line of tail.slice(1)) {
    const s = line.trim();
    if (s.startsWith("- ")) {
      qs.push(s.slice(2).trim());
      continue;
    }
    if (s.length === 0) continue;
    break;
  }
  return qs.filter(Boolean);
}

export function summarizeReview(outputText) {
  const lines = String(outputText || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const fails = lines.filter((l) => l.includes("[FAIL]"));
  const warns = lines.filter((l) => l.includes("[WARN]"));
  const coverage = lines.filter(
    (l) =>
      l.includes("Controller coverage:") ||
      l.includes("DB table coverage:") ||
      l.includes("quality check:")
  );
  const picked = [...fails.slice(0, 40), ...warns.slice(0, 10), ...coverage].join("\n");
  return picked || "(no parsed failures)";
}

/**
 * review 出力からファイル単位の PASS/FAIL 情報を抽出する。
 * [FAIL] 行に含まれるファイル名を failedFiles、
 * review 対象のうち failedFiles に含まれないものを passedFiles として返す。
 *
 * @param {string} outputText - review コマンドの stdout+stderr
 * @param {string[]} allFiles - review 対象の全ファイル名リスト (例: ["docs/overview.md", ...])
 * @returns {{ passedFiles: string[], failedFiles: string[] }}
 */
export function parseFileResults(outputText, allFiles) {
  const text = String(outputText || "");
  const failedSet = new Set();

  // [FAIL] / [WARN] 行からファイル名を抽出
  // 形式例: "[FAIL] 行数不足 (5 行): overview.md"
  //         "[FAIL] HTML コメント外に露出したディレクティブ 1 件: cli_commands.md"
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.includes("[FAIL]")) continue;
    // ファイル名は行末にある（": filename" パターン）
    const match = trimmed.match(/:\s*([\w/.-]+\.md)\s*$/);
    if (match) {
      const fileName = match[1];
      for (const f of allFiles) {
        if (f === fileName || f.endsWith(`/${fileName}`) || fileName.endsWith(`/${f}`)) {
          failedSet.add(f);
        } else {
          const fBase = f.split("/").pop();
          if (fBase === path.basename(fileName)) {
            failedSet.add(f);
          }
        }
      }
    }
  }

  const failedFiles = [...failedSet];
  const passedFiles = allFiles.filter((f) => !failedSet.has(f));
  return { passedFiles, failedFiles };
}
