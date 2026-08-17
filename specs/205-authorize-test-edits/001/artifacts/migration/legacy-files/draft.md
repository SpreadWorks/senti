# Draft: authorize-test-edits

**開発種別:** 機能追加（gate-impl のバイパス機構）

**目的:** gate-impl のテスト変更機械判定（spec 201 導入）に、spec 作者が明示的に承認した既存テスト変更を FAIL 判定から除外する opt-in 機構を追加する。契約変更系 / リファクタ系 / バグ修正系 spec で正当に発生するテスト更新を通しつつ、「テスト無効化で通す」攻撃への防御性は維持する。

## Impact on Existing Features

- **gate-impl のテスト変更検出**: 既存の機械判定は維持。spec 作者が明示した承認リストがあるファイルに限り、既存行変更を FAIL から除外する追加判定が加わる。承認リストが無い場合は従来挙動と同一。
- **spec.md のフォーマット**: オプショナルなセクションが 1 つ増える。未使用の spec には影響なし。
- **既存テスト**: テスト変更検出ロジックのユニットテスト（spec 201 系）の期待動作は維持される。
- **対象外**: AI ベースの guardrail 評価、lint、draft / spec フェーズの gate 挙動、retry 上限値。
- **spec 202 の類似ケースへの波及**: spec 202 の issue-log に同種の FP（バックワード互換 break が gate-impl でブロック）が記録されており、本 spec の承認機構は同類ケースも救済する。

## Priority

1. **P1（必須）**: R1, R2 — バイパス機構のコア（宣言と除外）
2. **P2（必須）**: R3, R4 — 適用範囲とパース堅牢性
3. **P3（推奨）**: R5 — 未使用エントリの警告

## Q&A

### Q1: バイパスの機構

**Ask:** issue 200 が挙げる 3 案（A: spec.md セクション宣言 / B: coverage 非減少判定 / C: retry 上限引き上げ）のどれを採用するか。

**Answer:** **A: spec.md セクション宣言方式**。

**Recommendation rationale:** spec 201 が採用する「テスト変更検出は構文解析に依存しない」原則と整合する。B は coverage 計測にテストコードの構文解析を要し、その原則と衝突する。C は別 issue (0280) で既に対処済み（実態と整合する方向でドキュメント修正済み）であり、本件の FP 自体は解消しない。A は人間による明示 opt-in と書くコストで抑止力を担保しつつ、機械判定できる形で実装できる。

### Q2: バイパス粒度

**Ask:** 承認エントリの粒度（ファイル / ファイル+行範囲 / ファイル+hunk 数）。

**Answer:** **ファイル単位**。

**Recommendation rationale:** gate-impl の retry ループで diff 行番号が変動するため、行範囲方式は頻繁な書き直しを要する。hunk 数上限は spec 204 の実害ケース（2 ファイル × 1 hunk）に対して過剰。抑止は reason テキストの書くコストで確保する。

### Q3: エントリ構文と reason 最小文字数

**Ask:** spec.md に書くエントリの構文と reason 下限。

**Answer:** 1 行形式のフラット箇条書き、reason min **40 文字**。

**Recommendation rationale:** 1 行 1 エントリの表記は markdown として読みやすく、spec 201 の「構文解析に依存しない」原則と整合する形でパース可能。40 文字は既存 issue-log の `reason` 下限 20 文字より厳しく設定し、ガードレール無効化申告としての抑止を強める。埋め草防止として 80 文字まで上げる選択肢もあったが、記述負担とのバランスで 40 文字を採用。

### Q4: 適用範囲と未使用エントリの扱い

**Ask:** バイパスを効かせる phase と、spec.md に書いたが diff に該当変更のない未使用エントリの扱い。

**Answer:** **task-impl と integration の両 phase** に適用。未使用エントリは **WARN**（gate 全体は PASS）。

**Recommendation rationale:** テスト変更検出は両 phase で動く同一ロジックであり、spec 202 の issue-log にも両 phase 相当の FP 実害がある。片方のみ対応は整合性を欠く。未使用エントリは保守時のゴミ検出に有用だが、gate を落とすほどのリスクではない。

## Requirements

- **R1（P1）**: When spec 作者が既存テストファイルの変更を必要とする時、system shall spec.md の指定セクションに「ファイルパス」と「理由テキスト」を記述することで、当該ファイルの既存行変更を gate-impl の FAIL 判定から除外できる。理由テキストは 40 文字以上を必須とする。
- **R2（P1）**: When gate-impl のテスト変更検出が実行される時、system shall spec.md から承認リストを抽出し、承認済みファイルの変更は FAIL 判定から除外する。未承認ファイルの既存行変更は従来通り FAIL とする。
- **R3（P2）**: When task-impl または integration の gate が実行される時、system shall R2 の承認機構を両 phase で同じ仕様で適用する。
- **R4（P2）**: When 承認セクションの読み取りが実行される時、system shall reason の文字数不足やエントリ構文の違反を gate FAIL として明示する。違反を黙って無視する挙動は禁止する。
- **R5（P3）**: When spec.md の承認エントリが diff に該当変更を持たない時、system shall gate 結果に警告メッセージを含める（gate 全体は PASS）。

## Acceptance Criteria

- **AC-1 (R1, R2)**: spec.md に承認セクションを持たない spec は gate-impl の挙動が従来と同一である（spec 201 系の既存テストが全 PASS）。
- **AC-2 (R1, R2)**: spec.md に承認セクションを持ち、該当ファイルで既存行変更が発生する spec は gate-impl が PASS する。
- **AC-3 (R2)**: 承認対象外のテストファイルで既存行変更が発生した場合は gate-impl が FAIL する。
- **AC-4 (R3)**: AC-2 / AC-3 のシナリオが task-impl と integration の両 phase で同じ結果になる。
- **AC-5 (R4)**: reason が 40 文字未満のエントリや構文違反のエントリが含まれる spec.md では gate-impl が FAIL し、失敗理由が違反内容を明示する。
- **AC-6 (R5)**: 承認エントリが diff に該当変更を持たない場合、gate 結果に警告が含まれ、gate 全体は PASS する。

## Alternatives Considered

このセクションは **Decision Mode** で記述する。issue 200 本文に列挙された 3 案および spec 204 実装中のセッション対話を通して、ユーザーが各案を「決定のための選択肢」として提示し、Q1〜Q4 で明示的に採否を選択した。ブレインストーミング段階の未整理アイデアではなく、確定した方針としての代替案記録である。

- **B: coverage 非減少判定**: テスト関数数や assertion 数の自動計測で「減っていなければ PASS」とする案。ユーザーの申告なしに機械判定できる利点があるが、構文解析を要し spec 201 の「テスト変更検出は構文解析に依存しない」原則と衝突する。また「assertion を置換したが内容が無意味になる」攻撃を検出できない。
- **C: retry 上限引き上げ**: 上限を上げれば通るが、FP 自体は解消せず抑止も崩れる。別 issue (0280) でドキュメントの実態整合は済ませたが、本件の解決策としては機能しない。
- **ファイル+行範囲 / hunk 数粒度**: gate-impl の retry で diff 行番号がずれるため、spec.md の書き直し負担が発生する。粒度の細かさに見合う価値がない。
- **構造化ブロック (JSON/YAML)**: 厳格だが spec.md の自然な markdown 表現から外れる。フラット箇条書きで十分な表現力が得られる。

## Open Questions

- 承認セクションのヘッダ文言と違反メッセージ文言は実装時に確定する。
- spec.md への該当セクション追加ガイダンス（skill 側の指示追加）は、本 spec で行うか別 spec にするかは実装時の判断とする。

## User Confirmation

- [x] User approved this draft
- Date: 2026-04-21
