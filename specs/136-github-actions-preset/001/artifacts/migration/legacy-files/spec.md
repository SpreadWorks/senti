# Feature Specification: 136-github-actions-preset

**Feature Branch**: `feature/136-github-actions-preset`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #81

## Goal

ci プリセットに含まれる GitHub Actions 固有のコード（DataSource, scan 設定, テンプレート）を github-actions プリセットに移動し、ci を抽象プリセット（章定義 + 汎用 guardrail のみ）として整理する。

### Rationale

現在の ci プリセットは `.github/workflows/*.yml` のパース、`${{ secrets.* }}` の抽出など GitHub Actions 固有の実装を含んでいる。ci は将来 GitLab CI 等の別 CI プラットフォームの親プリセットになり得るため、固有コードを子プリセット（github-actions）に移し、ci 自体は抽象的な章構成と汎用 guardrail のみを保持する構造にする。

## Scope

1. `ci/data/pipelines.js` を `github-actions/data/pipelines.js` に移動する
2. `ci/templates/{en,ja}/ci_cd.md` を `{{text}}` + `{%block%}` の抽象テンプレートに変更する
3. `github-actions/templates/{en,ja}/ci_cd.md` を新規作成する（`{%extends%}` + `{{data("github-actions.pipelines.*")}}` オーバーライド）
4. `ci/preset.json` から `scan.include` を削除し、`aliases` から `"github-actions"` を削除する
5. `github-actions/preset.json` に `scan.include` を追加する
6. `tests/unit/presets/ci-pipelines.test.js` を `github-actions-pipelines.test.js` にリネームし、import パスを更新する
7. 全テスト（preset-scan-integrity 含む）がパスすることを確認する

## Out of Scope

- GitHub Actions 固有の新機能追加（reusable workflows, composite actions, matrix strategy 等の解析）
- 他の CI プラットフォーム（GitLab CI, CircleCI 等）のプリセット作成
- ci プリセット自体の削除

## Clarifications (Q&A)

- Q: ci プリセットのどのコードが GitHub Actions 固有か？
  - A: `data/pipelines.js`（`.github/workflows/*.yml` の match パターン、`${{ secrets.* }}` 抽出）、`scan.include`（`.github/workflows/**/*.yml`）、`templates/ci_cd.md`（`ci.pipelines.*` ディレクティブ）がすべて GitHub Actions 固有。guardrail（シークレット禁止、バージョン固定）は CI 汎用のため ci に残す。

- Q: テンプレートの継承構造はどうするか？
  - A: ci の `ci_cd.md` は `{{text}}` + `{%block%}` の抽象テンプレートに変更。github-actions が `{%extends%}` でブロックを `{{data("github-actions.pipelines.*")}}` にオーバーライドする。ルール「親テンプレートは `{{text}}`、子が `{{data}}` で override」に合致。

- Q: ci の aliases から github-actions を削除する影響は？
  - A: `github-actions` プリセットが独立して存在するため、`type: "github-actions"` の設定は引き続き動作する。alpha 版ポリシーにより後方互換コードは不要。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-04
- Notes: ユーザー承認済み

## Requirements

優先順位（高→低）:

1. **[P1] DataSource 移動**: `ci/data/pipelines.js` を `github-actions/data/pipelines.js` に移動する。ファイル内の import パス（相対パス）を新しい配置に合わせて調整する。DataSource の参照名はプリセットディレクトリ名（`github-actions`）とファイル名（`pipelines`）から自動解決されるため、コード内の名前変更は不要。
2. **[P1] scan 設定移動**: `ci/preset.json` から `scan.include` を削除し、`github-actions/preset.json` に `scan.include: [".github/workflows/**/*.yml", ".github/workflows/**/*.yaml"]` を追加する。
3. **[P1] ci テンプレート抽象化**: `ci/templates/{en,ja}/ci_cd.md` を `{{text}}` + `{%block%}` の抽象テンプレートに変更する。各ブロック（description, pipelines, jobs, env）は `{{text}}` で AI 生成テキストを出力する。
4. **[P1] github-actions テンプレート作成**: `github-actions/templates/{en,ja}/ci_cd.md` を新規作成する。`{%extends%}` で ci テンプレートを継承し、各ブロックを `{{data("github-actions.pipelines.*")}}` でオーバーライドする。
5. **[P1] aliases 削除**: `ci/preset.json` の `aliases` から `"github-actions"` を削除する。
6. **[P1] 移行手順の明示**: `ci` の aliases 削除に伴い、`config.json` で `type: "ci"` かつ alias 経由で `github-actions` を参照していたプロジェクトは `type: "github-actions"` に変更する必要がある。alpha 版ポリシーにより後方互換コードは不要。
7. **[P2] テストリネーム**: `tests/unit/presets/ci-pipelines.test.js` を `github-actions-pipelines.test.js` にリネームし、import パスを `src/presets/github-actions/data/pipelines.js` に変更する。
8. **[P2] テスト実行**: `npm test` で全テスト（preset-scan-integrity 含む）がパスすることを確認する。

## Acceptance Criteria

1. `github-actions` プリセットで `sdd-forge docs scan` を実行したとき、`.github/workflows/*.yml` が正しくスキャンされ、analysis.json に `pipelines` エントリが生成されること。
2. `github-actions` プリセットで `sdd-forge docs data` を実行したとき、`{{data("github-actions.pipelines.*")}}` ディレクティブがスキャン結果のテーブルに置換されること。
3. `ci` プリセット単体では `scan.include` が定義されておらず、GitHub Actions 固有のスキャンが実行されないこと。
4. `ci` プリセット単体の `ci_cd.md` テンプレートが `{{text}}` ディレクティブを使用しており、`{{data}}` を含まないこと。
5. `tests/unit/presets/github-actions-pipelines.test.js` が全件パスすること。
6. `npm test` が 0 failures で完了すること（preset-scan-integrity テスト含む）。

## Test Strategy

- **ユニットテスト**: 既存の `ci-pipelines.test.js` を `github-actions-pipelines.test.js` にリネーム。import パスの変更のみで、テスト内容（パーサー I/O テスト）は変更しない。
- **整合性テスト**: `preset-scan-integrity.test.js` が github-actions プリセットの scan → DataSource → テンプレートの整合性を自動検証する。
- **回帰テスト**: `npm test` で全プリセットのテストが引き続きパスすることを確認する。

## Impact on Existing Features

- **`ci` プリセットを直接使用しているプロジェクト**: ci から scan 設定と DataSource が削除されるため、ci 単体では GitHub Actions ワークフローのスキャンが行われなくなる。ci は抽象プリセットであり、ユーザーは `github-actions` 等の子プリセットを使うことが想定される。
- **`github-actions` プリセットを使用しているプロジェクト**: 機能は完全に保持される（scan + DataSource が直接 github-actions に含まれるため）。
- **alias `github-actions` の削除**: `ci` の aliases から削除するが、`github-actions` プリセットが独立して存在するため `type: "github-actions"` は引き続き動作する。移行: `config.json` で `type: "ci"` かつ alias 経由で参照していたプロジェクトは `type: "github-actions"` に変更すること。

## Open Questions

なし
