# Quality Report: generate vs translate mode

**Date**: 2026-03-15
**Config**: `output.languages: ["en", "ja"]`, `output.default: "en"`

## (a) Diff 行数サマリー

| ファイル | diff 行数 |
|---|---|
| overview.md | 235 |
| cli_commands.md | 470 |
| configuration.md | 275 |
| internal_design.md | 598 |
| README.md | 228 |
| **合計** | **1,811** |

差分が大きい理由: generate モードは `{{text}}` ディレクティブのプロンプトが日本語に翻訳された状態で AI に渡され、AI が日本語で直接生成する。translate モードは英語のプロンプトで生成された英語テキストを後から翻訳する。そのため文章構成・表現・情報量が根本的に異なる。

## (b) sdd-forge review 結果

| モード | 結果 | WARN |
|---|---|---|
| generate | **PASSED** | uncovered: package(2), modules(2) |
| translate | **PASSED** | uncovered: package(2), modules(2) |

両モードとも同一の WARN（analysis カテゴリ未カバー）のみで PASS。

## (c) AI 品質見解

### generate モード
- **長所**: `{{text}}` プロンプトが日本語化されているため、日本語として自然な文体・構成になる。テーブルの見出しやコマンド説明が日本語ネイティブの表現。
- **短所**: 英語版とは異なる AI セッションで生成されるため、情報量や記述の粒度に差異が出る可能性がある。ビルド時間が translate の約2倍（text ステップが言語ごとに実行される）。
- **総評**: 日本語の自然さ・読みやすさは translate モードより優れる。

### translate モード
- **長所**: 英語版と1対1の構造を維持するため、原文との整合性が高い。`{{text}}` プロンプト（英語）がそのまま残るため、後からの再翻訳が容易。ビルド時間が短い。
- **短所**: 翻訳調の文章になりやすい（「〜を提供します」「〜を行います」の連続など）。英語の文構造をそのまま日本語化するため、冗長になる箇所がある。
- **総評**: 原文の忠実な反映が求められる場合に適する。

### 推奨
- **ドキュメントの読み手が日本語話者中心** → generate モード推奨（自然な日本語）
- **多言語間の構造的一貫性が重要** → translate モード推奨（原文との1対1対応）
