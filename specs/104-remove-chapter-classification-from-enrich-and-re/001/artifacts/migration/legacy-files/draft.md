# Draft: enrich の chapter 割り当て改善

## Issue
#33: Evaluate a design to remove chapter classification from enrich and resolve it statically from templates

## 要件

### chapters 形式の変更
- preset.json と config.json の `chapters` をオブジェクト配列に変更
- 形式: `{ chapter: "name.md", desc?: "...", exclude?: true }`
- preset.json: 全章の順序定義 + 汎用的な desc
- config.json: 差分上書き（desc/exclude のみ）。全章列挙不要
- 順序: preset の配列順。config にあって preset にない章は末尾追加

### enrich の chapter 割り当てを2段階方式に
- 第1段階（静的）: テンプレートの `{{data}}` 参照からカテゴリ→章マッピングを構築し、該当エントリの chapter を自動割り当て
- 第2段階（動的）: 未割り当てエントリのみ AI に渡し、章名 + desc 付きプロンプトで chapter を割り当て

### {{data}} カテゴリ抽出ロジックの共通化
- text.js の既存ロジックと enrich の静的割り当てで同じ抽出関数を使用

### 既存プリセットの chapters 更新
- 全プリセットの preset.json の chapters を新形式に移行
- 各章に汎用的な desc を設定

### 変更しないもの
- getEnrichedContext() — chapter フィルタはそのまま
- detectChangedChapters() — chapter フィールドは残るため変更不要
- deep/light モード — 既存動作を維持

## 背景・議論の経緯
- ボード dffe の検証で enriched context が text 品質に必須と判明
- chapter フィルタ廃止ではなく、割り当て精度の改善が費用対効果が高い
- 誤分類の原因は章名だけ渡して章の説明がないこと
- 静的割り当て（{{data}} 参照）+ 動的割り当て（AI + desc）の2段階方式で精度向上

- [x] User approved this draft (2026-03-31)
