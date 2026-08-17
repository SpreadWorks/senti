# Feature Specification: 205-authorize-test-edits

**Feature Branch**: `feature/205-authorize-test-edits`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #200

## Goal

gate-impl のテスト変更機械判定（spec 201 導入の `checkTestChanges`）に、spec 作者が明示的に承認した既存テスト変更を FAIL 判定から除外する opt-in 機構を追加する。契約変更系 / リファクタ系 / バグ修正系 spec で正当に発生するテスト更新を通しつつ、spec 201 の防御性（テスト無効化攻撃の検出）は維持する。

## Scope

- `src/flow/lib/run-gate.js` の `checkTestChanges` に「承認済みファイル」を伝える経路を追加する。
- `executeDiffBasedGate` の呼び出し側で spec.md から承認エントリを抽出し、`checkTestChanges` に渡す。
- spec.md の `## Authorized Existing Test Modifications` セクションから承認エントリをパースする関数を新設する。エントリ構文は 1 行フラット箇条書き `` - `<path>` — <reason (40+ chars)>``。
- task-impl と integration の両 phase で同じ仕様のバイパスを適用する。
- パースエラー（reason 文字数不足、構文違反）は gate FAIL として明示する。
- 承認エントリが diff に該当変更を持たない場合は gate 結果に警告を付与する（gate 全体は PASS）。

## Impact on Existing Features

- **`checkTestChanges` (src/flow/lib/run-gate.js:531)**: 引数に「承認済みファイルのリスト（`string[]`）」を追加する。省略時 or 空配列の場合は従来挙動と完全に同一。spec 201 系の既存ユニットテストは 2 引数呼び出しのまま動作する（新引数はデフォルト値 `[]`）。
- **`executeDiffBasedGate` (src/flow/lib/run-gate.js 周辺)**: spec.md を読んで承認リストを抽出し、`checkTestChanges` に渡す処理が追加される。承認セクションがない spec では従来挙動と同一。
- **spec.md のフォーマット**: オプショナルなセクション `## Authorized Existing Test Modifications` が 1 つ増える。未使用の spec（承認が不要な spec）には影響なし。
- **spec 201 系の既存テスト** (`tests/unit/flow/gate-test-change-check.test.js`): 既存 assertion は維持される。新引数のテストを追加するのみ。
- **spec 202 の類似 FP ケース**: spec 202 の issue-log に記録された「バックワード互換 break が gate-impl でブロック」の構造的同型ケースは、本 spec の承認機構によって救済できる。
- **対象外（無影響）**: AI guardrail 評価、lint、docs 生成パイプライン、CLI コマンド / オプション。

## Out of Scope

- AI ベースの guardrail 評価（`buildGuardrailPrompt` 等）への承認機構適用。
- gate-draft / gate-spec phase での承認機構（対象は task-impl と integration のみ）。
- lint / review phase の挙動変更。
- retry 上限値の変更（別 issue 0280 で docs 整合は済ませた）。
- 新しい CLI サブコマンド追加。
- spec.md テンプレートの skeleton 更新（承認セクションの雛形挿入）および skill 指示への書き方ガイダンス追加。

## Priority

1. **P1（必須）**: R1, R2 — バイパス機構のコア（宣言と除外）
2. **P2（必須）**: R3, R4, R6 — 適用範囲・パース堅牢性・テスト追加
3. **P3（推奨）**: R5 — 未使用エントリの警告

## Clarifications (Q&A)

- Q: バイパス機構は issue 200 の 3 案 (A/B/C) のどれを採用するか。
  - A: A（spec.md セクション宣言）。B は spec 201 の「構文解析に依存しない」原則と衝突、C は別 issue 0280 で対処済みかつ FP 自体は解消しない。
- Q: 承認粒度はファイル / 行範囲 / hunk 数のどれか。
  - A: ファイル単位。gate retry で diff 行番号がずれるため行範囲方式は書き直し負担が大きい。
- Q: エントリ構文と reason 下限。
  - A: 1 行フラット箇条書き `` - `<path>` — <reason>``、reason min 40 文字。
- Q: 適用 phase と未使用エントリの扱い。
  - A: task-impl + integration 両 phase に適用。未使用エントリは gate 結果に警告のみ付与（gate 全体は PASS）。

## Alternatives Considered

- **B: coverage 非減少判定**: テスト関数数や assertion 数の自動計測で「減っていなければ PASS」とする案。ユーザー申告なしに機械判定できる利点があるが、構文解析を要し spec 201 の設計原則と衝突する。「assertion を置換したが内容が無意味化する」攻撃を検出できない。
- **C: retry 上限引き上げ**: 上限を上げれば通るが、FP 自体は解消せず抑止も崩れる。別 issue 0280 でドキュメント整合は済ませたが、本件の解決策としては機能しない。
- **ファイル+行範囲 / hunk 数粒度**: gate retry で diff 行番号がずれるため、spec.md の書き直し負担が発生する。粒度の細かさに見合う価値がない。
- **構造化ブロック (JSON/YAML)**: spec.md 内に JSON/YAML を埋め込む表現は自然な markdown 文書から外れる。フラット箇条書きで十分な表現力が得られる。
- **AI に reason 妥当性を判定させる**: reason が文字数は満たすが内容が空虚な場合に AI 検証で救う案。本 spec では範囲外（機械判定のみでシンプルに保つ）。将来の拡張余地として残す。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: auto-approved via autoApprove mode

## Requirements

- **R1（P1）**: When spec 作者が既存テストファイルの変更を必要とする時、system shall `specs/<spec>/spec.md` の `## Authorized Existing Test Modifications` セクションに `- \`<path>\` — <reason>` 形式で「ファイルパス」と「理由テキスト（40 文字以上）」を記述することで、当該ファイルの既存行変更を gate-impl の FAIL 判定から除外できる。
- **R2（P1）**: When gate-impl の `checkTestChanges` が実行される時、system shall spec.md から承認リストを抽出し、承認済みファイルのテスト hunk（`removed >= 1` や `added === 1 && removed === 0` 相当）を FAIL 判定から除外する。未承認ファイルの既存行変更は従来通り FAIL とする。
- **R3（P2）**: When task-impl phase または integration phase の gate が実行される時、system shall R2 の承認機構を両 phase で同じ仕様で適用する。
- **R4（P2）**: When 承認セクションのパースが実行される時、system shall エントリ構文違反や reason 40 文字未満のエントリを検出し gate FAIL として明示する。エラーメッセージは違反したエントリのパスと違反理由を含む。
- **R5（P3）**: When spec.md の承認エントリが diff に該当変更を持たない時、system shall gate 結果に警告メッセージを含める（gate 全体は PASS）。警告メッセージは該当する未使用エントリのパスを含む。
- **R6（P2）**: When `npm test` が実行される時、system shall 次のテストを通過する:
  - R6.1: 承認リスト空時は従来挙動と完全一致する（spec 201 既存テストが全 PASS）。
  - R6.2: 承認リストに含まれるファイルの hunk は FAIL から除外される。
  - R6.3: 承認リストに含まれないファイルの hunk は従来通り FAIL となる。
  - R6.4: パース違反（reason 文字数不足、構文違反）を検出しエラーを返す。
  - R6.5: 未使用エントリを検出し警告メッセージを返す。

## Acceptance Criteria

- **AC-1 (R1, R2)**: `## Authorized Existing Test Modifications` セクションを持たない spec は gate-impl の挙動が従来と同一（spec 201 系の既存テストが全 PASS）。
- **AC-2 (R1, R2)**: セクションを持ち、該当ファイルで既存行変更が発生する spec は gate-impl が PASS する。
- **AC-3 (R2)**: 承認対象外のテストファイルで既存行変更が発生した場合は gate-impl が FAIL する。
- **AC-4 (R3)**: AC-2 / AC-3 のシナリオが task-impl と integration の両 phase で同じ結果になる。
- **AC-5 (R4)**: reason が 40 文字未満のエントリや構文違反のエントリが含まれる spec.md では gate-impl が FAIL し、失敗理由が違反内容を明示する。
- **AC-6 (R5)**: 承認エントリが diff に該当変更を持たない場合、gate 結果に警告が含まれ、gate 全体は PASS する。
- **AC-7 (R6)**: R6.1 〜 R6.5 の新規ユニットテストが `tests/unit/flow/` 配下に追加され、`npm test` で PASS する。

## Authorized Existing Test Modifications

- `tests/unit/flow/gate-test-change-check.test.js` — Added spec 205 bypass block then refactored it during review to extract diff-fixture helpers per the review proposal.

## Test Strategy

- **Unit tests**: `tests/unit/flow/gate-test-change-check.test.js` を拡張し、`checkTestChanges` の承認リスト引数を検証する。パースロジック（spec.md → 承認リスト抽出）のテストは分離した新規ファイルに置く。
  - R6.1 〜 R6.5 のケースを個別に記述
  - パーサのエッジケース（空セクション、コメント行混在、複数エントリ、reason 文字数境界）
- **Integration / placement tests**: `specs/205-authorize-test-edits/tests/` 配下に、spec.md の fixture を使った end-to-end パースとバイパス動作のテストを置く。
- **Manual verification**: `tests/unit/flow/gate-test-change-check.test.js` の既存テストが全 PASS し続けることを確認する（spec 201 の防御性が壊れていないことのエビデンス）。
- **AI 出力の性質テスト**: 対象外。

## Open Questions

- 承認セクションのヘッダ文言は `## Authorized Existing Test Modifications` を採用する。別案が出た場合は実装時に判断する。
- パース違反時のエラーメッセージ文言は実装時に確定する。
