# Draft: 221-default-finalize-mode

**開発種別:** feature
**目的:** `sdd-forge flow run finalize` の `--mode` オプションに既定値 `all` を設定し、引数なし実行での UX 改善とドキュメント上の optional 表記との整合を取る。

## Scope Verification
- In scope（優先度順）:
  1. **[P1 必須]** When ユーザーが `flow run finalize` を `--mode` 引数なしで起動したとき、本コマンドは `--mode all` を指定したときと同じ最終化パイプラインを実行し、exit code 0 で完了すること。
  2. **[P1 必須]** When `--mode` 引数が省略された、または値が `all` である場合、本コマンドは従来 `--mode all` で実行された全ステップ（commit, merge, sync, cleanup）を順に実行すること。
  3. **[P1 必須]** If `--mode` の値が `all` / `select` 以外、または `--mode select` が `--steps` なしで指定された場合、本コマンドは non-zero の exit code で終了し、従来と同じ理由を示すエラーメッセージ（`--mode must be 'all' or 'select'` および `--steps required when mode is 'select'` 相当）を stderr に出力すること。
  4. **[P1 必須]** When 上記 1〜3 の条件で本コマンドが実行されたとき、その結果（正常完了 / エラー終了）を検証する自動テストが CI で実行されること。
  5. **[P2 付随]** When ユーザーが CLI ヘルプ（`--help`）または実装フェーズの finalize 実行ガイドを参照したとき、`--mode` が optional であり既定値 `all` を持つ旨が表示されること。
- Out of scope:
  - `--mode select` における `--steps` 必須性の変更、および `--mode` 無効値に対するエラー挙動の変更。
  - skill 配布テンプレートの構文表記（既に optional 表記で整合済み）。
  - finalize 以外のコマンドが持つ `--mode` オプションの仕様。

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow run finalize`：When 引数なしで起動されたとき、従来は exit 1 で停止していたが、本変更後は `--mode all` 相当で正常に最終化を実行する。明示的な `--mode all` / `--mode select --steps ...` 呼び出しは挙動不変（完全後方互換）。
  - SDD フローの自動実行ガイド（finalize 呼び出しを含む実装フェーズ prompt）：`--mode all` を明示しなくても同じ動作になるため、表記を整理しても実行結果は不変。
- 影響なし:
  - finalize 以外のコマンド全般、および `flow run finalize --dry-run` / `flow run finalize --mode select --steps 1,2` 等の明示指定パス。

### CLI Migration Plan
- **互換性分類:** 純粋な追加変更（additive）。既存の有効な CLI 呼び出しの挙動は変わらない。
- **エラー挙動の変更:** これまで引数なし実行時に出力していた「`--mode` 必須」エラーが消え、正常実行に変わる。このエラー文言やエラー終了に依存する自動化は想定しない（文字列一致に依存する設計は脆弱なため）。
- **既存呼び出しの扱い:** 明示的な `--mode all` / `--mode select --steps ...` / 不正値 / `--steps` 欠落時の `--mode select` はすべて従来通りに動作する。
- **廃止予定:** なし。明示的な `--mode all` 指定は冗長になるが deprecate は行わず、引き続き許容する（alpha 版ポリシー：追加のみで削除は行わない）。
- **ユーザー告知:** リリースノート / CHANGELOG に「`flow run finalize` is now valid without `--mode` (defaults to `all`)」として記載する。破壊的変更ではなく特別な移行手順は不要。

## Q&A
- Q1: `--mode` オプションの扱いを `all` 既定化するか、必須維持 + ドキュメント修正か？
  - A1: 推奨 = `all` 既定化（Issue #241 提案と同じ）。根拠:
    - **[既存コード調査]** SDD フローの finalize 呼び出しプロンプト（実装フェーズの通常完了パス）は常に `--mode all` 形式で記述されており、`--mode select` は特定ステップのみ再実行する補助用途のみ。すなわち既定パスは `all` 固定。
    - **[既存ドキュメント]** 配布用 skill テンプレートの finalize 構文は `[--mode all|select]` と既に optional 表記のため、CLI 側が既定値を持つ方が整合する。
    - **[UX]** 引数なし実行時のエラーはタイプミスではなく単なる省略に起因するケースが支配的で、`--mode all` を毎回手入力させる設計コストは正当化されない。
- Q2: ドキュメント・prompt の更新スコープは？
  - A2: 推奨 = CLI 本体 + CLI ヘルプ表示 + 実装フェーズ prompt の finalize 実行例（冗長な `--mode all` を削除）。根拠:
    - **[ガードレール: Backward-Compatible CLI Interface]** CLI 変更と一貫した表記更新を同時に行うことで、ユーザー視点での挙動とドキュメントのズレを残さない。
    - **[既存コード調査]** 配布用 skill テンプレートは既に optional 表記 `[--mode all|select]` のため再更新不要。
    - **[プロジェクトルール: alpha 版ポリシー]** `--mode all` は deprecate せず、冗長表記として許容し続ける（追加のみ、削除は行わない）。

## Open Questions
-

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: Issue #241 の提案（all 既定化）を採用。ドキュメント・prompt も同時に更新。
