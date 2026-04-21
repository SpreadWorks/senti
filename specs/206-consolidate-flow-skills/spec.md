# Feature Specification: 206-consolidate-flow-skills

**Feature Branch**: `feature/206-consolidate-flow-skills`
**Created**: 2026-04-21
**Status**: Draft
**Input**: Issue #199 (cac6/T7)

## Goal

SDD メインフロー skill を単一の統合 skill に再編成し、skill を「薄い dispatcher」として再設計する。cac6 分解タスク T7 の合流点。

## Scope

- メインフロー skill の統合（3→1）
- legacy メインフロー skill テンプレートの削除
- 既存プロジェクトから legacy skill を自動削除する（既存汎用 cleanup 機構を利用）
- 生成系ドキュメントテンプレ内の legacy skill 名参照を統合後名に更新
- 新 skill のパッケージ構成とアップグレード挙動を検証するテスト追加

## Out of Scope

- 補助 skill（flow-auto / flow-resume / flow-status / flow-sync）の機能変更
- 次アクション機構本体（data / schema / 問い合わせロジック）の変更
- upgrade 削除ロジック本体の変更（既存汎用実装に委任）
- 対話プロンプト群のデータ変更
- CLI コマンドインターフェースの変更

## Why This Approach

- 次アクション問い合わせ機構が既にデータ駆動化されているため、skill にステップ手順をハードコードする必要は無い。skill を「薄い dispatcher」に純化することで、将来のステップ追加時に skill を無修正で扱える（T5 で確立された extensibility contract の継承）。
- upgrade の汎用 cleanup 機構（配布テンプレートに存在しない skill を自動削除）が既に実装済みであるため、legacy 削除のための新規ロジックを書かず既存機構に委ねる方が accidental complexity を避けられる。
- alpha 方針（deprecated 期間なし・後方互換エイリアス禁止）のため、統合は legacy 即削除の形で行う。ユーザー移行コストは upgrade コマンドの冪等性で吸収する。
- 3 skill 維持 + 共通処理抽出深化は、AI の skill 選択ミス・ユーザー記憶負荷を解消しないため採用しない。

## Clarifications (Q&A)

- Q: 新 skill は pre-flow（フロー未初期化）と active-flow（フロー初期化済み）のどちらで起動されても機能するか?
  - A: 両方対応する。skill 冒頭でフロー状態を判定し、適切な初期化対話または次アクション取得に分岐する。詳細手順は実装で決定。

- Q: 次アクション機構に登録されていない step（pre-flow step / finalize 以降の git / docs 系 step）はどう扱うか?
  - A: CLI 側 run コマンドが内部で step 遷移を管理しているため、skill から明示的にハンドリングする必要はない。既存 CLI 仕様に依存する。

- Q: 既存 AGENTS.md / CLAUDE.md などの生成系ドキュメントテンプレに存在する legacy skill 名参照はどうするか?
  - A: 統合後 skill 名に更新する（R8）。プロジェクト側のすでに生成されたドキュメントはドキュメント再生成コマンドで反映される。

## Alternatives Considered

1. **3 skill 維持 + 共通処理の抽出深化**: AI の skill 選択ミス / ユーザー記憶負荷が残る。Issue 要件の「単一化」に不合致のため却下。
2. **新 skill 追加 + legacy を deprecated 保持**: alpha 方針「deprecated 期間なし」に違反するため却下。
3. **dispatcher を CLI に寄せ skill を最小化**: 対話的選択肢提示・ユーザー入力待ちは skill 責務で CLI 側では実現不可のため却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: draft で `[1] はい` 明示承認、`use auto mode` 指示で autoApprove 有効化済み

## Requirements

**P0 — 必達:**

- **R1 (skill 統合):** When the package ships the mainline SDD flow skill, it shall be a single consolidated skill that covers planning, implementation, and finalization responsibilities currently split across three skills.
- **R2 (legacy テンプレ除去):** When the consolidated skill is released, the package shall not include the three legacy mainline skill templates.
- **R3 (既存プロジェクト自動 cleanup):** When a user runs the upgrade command on an existing project after this change, the upgrade shall remove the three legacy skills from the project's installed skill directories without requiring user intervention, using only the existing cleanup mechanism.
- **R4 (dispatcher 仕様):** When the consolidated skill executes its main loop, it shall obtain each step's instructions from the CLI's data-driven next-action facility rather than encoding per-step procedures in the skill body.
- **R5 (universal guardrails):** When the consolidated skill runs any step, it shall enforce the universal guardrails already shared across the current three skills: approval waiting, no-auto-promote, worktree boundary, standardized choice format, issue-log recording, prohibition of chaining / backgrounding sdd-forge commands, and autoApprove exception handling.

**P1 — 付随:**

- **R6 (補助 skill 機能継続):** When the consolidation is applied, the auxiliary skills (auto / resume / status / sync) shall retain their user-facing contract — each responds to the same invocation, performs the same observable outcome, and remains installed at the same location after upgrade cleanup. Line-level template edits to replace legacy skill name references with the consolidated name are permitted and required.
- **R7 (進行中フロー無影響):** When a user has an active flow at the time of upgrade, the consolidation shall not break the ability to resume that flow; existing flow state, step identifiers, and next-action rules shall remain valid.
- **R8 (ドキュメント参照整合):** When documentation templates reference the legacy skill trigger names, those references shall be updated to the consolidated skill's trigger name so that generated project documentation guides users to the correct skill.

**P2 — 品質・検証:**

- **R9 (パッケージ構成テスト):** When the consolidation is released, it shall include a test asserting the presence of the new skill template and the absence of the three legacy skill templates in the shipped package.
- **R10 (cleanup 回帰防止テスト):** When the upgrade cleanup runs on a project with the three legacy skills installed and only the consolidated skill in active templates, it shall remove exactly those three legacy skills and preserve unrelated skills.

## Acceptance Criteria

- 新 package で upgrade を実行した既存プロジェクトにおいて、legacy 3 skill が installed skill ディレクトリから消失し consolidated skill が配置される
- 新規プロジェクトの setup / upgrade において consolidated skill のみが配置される
- 進行中 active flow が consolidated skill 配下で plan → impl → finalize の全 step を通過できる（step 識別子互換）
- 生成系ドキュメントテンプレが consolidated skill 名を参照している

## Test Strategy

- **パッケージ構成テスト (R9):** 新 skill テンプレートがパッケージに含まれ legacy 3 skill テンプレートが含まれないことを検証するユニットテストを追加
- **Upgrade cleanup 回帰テスト (R3 / R10):** fixture で legacy 3 skill + 無関係 skill が installed 状態の project を作り、active templates を consolidated のみに設定して upgrade を走らせ、legacy 3 のみが削除されることを確認するユニットテストを追加
- **ドキュメント参照テスト (R8):** 生成系ドキュメントテンプレが legacy skill 名を含まないことを検証するテストを追加
- **補助 skill 機能継続 (R6):** 補助 skill の起動テキスト (frontmatter の name / description) と主要なコマンド呼び出し契約が維持されていることを目視と既存の `skills-include.test.js` で担保。テンプレート本文は legacy 参照の更新に限定し、追加のリンタは導入しない。
- **手動統合テスト:** 実プロジェクトで upgrade 実行 → 新 skill 配置 → dispatcher ループによる plan → impl → finalize 全 step 通過を確認（自動化不能部分）

上限: ユニットテストは既存 `tests/unit/` 配下のテストスイートに追加し、`node tests/run.js` で 5 秒以内に完了する規模に収める。

## Open Questions

なし。実装フェーズで新たに判明した論点は issue-log に記録し、必要に応じて spec に反映する。
