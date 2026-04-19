# Tests — 195 gate-guardrail-diff-scope

本 spec のテスト配置と実行手順。

## 1. Formal Unit Tests（`tests/unit/specs/commands/guardrail.test.js`）

R1/R2/R3 を構造的に検証するユニットテスト。`buildGuardrailPrompt` が impl フェーズで diff スコープ制約（追加/変更行のみを判定対象とする旨、pre-existing コードを除外する旨）を含むプロンプトを生成することを確認する。

配置理由: 将来このプロンプト構造が崩れれば Issue #180 の再発につながるため、本 spec 固有ではなく常時保守すべきバグ検知テストとして `tests/` に置く。

実行:

```bash
node tests/run.js --scope unit --filter guardrail
```

期待結果: `buildGuardrailPrompt impl-phase diff-scope constraint` スイートの全サブテストが PASS。

## 2. Spec-local 手動再現テスト

R4 の手動再現テスト。Issue #180 の症状（数行変更の diff に対して同ファイル内の pre-existing な違反パターンが FAIL となる）を再現し、本 spec 適用後に gate-impl が PASS となることを確認する。

### 再現シナリオ

1. 任意の spec を開いた状態で、`src/` 配下の 1 ファイルに対して guardrail 違反と無関係な数行の変更を加える（例: コメント追加、変数名変更）。
2. 同ファイル内の別の関数に、本 spec で対象とした guardrail 違反パターン（例: hot path 内の `fs.existsSync` 呼び出し）が pre-existing に存在することを確認する。
3. `sdd-forge flow run gate --phase impl` を実行する。

### 期待結果

- **本 spec 適用前（Before）:** gate が FAIL を返し、`data.artifacts.reasons` に pre-existing な関数の違反が FAIL として含まれる。
- **本 spec 適用後（After）:** gate が PASS を返す（または、diff 内の追加/変更行に起因しない pre-existing な違反は FAIL として計上されない）。

### 記録

実行結果（コマンド出力の該当部分）を `specs/195-gate-guardrail-diff-scope/tests/manual-repro.log` に保存し、Before/After の差分を確認する。AI 判断部分のためテストの決定論性は保証されないが、同一 diff で 3 回程度実行して傾向を確認する。
