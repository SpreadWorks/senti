# 217-fix-mermaid-line-breaks — Tests

## 新規テスト
なし。

## 理由
本 spec の変更は以下 2 種のみで、公開 API / CLI / ロジックの挙動を変えない:

1. `docs/internal_design.md` の静的テキスト（mermaid ブロック内ノードラベル）の直接修正
2. `src/presets/**/templates/**/*.md` 内 `{{text({prompt: ...})}}` プロンプト文字列への汎用的な指示追記

(1) は grep による静的検証（AC1）、(2) は対象ファイル一覧と文字列含有の grep 検証（AC2）で十分。
(2) の変更は AI 生成時の挙動を誘導するための指示文字列であり、外部 AI 出力のテストによる固定は適切でない。

## 実施する検証（gate-impl で評価）
- AC1: `docs/internal_design.md` 内 mermaid コードブロックにリテラル `\n` が残っていないこと
- AC2: 対象 preset template 全 15 ファイルに追加指示文字列が含まれていること
- AC3: `npm test` が exit 0 で完了すること（baseline と同条件）

## テスト配置方針
`tests/` への追加は行わない。既存 unit + integration テストの回帰実行のみ。
