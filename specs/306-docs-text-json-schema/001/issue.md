## Overview
In the `text` phase of `senti docs build`, `docs.text` expects a JSON object mapping `directive id -> markdown text`, but Codex may return ordinary natural language, causing `batch JSON parse failed`. In addition, during an active flow, that non-JSON response is saved to `.senti/agent-cache`, so the same failure is replayed on reruns and does not recover naturally.

## Problems
- JSON schema is not enforced in batch generation for `docs.text`.
- `jsonSchemaFlag` / `jsonSchemaMode` are not aligned between Codex provider defaults and configuration through the built-in profile, so there are paths where the schema specification does not reach the actual provider invocation.
- Responses that fail JSON parsing are saved to the prompt cache, causing the failure to become fixed.
- Retry on parse failure is weak at the target-file level, making the entire build unstable after a single non-JSON response.
- Project-local `agent.profiles` / `providers` overrides may overwrite the built-in configuration and disable schema support, making root cause identification difficult.

## Expected Fixes
1. Always pass a JSON schema to `agent.call` during `docs.text` batch generation, constraining the return value to an object mapping `directive id -> markdown text`.
2. Define `jsonSchemaFlag` and `jsonSchemaMode` in Codex provider defaults so that schema settings are reflected in provider invocation even through the setup built-in profile.
3. If a `docs.text` response results in a JSON parse failure, do not save that response to the prompt cache.
4. When a parse failure occurs, allow retrying at the failed target-file level so the build can continue if a later attempt returns valid JSON.
5. For cases where project-local overrides disable built-in settings, provide at least diagnostic logs or a migration guide so configuration mismatches are easier to detect.

## Acceptance Criteria
- There is a unit test confirming that `docs.text` batch calls pass `jsonSchema`.
- There is a unit test confirming that schema-related flags are added to Codex provider invocation.
- There is a unit test confirming that JSON parse failure responses are not saved to cache.
- There is a test where the first response is natural language and the second response is JSON, and the build succeeds via parse failure retry.
- There is either a test that diagnoses or makes explicit the case where project-local overrides cause schema settings to be missing, or an implementation that confirms this as a specification.

## Notes
Because `docs.text` depends on the JSON object contract, schema enforcement and failure cache prevention here should be treated as consistency fixes rather than behavioral improvements.

<details>
<summary>ja</summary>

docs.text の JSON 出力強制と失敗キャッシュ抑止

## 概要
`senti docs build` の `text` フェーズでは、`docs.text` が `directive id -> markdown text` の JSON object を期待しているが、Codex 側が通常の自然文を返し `batch JSON parse failed` になることがある。さらに active flow 中はその非 JSON 応答が `.senti/agent-cache` に保存されるため、再実行時にも同じ失敗が再生され、自然回復しない。

## 問題
- `docs.text` の batch 生成で JSON schema が強制されていない。
- Codex provider defaults と built-in profile 経由の設定で `jsonSchemaFlag` / `jsonSchemaMode` が揃っておらず、schema 指定が実際の provider invocation まで届かない経路がある。
- JSON parse failure の応答が prompt cache に保存され、失敗が固定化される。
- parse failure 発生時に対象ファイル単位での retry が弱く、1 回の非 JSON 応答で build 全体が不安定になる。
- project-local の `agent.profiles` / `providers` override が built-in 設定を上書きして schema 有効化を潰す可能性があり、原因特定が難しい。

## 期待する修正
1. `docs.text` の batch 生成で `agent.call` に JSON schema を必ず渡し、戻り値を `directive id -> markdown text` の object に制約する。
2. Codex provider defaults に `jsonSchemaFlag` と `jsonSchemaMode` を定義し、setup の built-in profile 経由でも schema 指定が provider invocation に反映されるようにする。
3. `docs.text` の応答が JSON parse failure になった場合、その応答を prompt cache に保存しない。
4. parse failure 発生時は失敗した対象ファイル単位で retry できるようにし、後続試行で正常な JSON が返れば build を継続できるようにする。
5. built-in 設定を project-local override が潰すケースについて、少なくとも診断ログまたは移行ガイドを用意し、設定不整合を検出しやすくする。

## 受け入れ条件
- `docs.text` batch 呼び出しが `jsonSchema` を渡すことを確認する unit test がある。
- Codex provider invocation に schema 関連 flag が付与されることを確認する unit test がある。
- JSON parse failure 応答が cache に保存されないことを確認する unit test がある。
- 1 回目が自然文、2 回目が JSON のケースで、parse failure retry により build が成功する test がある。
- project-local override により schema 設定が欠落するケースを診断または明示できるテスト、もしくは仕様として確認できる実装がある。

## 補足
`docs.text` は JSON object 契約に依存しているため、ここでの schema 強制と failure cache 抑止は挙動改善ではなく整合性修正として扱う。

</details>