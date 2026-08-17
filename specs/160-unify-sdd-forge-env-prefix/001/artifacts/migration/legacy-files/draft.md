**開発種別:** ENHANCE（機能強化）

**目的:** 環境変数プレフィックスを `SDD_` から `SDD_FORGE_` に統一し、命名の一貫性を確保する

## Q&A

**Q1: 変更対象の環境変数はどれか？**

A: `SDD_SOURCE_ROOT` と `SDD_WORK_ROOT` の2つ。`SDD_FORGE_PROFILE` は既に正しいプレフィックスを持っている。
- `SDD_SOURCE_ROOT` → `SDD_FORGE_SOURCE_ROOT`
- `SDD_WORK_ROOT` → `SDD_FORGE_WORK_ROOT`

**Q2: 変更対象のファイルは？**

A: ソースコード内でこれらの環境変数を参照しているファイル：
- `src/lib/cli.js` — `process.env.SDD_WORK_ROOT` / `process.env.SDD_SOURCE_ROOT` の読み取り（実装コア）
- `src/docs/lib/command-context.js` — JSDoc コメントでの参照（コメントのみ）
- `src/presets/laravel/tests/e2e/integration.test.js` — e2e テストでの env 設定（2箇所）
- `src/presets/symfony/tests/e2e/integration.test.js` — e2e テストでの env 設定（2箇所）

**Q3: 後方互換コードは必要か？**

A: 不要。alpha 版ポリシーに従い、旧変数名（`SDD_WORK_ROOT`, `SDD_SOURCE_ROOT`）のフォールバックは書かない。

**Q4: 既存機能への影響は？**

A: 環境変数でパスをオーバーライドしているユーザーは新しい変数名に移行が必要。alpha 期間中のため breaking change として許容する。

**Q5: `SDD_DIR_NAME`、`SDD_DIRECTIVE_RE` 等の JS 定数は変更対象か？**

A: いいえ。これらは JavaScript の定数名であり、環境変数ではない。変更対象外。

**Q6: `src/AGENTS.md` のドキュメント更新は？**

A: `src/AGENTS.md` は `sdd-forge agents` コマンドで自動生成されるため、手動更新ではなく実装後に `sdd-forge build` を実行することで更新される。実装スコープには含めない。

**Q7: 古い specs/（歴史的ドキュメント）内の参照は？**

A: `specs/` 以下の過去の spec/draft ファイルは歴史的記録のため変更しない。

**Q8: 利用者への移行ガイドはどう提供するか？**

A: alpha 期間中の breaking change であるため、以下の方針で対応する：
- **旧変数名検出・警告コードは書かない**（alpha ポリシー: 後方互換コード禁止。旧名を検出して警告する処理自体がフォールバックコードと等価のため）
- 旧変数名（`SDD_WORK_ROOT`, `SDD_SOURCE_ROOT`）を設定してもランタイムに何も起きない（サイレント無視）
- ユーザーへの通知手段: CHANGELOG.md に Breaking Change として記載することのみで十分（alpha 版の合意済みポリシー）
- README や `src/AGENTS.md` のドキュメントは実装後の `sdd-forge build` で自動更新される

**Q9: CLI コマンド・オプションへの影響はあるか？**

A: **なし**。本 spec はランタイムで読み取る環境変数名の変更のみ。`sdd-forge` の CLI コマンド名・サブコマンド名・オプション名は一切変更しない。

移行計画の十分性: alpha 版ポリシーにより、CHANGELOG への Breaking Change 記載のみで十分とプロジェクトが合意している。ランタイム警告・旧名フォールバックは書かない。

## Summary

- 変更箇所: `src/lib/cli.js`（2箇所）、`src/docs/lib/command-context.js`（コメント）、e2e テスト 2ファイル計 4箇所
- 機械的なリネームが主体。実装リスクは低い
- alpha ポリシーによりフォールバック不要

- [x] User approved this draft (autoApprove)
