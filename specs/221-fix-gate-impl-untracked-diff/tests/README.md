# spec 221 — テスト記録

## 何をテストしたか

`src/flow/lib/run-gate.js` に新規追加する `collectUntrackedDiff(root, options?)` 純粋関数の動作仕様を検証した。

| シナリオ | 対応 REQ | 概要 |
|---|---|---|
| untracked 0 件 | REQ-3 | 空文字列を返す |
| untracked テストファイル | REQ-1, REQ-2 | `+` のみの hunk として diff に出現、`checkTestChanges` を素通りする |
| untracked src ファイル | REQ-1 | テスト/src を区別せず取り込む |
| 合成 diff のパース | REQ-2 | `git diff HEAD` 出力 + `collectUntrackedDiff` 出力の連結を `checkTestChanges` が正しく処理する |
| 副作用ゼロ | REQ-4 | 呼び出し前後で `git status --porcelain` が同一 |
| 入力契約 | REQ-5 | `(root, options?)` のみで戻り値は `string` |
| `.gitignore` 順守 | REQ-1 暗黙 | git の `--exclude-standard` で `.gitignore` 一致は除外 |
| 件数上限超過 | REQ-6 | `UNTRACKED_LIMIT_EXCEEDED` を throw、観測値と上限を含む |
| サイズ上限超過 | REQ-6 | 同上、ファイル名・観測サイズ・上限を含む |
| 上限内 | REQ-6 | throw しない |

## テスト配置

`tests/unit/flow/gate-untracked-diff.test.js` (formal test).

選択理由: 「将来の変更でこのテストが落ちたらバグか？」 → YES。`collectUntrackedDiff` は run-gate モジュールの公開関数として `executeDiffBasedGate` から呼ばれる契約 (戻り値型・副作用ゼロ・上限チェック) を持ち、これが破れれば gate-impl の判定挙動が壊れる。spec 完了後も継続的に守るべき仕様であるため `tests/` 配下に配置する。

## 実行方法

```bash
node --test tests/unit/flow/gate-untracked-diff.test.js
# あるいは
npm test
```

## 期待結果

- 実装前: `collectUntrackedDiff` export が存在しないため SyntaxError で全件 fail
- 実装後: 全件 pass
- regression: `npm test` 全体で baseline (2144 unit + 261 integration) を維持

## 上限値

- `maxFiles`: 既定 500 (テストでは小さい値で検証)
- `maxFileSize`: 既定 1 MiB (テストでは小さい値で検証)

上限を可変にしているのは、テストで巨大ファイルを生成せず低コストで境界を検証するため。production 呼び出し (executeDiffBasedGate) では既定値を使用する。
