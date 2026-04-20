# Feature Specification: 201-gate-impl-eval-accuracy

**Feature Branch**: `feature/201-gate-impl-eval-accuracy`
**Created**: 2026-04-20
**Status**: Approved
**Input**: issue #194 / gate-impl 評価器の判定精度改善

## Goal

gate-impl の AI 評価器が spec の本来の合格条件に対してノイズとなる FAIL 判定を返すケースを排除し、auto mode での retry 爆発・finalize ブロック要因を解消する。

## Scope

- 軸 C（最優先）: test ファイル変更判定を AI 評価から機械判定に移管
- 軸 A（次点）: gate-impl retry 回数に hard ceiling を設け、上限到達時にエスカレーションする

## Out of Scope

- 軸 B（baseline 失敗との差分認識）: 別 draft `bfa5` として board に分離
- 軸 C 残存リスク（複数行追加に紛れる trivial test 水増し）: 別 draft `6308` として board に分離
- gate の phase（draft / spec / task-impl 以外）の変更
- 既存 CLI コマンド・オプションの追加・削除・意味変更

## Clarifications (Q&A)

- Q: スコープに 3 軸（A / B / C）全て含めるか？
  - A: 当初は 3 軸含める想定だったが、軸 B は baseline 実行方式が user NG で代替方式検討が必要なため別 draft `bfa5` に分離。本 spec は A + C のみ。

- Q: retry counter の格納先は？既存 metrics 基盤と二重管理にならないか？
  - A: 現状 `VALID_METRIC_COUNTERS` に retry は含まれず、別途 retry を永続管理する仕組みも無い。既存 metrics 基盤に相乗りする方式を選定し二重管理を回避。

- Q: 上限到達時は 10 回きっちり走るか？
  - A: hard ceiling のみ強制（上限以下での早期停止は AI 判断を尊重）。「N 回以上は絶対走らない」という作用。

- Q: デフォルト retry 上限値は？
  - A: 3。user feedback「そもそもリトライが多すぎる」方針に従い、issue 本文の例示値 5 より厳しめに設定。

- Q: 軸 C の append/modify 判定に言語パースを使ってよいか？
  - A: NG（user 表明）。diff 構造のみで判定する。

- Q: `+` のみ 1 行の hunk を append とみなすか？
  - A: NG。新規 test ブロック追加は構文上最低 3 行必要。1 行 `+` は既存ブロック内への assert 追加であり modify 扱いで FAIL。

- Q: `+` のみ複数行の hunk は append と modify のどちらと判定するか？
  - A: 機械的に区別不能なため skip（FAIL を返さない）。核心攻撃ベクトル（A/B/C/D = `-` 行または 1 行 `+`）は別のルールで捕捉されるため、この skip で regression 隠蔽を許すことにはならない。残存リスク E/F（trivial test 水増し・既存ブロック内複数行 helper 追加）は別 draft `6308` に分離。

- Q: 機械判定できるならその結果を AI に渡す意味はあるか？
  - A: ない。AI に渡す情報は AI 判定が必要な範囲に留める。本 spec では AI 判定を完全廃止。

- Q: 上限到達時の戻り値は戻り値 flag と例外のどちらか？
  - A: 例外（本プロジェクトに既存する retry エスカレーションパターンと同一形式）。AI 誤認リスク最小・skill プロンプト量最小・既存コード一貫性の全てで優位。

## Alternatives Considered

- **軸 C の判定方式**: AI 判定強化、dedicated AI checker 分離、言語パース、ルール廃止、機械判定の 5 案を比較。核心攻撃ベクトルが機械検知可能であり、AI 判定を廃止することが誤 FAIL 抑制に最も効果的なため機械判定を選定。
- **軸 C の hunk 分類粒度**: 言語パースによる意味的分類（`it()` / `test()` ブロック境界）を検討したが、言語別対応が必要なこと、および user が NG 表明したため採用せず。diff 構造のみに基づく分類に限定。
- **軸 A の上限到達時挙動**: 戻り値 flag 方式（`result: "escalate"`）と例外方式を比較。AI 誤認リスク・skill プロンプト量・既存パターン一貫性で例外方式が優位と判断。
- **軸 A のカウンタ管理方法**: 独立フィールド新設、issue-log エントリ数カウント、既存 metrics 基盤相乗りの 3 案を比較。既存基盤相乗りが新規コマンド追加不要で最小実装として選定。
- **ルール廃止案（軸 C）**: 「既存テスト改変禁止」ルールを gate-impl から完全削除する案を検討したが、ルールの真の目的は「テストを通すためのテスト」を書かせないことで、test 実行だけでは捕捉できない攻撃ベクトル（trivial test 水増し等）が残るため却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: autoApprove モード。draft 承認と同時に本 spec も承認扱い。

## Requirements

### P1-R1（軸 C）: test 変更判定を AI から機械判定へ移管
When gate-impl が test ファイルの diff を評価する場合, gate-impl は AI 評価器を使わず決定論的ロジックで判定 shall する。

### P1-R2（軸 C）: 既存行の削除・改変の検出
If test ファイルの diff hunk のうち「削除行（`-` で始まる行）を 1 行以上含む」 hunk が 1 つでも存在する場合, gate-impl は FAIL を返 shall する。

### P1-R3（軸 C）: 1 行追加の検出
If test ファイルの diff hunk のうち「追加行数 1 行 かつ 削除行数 0 行」の hunk が 1 つでも存在する場合, gate-impl は FAIL を返 shall する。

### P1-R4（軸 C）: 複数行追加の許容
If test ファイルの diff の全 hunk が「追加行数 ≥ 2 行 かつ 削除行数 0 行」のみで構成される場合、または test ファイルに変更がない場合, gate-impl は test 変更判定から FAIL を返 shall ない。

### P1-R5（軸 C）: FAIL 理由の具体性
When gate-impl が test 変更で FAIL を返す場合, gate-impl は FAIL 対象となった test ファイル名と該当行番号を FAIL 理由に 100% 含 shall する。

### P1-R6（軸 C）: 言語非依存
When test 変更判定を行う場合, gate-impl は言語別パース（`it`, `test`, `def` 等のブロック境界解析）を使わ shall ない。

### P2-R1（軸 A）: retry 回数の計測
When gate-impl が FAIL を返した場合, retry 回数は 1 増加 shall する。When gate-impl が PASS を返した場合, retry 回数は 0 にリセット shall する。

### P2-R2（軸 A）: 上限到達時のエスカレーション
When retry 回数が retry 上限値以上に達した場合, gate-impl の呼び出しは (a) プロセス終了コードが非 0 with (b) 標準出力または標準エラー出力に retry 履歴（過去 N 回の FAIL 理由を識別可能な形で列挙したテキスト）を含 shall む。

### P2-R3（軸 A）: デフォルト上限値
If retry 上限値が明示設定されていない場合, gate-impl は retry 上限値 = 3 を使 shall する。

### P2-R4（軸 A）: AI 判断排除
When retry 回数管理を行う場合, gate-impl は AI 判断を介さ shall ない。

## Acceptance Criteria

- spec 191 相当のケース（既存 test ファイルに新規 test case を追加する変更のみ、複数行）で gate-impl が test 変更判定から FAIL を返さないことが integration test で確認できる。
- 既存 test 改変の核心攻撃ベクトル（assert 書換・削除・skip 化・1 行 assert 追加）は gate-impl が FAIL を返すことが integration test で確認できる。
- 連続 FAIL 3 回発生後の gate-impl 呼び出しで、プロセス終了コードが非 0 となり retry 履歴を含むエラー出力が得られることが integration test で確認できる。
- gate-impl の FAIL 理由文字列が test 変更検出時に test ファイル名と行番号を含むことが unit test で確認できる。
- retry 回数カウンタが gate-impl PASS で 0、FAIL で +1 に遷移することが unit test で確認できる。
- retry 上限到達時の gate-impl の外部挙動が本プロジェクトに既存する retry エスカレーション挙動と一致することが unit test で確認できる。

## Open Questions

なし
