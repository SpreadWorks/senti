# experimental

このドキュメントは `experimental/` 配下のコードとテストのルールを定義する。

## 目的

- `experimental/` は **src/ への昇格前の試験コード** を置く領域である。
- ここに置いたコードが安定し、運用方法論が固まったら src/ へ昇格させる（promotion）。動いたら src/ に上げる運用とする。
- 昇格後は experimental/ 側の実体を削除し、src/ を唯一の正とする。

## 運用フロー

1. 新しいワークフローや補助ツールをまず `experimental/` で試作する。
2. 実装が安定し、CLI surface・config キー・利用パターンが固まったら src/ へ昇格する。
3. 昇格時に呼び出し経路（skill / docs）を新しい src/ コマンドへ更新し、experimental/ の旧実体を削除する。

## 昇格の実例

- `senti workflow`（GitHub Projects ボード管理 + issue 化）は `experimental/` から `src/workflow/` へ昇格済み。昇格条件は `src/workflow/AGENTS.md` を参照。

## テスト

- **MUST: `experimental/` 配下のコードをテストするファイルは `experimental/tests/` に置くこと。**
- **MUST: `experimental/` 配下のテストを `tests/unit/` や `tests/e2e/` に置いてはならない。**
- src/ へ昇格したコードのテストは `tests/unit/` 等の通常のテスト配置に従う（experimental のテスト配置規則は適用しない）。
- 出力は JSON envelope 形式（`{ ok, type, key, data, errors }`）を推奨する。
