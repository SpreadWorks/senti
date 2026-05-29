## Symptoms

During `{{text}}` directive AI generation in `docs build` / `docs text`, the subprocess becomes unresponsive and is SIGTERM-killed after the agent timeout (300 seconds), repeatedly. After the kill, the partial stdout cannot be JSON-parsed and is immediately thrown, with no retry attempted.

## Observed Case (OOS_spread_commerce)

- Log: `/home/nakano/workspace/OOS_spread_commerce/.tmp/logs/001-route-host-hardening.log`
- 7 calls terminated at **exactly 300000ms (agent.js default timeout)**.
- provider = `codex` (profileKey `codex/gpt-5.4`). Not Claude.
- `tokens.input/output/cacheRead` = 0 — no response headers received at all.
- `responseChars` = 721–1633 — some cases had partial stdout, and those fragment JSONs failed to parse.

## Related Code

- `src/lib/agent.js:253` — `setTimeout(() => child.kill("SIGTERM"), timeoutMs)`. Default 300 seconds.
- `src/lib/agent.js:193-214` — When `error.killed === true`, retry is skipped and immediately throws.
- `src/docs/commands/text.js:247-256` — On `parseBatchJsonResponse()` failure, immediately throws. No partial stdout saving or fallback.
- Provider builtin profile rule: JSON output flags are written as literals in args (`src/CLAUDE.md`). Needs verification that codex provider's builtinProfiles contain `--json` or equivalent as a literal.

## Root Cause Hypothesis

Most likely: **stdout close timing issue on the codex CLI side**. The Claude side has a workaround that closes stdin with `stdio: ["ignore", "pipe", "pipe"]`, but the equivalent handling or literal JSON output mode specification may be missing for the codex side. This is consistent with hanging on large prompts and fragmented partial responses.

Possible secondary causes:
- The codex provider's `jsonOutputFlag` is not configured, causing it to be treated as plain text, and `parseBatchJsonResponse` fails trying to parse a non-JSON response.
- Structural timeout issue when codex response time exceeds the 300-second limit.

## Short-Term Fixes

1. Check codex provider builtin profile: verify that `--json` (or codex's JSON output flag) is included as a literal in args, and that the `jsonOutputFlag` property is set.
2. In `agent.js`, save timeout-caused partial stdout to debug log for post-hoc investigation.
3. Allow retry on timeout (`error.killed`) — avoid the current immediate throw behavior.
4. On `parseBatchJsonResponse` failure, include the first 200 characters of stdout in the error message to aid diagnosis.

## Impact

This failure stops `docs build` in real-world use. High likelihood of reproduction for users using the codex provider.

## Related

- agent_json_output: JSON output format differences between claude/codex and normalization proposal
- agent_prompt_logging: Recording via `.tmp/logs/prompts.jsonl`

<details>
<summary>ja</summary>

[BUG] codex provider の {{text}} AI 生成が 300s timeout で hang し partial JSON parse 失敗

## 症状

`docs build` / `docs text` の `{{text}}` ディレクティブ AI 生成で、subprocess が応答せず agent timeout (300 秒) で SIGTERM kill される事象が連続発生する。kill 後の partial stdout が JSON parse できず即 throw され、リトライも行われない。

## 観測ケース（OOS_spread_commerce）

- ログ: `/home/nakano/workspace/OOS_spread_commerce/.tmp/logs/001-route-host-hardening.log`
- 7 件の呼び出しが **正確に 300000ms（agent.js のデフォルト timeout）** で終了。
- provider = `codex` (profileKey `codex/gpt-5.4`)。Claude ではない。
- `tokens.input/output/cacheRead` = 0 — 応答ヘッダすら到達せず。
- `responseChars` = 721〜1633 — partial stdout が来ているケースあり、その断片 JSON が parse 失敗。

## 関連コード

- `src/lib/agent.js:253` — `setTimeout(() => child.kill("SIGTERM"), timeoutMs)`。デフォルト 300 秒。
- `src/lib/agent.js:193-214` — `error.killed === true` のときリトライをスキップして即 throw。
- `src/docs/commands/text.js:247-256` — `parseBatchJsonResponse()` 失敗時即 throw。partial stdout の保存もフォールバックもなし。
- Provider builtin profile ルール: JSON 出力フラグは args に literal 記述（`src/CLAUDE.md`）。codex provider の builtinProfiles に `--json` 等が literal に含まれているか要確認。

## 根本原因仮説

最有力: **codex CLI 側の stdout 閉鎖タイミング問題**。Claude 側は `stdio: ["ignore", "pipe", "pipe"]` で stdin を閉じる対処がされているが、codex 側で同等の処理または JSON 出力モードの literal 指定が抜けている可能性。large prompt 時に hang して partial response が断片化することと整合する。

副因の可能性:
- codex provider の `jsonOutputFlag` 設定が抜けていて plain text として扱われ、`parseBatchJsonResponse` が JSON ではない応答を強引に parse して失敗。
- timeout 300 秒に対し codex の応答上限が長い場合の構造的時間切れ。

## 短期対処

1. codex provider の builtin profile を確認: `--json`（または codex の JSON 出力フラグ）が args に literal で入っているか、`jsonOutputFlag` プロパティが設定されているか。
2. `agent.js` で timeout 起因の partial stdout を debug ログに保存し、後検証可能にする。
3. timeout (`error.killed`) のリトライを許可する（現状即 throw を避ける）。
4. `parseBatchJsonResponse` 失敗時、stdout 先頭 200 字をエラーメッセージに含めて診断容易にする。

## 影響範囲

実利用で `docs build` を止める degree の故障。codex provider 利用ユーザーで再現の可能性が高い。

## 関連

- agent_json_output: claude/codex の JSON 出力形式差と正規化案
- agent_prompt_logging: `.tmp/logs/prompts.jsonl` での記録

</details>