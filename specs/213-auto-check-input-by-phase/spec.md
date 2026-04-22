# Feature Specification: 213-auto-check-input-by-phase

**Feature Branch**: `feature/213-auto-check-input-by-phase`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #218

## Goal
- `flow set auto on` の auto-check 入力をフロー進行状況に応じて切り替え、spec 承認後や draft 記述後でも auto モードを有効化できるようにする。

## Background
- 現在の `flow set auto on` は `state.request` + `state.issue` のみを auto-check に投入するため、Issue 本文が短い場合や spec で詳細化した後でも、元の曖昧な request テキストに基づいて採点される。
- 結果、spec を詰め切った後に auto を有効化したくても hard-gate 落ちで拒否されるケースがある（本 spec のフロー立ち上げ時にも発生）。
- ユーザーからの根本方針: (1) spec 承認は人手による最上位ゲートなので、承認済みなら追加採点は不要。(2) spec 未作成でも draft が書かれていれば、draft 本文の方が採点に適している。

## Scope
- `sdd-forge flow set auto on` の入力決定ロジックをフェーズ別に切り替える。
- active flow の以下 3 ケースを識別する:
  1. spec 承認済み（approval step 完了）→ auto-check を実行せず即 autoApprove を有効化。
  2. spec 未承認だが spec ディレクトリに draft 本文が記録されている → auto-check 入力を draft 本文に切り替え。
  3. 上記いずれでもない → 従来どおり request + issue 本文で採点。
- preparing flow（pre-prepare, flow.json 作成前）では従来どおり preparing state の request + issue で採点（draft は存在しない段階のため対象外）。
- spec 承認済みスキップ時の autoCheck 記録に、通常採点と区別可能な真偽値識別子を含める。

## Out of Scope
- auto-check の採点ロジック（`runAutoCheckCore`, 静的ゲート）の変更。
- auto-check のしきい値変更。
- `flow prepare` 実行手順や skill ワークフローの変更。
- draft → spec 遷移時に auto 状態を引き継ぐ既存挙動（`run-prepare-spec` 側）の変更。
- 新規 CLI フラグの追加。

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）。
- 後方互換: CLI サブコマンド名・引数・成功時 envelope の既存フィールドは不変。挙動の変化は成功条件が緩和される方向のみ。
- src/CLAUDE.md の既存コーディングルール（過剰防御禁止、alpha 版互換コード禁止、OOP 型表現）を遵守。

## Design Principles
- **深い判定を薄い入口に隠す**: `set-auto` のトップレベル分岐には入口情報（flow state / specDir）だけ渡し、判定ロジックは 1 箇所にまとめる。
- **副作用を最小化**: spec 承認済みスキップ時は auto-check を呼ばず、ファイル I/O も draft 読込 1 回のみ。

## Overview
### Modules
- `src/flow/lib/set-auto.js` — 入力選択と auto-check スキップの分岐を担う。
- `src/flow/lib/run-auto-check.js` — 既存のまま（`runAutoCheckCore` を呼ぶだけ）。

### Data Flow
1. `SetAutoCommand.execute(ctx)` は、active flow か preparing flow かを判別する（既存ロジック）。
2. active flow の場合:
   - `flowState.steps` から `id === "approval"` のステップを探し、`status === "done"` なら **skip 経路**。
   - そうでなく、`flowState.spec` から解決した spec ディレクトリに `draft.md` が存在し読み込み可能なら、その本文を `buildInputText` の結果として採用（**draft 経路**）。
   - いずれでもなければ `buildInputText(flowState)` を従来どおり使用（**fallback 経路**）。
3. preparing flow の場合:
   - 従来どおり `buildInputText(preparingState)`（request + issue）を使用。
4. skip 経路: auto-check を呼ばず、autoCheck フィールドに識別子付き envelope（`{ skipped: true, eligible: true, reason: "spec approved" }`）を保存。`autoApprove = true`。
5. skip 以外: 従来どおり `runAutoCheckCore(container, inputText)` を実行し、結果を永続化 → eligible なら `autoApprove = true`、そうでなければ既存のエラー throw。

### Decisions
- spec 承認シグナルは `flowState.steps[id=approval].status === "done"` を正とする（flow ステップ管理が単一ソース）。
- draft 経路では静的ゲート + AI 採点を従来どおり実行する（内容がまだ変わる余地があるため、スキップ対象は承認済みのみ）。
- skip 経路でも autoCheck を書き込み、監査のため `skipped: true` を立てる（従来の `score/breakdown/staticGates` はこの場合未定義で構わない）。

## Clarifications
- Q: 「spec 承認済み」の判定に `spec.json.status` を使わないのか？
  - A: 使わない。`spec.json` はライフサイクルを flow 側と独立に持つため、同期ズレリスクがある。approval ステップの完了は flow エンジン内で一貫して管理され、gate PASS + ユーザー承認を経て done になる唯一のシグナル。
- Q: draft 本文が空の skeleton のまま（プレースホルダのみ）のケースはどう扱うか？
  - A: draft ファイルが存在すれば draft 経路を採用する。skeleton のままで採点が通らなければ従来の auto-check 結果と同様に拒否されるだけで、誤動作ではない。プレースホルダ検知のような追加ロジックは本 spec スコープ外。
- Q: preparing flow でも draft が存在する経路はありうるか？
  - A: 本 spec 時点ではない（draft は `flow prepare` 後に作成される）。将来 preparing で draft を扱う場合は別 spec で拡張する。

## Alternatives Considered
- **spec 承認済みでも auto-check を走らせる（スキップしない）**: 現状と同じく hard-gate 落ちする問題が残るため不採用。
- **入力を常に draft + request を連結**: spec 承認済みケースで採点する意味が薄いうえ、プロンプトトークン増加。不採用。
- **新規フラグ `--force` を追加して auto-check バイパス**: ユーザー要望は「自動判定で賢く通す」であり、手動バイパスは意図と異なる。不採用。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-22
- Notes: auto mode による自動承認。

## Requirements
- R1 (P1): active flow かつ `flowState.steps` 中の approval ステップが `status: done` の場合、`flow set auto on` は auto-check を実行せず `autoApprove = true` を設定する。
- R2 (P1): 上記 R1 のとき、`autoCheck` フィールドに `skipped: true` と `eligible: true` を含む envelope を保存する。従来の `score`/`breakdown`/`staticGates` は保存しないか、欠落していてよい。
- R3 (P2): active flow で approval が done ではなく、かつ `flowState.spec` から解決した spec ディレクトリに `draft.md` ファイルが存在する場合、auto-check の入力テキストとして当該ファイル本文を使用する。
- R4 (P2): R3 の条件下でも auto-check 自体（静的ゲート + AI 採点）は従来どおり実行する。
- R5 (P3): R1・R3 のいずれにも該当しない active flow / preparing flow では、auto-check 入力は従来の `buildInputText(state)`（request + issue）を使用する。
- R6 (P3): 本仕様の実装にあたり、既存 CLI サブコマンド `flow set auto` の名前・位置引数・既存オプションは変更しないものとし、成功時 envelope に含まれる既存フィールドのキー名・型は保持されるものとする。

## Authorized Test Modifications
本仕様は既存テストファイル `tests/unit/flow/set-auto.test.js` への追加・変更を伴う。以下の変更をユーザー承認済みとして明示する:
- 新規テストケースの追加（R1/R2/R3/R4 の検証）。
- 既存テストヘルパー（`createFlowState` / `createTmpProject`）の、追加テストが必要とする範囲での拡張（spec dir への draft.md 配置、approval ステップの状態注入など）。
- 既存テストの assertion は削除・弱化しない。非回帰のため既存ケースはそのまま維持する。

## Acceptance Criteria
- AC1: spec 承認済み（approval=done）の active flow で `flow set auto on` を実行すると、auto-check を呼び出さずに成功し、flow.json の `autoApprove` が `true`、`autoCheck.skipped` が `true` になる（単体テストで検証）。
- AC2: spec 未承認・draft.md が存在する active flow で、draft.md 本文が auto-check 入力に使用されたことを（モック agent が受け取ったプロンプトに draft 内容が含まれることで）確認できる（単体テストで検証）。
- AC3: draft.md が存在しない active flow では、従来どおり request + issue で auto-check が実行される（既存テスト群が PASS する）。
- AC4: preparing flow での既存テストは従来どおり PASS する。
- AC5: 既存テスト `tests/unit/flow/set-auto.test.js` の全ケースが PASS する（非回帰）。

## Implementation Targets
- `src/flow/lib/set-auto.js`
- `tests/unit/flow/set-auto.test.js`（R1/R2/R3/R4 検証ケース追加）

## Open Questions
- なし
