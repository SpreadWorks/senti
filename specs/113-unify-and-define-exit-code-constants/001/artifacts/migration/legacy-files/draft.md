# Draft: 終了コードの統一と定数化

## Issue
#49: Unify and define exit code constants

## Self-Q&A

### 1. Goal & Scope
- Goal: 終了コードの意味を定義し、定数として集約する
- Scope: src/lib/ に定数定義ファイルを作成し、process.exitCode / process.exit() の呼び出し箇所を定数参照に置換
- 現状: forge.js は exitCode=2、text.js は exitCode=1、retro.js は exitCode=1 を多用。意味の区別がない

### 2. Impact on existing
- 約50箇所の process.exit() / process.exitCode の呼び出しに影響
- ただし動作自体は変わらない（定数の値は現在と同じ数値）
- flow-envelope.js の output() は ok フィールドで 0/1 を自動決定しており、これはそのまま

### 3. Constraints
- 外部依存なし（Node.js 組み込みのみ）
- alpha 版ポリシー: 後方互換不要
- ガードレール「終了コードの規約」に対応

### 4. Edge cases
- process.exit(0) は成功なので定数化の意味が薄いが、可読性のために EXIT_SUCCESS を定義
- flow-envelope.js は独自のロジックで exit code を決定 → 定数化の対象外とする

### 5. Test strategy
- 既存テストがパスすることで十分（動作変更なし）
- 定数の値が正しいことを確認するユニットテスト

## 終了コードの定義
- 0: 成功 (EXIT_SUCCESS)
- 1: エラー (EXIT_ERROR) — バリデーション、設定不備、処理失敗のすべてを含む
- 2: 処理エラー (EXIT_PROCESSING_ERROR) — forge.js が使用中だが、1 に統一する方が良い

### 判断: 0 と 1 の2値に統一
forge.js の exitCode=2 を 1 に統一する。理由:
- 呼び出し元（シェル、CI）は 0 か非0 かしか見ない
- 2 の意味が定義されておらず、1 との区別が有用でない
- シンプルさを優先（alpha 版ポリシー）

- [x] User approved this draft (autoApprove)
