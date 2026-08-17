# Feature Specification: 176-refactor-runcmd-git-logging

**Feature Branch**: `feature/176-refactor-runcmd-git-logging`
**Created**: 2026-04-14
**Status**: Draft
**Input**: GitHub Issue #131 — [ENHANCE] Revisit the design of embedding git logging inside runCmd

## Goal

汎用コマンド実行ヘルパー内に埋め込まれた git ロギングが worktree 内で無限再帰を引き起こす問題を、設計を見直して恒久的に解消する。git コマンドのロギング自体は維持する。

## Scope

- 業務 git 操作と基盤 git 操作を別経路で扱う設計に変更する。
- 業務 git 操作はロギング対象、基盤 git 操作はロギング対象外とする。
- 例外箇所（基盤 git 操作）には除外理由のコメントを残す。
- 新経路の単体テストと、worktree 内での再帰回帰テストを追加する。

## Out of Scope

- 0003（トークン削減/コマンドプロキシ）の本実装。本 spec は 0003 の前哨と位置付けるが、compact/digest 段階、flow-aware 制御、raw フォールバック等の機能は含まない。
- gh コマンドのロギング体系化。
- 既存ログファイル形式（JSONL の `type: "git"` レコード）の変更。
- 非 git コマンド（gh, npm, claude 等）のロギング挙動の変更。
- **ログの機微情報マスキング**: `runGit` が記録する `cmd` 引数や `stderr` には git トークン等の機微情報が含まれ得るが、本 spec ではマスキングを実装しない。理由 — マスキング戦略は git ログだけでなく Logger 経由の全ログ（agent prompt log 等）に一貫適用すべきであり、git だけに入れるとアーキテクチャが歪む。別 spec として board id `7e83` に登録済み。R1 が要求する「stderr を記録する」は明示要件であり、本 spec ではこの要件通りの挙動を維持する。
- **コマンド実行系の async 化**: `runCmd` / `runGit` の内部実装は同期 (`execFileSync`) のままとし、`scanAllFlows` 等のループ内呼び出しも同期実行を維持する。理由 — async 化は `runCmd` 全呼び出し元（~50 箇所）への波及が必要な大規模リファクタで、本 spec の主旨（runCmd 内 git ロギング再設計）から逸脱する。別 spec として board id `08cd` に登録済み。`scanAllFlows` には本 spec で `SCAN_FLOWS_LIMIT = 200` の上限を導入し、暴走を防ぐ範囲で対応した。

## 用語定義

- **業務 git 操作**: ユーザー要求や SDD フローを進めるために実行される git コマンド。commit, push, diff, branch, checkout, merge, worktree 操作, log, status, rev-list, add 等、ロガーから可視な範囲で実行されるすべての git コマンドを指す。
- **基盤 git 操作**: ロガー自身がログ出力先パスを解決するために実行する内部 git コマンド。リポジトリトップレベル取得と共有 git ディレクトリ取得の 2 種類のみを指す。

## Clarifications (Q&A)

- Q1: 設計方針 — 汎用ヘルパー内ロギングを残して再帰回避ロジックを足すか、ロギングを別経路に分離するか？
  - A: 別経路に分離する。SRP（汎用ヘルパーが特定コマンド種別を知らない）と既存の git 横断ヘルパーモジュールへの自然な集約を理由とする。
- Q2: 0003（型付きコマンドプロキシ）との関係 — 本 spec で 0003 機能まで実装するか？
  - A: 含めない。本 spec の成果物は 0003 の前哨として位置付け、将来 0003 を実装する際に拡張のみで対応できる構造を残す。
- Q3: 置換スコープ — 全 git 呼び出しを新経路に通すか？
  - A: 基盤 git 操作のみ現行経路を維持し、それ以外は全て新経路に統一する。例外箇所には除外理由のコメントを残す。
- Q4: テスト配置 — 永続テスト領域に置くか spec 個別領域に置くか？
  - A: 永続テスト領域に置く。新経路は公開 API、再帰回帰は普遍的価値があり spec 個別の関心事ではない。

## Alternatives Considered

- **代替案 A: 汎用ヘルパー内ロギング + 再帰防止フラグ**: ロギング中フラグで再帰を回避する案。却下理由 — 暗黙のステートフル挙動でデバッグしづらく、SRP も解消されない。
- **代替案 B: 呼び出し元での個別ロギング**: 業務 git 操作の各呼び出し元で明示的にロガーを呼ぶ案。却下理由 — 約 38 箇所の呼び出し元すべてで重複コードが必要となり DRY 違反、ロギング忘れも防げない。

## Why This Approach

- **SRP の遵守**: 汎用コマンド実行ヘルパーが「git だけ特別扱い」する責務を持つのは設計上の歪み。git 横断ヘルパー側に集約することで責務境界が明確になる。
- **再帰の物理的解消**: ロガー基盤が依存する基盤 git 操作を明示的にロギング対象外として切り分けることで、再帰経路自体を構造的に消す（ロジカルなガード不要）。
- **将来拡張性**: 0003 の型付きコマンドプロキシ構想は git 以外（test, lint, status 等）の同種ラッパーを追加する形で実現される見込み。本 spec の git 経路はその第 1 例となり、後続の同種拡張時のテンプレートとなる。
- **既存構造との整合**: 既に集約地として存在する git 横断ヘルパーモジュールに集約することで、新たな抽象層を作らず既存パターンを延長する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-14
- Notes: gate-PASS 後にユーザー承認

## Requirements

### P0（必須）

- **R1**: When 業務 git 操作（用語定義参照）が実行されたとき, the system shall コマンド配列・終了コード・stderr を含む git レコードをログに記録する。
- **R2**: When 業務 git 操作が worktree 内で実行されたとき, the system shall 再帰なくログを記録できる。
- **R3**: When 基盤 git 操作（用語定義参照）が実行されたとき, the system shall そのコマンドをロギング対象外とし、除外理由を示すコメントを残す。

### P1（強く推奨）

- **R4**: If 業務 git 操作の実行が失敗したとき, the system shall 失敗時の終了コードと stderr もログに記録する。
- **R5**: When 業務 git 操作が失敗したとき, the system shall 戻り値の `ok: false` および `status` に非 0 の終了コードを設定し、成功時と失敗時で値を区別する（失敗を 0 で報告しない）。

## Acceptance Criteria

- **AC1（R1, R4, R5）**: 業務 git 操作（成功・失敗いずれも）を実行したとき、JSONL ログに `type: "git"` のレコードが追記され、`cmd`, `exitCode`, `stderr` が記録されている。失敗時の戻り値は `ok: false` かつ `status` が非 0 で、成功時（`ok: true`, `status: 0`）と区別できる。
- **AC2（R2）**: worktree 内で業務 git 操作を実行したとき、再帰スタックオーバーフローが発生せず正常にログが記録される。worktree 内で業務 git 操作が成功裏に完了することを単体テストで検証する。
- **AC3（R3）**: 基盤 git 操作（リポジトリトップレベル取得・共有 git ディレクトリ取得）の呼び出し箇所には除外理由のコメントが付与されており、これらの呼び出しでは git レコードがログに記録されない。
- **AC4（R1, R2, R3）**: 既存の業務 git 操作（commit, push, diff, branch, merge, worktree 操作 等）すべてが新経路を通過しており、汎用コマンド実行ヘルパーから git 専用ロジックが削除されている。
- **AC5（テスト）**: 新経路の単体テストと worktree 内再帰回帰テストが永続テスト領域に追加されており、`npm test` で実行可能。

## Test Strategy

- **単体テスト**:
  - 新経路で git コマンドを実行 → 戻り値の形が汎用ヘルパー互換であることを検証。
  - 成功時・失敗時の両方で `type: "git"` レコードが正しく記録されることを検証。
  - 非 git コマンドが新経路に流れないこと（つまり新経路は git 専用）を確認。
- **再帰回帰テスト**:
  - tmp ディレクトリに worktree 風の構造を作成し、worktree 内で業務 git 操作を実行してもスタックオーバーフローが起きずログが記録されることを検証。
- **既存テスト**:
  - 既存の `tests/unit/lib/process.test.js` および `tests/unit/lib/log.test.js` がリグレッションなく通過することを確認。
  - `npm test` 全体がパスすることを確認。

## Open Questions

なし
