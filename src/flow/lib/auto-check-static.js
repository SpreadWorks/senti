/**
 * src/flow/lib/auto-check-static.js
 *
 * Static pre-gates for `sdd-forge flow run auto-check`.
 * Runs before the AI scoring step — if any gate hits, auto mode is rejected
 * without spending an AI call. See spec 208 R2 / R14.
 *
 * Input: raw text (request text / Issue body concatenated).
 * Output: { G, H, I, eligible }
 *   - G: high-risk domain keywords (auth / credentials / migrations / release ops)
 *   - H: external-contract keywords (breaking change / public interface / API contract)
 *   - I: contradiction markers — two or more inversion phrases in the same input
 *   - eligible: true when all three gates are false
 */

const G_KEYWORDS = [
  "security", "auth", "authentication", "password", "token", "credential",
  "migration", "migrate", "delete", "drop", "destructive", "secret",
  "npm publish", "release",
  "パスワード", "認証", "トークン", "資格情報", "マイグレーション",
  "削除", "破壊的", "リリース",
];

const H_KEYWORDS = [
  "cli signature", "breaking change", "api contract", "public interface",
  "backward incompatible", "schema break",
  "破壊的変更", "公開インターフェース", "api 契約", "後方互換",
];

const I_INVERSIONS = [
  /\bexcept\b/gi,
  /\bbut not\b/gi,
  /\bhowever\b/gi,
  /ただし/g,
  /ただ/g,
  /ただ し/g,
];

function anyKeyword(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function countInversions(text) {
  let total = 0;
  for (const pattern of I_INVERSIONS) {
    const matches = text.match(pattern);
    if (matches) total += matches.length;
  }
  return total;
}

export function evaluateStaticGates(text) {
  const input = typeof text === "string" ? text : "";
  const G = anyKeyword(input, G_KEYWORDS);
  const H = anyKeyword(input, H_KEYWORDS);
  const I = countInversions(input) >= 2;
  return { G, H, I, eligible: !G && !H && !I };
}
