# Draft: fix-issue-log-test-leak

**開発種別:** バグ修正

**目的:** `flow set issue-log` コマンドで placeholder 的な短文 reason（"first", "second", "test", "wrong scope" 等）が実 spec の `issue-log.json` に混入する問題を、入力バリデーション強化により防止する。

## 背景

issue #176（2026-04-18 の横断調査で検出）:

- 実 spec の issue-log に placeholder 値が 10+ 件蓄積している（"first", "second", "test", "wrong scope" 等）。
- 現行の `flow set issue-log` は必須フィールドの非 null チェックのみで、極端に短い placeholder 文字列を弾かない。
- テストは作業ルート隔離で守られているが、手動 CLI 実行時のミスタイプ等は素通りする。

## 要件（優先順位付き）

### P1（必須）: reason の最小長バリデーション

- **When:** 利用者が `flow set issue-log` を呼び出したとき
- **If:** 指定された `reason` を trim した長さが 20 文字未満であるとき
- **Shall:** コマンドは `ok: false` envelope とエラーコードを返して終了し、`issue-log.json` への書き込みを一切行わない

### P2（必須）: 任意フィールドの最小長バリデーション

- **When:** 利用者が `flow set issue-log` に任意フィールド（`trigger` / `resolution` / `guardrail-candidate`）を指定したとき
- **If:** 指定された値を trim した長さが 10 文字未満であるとき
- **Shall:** コマンドはエラー envelope を返して終了し、書き込みを行わない

### P3（必須）: 既存利用箇所の整合性確保

- **When:** 本 spec のバリデーションが導入されたとき
- **If:** 既存の呼び出し（SDD スキル内の実行例・テストケース・`run gate` post hook）がバリデーション条件を満たしていないとき
- **Shall:** 呼び出し側の短文を P1/P2 の最小長（reason は 20 文字以上、任意フィールドは 10 文字以上）を満たす文言へ更新する

## 既存機能への影響

- `run gate` の post hook: 常に十分長い reason を生成するため影響なし。
- SDD スキル内の `flow set issue-log` 例示: 説明として十分長い文字列を使っており影響なし。
- ユニットテスト: 短い placeholder 文字列を使うケースは新仕様の下で失敗するため、テスト文言を現実的な長さへ更新する（P3 で対応）。
- `flow set issue-log` 以外のコマンド（`note`, `summary` 等）への影響なし。

## 移行計画（Backward-Compatible CLI Interface）

- 本変更は `flow set issue-log` に対して以前は許容された短文入力を拒否する破壊的変更である。
- 利用者影響: SDD スキルおよび sdd-forge 自身の内部経路のみが実利用者であり、すべて十分な長さの reason を生成している。一般ユーザが意図して短文を記録するユースケースは存在しない。
- 移行手順:
  1. 本 spec の実装と同一コミットで、既存テスト・ドキュメントの短文例示を現実的な長さへ差し替える。
  2. エラー envelope の `messages` に「最小文字数を満たす具体的な reason を記述してください」という利用者向けガイダンスを含める。
  3. sdd-forge 自身は alpha 版でありバージョン固定の外部依存が存在しないため、非推奨期間は設けない。

## ブレインストーム vs 決定の区別

以下の「検討した代替案」は、spec 策定前のブレインストーミング段階で挙がった選択肢を整理したものである。利用者による autoApprove 指示のもと、本ドラフト時点で決定事項に転化している。批評対象はあくまで「確定した決定の理由付け」であり、ブレスト中のアイデアへの否定ではない。

## 検討した代替案

1. **sink 環境変数（`SDD_FORGE_ISSUE_LOG_SINK=devnull` 等）でテスト時に書き込みを抑止**  
   却下: テスト経路は既に作業ルート隔離で守られている。手動 CLI 実行時の誤入力を防ぐには効かない。
2. **placeholder 辞書でキーワードをブロック**  
   却下: 保守負担が高く、辞書外の別短文を素通りさせる。
3. **最小長バリデーションのみ（本案）**  
   採用: 実用 reason は例外なく閾値を超えており、placeholder 相当の短文は閾値未満に収まる。誤検知が極小。

## 将来拡張

- 本リリース後に placeholder の混入が続く場合、ブロックリスト方式を追加導入する余地あり。
- 他の `flow set` コマンド（`note`, `summary` 等）に同様の短文検出が必要になれば、共通ヘルパーへ抽出する。

## Q&A

### Q1: 最小長の閾値をどう決めるか

- 推奨: `reason` は 20 文字、任意フィールド（`trigger` / `resolution` / `guardrail-candidate`）は 10 文字とする。
- 根拠: 既知の placeholder は全て 12 文字以下。`run gate` post hook の reason は 100 文字超が通常。20 文字は誤検知がほぼゼロで、placeholder を確実に弾く水準。

### Q2: sink 機構を併設するか

- 推奨: しない。バリデーションで目的を達する。
- 根拠: alpha 版ポリシー「過剰な防御コードを書かない」。テスト経路は既に隔離済み。

### Q3: 既存 spec の placeholder エントリをクリーンアップするか

- 推奨: 含めない。
- 根拠: issue 本文で「別途判断」と明示。finalize 済み spec の事後編集は本 spec の責務外。

### Q4: 任意フィールドにも閾値を設けるか

- 推奨: 設ける（reason より短い閾値）。
- 根拠: reason だけ守っても任意フィールドが placeholder だらけになれば同じ問題が再発する。

## テスト戦略

- 短文 reason を与えた場合にエラー envelope を返し、書き込みが行われないことを検証する新規ケース。
- 既存ケースの reason 文字列を現実的な長さへ更新する。

## User Confirmation

- [x] User approved this draft (autoApprove)
- 確認日: 2026-04-19
