# Feature Specification: 184-flow-manager-refactor

**Feature Branch**: `feature/184-flow-manager-refactor`
**Created**: 2026-04-17
**Status**: Approved
**Input**: GitHub Issue #163 (Phase 2B / parent task 1877)

## Goal

`src/lib/flow-state.js` の状態管理機能を Container 配下のサービス (`container.flowManager`) に統合し、現状バイパスされている Container キャッシュを実態として有効化する。CLI 出力・flow.json スキーマ・.active-flow フォーマットなど外部から観測できる振る舞いは一切変更しない。

## Scope

- 状態管理機能の Container サービス化 (`container.flowManager`)
- 全呼び出し側 (production code 22 ファイル) を新 API に書換
- 全テスト (~20 ファイル) を新 API に書換
- pure helper (`derivePhase`, `FLOW_STEPS`, `PHASE_MAP`, `getSpecName`, `buildInitialSteps`, `specIdFromPath` 等の純粋関数) はモジュール export として残置
- `workRoot` 引数の全廃 (Container.paths から内部解決)

## Out of Scope

- CLI コマンド出力フォーマットの変更
- flow.json / .active-flow / preparing flow ファイルのスキーマ変更
- 並行 flow の新機能追加 (既存挙動は維持)
- 別 storage backend (SQLite 等) への移行
- サブクラス個別のユニットテスト追加 (内部分割は実装詳細扱い)
- 追加のキャッシュ層導入 (Container 既存解決結果で十分)

## Clarifications (Q&A)

- Q: 範囲は段階分割か一括か?
  - A: 一括。alpha 期間で後方互換不要、Container 化は途中状態に意味がない、22 ファイルの書換は機械的で一括が安全。
- Q: Container での公開形式はファサードか個別公開か?
  - A: ファサード。`container.get("flowManager")` のみ公開、内部分割の自由度を将来も保持する。
- Q: 「git 呼び出しキャッシュ」とは何を指すか?
  - A: 新規キャッシュ層を足すことではなく、Container にすでに寄せられている `inWorktree` / `mainRoot` 解決結果を実際に使うこと。`workRoot` 引数削除によって `paths.root` 経由になり、git 再解決が自然に消える。
- Q: 既存テストはどう扱うか?
  - A: 全テストを同 PR 内で新 API に書き換え。互換シムは alpha ポリシー違反。
- Q: サブクラス個別のユニットテストを追加するか?
  - A: 追加しない。既存テストが振る舞いをカバーしており、内部分割の単体テストは実装詳細に結合し将来の再分割を阻害する。

## Alternatives Considered

| 案 | 不採用理由 |
|---|---|
| 段階分割 (Phase 2B-1/2/3) | Container 化は途中状態に意味がない。22 ファイルの書換は機械的で一括が安全 |
| 個別公開 (`flowManager` / `activeFlows` 等を別 register) | Issue 指定外。呼び出し点が分散し内部分割の自由度を失う |
| 互換シム (`flow-state.js` を re-export) | alpha ポリシー違反 |
| サブクラス個別ユニットテスト追加 | 実装詳細に結合し将来の再分割を阻害 |
| 追加キャッシュ層導入 | Container 既存解決結果で十分。新規キャッシュは並行 flow 干渉リスクを生む |

## Why This Approach

- **ファサード採用の理由**: 22 の呼び出し側にとって単一の窓口で済み、内部分割を将来再構成しても外部影響なし。Issue #163 指定方針とも一致。
- **一括書換の理由**: alpha 期間で後方互換が不要、互換シムは禁止、import 書換は機械的で IDE 補助があれば短時間で完了する。
- **追加キャッシュ層を持たない理由**: Container は既に `inWorktree` / `mainRoot` / `flowState` を init 時に解決済み。`workRoot` 引数を消せば自動的にそれらが活用され、追加レイヤを足すコストとリスク (並行 flow 干渉) を負う必要がない。
- **新規ユニットテスト不要の理由**: 振る舞い不変が前提。既存 ~20 テストが flow.json / .active-flow / preparing の挙動を網羅。内部分割の単体テストは将来の再分割を阻害する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-17
- Notes: ユーザー承認 (auto モード継続中)

## Requirements

### P1 (本リファクタの本質)

- **R1**: When production code または test code が flow.json / .active-flow / preparing flow の状態を読み書きするとき、Container 経由 (`container.get("flowManager")`) のサービス参照を通じて行われる shall。Container をバイパスした直接 import (旧 `flow-state.js` からの状態管理関数 import) は残らない shall。
- **R2**: When 呼び出し側が状態管理サービスのメソッドを呼ぶとき、`workRoot` または同等のパス引数を渡さない shall。サービスは Container.paths から必要なパスを内部解決する shall。
- **R3**: When 旧 `flow-state.js` の任意の public export が以前呼び出されていた箇所において、その機能 (flow.json I/O, .active-flow 管理, preparing flow 管理, mutation 系全般) が新サービス上で同等に呼び出せる shall。

### P2 (品質・保守)

- **R4**: When `node tests/run.js` を実行するとき、既存テスト (`tests/` 配下で `flow-state` を import している ~20 ファイル) が新 API に書き換えた状態で全て pass する shall。テストの期待値・カバー範囲は変更しない shall。
- **R5**: When 状態管理サービスを実装するとき、内部は責務別に複数のクラスに分割される shall。外部からは単一のファサードとしてのみ観測される shall。
- **R6**: When pure helper (`derivePhase`, `FLOW_STEPS`, `PHASE_MAP`, `getSpecName`, `buildInitialSteps`, `specIdFromPath` 等の純粋関数) を呼ぶとき、サービスを介さず独立したモジュール export として import 可能である shall。

### P3 (副次効果)

- **R7**: When 1 CLI コマンド実行内で同一 flow.json に対する複数の mutation が発生する (例: hook 連鎖、agent metric 集約) とき、Container 既解決の worktree/mainRoot 値が再利用され、`isInsideWorktree` / `getMainRepoPath` の git spawn が複数回発生しない shall。

## Acceptance Criteria

- **AC1 (R1, R3)**: `grep -r "from .*lib/flow-state" src/` の結果が pure helper 用モジュール (`derivePhase`, `FLOW_STEPS` 等を提供する単一モジュール) のみを参照する状態になっている。状態管理関数を直接 import する箇所はゼロ。
- **AC2 (R2)**: 新 API のメソッドシグネチャに `workRoot` 引数が一切現れない。
- **AC3 (R3)**: 旧 `flow-state.js` の全 public export (`loadFlowState`, `saveFlowState`, `mutateFlowState`, `clearFlowState`, `loadActiveFlows`, `addActiveFlow`, `removeActiveFlow`, `cleanStaleFlows`, `scanAllFlows`, `resolveActiveFlow`, `createPreparingFlow`, `loadPreparingFlow`, `deletePreparingFlow`, `listPreparingFlows`, `cleanStalePreparingFlows`, `resolvePreparingInputs`, `generateRunId`, `resolveByRunId`, `updateStepStatus`, `setRequirements`, `setTestSummary`, `updateRequirement`, `setRequest`, `setIssue`, `addNote`, `saveFinalizedAt`, `accumulateAgentMetrics`, `incrementMetric`, `flowStatePath`, `resolveWorktreePaths`) が新 API 上で同等に呼び出せる。
- **AC4 (R4)**: `node tests/run.js` が全 pass する。テスト本体の期待値変更はない (API 呼び出し形式のみ書換)。
- **AC5 (R5)**: ファサード (`flowManager`) はモジュール構造上、責務別の複数クラスに内部分割されている。外部からは単一の `container.get("flowManager")` のみが観測可能。
- **AC6 (R6)**: pure helper はサービス本体とは別モジュールに分離され、`container` を介さずに import 可能。
- **AC7 (R7)**: `sdd-forge flow set step` などの mutation を 1 コマンド内で複数回呼ぶシナリオで、`isInsideWorktree` / `getMainRepoPath` が複数回 spawn されない (Container 解決済み値を参照する)。

## Test Strategy

- **既存テスト書換 (主軸)**: `tests/` 配下で `flow-state` を import している全ファイル (~20) を新 API 呼び出し形式に書換。期待値・シナリオは維持。
- **実行コマンド**: `node tests/run.js > $WORK_DIR/logs/test-output.log 2>&1` で全テスト pass を確認。
- **新規テスト**: 追加しない (振る舞い不変が前提のため)。
- **手動確認**: `sdd-forge flow get status`, `sdd-forge flow set step <id> <status>` 等の主要コマンドが現状と同じ JSON envelope を返すことを確認。
- **配置**: 既存テストの場所を維持。新ファイル名へのリネーム (例: `flow-state-runid.test.js` → `flow-manager-runid.test.js`) は実装フェーズで判断。

## Impact on Existing Features

- **CLI**: 全コマンド振る舞い不変。出力 JSON envelope に変更なし。
- **flow.json / .active-flow / preparing flow**: フォーマット変更なし。
- **production code (22 ファイル)**: import 書換のみ。ロジック変更なし。
- **tests (~20 ファイル)**: API 呼び出し書換のみ。期待値変更なし。
- **Container init**: `container.register("flowState", loadFlowState(root))` を `container.register("flowManager", new FlowManager({ paths }))` 相当に置換。

## Open Questions

- [x] 内部サブクラスの正確な命名: `FlowStore` (flow.json I/O), `ActiveFlowRegistry` (.active-flow), `PreparingFlowStore` (preparing flow) を採用。`FlowManager` がファサード。
- [x] テストファイル名のリネーム: 該当する場合のみ `flow-state-*.test.js` → `flow-manager-*.test.js` にリネームする。
