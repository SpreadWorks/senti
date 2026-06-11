const JAPANESE_RE = /[^\x00-\x7f]/;
const SAFE_SPEC_PATH_RE = /^specs\/[0-9][0-9][0-9]-[^/]+\/spec\.json$/;
const SHELL_META_RE = /[;&|<>`$()[\]{}*?\\]/;

export function isJapaneseText(value) {
  return typeof value === "string" && value.trim() !== "" && JAPANESE_RE.test(value);
}

export function assertJapanese(value, label) {
  if (!isJapaneseText(value)) throw invalid(`${label} must be a non-empty Japanese string`);
}

export function assertJapaneseOptional(value, label) {
  if (value == null || value === "") return;
  assertJapanese(value, label);
}

export function assertHash(value) {
  if (typeof value !== "string" || value.trim() === "" || value.startsWith("-")) {
    throw invalid("hash is required");
  }
}

export function assertNonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw invalid(`${label} is required`);
}

export function assertAddStatus(value) {
  if (value == null) return;
  if (!["Ideas", "To-do"].includes(value)) throw invalid("--status must be Ideas or To-do");
}

export function assertCategory(value) {
  if (value == null) return;
  if (!["RESEARCH", "BUG", "ENHANCE", "OTHER"].includes(value)) {
    throw invalid("--category must be RESEARCH, BUG, ENHANCE, or OTHER");
  }
}

export function assertSafeSpecPath(value) {
  assertNonEmpty(value, "--spec");
  if (value.startsWith("/") || value.includes("..") || SHELL_META_RE.test(value) || !SAFE_SPEC_PATH_RE.test(value)) {
    throw invalid("--spec must be a safe root-relative spec path");
  }
}

export function invalid(message) {
  const err = new Error(message);
  err.code = "INVALID_ARGS";
  return err;
}
