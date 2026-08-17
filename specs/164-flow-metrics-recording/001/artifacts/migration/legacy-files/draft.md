# Draft: flow 実行時にメトリクスを flow.json に記録する仕組み

**開発種別:** 機能追加
**目的:** agent 呼び出し後に token/cost/cache メトリクスを flow.json に累積記録し、`sdd-forge metrics` ツールが `.tmp/logs/` に依存せず flow.json だけからデータを読めるようにする。

## Q&A

**Q1: バックフィルはこのspecのスコープに含めますか？**
A: 含める。理由: 本機能実装前の spec のメトリクスが欠落したままでは `sdd-forge metrics` での履歴比較が機能しない。過去ログから flow.json への補完は、「flow.json をメトリクスの唯一の情報源にする」という同一ゴールの一部。

**Q2: token/cost メトリクスを `sdd-forge flow run report` にも表示しますか？**
A: 含める。理由: report は flow の完了サマリーであり、コストを可視化する最も近い既存の出力先。記録だけして表示しないと機能が不完全な状態になる。

**Q3: `usage` が null または `cost_usd` が null の場合の挙動は？**
A: `cost_usd` が null なら cost の加算をスキップし、使用モデル名を記録しておく。根拠: 一部エージェント（codex 等）は USD コストを返さない仕様のため、cost フィールドを強制すると不正確な 0 が蓄積される。モデル名を記録しておくことで、後から単価が判明した際に計算可能にする。

**Q4: active な flow がない（sddPhase が null）ときは？**
A: スキップ（flow.json がなければ記録しない）。根拠: flow.json がない状態ではメトリクスの蓄積先がなく、かつ `sdd-forge docs build` 等の flow 外コマンドはメトリクス追跡の対象外。

## 決定事項

- 記録対象: active な SDD flow（いずれかの step が `in_progress` の状態）での agent 呼び出しのみ
- flow 外の agent 呼び出しは記録しない
- `cost_usd` が null のエージェントはコスト加算なし、ただしモデル名は記録
- 過去ログから flow.json へのメトリクス補完は一度だけ手動実行する
- report コマンドの token/cost 表示も本 spec に含める

## スコープ（優先順位付き）

本 spec の関心事は「**flow.json をメトリクスの唯一の信頼できる情報源にする**」という1点である。以下3つはその実現に必要な側面であり、個別に分けるとそれぞれが中途半端な状態で merge される。

### P1（必須・コアロジック）
1. agent 呼び出し完了後のメトリクス記録:
   - When: active な SDD flow 中に agent 呼び出しが完了した時
   - Shall: 実行フェーズごとに、token 種別（入力・出力・キャッシュ作成・キャッシュ読み取り）の使用量を flow.json へ累積する
   - Shall: USD コストが取得できる場合のみ、フェーズごとのコスト合計を flow.json へ累積する
   - Shall: 呼び出し回数・レスポンス文字数・使用モデルをフェーズごとに flow.json へ記録する
   - Shall: active な flow がない場合は何も記録しない

### P2（履歴復元）
2. 既存ログファイルから過去メトリクスを flow.json へ補完する処理:
   - When: ユーザーが一度だけ手動でスクリプトを実行した時（通常の CLI コマンドには含めない）
   - Shall: `.tmp/logs/` 配下のプロンプトログを読み、spec×phase ごとに集計して各 spec の flow.json へ書き込む
   - Shall: 既存の metrics フィールドを上書きせず、token/cost 系フィールドのみを追記する
   - Shall: スクリプトはプロジェクトローカルな一時ファイルとして提供し、npm パッケージには含めない

### P3（可視化）
3. `sdd-forge flow run report` の出力に token/cost の集計を追加:
   - When: `sdd-forge flow run report` を実行した時
   - Shall: フェーズごとの input/output/cache トークン数、USD コスト合計、呼び出し回数を報告に含める
   - Shall: `cost_usd` が記録されていないフェーズは「コスト不明」と表示し、誤った 0 を表示しない

## 既存機能への影響

- **flow.json スキーマ**: `metrics` フィールドに token/cost/callCount/responseChars/model の各フィールドが追加される。既存の読み取り箇所（`flow get status`、`flow get context` 等）は既存キー（`question`/`srcRead` 等）を参照するため影響なし
- **`.tmp/logs/` との共存**: 本機能実装後も `.tmp/logs/` へのログ出力は継続する（別の用途で使用されているため廃止しない）
- **backfill 実行前の既存 flow.json**: backfill 前の flow.json には `metrics: null` または既存カウンタのみが入っている。backfill は token/cost フィールドのみを追記し、既存フィールドを上書きしない
- **並行書き込みの可能性**: worktree で複数フローを並行実行している場合、同一タイミングでの flow.json 書き込みが競合する可能性がある。ただし SDD フローは基本的に順次実行（一度に1 agent 呼び出し）であるため、agent 実行中の同時書き込みは想定しない

## スコープ外

- `sdd-forge metrics` ツール本体（#8690 で対応）
- codex の credits → USD 変換（単価情報が不確実なため）
- worktree 間の並行書き込み競合対策（排他ロック等）
- リアルタイム通知や可視化

- [x] User approved this draft
