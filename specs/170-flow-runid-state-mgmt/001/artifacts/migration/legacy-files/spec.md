# Feature Specification: 170-flow-runid-state-mgmt

**Feature Branch**: `feature/170-flow-runid-state-mgmt`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #137

## Goal

flow-plan の prepare 実行前（ステップ1〜2）に存在する状態追跡の空白期間を解消する。runId ベースの一時状態ファイル（`.active-flow.<runId>`）を導入し、フロー開始直後から状態を永続化する。加えて、runId を flow.json に保存し、status 解決・resume・stale cleanup を runId ベースで行えるようにする。

## Scope

1. runId の発番と `.active-flow.<runId>` の作成（`flow set init` 新コマンド）
2. flow.json スキーマへの runId 追加（`flow prepare` 時に保存）
3. `flow get status <runId>` の runId 解決ロジック追加
4. resume の runId 復元ロジック（`loadFlowState` での透過的移行含む）
5. autoApprove 適用タイミングの明文化
6. stale `.active-flow.*` の TTL ベース自動削除
7. SKILL.md テンプレートへの Step 0 追加
8. テスト

## Out of Scope

- runId 必須化（将来検討）
- `flow get status` 引数なし動作の変更
- `.active-flow` 配列フォーマットの変更
- 並列フロー切り替え UI（複数 active 時の選択コマンド等）

## Clarifications (Q&A)

- Q: `.active-flow.<runId>` のフォーマットは？
  - A: flow.json と完全同一スキーマ。未定フィールド（spec, baseBranch, featureBranch 等）は null。lifecycle フィールドで状態を区別する。

- Q: 昇格後の `.active-flow.<runId>` はどうなる？
  - A: `flow prepare` で flow.json + `.active-flow` エントリに昇格した時点で削除する。

- Q: 既存 flow.json（runId なし）の移行は？
  - A: `loadFlowState` で読み込み時に runId が無ければ自動採番して保存する（透過的移行）。

- Q: stale クリーンアップの方針は？
  - A: `flow prepare` 実行時に mtime ベースで TTL 超過（24時間）の `.active-flow.*` を自動削除。明示コマンドは追加しない。

## Alternatives Considered

- **runId なしで `.active-flow` エントリのみ拡張する案**: prepare 前の空白期間を解消できないため却下。
- **`.active-flow.<runId>` を昇格後も残す案（lifecycle を promoted に更新）**: ファイルが蓄積する。削除の方がシンプル。
- **`loadFlowState` 以外（resume のみ）で移行する案**: 全コマンドで runId を利用可能にするには透過的移行が適切。

## Why This Approach

- prepare 前の空白期間を埋める最もシンプルな方法は、prepare より前に状態ファイルを作ること
- flow.json と同一スキーマにすることでパーサー・バリデータを共有でき、昇格時の変換が不要
- 後方互換を維持しつつ段階的に runId ベースへ移行できる設計

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: 全要件承認済み。既存テスト `tests/unit/flow.test.js` の `loadFlowState reads from specs/NNN/flow.json via .active-flow` は、透過的移行（runId 自動付与）により `deepEqual` が成立しなくなるため、個別フィールド検証に変更を承認。issue-log に記録済み。

## Requirements

**P1 (必須)**

1. `sdd-forge flow set init` コマンドを追加する。
   - When: AI がフロー開始時（ステップ1の前）に実行する
   - Shall: `crypto.randomUUID()` で runId を生成し、`.sdd-forge/.active-flow.<runId>` ファイルを作成する
   - Shall: ファイルフォーマットは flow.json と同一スキーマ。`runId` フィールドに生成値、`lifecycle` フィールドに `"preparing"` を設定。`spec`, `baseBranch`, `featureBranch`, `worktree` は null。`steps` は `buildInitialSteps()` で初期化する
   - Shall: JSON envelope `{ ok: true, type: "set", key: "init", data: { runId } }` を返す
   - Shall: 成功時は exit code 0、失敗時は非ゼロ

2. flow.json スキーマに `runId` フィールドを追加する。
   - When: `flow prepare` が flow.json を作成する時
   - Shall: `runId` フィールドを flow.json に含める
   - If: `--run-id <runId>` オプションが渡された場合 → その runId を使用し、対応する `.active-flow.<runId>` を削除する
   - If: `--run-id` が渡されない場合 → 新規 runId を `crypto.randomUUID()` で採番する

3. flow.json スキーマに `lifecycle` フィールドを追加する。
   - When: `flow prepare` が flow.json を作成する時
   - Shall: `lifecycle` を `"active"` に設定する
   - When: `.active-flow.<runId>` が作成される時
   - Shall: `lifecycle` を `"preparing"` に設定する

4. `loadFlowState` で runId の透過的移行を行う。
   - When: flow.json を読み込み、`runId` フィールドが存在しない時
   - Shall: `crypto.randomUUID()` で runId を採番し、flow.json に書き戻す
   - Shall: 呼び出し元は移行を意識しない（戻り値に runId が含まれる）

5. `flow get status` に runId 引数を追加する。
   - When: `flow get status <runId>` が実行された時
   - Shall: 以下の順序で解決する（走査対象は `.active-flow` エントリに限定、最大100件で打ち切り）:
     1. `.active-flow` 経由で全 active flow の flow.json を走査し、`runId` が一致するものを返す
     2. 見つからない場合、`.sdd-forge/.active-flow.<runId>` ファイルを読む（単一ファイルの存在チェック）
     3. それでも見つからない場合、`RUN_ID_NOT_FOUND` エラーを返す（exit code 非ゼロ）
   - When: `flow get status`（引数なし）が実行された時
   - Shall: 従来の解決ロジックをそのまま使用する。動作変更なし
   - Shall: 出力に `runId` フィールドを含める

6. stale `.active-flow.*` ファイルの自動クリーンアップ。
   - When: `flow prepare` が実行された時（`cleanStaleFlows` と同タイミング）
   - Shall: `.sdd-forge/` 配下の `.active-flow.*` ファイル（最大100件まで走査）のうち、mtime が24時間を超過したものを削除する
   - Shall: `.active-flow` 本体（ポインタファイル）は削除対象外とする

**P2 (重要)**

7. resume の runId 復元。
   - When: `flow resume` が実行された時
   - Shall: 出力に runId を含める（loadFlowState の透過的移行により自動的に利用可能）

8. autoApprove ルールの明文化。
   - When: `.active-flow.<runId>` 状態（lifecycle = "preparing"）の時
   - Shall: autoApprove は常に false として扱う
   - When: `flow prepare` 成功後（lifecycle = "active"、flow.json 存在）の時
   - Shall: flow.json の `autoApprove` フィールドを正式に読み取って適用する

9. 競合ガード。
   - When: `flow set init` 実行時に、既存の `.active-flow.*` ファイル（preparing 状態）が存在する場合
   - Shall: stderr に警告メッセージを出力する（処理は続行する）

**P3 (望ましい)**

10. SKILL.md テンプレートに Step 0 を追加する。
    - When: flow-plan SKILL.md テンプレートが更新される時
    - Shall: ステップ1（アプローチ選択）の前に `sdd-forge flow set init` 実行ステップを追加する
    - Shall: `flow prepare` に `--run-id <runId>` を渡すよう指示を追加する

11. `flow set init` の出力に `runId` を返し、SKILL.md が後続コマンドに渡せるようにする。

## CLI 互換性

### 新規コマンド
- `sdd-forge flow set init` — 新規追加。既存コマンドとの衝突なし。

### 既存コマンドの変更
- `sdd-forge flow prepare`: `--run-id <runId>` オプション追加（任意）。なしでも従来通り動作。
- `sdd-forge flow get status`: 任意の位置引数 `<runId>` 追加。なしでも従来通り動作。

### SKILL.md 移行
- `src/templates/skills/` 内の flow-plan SKILL.md テンプレートに Step 0 を追加。
- `sdd-forge upgrade` で既存プロジェクトに反映。
- `flow set init` なしで `flow prepare` を直接呼んでも壊れない。

## Acceptance Criteria

1. `sdd-forge flow set init` が runId を生成し、`.sdd-forge/.active-flow.<runId>` を作成する
2. `.active-flow.<runId>` が flow.json と同一スキーマで、lifecycle="preparing"、未定フィールドが null である
3. `sdd-forge flow prepare --run-id <runId>` が runId を flow.json に保存し、`.active-flow.<runId>` を削除する
4. `sdd-forge flow prepare`（--run-id なし）が従来通り動作し、新規 runId を自動採番する
5. `sdd-forge flow get status` （引数なし）が従来通り動作し、出力に runId を含む
6. `sdd-forge flow get status <runId>` が runId ベースで状態を解決する
7. 存在しない runId で `flow get status` を呼ぶと RUN_ID_NOT_FOUND エラーが返る
8. 既存 flow.json（runId なし）を読み込むと runId が自動採番・保存される
9. `flow prepare` 実行時に24時間超過の `.active-flow.*` が自動削除される
10. `.active-flow.<runId>` 状態で autoApprove が false として扱われる

## Test Strategy

### ユニットテスト（`tests/`）
- runId 生成と `.active-flow.<runId>` ファイルの CRUD（flow-state.js の公開関数テスト）
- `loadFlowState` の透過的移行（runId なし flow.json → runId 自動付与）
- stale `.active-flow.*` の TTL ベースクリーンアップ
- `flow get status <runId>` の3段階解決ロジック
- 競合ガード（既存 preparing ファイル存在時の警告）

### spec 検証テスト（`specs/170-flow-runid-state-mgmt/tests/`）
- `flow set init` → `flow prepare --run-id` の一連のフローテスト
- `flow set init` なしでの `flow prepare` 後方互換テスト
- `flow get status` 引数なし/ありの動作確認

## Existing Test Modifications (Approved)

The following existing test was modified with user approval:

- **File**: `tests/unit/flow.test.js`
- **Test**: `loadFlowState reads from specs/NNN/flow.json via .active-flow`
- **Change**: `assert.deepEqual(loaded, state)` replaced with individual field assertions + `assert.ok(loaded.runId)`
- **Reason**: Transparent migration (Req 4) adds `runId` to all loaded flow.json, making `deepEqual` against the original (runId-less) object impossible. The test now verifies all original fields are preserved AND that runId is auto-assigned.
- **Approval**: User approved on 2026-04-13 (recorded in issue-log.json entry for implement step).

## Open Questions
- [x] TTL の24時間は適切か？ → 24時間で開始し、運用フィードバックで調整する。定数化して変更を容易にする
