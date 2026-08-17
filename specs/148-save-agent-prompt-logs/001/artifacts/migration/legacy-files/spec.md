# Feature Specification: 148-save-agent-prompt-logs

**Feature Branch**: `feature/148-save-agent-prompt-logs`
**Created**: 2026-04-06
**Status**: Draft
**Input**: Issue #101

## Goal

`callAgent` / `callAgentAsync` 実行時のプロンプトを JSON Lines 形式でファイルに保存し、後からプロンプト内容・実行時間・コンテキスト（spec / phase）を確認・再利用できるようにする。

## Scope

- `src/lib/agent-log.js`: `AgentLog` クラスの新設
- `src/lib/agent.js`: `callAgent` / `callAgentAsync` への `AgentLog` オプション引数追加とログ書き込み処理
- `src/lib/types.js`: `logs` 設定スキーマの追加
- ログ出力先: `{agent.workDir}/logs/prompts.jsonl`（デフォルト `.tmp/logs/prompts.jsonl`）
- 設定: `config.json` の `logs.prompts` / `logs.dir` フィールド

## Out of Scope

- ログファイルのローテーション・サイズ上限（v1 では設けない。`logs.prompts` はデフォルト `false` であり、有効化は開発者が意図的に行う操作のため、ファイル増大はユーザーの責任範囲とする。将来的にファイルサイズが問題になる場合は別 spec で対応する）
- ログの閲覧・検索 CLI コマンド
- 各呼び出し元（`flow/commands/review.js` 等）への `AgentLog` 渡しの実装（各機能 spec で対応）
- `.gitignore` への追加（`.tmp/` は既存の `.gitignore` で除外済み）

## Clarifications (Q&A)

- Q: ログファイルの追記形式は？
  - A: JSON Lines (`.jsonl`) — 1行1オブジェクト。追記が高速でファイルが壊れにくい。
- Q: spec / phase のコンテキスト取得方法は？
  - A: `callAgent`/`callAgentAsync` に `AgentLog` クラスのインスタンスを渡す方式。渡さない場合はログ処理をスキップ。
- Q: デフォルトのログ保存先は？
  - A: `{agent.workDir}/logs/prompts.jsonl`（`agent.workDir` に従う。デフォルト `.tmp/logs/prompts.jsonl`）。

## Alternatives Considered

- **環境変数（`SDD_FLOW_SPEC` / `SDD_FLOW_PHASE`）経由**: 呼び出し側の変更が不要だが暗黙的で型安全でない。`AgentLog` クラス渡しの方が明示的で将来の拡張にも対応しやすい。
- **JSON 配列形式（`.json`）**: 人間が読みやすいが、読み込み→パース→push→書き込みの処理が必要で並行書き込みに弱い。JSON Lines の方が追記操作のみで完結し安全。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-06
- Notes: Approved after gate PASS.

## Requirements

優先順位: P1（コア動作）→ P2（エントリ内容）→ P3（設定・運用）

**P1 — コア動作（必須）**

1. When `logs.prompts` is `true` in config.json, `callAgent` / `callAgentAsync` shall append one JSON Lines entry per invocation to the log file.
2. When `logs.prompts` is `false` or absent, no log processing shall occur.
3. When an `AgentLog` instance is not passed to `callAgent` / `callAgentAsync`, no log processing shall occur.

**P2 — エントリ内容（必須）**

4. Each log entry shall contain: `executeStartAt` (ISO 8601), `executeEndAt` (ISO 8601), `executeTime` (seconds, number), `spec` (string or null), `phase` (string or null), `prompt` (string).
6. When `callAgent` / `callAgentAsync` fails (throws), the log entry shall still be appended with the fields available at the time of failure (`executeEndAt` reflects the time of failure).

**P3 — 設定・運用（必須）**

5. When a `logs.dir` value is set in config.json, the log file shall be written to `<logs.dir>/prompts.jsonl`. When absent, it shall default to `<agent.workDir>/logs/prompts.jsonl`.
7. The `logs/` directory shall be created automatically using recursive directory creation (`mkdirSync` with `recursive: true`). No depth limit is applied; the OS filesystem limit governs.
8. The log file shall have no size limit or rotation in v1. Unbounded growth is accepted; `logs.prompts` defaults to `false` and must be explicitly enabled, placing responsibility for file growth on the operator.
9. When the log file write fails (e.g., permission error, disk full), the error shall not be re-thrown. The agent call result shall be returned normally. The write failure shall be output to stderr. No retry shall be attempted.

## Acceptance Criteria

- `logs.prompts: true` の設定で agent を呼び出すと `.tmp/logs/prompts.jsonl` にエントリが追記される
- `logs.prompts: false`（または未設定）の場合、ログファイルが作成されない
- `AgentLog` を渡さない既存の呼び出しはログを記録せず、動作に変化がない
- エラーで agent が失敗した場合もログエントリが追記される
- `logs.dir` でカスタムパスを指定すると、そこに書き込まれる
- ログエントリは有効な JSON Lines 形式（1行1オブジェクト）

## Test Plan

`specs/148-save-agent-prompt-logs/tests/` にスペック検証テストを配置する。

- `logs.prompts: true` 時のログ追記動作を確認（ファイル作成・エントリ内容）
- `logs.prompts: false` / 未設定時にファイルが作成されないことを確認
- `AgentLog` 未渡し時に既存呼び出しが影響を受けないことを確認
- エラー時もログが追記されることを確認
- `logs.dir` カスタムパスへの書き込みを確認

## Open Questions

なし

