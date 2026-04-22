/**
 * src/flow/lib/summarize-test-log.js
 *
 * Test log summarizer — calls an external agent with a truncated log and
 * returns a validated structured summary of failed tests. Used by
 * `flow run tests` (and `--baseline` variant) to convert raw stdout/stderr
 * into a compact JSON suitable for gate-impl prompts.
 *
 * Contract (spec 209):
 *   - Input log is truncated to at most `MAX_INPUT_BYTES` (tail) before being
 *     sent to the agent.
 *   - Agent response must be JSON of shape `{ failed: [{id, reason}, ...] }`.
 *   - `failed[]` is capped at `MAX_FAILED_ENTRIES`; each `reason` is truncated
 *     to `MAX_REASON_CHARS`.
 *   - On any failure (agent throw, invalid JSON, schema violation) returns
 *     `{ ok: false, reason }` rather than throwing — callers decide fallback.
 */

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_FAILED_ENTRIES = 100;
const MAX_REASON_CHARS = 500;
const MAX_ID_CHARS = 200;

function tailBytes(text, maxBytes) {
  if (!text || Buffer.byteLength(text) <= maxBytes) return text;
  const buf = Buffer.from(text);
  const slice = buf.slice(buf.length - maxBytes);
  return `[... truncated, showing last ${maxBytes} bytes ...]\n` + slice.toString("utf8");
}

function buildPrompt({ log, exitCode, counts }) {
  const truncated = tailBytes(log || "", MAX_INPUT_BYTES);
  return [
    "You are a test log summarizer.",
    "Given the raw stdout+stderr of a test run, extract the list of failed tests.",
    "",
    "OUTPUT FORMAT — strict JSON, no prose:",
    '  {"failed":[{"id":"<test identifier>","reason":"<short failure reason, ≤500 chars>"}]}',
    "",
    "Rules:",
    "- id: framework-native test identifier (e.g. file::test_name, describe > it chain).",
    "- reason: first line of error message or assertion diff, concise.",
    "- Skip tests that passed. Only include failures.",
    "- If no failures, return {\"failed\":[]}.",
    "",
    `Context: exitCode=${exitCode}; counts=${JSON.stringify(counts || {})}`,
    "",
    "## Test Log",
    truncated,
  ].join("\n");
}

function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) return null;
  const candidate = trimmed.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function validateAndNormalize(parsed) {
  if (!parsed || !Array.isArray(parsed.failed)) {
    return { ok: false, reason: "invalid JSON shape: missing failed[] array" };
  }
  const failed = [];
  for (const entry of parsed.failed) {
    if (!entry || typeof entry.id !== "string" || typeof entry.reason !== "string") {
      return { ok: false, reason: "invalid JSON shape: failed[].id and reason must be strings" };
    }
    const id = entry.id.trim();
    if (!id) {
      return { ok: false, reason: "invalid JSON shape: failed[].id must be non-empty" };
    }
    failed.push({
      id: id.slice(0, MAX_ID_CHARS),
      reason: entry.reason.slice(0, MAX_REASON_CHARS),
    });
    if (failed.length >= MAX_FAILED_ENTRIES) break;
  }
  return { ok: true, failed };
}

/**
 * @param {{ agent: object, log: string, exitCode: number, counts: object }} args
 * @returns {Promise<{ok: true, failed: Array} | {ok: false, reason: string}>}
 */
export async function summarizeTestLog({ agent, log, exitCode, counts }) {
  const prompt = buildPrompt({ log, exitCode, counts });
  let response;
  try {
    response = await agent.call(prompt, { commandId: "flow.tests.summarize" });
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
  const parsed = extractJsonObject(response);
  if (!parsed) {
    return { ok: false, reason: "invalid JSON: agent response could not be parsed as JSON object" };
  }
  return validateAndNormalize(parsed);
}

export const SUMMARIZE_CONSTANTS = Object.freeze({
  MAX_INPUT_BYTES,
  MAX_FAILED_ENTRIES,
  MAX_REASON_CHARS,
  MAX_ID_CHARS,
});
