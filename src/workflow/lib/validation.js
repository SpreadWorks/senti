import { extractId } from "./hash.js";

const JAPANESE_CHAR_RE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

export function containsJapanese(text) {
  return JAPANESE_CHAR_RE.test(String(text || ""));
}

export function stripHashPrefix(title) {
  const text = String(title || "");
  const id = extractId(text);
  if (!id) return text;
  return text.slice(id.length + 2);
}

export function assertJapaneseDraftField(label, text, { allowEmpty = false } = {}) {
  const value = String(text || "");
  if (!value.trim()) {
    if (allowEmpty) return;
    throw new Error(`${label}は空にできません`);
  }
  if (!containsJapanese(value)) {
    throw new Error(`${label}は日本語で入力してください`);
  }
}

export function assertJapaneseDraft(title, body, { allowEmptyBody = true } = {}) {
  assertJapaneseDraftField("タイトル", title);
  assertJapaneseDraftField("本文", body, { allowEmpty: allowEmptyBody });
}
