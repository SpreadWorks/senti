# Draft: docsRead/srcRead メトリクス計測漏れ修正

## 背景
- docsRead/srcRead メトリクスが全 spec で 0（計測漏れ）
- スキルが set コマンドを手動で呼ぶ運用は AI が指示を飛ばすと記録されない
- コマンド実行から機械的に決定できるものは hook や引数に移し、スキルの負荷を減らす

## 決定事項

### スコープ
- 一括で1つの spec として進める（hook再設計 + prepare-spec引数 + スキル更新は密結合）

### hook ライフサイクル再設計
- before/after → pre/post にリネーム
- onError/finally を追加（Issue 設計通り）
- runEntry を try/catch/finally 構造に変更

### prepare-spec への引数追加
- --issue と --request を追加
- prepare-spec 本体で flow.json 作成時に含める（hook ではなく作成コマンドの責務として。例外であることをコメントで明記）

### docsRead/srcRead メトリクスの自動記録
- get.context の incrementMetric を registry の post hook に移動
- file mode: result.data.type で判定（"docs" → docsRead, "src" → srcRead）
- list/search mode: docsRead（analysis.json 読み込みのため）
- incrementMetric 関数を flow-state.js に移動（共有ユーティリティ化）

### redo メトリクスの自動インクリメント
- set.redo の post hook で自動的にカウントアップ

### 全 run コマンドへの pre/post hook 追加
- gate, review は既存を pre/post にリネーム
- finalize, sync, retro, lint, impl-confirm にも pre/post hook 追加
- pre: step を in_progress に
- post: step を done に

### スキルテンプレート変更
- hook 化された set step の手動呼び出しを削除
- prepare-spec に --issue, --request を渡すように変更
- Read ツール後の metric 記録指示を追加（docs/ → docsRead, src/ → srcRead）

### スキルに残るもの（hook に移せない）
- set note, set summary, set req, set metric question, set redo, set auto

## 影響範囲
- before/after → pre/post: registry.js 内部のみ（外部 API ではない）
- prepare-spec --issue/--request: 新オプション追加（既存動作不変）
- context.js incrementMetric 削除: post hook に移動（外部動作同じ）
- スキルテンプレート: sdd-forge upgrade で反映

## 承認
- [x] User approved this draft (2026-04-02)
