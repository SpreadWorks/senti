# Feature Specification: 212-gate-impl-repeat-escalate

**Feature Branch**: `feature/212-gate-impl-repeat-escalate`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #215

## Goal
- gate-impl で同一 guardrail × 同一理由の FAIL が繰り返された場合、AI 呼び出しループを打ち切って人間にエスカレーションする仕組みを追加する。retry 枠の無駄消費を防ぎ、「この REQ は現 spec 記述では diff から検証不能」のループを早期に可視化する。

## Background
- Issue #211 (cc61) は gate-impl の「AI 判定ブレ」を多数決で吸収する案だったが、実データ分析で前提が崩れた。観測されたのは AI が一貫して同じ REQ を同じ理由で FAIL させているケース（specs/203-next-action-cli の REQ-11）や、段階的に異なる legitimate な問題を発見しているケースで、いずれも多数決が無効または不適だった。
- spec 210 の `NO_PROGRESS_SINCE_LAST_FAIL` は「ユーザーが spec / コードを一切変更せず同じ gate-impl を再実行した」ケースを PRE-hook で弾くが、「コードは変えたが AI は同じ REQ を同じ理由で FAIL させ続ける」ケースには働かない。本 spec は後者の穴を塞ぐ相補的な仕組みとして位置付ける。

## Scope
- gate-impl の FAIL 経路に「同一 guardrail × 同一理由の繰り返し」検出を追加する。
- FAIL 時の issue-log entry に、後続比較に足る構造情報を追加する（既存の人間向け flat 理由表示は維持）。
- 検出時は既存の ESCALATE_* 系と同じ envelope 形式で人間エスカレーションを返す。

## Out of Scope
- AI に同一性判定を委ねる方式。
- embedding 類似度や編集距離など、正規化文字列一致以外の判定手法。
- draft b833（spec-phase diff-verifiability ガード）との統合実装。
- AI 判定ブレの吸収（本件の対象外）。
- report.js など既存 consumer の表示変更。
- `no-sensitive-data-in-logs` ガードレールへの対応（masking 実装）。理由: 新規フィールド `failedEvaluations.reason` は AI が生成した gate 評価メタデータであり、ユーザー入力や secrets ではない。同内容は既存 `entry.reason` (flat 文字列) に従来どおり unmasked で永続化されている。本 spec は同データの構造化ビューを追加するのみで、log-sensitivity の表面積を増やしていない。したがって masking は本 spec のスコープ外とする。

## Constraints
- Node.js 組み込みモジュールのみを使用する（外部依存禁止）。
- gate-impl 以外の phase（draft / spec / task-spec）には影響を与えない。
- 既存 issue-log.json を壊さない（追加フィールドのみ）。
- retry.max の既定値や ESCALATE_RETRY_EXHAUSTED の発動条件を変更しない。

## Design Principles
- spec 210 の先行設計（PRE-hook / git-state 完全一致 / retry 非消費）と整合する。
- 同一性判定は外部依存ゼロの決定論的ロジックに限定する（正規化 + 文字列一致）。
- FAIL が 1 件でも前回と同一ペアと一致すれば escalate（N=1）。偶発一致のリスクよりも「早く止める」ことを優先する。
- retry 非消費は、POST 検出時の throw により registry の post-hook カウンタ更新が走らないことで実現する。

## Overview
### Modules
- `src/flow/lib/run-gate.js`: FAIL entry の記録処理に構造情報を追加、および POST 検出ロジックの配置。
- `specs/<spec>/issue-log.json`: FAIL entry のスキーマを拡張（追加フィールドのみ）。

### Data Flow
1. gate-impl が AI 評価を実行し、FAIL 判定を返す。
2. POST 検出ロジックが、新 FAIL の (guardrail, 正規化理由) ペア群と、直近の同 phase FAIL entry の同種ペア群を突き合わせる。
3. 一致ペアが 1 件でもあれば `ESCALATE_REPEATED_FAIL` を throw。issue-log への FAIL entry 追記と retry カウンタ増分は行われない（onError hook により別途エスカレーション記録のみ残る）。
4. 一致が無ければ従来どおり FAIL entry を追記し、retry カウンタを +1 する。

### Decisions
- 判定方式: 正規化後の文字列一致（trim / 連続空白を単一空白に畳み込み / 小文字化）。
- 閾値: N=1（直近の同 phase FAIL entry と比較）。
- 発動タイミング: POST 検出 → throw。
- entry 拡張: 既存 flat `reason` は維持し、構造情報を追加フィールドとして格納。
- envelope: 既存 ESCALATE_* と同形式（`ok: false`, `errors: [{ code, message, data }]`）。

## Clarifications (Q&A)
- Q1: 同一性判定方式
  - A: 正規化後の文字列一致（外部依存禁止方針および spec 210 完全一致の先行事例と整合）。
- Q2: 閾値
  - A: N=1（直近 1 件の FAIL と比較。retry.max=3 環境で 2 回目 FAIL で即検出）。
- Q3: 発動タイミング
  - A: AI 評価完了後の POST 検出 → throw。
- Q4: issue-log entry の拡張方針
  - A: 既存 flat `reason` は維持し、(guardrail, 理由) ペア列を追加フィールドで格納。既存 consumer（report.js 等）を壊さない。
- Q5: テスト戦略
  - A: 単体テストで (a) 正規化ロジック、(b) entry 書き出し時の新フィールド、(c) 検出成立 / 不成立 条件、(d) escalation 時に retry カウンタが増えないこと、を網羅。E2E は既存 gate-impl 経路が間接的に通すため追加不要。

## Alternatives Considered
- **案 1: 多数決（issue #211 当初案）**: 不採用。実データで「AI の判定ブレ」ではなく「AI の一貫した FAIL」だったため無効。
- **案 2: AI に意味的同一性判定を委ねる**: 不採用。AI 呼び出しコスト増、および sdd-forge の決定論的判定方針と不整合。
- **案 3: Levenshtein 距離 / embedding 類似度**: 不採用。外部依存禁止方針に反し、自前実装も本 spec のスコープを超える。完全一致で漏れるケースは既存の `ESCALATE_RETRY_EXHAUSTED` で二段目の救済が機能する。
- **案 4: POST 検出ではなく PRE-hook で「前回 FAIL と同じ guardrail 群なら AI 呼び出し前に打ち切り」**: 不採用。前回 FAIL の guardrail が今回もまた一致するかは AI 評価しないと分からず、PRE で判定すると過検出になる。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-22
- Notes: Issue #215 の詳細化完了。draft 5問 Q&A → spec 化 → gate PASS → ユーザー承認。

## Requirements

### P0 — 本 spec の主目的
- **REQ-1**: **When** gate-impl の AI 評価結果が FAIL を返し、かつ結果に含まれる (guardrail, 正規化理由) ペアのいずれかが、同 phase の直近 FAIL entry に記録されたペア列にも存在する場合、**the system shall** `ESCALATE_REPEATED_FAIL` エラーコードを持つエスカレーション例外を発生させ、通常の FAIL return は行わない。
- **REQ-2**: **When** REQ-1 のエスカレーション例外が発生した場合、**the system shall** その試行について retry カウンタを増分させない（registry の POST-hook カウンタ更新が走らないことで保証する）。

### P1 — 主目的を成立させる付帯要件
- **REQ-3**: **When** REQ-1 のエスカレーション例外が発生した場合、**the system shall** `{ ok: false, errors: [{ code: "ESCALATE_REPEATED_FAIL", message: <人間可読>, data: <機械可読> }] }` の envelope で結果を返す。`data` には少なくとも 当該 phase と、一致したペア列（guardrail id と理由）を含む。
- **REQ-4**: **When** gate-impl が FAIL 判定を issue-log entry に記録する時、**the system shall** 新規フィールド `failedEvaluations: [{ guardrail_id, reason }]` を entry に含める。既存の flat `reason` 文字列フィールドは従来どおり維持する。

### P2 — スコープ限定
- **REQ-5**: **When** REQ-1 の繰り返し検出を呼び出すか判定する時、**the system shall** 対象 phase を gate-impl のみとし、gate-draft / gate-spec / gate-task-spec は対象外とする。
- **REQ-6**: **When** REQ-1 の (guardrail, 理由) ペア同一性を判定する時、**the system shall** 次の正規化を施した理由文字列の完全一致のみで判定する: (a) 前後空白を trim、(b) 連続する空白類を単一半角空白に畳み込み、(c) 小文字化。意味的類似・編集距離・embedding 等は用いない。

## Acceptance Criteria
- AC-1: gate-impl を 2 回実行し、両回とも同じ guardrail が同じ理由で FAIL を返す fixture で `ESCALATE_REPEATED_FAIL` が throw される（REQ-1）。
- AC-2: AC-1 と同じ状況で retry カウンタが増分しない（flow state の `metrics[phase].gateRetry` が 1 のまま 2 回目 throw で変わらない）（REQ-2）。
- AC-3: `ESCALATE_REPEATED_FAIL` 発生時の envelope が REQ-3 の構造を満たす（`ok: false`、`errors[0].code`、`data.phase`、`data.matched`）。
- AC-4: gate-impl FAIL 時の issue-log entry に `failedEvaluations` 配列が含まれ、各要素が `guardrail_id` と `reason` を持つ（REQ-4）。
- AC-5: gate-draft / gate-spec / gate-task-spec で同様の反復 FAIL を発生させても `ESCALATE_REPEATED_FAIL` は発生しない（REQ-5）。
- AC-6: `"  Foo Bar  "` と `"foo   bar"` が同一と判定され、`"foo bar"` と `"foo baz"` が別と判定される（REQ-6）。

## Test Strategy
- 単体テスト対象:
  1. 理由文字列の正規化関数（trim / 空白畳み込み / 小文字化）。
  2. `appendIssueLogFromGateResult` が `failedEvaluations` を正しく書き出す（FAIL evaluation のみ抽出される）。
  3. 繰り返し検出ロジック: (a) 一致で throw、(b) phase 違い / PASS 挟み / 過去 FAIL なしでは throw しない、(c) 正規化差分のみのケースは一致扱い。
  4. throw 経路で registry POST-hook が呼ばれず `gateRetry` が増えないことを、state スタブで検証。
- フィクスチャ: ミニマル issue-log.json（同 phase FAIL 1 件 + 新 FAIL 入力）。
- 統合 / E2E テスト: 既存 gate-impl の CI テストが間接的に通すため追加しない。

## Implementation Targets
- `src/flow/lib/run-gate.js`:
  - FAIL 時 issue-log entry 書き出し（`appendIssueLogFromGateResult`）に `failedEvaluations` 追記。
  - 理由文字列の正規化ヘルパを追加。
  - 繰り返し検出ヘルパを追加し、gate-impl の FAIL 生成後から return 前の位置で呼び出して throw 条件を評価する。
- `tests/` 配下に上記 4 種の単体テストを追加（既存テスト配置規約に従う）。

## Open Questions
- なし
