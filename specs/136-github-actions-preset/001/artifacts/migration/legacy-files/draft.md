# Draft: github-actions プリセットの完成

**目的:** ci プリセットに含まれる GitHub Actions 固有のコード（DataSource, scan, テンプレート）を github-actions プリセットに移動し、ci を抽象プリセットとして整理する。

**開発種別:** リファクタリング + 機能移動

## Q&A

### Q1: github-actions プリセットの独自実装として何が必要か？

ci の GitHub Actions 固有コードを github-actions に移動する。ci の datasource/テンプレートは固有内容のみなので移動後に削除。

### Q2: ci プリセットから github-actions への移動方針

- `data/pipelines.js` と `templates/ci_cd.md` を github-actions に移動
- ci の `scan.include` を削除
- ci は chapters/guardrail のみの抽象プリセットにする

### Q3: 移動後のテンプレート構成

- ci の `ci_cd.md` は `{{text}}` + `{%block%}` の抽象テンプレートに変更
- github-actions が `{%extends%}` でブロックを `{{data("github-actions.pipelines.*")}}` にオーバーライド
- ルール「親テンプレートは `{{text}}`、子が `{{data}}` で override」に合致

### Q4: 既存テストの扱い

- `tests/unit/presets/ci-pipelines.test.js` → `tests/unit/presets/github-actions-pipelines.test.js` にリネーム
- import パスを `src/presets/github-actions/data/pipelines.js` に変更

### Q5: ci preset.json の aliases

- `"aliases": ["github-actions"]` を削除（独立プリセットとして存在するため不要）

## Scope

### In Scope

1. `ci/data/pipelines.js` → `github-actions/data/pipelines.js` に移動する。移動後、`github-actions` プリセットで `sdd-forge docs scan` を実行したとき、GitHub Actions ワークフローが正しくスキャンされること。
2. `ci/templates/{en,ja}/ci_cd.md` を `{{text}}` + `{%block%}` の抽象テンプレートに変更する。`ci` プリセット単体で `sdd-forge docs build` を実行したとき、`{{text}}` により AI がテキストを生成すること。
3. `github-actions/templates/{en,ja}/ci_cd.md` を新規作成する（`{%extends%}` + `{{data}}` オーバーライド）。`github-actions` プリセットで build したとき、`{{data}}` がスキャン結果のテーブルを出力すること。
4. `ci/preset.json` から `scan.include` を削除し、`aliases` から `"github-actions"` を削除する。ci プリセット単体では GitHub Actions 固有のスキャンが実行されなくなること。
5. `github-actions/preset.json` に `scan.include` を追加する。github-actions プリセットで `.github/workflows/*.yml` がスキャン対象になること。
6. `tests/unit/presets/ci-pipelines.test.js` を `github-actions-pipelines.test.js` にリネームし、import パスを `src/presets/github-actions/data/pipelines.js` に変更する。テストが全件パスすること。
7. `npm test` で preset-scan-integrity テストを含む全テストがパスすること。

### Out of Scope

- GitHub Actions 固有の新機能追加（reusable workflows, composite actions 等の解析）
- 他の CI プラットフォーム（GitLab CI 等）のプリセット作成
- ci プリセット自体の削除

## 既存機能への影響

- **`ci` プリセットを直接使用しているプロジェクト**: `ci` から scan 設定と DataSource が削除されるため、`ci` 単体では GitHub Actions ワークフローのスキャンが行われなくなる。ただし `ci` は抽象プリセットであり、ユーザーは `github-actions` 等の子プリセットを使うことが想定されるため、実質的な影響はない。
- **`github-actions` プリセットを使用しているプロジェクト**: 機能は完全に保持される（scan + DataSource が直接 github-actions に含まれるため）。
- **alias `github-actions` の削除**: `ci` の aliases から `github-actions` を削除するが、`github-actions` プリセットは独立して存在するため、`type: "github-actions"` の設定は引き続き動作する。alpha 版ポリシーにより後方互換コードは不要だが、移行手順として: `config.json` で `type: "ci"` かつ alias 経由で `github-actions` を参照していたプロジェクトは、`type: "github-actions"` に変更すること。

## Open Questions

なし

- [x] User approved this draft

