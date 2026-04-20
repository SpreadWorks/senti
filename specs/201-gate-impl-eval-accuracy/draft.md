---
title: gate-impl 評価器の判定精度改善
issue: 194
---

# Draft: gate-impl 評価器の判定精度改善

**開発種別:** 機能改善（既存機能の精度向上）

**目的:** gate-impl の AI 評価器が spec の本来の合格条件に対してノイズとなる FAIL 判定を返すケースを排除し、auto mode での retry 爆発・finalize ブロック要因を解消する。

## 背景

specs 180 以降で複数 spec の gate-impl が誤判定で FAIL を返し、auto mode で retry が 5〜10 回に及ぶ事象が繰り返し発生している（issue #194）。特に:

- spec 189: retry cycle にわたり FAIL 理由が毎回ズレ続け、最終的にユーザー手動介入
- spec 191: 既存 test ファイルへの test case 追加が既存テスト改変禁止ルールで FAIL

本 draft は上記 2 症状を対象に、軸 A（retry 上限）と軸 C（テスト変更判定の機械化）を扱う。軸 B（baseline 失敗との差分認識）は別 draft として board に切り出し済み。

## 要件（優先順位順）

優先順位の原則: 「誤 FAIL を減らす > 暴走時に止める」。誤 FAIL 根絶（軸 C）を P1、安全網としての上限制御（軸 A）を P2 とする。

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

## Impact on Existing Features

- **gate-impl の外部挙動**: 既存 test ファイルへの変更判定結果が変わる。従来誤 FAIL していた「新規 test case 追加のみ」ケースが PASS に転じる。核心攻撃ベクトル（assert 書換等）は従来通り FAIL。spec 180 以前の spec に対して再実行すると判定結果が変わる可能性あり（主に誤 FAIL からの救済方向）。
- **既存の「テスト改変禁止」ルール**: AI 評価対象から外れる。ルール記述自体は保守的に保持する方針。
- **既存 CLI コマンド**: 追加・削除・オプション意味変更なし。既存 API 互換。
- **config スキーマ**: 新規キー追加なし、既存キー破壊的変更なし。
- **skill 側の指示文言**: 追加指示なし。既存の「コマンド失敗時は停止」ルールで吸収。

## スコープ外（別 draft に分離）

- **軸 B**: baseline 失敗との差分認識。baseline でのテスト実行が不可という制約があり代替方式の検討が必要。board ドラフト `bfa5` として分離。
- **軸 C 残存リスク**: 機械判定で skip される変更パターンに紛れる trivial test 水増し。核心の攻撃ベクトル（既存 validation の骨抜き）は全て機械検知で捕捉されるため本 draft では skip を許容。別途検討として board ドラフト `6308` に記録。

## Acceptance Criteria

- spec 191 相当のケース（既存 test ファイルに新規 test case を追加する変更のみ）で gate-impl が FAIL を返さないことが integration test で確認できる。
- spec 189 相当のケース（連続 FAIL が 3 回発生）で、gate-impl が 3 回目の FAIL 後に自動的に user エスカレーションに遷移することが integration test で確認できる。
- 既存 test 改変の核心攻撃ベクトル（assert 書換・削除・skip 化・1 行 assert 追加）は gate-impl が FAIL を返すことが integration test で確認できる。
- gate-impl の FAIL 理由文字列が、test 変更検出時には test ファイル名と行番号を含むことが unit test で確認できる。
- retry 上限到達時の gate-impl の外部挙動が本プロジェクトに既存する retry エスカレーション挙動と一致することが unit test で確認できる。

## Alternatives Considered

- **軸 C の判定方式**: AI 判定強化、dedicated AI checker 分離、言語パース、ルール廃止、機械判定の 5 案を比較。核心攻撃ベクトルが機械検知可能であり、AI 判定を廃止することが誤 FAIL 抑制に最も効果的。
- **軸 C の hunk 分類**: 言語パースによる意味的分類を user が NG 表明。diff 構造のみに基づく分類に限定。
- **軸 A の上限到達時挙動**: 戻り値 flag 方式と既存パターン踏襲方式を比較。AI 誤認リスクと skill プロンプト量の観点で既存パターン踏襲を選定。
- **軸 A のカウンタ管理方法**: 複数の保存先を比較し、新規コマンド追加が不要な方式を選定。
- **軸 B**: baseline テスト実行方式を user が NG 表明。代替方式検討のため本 draft から分離。

## Future Extensibility

- 軸 B および軸 C 残存リスク対策を将来別 spec として実装する際、本 draft で確立した機械判定の仕組みに分類ロジックを追加する形で拡張可能。
- retry 上限値は現状単一値だが、将来 phase 別設定への拡張が可能。

## Q&A

### Q1. 解釈の妥当性
**A1**: ユーザー承認（2026-04-20）。当初 3 軸すべてをスコープとしたが、Q6 で軸 B を別 draft に分離。

### Q2. retry 上限エスカレーションの方針
**A2**: AI 判断を介さず決定論的に上限チェックを行う方針。**根拠**: user 明示指示「AI になるべく判断を委ねないような仕組みしてください」、および CLAUDE.md「過剰な防御コードを書かない。内部インターフェースは信頼する」方針と整合。

### Q3. カウンタ管理方式
**A3**: 新規コマンド追加不要の方式を選定。**根拠**: CLAUDE.md「シンプルなインターフェースに十分な実装を隠す」「同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出する」方針。

### Q4. 上限到達時の挙動設計方針
**A4**: hard ceiling のみ強制、早期停止は AI 判断維持。**根拠**: 過去実績（user 観測）で AI が 4 回程度で早期停止しており下限強制は実害なし。retry 過多の根本対処は軸 C 側（false FAIL 排除）で達成する設計優先順位。

### Q5. デフォルト retry 上限値
**A5**: 3（issue 本文の例示値 5 より厳しめ）。**根拠**: user feedback「そもそもリトライが多すぎる」「リトライしなくても通るようなものを一発で最初から出せ」方針に従い、retry 上限で根本問題を糊塗せず低値で早期 user エスカレーションを促す。

### Q6. 軸 B の扱い
**A6**: 別 draft `bfa5` として board に切り出し。**根拠**: user が baseline テスト実行方式を NG 表明し代替方式の検討が必要。スコープ肥大化を避ける原則に従う。

### Q7. 軸 C の判定設計
**A7**: ルールを AI 評価から外し機械判定に移管。**根拠**: spec 191/189/199 の誤判定履歴（issue #194 本文）から AI の diff 解釈能力が不十分と確認。攻撃ベクトル分析（A/B/C/D は `-` 行または 1 行 `+` で現れる）により機械判定で核心リスクを捕捉可能と確認。残存リスク（E/F）は既存 validation を骨抜きにしないため別 draft `6308` に分離。

### Q8. テスト戦略
**A8**: 長期保守対象のテストとして形式テスト群に配置。**根拠**: CLAUDE.md/SKILL.md「tests/（長期保守）vs specs/<spec>/tests/（spec 固有一時）」の判断基準「将来的にこのテストが壊れたら常にバグか？」に対し、本機能の判定契約は将来も保守対象となるため YES = 長期保守側。

### Q9. 上限到達時の戻り値形式方針
**A9**: 本プロジェクトに既存する retry エスカレーションパターンと同一形式に揃える。**根拠**: CLAUDE.md「新しいコードは既存のコードパターン・命名規約・モジュール構造に合わせる」方針、および AI skill プロンプト量・誤認リスクの定量比較結果。

### Q10. Brainstorm vs Decision の確認
**A10**: 本 draft の各決定事項はユーザーの明示選択を経た decision。軸 B・軸 C 残存リスクは brainstorm として board に切り出した。

## Open Questions

なし。

## Approval

- [x] User approved this draft
- 承認日: 2026-04-20
