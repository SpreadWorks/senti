# Draft: 217-validate-explicit-run-id

**開発種別:** bugfix
**目的:** `flow set auto on|off` に存在しない `--run-id` が渡されたとき、AI 呼び出し前に structured な失敗 envelope を返して token 浪費と非構造化 `code: ERROR` を解消する。

## Scope Verification
- In scope（優先度順）:
  1. （P1 必須）`flow set auto` コマンドが明示的な `--run-id` を受け取ったとき、対応する preparing flow の存在を検証し、存在しなければ AI 呼び出し・状態変更の前に per-cause code を持つ失敗 envelope を返す
  2. （P2 必須）`on` 経路と `off` 経路の両方で同一の挙動とする
  3. （P3 必須）上記を検証するユニットテストを追加する
- Out of scope:
  - `--run-id` 未指定時の auto-detect 経路（0 件・複数件・1 件いずれも挙動維持）
  - preparing flow ストレージ層（load / mutate）の API 変更
  - `flow set auto` 以外の preparing flow 利用コマンドの検証強化
  - エラーコード体系全体の再整備（spec 213 の責務）

## Impact on Existing Features
- 影響ありの既存機能:
  - `flow set auto on --run-id <非存在>`: 以前は空入力で AI scoring が走り token を消費し、最終的に非構造化 `code: ERROR` で失敗 → 以後は AI 呼び出しなし、per-cause code で即時失敗
  - `flow set auto off --run-id <非存在>`: 以前は非構造化 `code: ERROR` → 以後は per-cause code
- 影響なし:
  - `--run-id` 未指定時の auto-detect 挙動
  - 存在する `--run-id` を渡したときの正常系（on / off 両方）
  - active flow（`flow.json` 存在）経路

## Q&A
- Q: 修正スコープは `on` のみか、`on` / `off` 両経路か？
  - A: 両方。基準: Issue #228 が spec 213 R3「per-cause code 化」の逸脱を問題視しており、`off` 経路にも同じ非構造化 `ERROR` 問題があるため、ガイドラインとの整合を取るには両方修正が必要（基準: Issue 記述 + spec 213 R3）。
- Q: 追加検証はどこまで必要か？
  - A: 既存コードパターン（auto-detect 経路で 0 件時に `NO_FLOW`、複数件時に `MULTIPLE_PREPARING_FLOWS` を返す構造）と対称に、明示指定時も per-cause code を返すケースをユニットテストで検証する（基準: 既存コードパターンとの一貫性、project CLAUDE.md「新しいコードは既存パターンに合わせる」）。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: `on` / `off` 両経路での existence 検証を承認
