# Feature Specification: 240-metrics-token-na-rows

**Feature Branch**: `feature/240-metrics-token-na-rows`
**Created**: 2026-04-28
**Status**: Draft
**Input**: GitHub Issue #283

## Goal
metrics token コマンドの N/A 行大量発生を修正する。agent metrics の記録配線断絶と、counter-only エントリからの空行生成の2つのバグを解消する。

## Background
flow-definition 導入（spec 226）でステップ構造が flat からnested（plan.children, impl.children）に変わったが、flow-manager.js の resolveCurrentContext はフラット検索のまま取り残された。結果として sddPhase が常に null を返し、agent.js からの accumulateAgentMetrics 呼び出しが空振りになり、agent metrics が一切記録されなくなった。同時に、normalizeMetrics が counter-only エントリから空の phase オブジェクトを生成し、全 null の N/A 行として表示される問題も発生していた。

## Scope
- resolveCurrentContext の nested ステップ対応（sddPhase 解決の修正）
- normalizeMetrics の counter-only エントリスキップ

## Out of Scope
- 過去 spec の metrics データ遡及修正
- difficulty 計算ロジックの変更
- metrics token コマンドの出力フォーマット変更

## Constraints
- 既存の CLI インターフェース（コマンド名・オプション）は変更しない
- findInProgressLeaf を再利用し、ステップ解決ロジックを definition.js に統一する

## Design Principles
- 既存のヘルパー関数を再利用し、ステップツリー走査ロジックの重複を避ける

## Overview
### Modules
- src/lib/flow-manager.js: resolveCurrentContext のステップ解決を nested 対応に修正
- src/metrics/commands/token.js: normalizeMetrics で counter-only phase を除外

### Data Flow
- agent.js → flowManager.accumulateAgentMetrics(sddPhase, usage) → flow.json metrics[] に agent エントリ追記
- metrics token → flow.json 読込 → normalizeMetrics → buildRows → 表示

### Decisions
- resolveCurrentContext で findInProgressLeaf を使い nested ステップツリーを走査する。flow-store.js が既に definition.js から同関数をインポートしており、依存方向は一貫している。
- normalizeMetrics で agent エントリがない phase は byPhase に含めない。counter データは token/cost レポートのスコープ外。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- resolveCurrentContext に独自の nested 検索を実装する — findInProgressLeaf が definition.js に既存で、get-next-action.js でも使われている。ロジック重複を避けるため不採用。
- counter データも metrics token で表示する — counter は srcRead/docsRead 等のアクティビティカウンタであり、token/cost レポートのスコープ外。表示する価値がなく、N/A 行の原因になるため不採用。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: resolveCurrentContext が nested ステップ構造で正しい sddPhase を返す。findInProgressLeaf を使い、children 内の in_progress リーフステップの id を返す。
- R2 [must]: normalizeMetrics が agent エントリのない phase を byPhase に含めない。counter-only エントリだけの phase は空オブジェクトとして残さない。
- R3 [must]: resolveCurrentContext のユニットテスト: nested ステップ構造（children 内に in_progress あり）で sddPhase が正しく解決されることを検証する。
- R4 [must]: normalizeMetrics / buildRowsFromMetrics のユニットテスト: counter-only エントリのみの配列入力で空行が生成されないことを検証する。

## Acceptance Criteria
- nested ステップ構造で resolveCurrentContext が in_progress リーフの id を sddPhase として返す
- counter-only metrics 配列から buildRowsFromMetrics が空行（全 null）を生成しない
- agent エントリを含む metrics 配列からは従来通り正しい行が生成される
- 全テストがパスする

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Fix resolveCurrentContext for nested steps
  - resolveCurrentContext で findInProgressLeaf を使い、nested ステップツリーから正しい sddPhase を解決する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Filter counter-only entries in normalizeMetrics
  - normalizeMetrics で agent エントリがない phase を出力から除外し、N/A 行の生成を防ぐ。
  - see `tasks/T-2.md` for full spec
