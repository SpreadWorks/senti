# Test Design

### Test Design

---

#### P1: agent 呼び出し後のメトリクス記録

---

- **TC-1: active flow での全フィールド累積記録**
  - Type: unit
  - Input: `sddPhase = "plan"`, agent 呼び出し結果に `input_tokens=100, output_tokens=50, cache_creation_tokens=20, cache_read_tokens=10, cost_usd=0.005, text="abc"(3文字)`, モデル名 `"claude-opus-4-5"` を含む
  - Expected: `flow.json` の `metrics.plan` に `inputTokens+=100, outputTokens+=50, cacheCreationTokens+=20, cacheReadTokens+=10, costUsd+=0.005, callCount+=1, responseChars+=3, models["claude-opus-4-5"]+=1` が反映される

---

- **TC-2: 複数回呼び出し時の加算累積**
  - Type: unit
  - Input: 同一フェーズで agent を 2 回呼び出す。1回目: `inputTokens=100, callCount初期値=0`、2回目: `inputTokens=200`
  - Expected: 2 回目完了後に `metrics.plan.inputTokens == 300, callCount == 2`（上書きでなく加算）

---

- **TC-3: currentPhase のみが更新される**
  - Type: unit
  - Input: `flow.json` に `metrics.plan` と `metrics.implement` が既に存在。`sddPhase = "plan"` で agent 完了
  - Expected: `metrics.plan` のみ更新され、`metrics.implement` は変更されない

---

- **TC-4: metrics フィールドが存在しない初回呼び出し**
  - Type: unit
  - Input: `flow.json` に `metrics` キーが存在しない状態で agent 完了
  - Expected: `metrics.<currentPhase>` が初期値 `0` から正しく作成・記録される（KeyError / undefined 参照エラーなし）

---

- **TC-5: 複数モデルの呼び出し回数追跡**
  - Type: unit
  - Input: フェーズ `"plan"` で `"claude-opus-4-5"` を 2 回、`"claude-haiku-3-5"` を 1 回呼び出す
  - Expected: `metrics.plan.models == { "claude-opus-4-5": 2, "claude-haiku-3-5": 1 }`

---

- **TC-6: active な flow がない（sddPhase = null）**
  - Type: unit
  - Input: `sddPhase = null`（flow 未開始またはフロー外）の状態で agent 呼び出し完了
  - Expected: `flow.json` への読み書きが一切発生しない。agent の `text` は正常に返却される

---

- **TC-7: cost_usd が null の場合はコストのみスキップ**
  - Type: unit
  - Input: agent 結果に `cost_usd = null`、その他フィールド (`input_tokens`, `output_tokens` 等) は有効値
  - Expected: `metrics.<phase>.costUsd` は加算されない（フィールドが存在しない、または変化しない）。`inputTokens`, `outputTokens`, `callCount`, `responseChars`, `models` は正常に記録される

---

- **TC-8: flow.json 書き込み失敗時の非致命的エラー処理**
  - Type: integration
  - Input: `flow.json` への書き込みが失敗する（例: 書き込み権限なし）
  - Expected: エラーが `stderr` に出力される。agent の `text` は呼び出し元に正常に返却される（例外が呼び出し元に伝播しない）

---

- **TC-9: responseChars の正確な計測**
  - Type: unit
  - Input: agent の text レスポンスが `"あいうえお"` (5文字、マルチバイト)
  - Expected: `responseChars` が `5` ではなく文字数として正しく計上される（バイト数との混同がない）

---

#### P2: 過去ログのバックフィル

---

- **TC-10: 正常系 – ログから spec×phase ごとに集計して flow.json へ書き込み**
  - Type: integration
  - Input: `.tmp/logs/` に spec `"feat-001"` の `plan` フェーズログファイルが 2 ファイル存在する。各ファイルに token 数・cost・モデル名が記録されている
  - Expected: `feat-001` の `flow.json` の `metrics.plan` に 2 ファイル分の値が正しく集計・書き込まれる

---

- **TC-11: 既存の question / srcRead フィールドを上書きしない**
  - Type: integration
  - Input: `flow.json` の `metrics.plan` に `question: 3, srcRead: 5` が既存。バックフィルを実行
  - Expected: `question`, `srcRead` の値は変化しない。`inputTokens` 等の token/cost 系フィールドのみ追記・更新される

---

- **TC-12: spec が null のログファイルをスキップ**
  - Type: unit
  - Input: ログファイルの `spec` フィールドが `null`
  - Expected: そのファイルはスキップされ、処理可能な他のファイルの処理は継続される。スキップ件数がカウントされる

---

- **TC-13: 対応する flow.json が存在しないログファイルをスキップ**
  - Type: unit
  - Input: ログファイルの `spec = "nonexistent-spec"` で、該当する `flow.json` が存在しない
  - Expected: そのファイルはスキップされ、処理は継続される。スキップ件数がカウントされる

---

- **TC-14: ファイルサイズが 50MB を超える場合はスキップ**
  - Type: unit
  - Input: 50MB を超えるログファイルが 1 ファイル存在する
  - Expected: そのファイルはスキップされ、`stderr` に警告メッセージが出力される。スキップ件数に算入される

---

- **TC-15: ちょうど 50MB のファイルはスキップされない（境界値）**
  - Type: unit
  - Input: ファイルサイズがちょうど 50MB（50 × 1024 × 1024 bytes）のログファイル
  - Expected: スキップされずに処理対象となる（`> 50MB` 条件の確認）

---

- **TC-16: ファイルを逐次処理する（全件一括ロードしない）**
  - Type: unit
  - Input: ログファイルが 1000 件存在する状況でバックフィル実行
  - Expected: ファイルを 1 件ずつ読み込み・処理する実装になっている（全ファイルを配列にバッファしない）。メモリ上限を超えずに完了する

---

- **TC-17: 処理完了後に処理件数 / スキップ件数を stdout に出力**
  - Type: integration
  - Input: 有効ファイル 5 件、スキップ対象（null spec）2 件、サイズ超過 1 件で実行
  - Expected: `stdout` に `処理: 5, スキップ: 3` 相当の集計サマリが出力される

---

- **TC-18: ログディレクトリが存在しない場合は exit code 1**
  - Type: integration
  - Input: `.tmp/logs/` ディレクトリが存在しない状態でバックフィル実行
  - Expected: `exit code 1` で終了し、エラー内容が `stderr` に出力される

---

- **TC-19: 正常完了時は exit code 0**
  - Type: integration
  - Input: `.tmp/logs/` が存在し、処理が全て（スキップ含む）完了する
  - Expected: `exit code 0` で終了する

---

- **TC-20: バックフィルスクリプトが npm パッケージに含まれない**
  - Type: acceptance
  - Input: `npm pack --dry-run` を実行する
  - Expected: バックフィルスクリプトのパスがパッケージ収録ファイル一覧に現れない（`src/` 外に配置されている）

---

- **TC-21: 同一 spec×phase への複数ファイルの正確な集計**
  - Type: integration
  - Input: spec `"feat-002"`, phase `"implement"` のログファイルが 3 件（それぞれ `inputTokens: 100, 200, 300`）
  - Expected: `flow.json` の `metrics.implement.inputTokens == 600`（3 ファイルの合算）

---

#### P3: report コマンドへの表示追加

---

- **TC-22: report に token 数・コスト・呼び出し回数が表示される**
  - Type: acceptance
  - Input: `flow.json` の `metrics.plan` に `inputTokens=1000, outputTokens=500, cacheCreationTokens=200, cacheReadTokens=100, costUsd=0.012, callCount=3` が記録された状態で `sdd-forge flow run report` を実行
  - Expected: レポート出力に `plan` フェーズの input/output/cache トークン合計、`$0.012`（または相当の表示）、呼び出し回数 `3` が含まれる

---

- **TC-23: コストが記録されていないフェーズは N/A 表示**
  - Type: acceptance
  - Input: `metrics.plan` に `costUsd` フィールドが存在しない（または `null`）状態で `report` 実行
  - Expected: コスト欄に `N/A` が表示される。`0` や空欄は表示されない

---

- **TC-24: コスト 0.0 と「未記録」を区別する**
  - Type: unit
  - Input: あるフェーズで `costUsd = 0.0`（記録済みだが値がゼロ）と、別フェーズで `costUsd` フィールド自体が存在しない（未記録）
  - Expected: `costUsd = 0.0` のフェーズは `$0.00`（または相当）、フィールド未存在のフェーズは `N/A` と区別して表示される

---

- **TC-25: 全フェーズを網羅的に表示**
  - Type: acceptance
  - Input: `flow.json` に `metrics.plan`, `metrics.implement`, `metrics.review` が全て存在する状態で `report` 実行
  - Expected: レポートに 3 フェーズ分の行がそれぞれ出力される（フェーズの一部が欠落しない）

---

- **TC-26: キャッシュトークンが 0 のフェーズでの表示**
  - Type: acceptance
  - Input: `metrics.plan.cacheCreationTokens = 0, cacheReadTokens = 0`（キャッシュ未使用）で `report` 実行
  - Expected: キャッシュトークン欄が `0` と正しく表示される（undefined / null による表示崩れが発生しない）

---

- **TC-27: metrics フィールドが全く存在しないフローの report**
  - Type: acceptance
  - Input: `flow.json` に `metrics` キー自体が存在しない状態で `report` 実行
  - Expected: エラーなく report が完了し、token/cost 欄は `N/A` または `0` が適切に表示される（クラッシュしない）

---

### テストタイプ比率サマリ

| Type | 件数 | 目的 |
|---|---|---|
| **unit** | 14 | メトリクス演算・スキップ条件・フィールド分岐ロジックの純粋テスト |
| **integration** | 8 | flow.json 読み書き・ログ集計・exit code など複数モジュール連携 |
| **acceptance** | 5 | CLI エンドポイント（`report` コマンド・npm pack）の外部挙動検証 |
| **合計** | **27** | |
