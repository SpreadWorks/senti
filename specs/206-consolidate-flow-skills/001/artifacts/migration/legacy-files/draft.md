---
spec: 206-consolidate-flow-skills
issue: 199
created: 2026-04-21
mode: auto (autoApprove, decision mode)
---

# Draft: consolidate flow skills (3 → 1)

**開発種別:** Enhancement (refactor)

**目的:** SDD メインフロー skill を単一の統合 skill に再編成し、skill を「薄い dispatcher」として再設計する。cac6 分解タスク T7 の合流点。

**Mode:** Decision mode (Q1 / Q2 の brainstorming は合意済み)

## 背景 / 前提

- CLI 側にはフロー各ステップの実行指示をデータ駆動で返す次アクション問い合わせ機構が既に存在する。skill にステップ手順をハードコードする必要は無い。
- upgrade 実行時に「配布テンプレート集合に存在しない skill を自動削除する」汎用 cleanup 機構が既に存在する。legacy 削除のための新規ロジックは不要。
- 現行の 3 skill は共通処理の include 分割が進んでいるが、pre-flow 対話と step 手順列挙が各 skill で重複している。

## Requirements（優先度順）

**P0 — 必達:**

- **R1 (skill 統合):** When the package ships the mainline SDD flow skill, it shall be a single consolidated skill that covers planning, implementation, and finalization responsibilities currently split across three skills.
- **R2 (legacy テンプレ除去):** When the consolidated skill is released, the package shall not include the three legacy mainline skill templates.
- **R3 (既存プロジェクト自動 cleanup):** When a user runs the upgrade command on an existing project after this change, the upgrade shall remove the three legacy skills from the project's installed skill directories without requiring user intervention, using only the existing cleanup mechanism.
- **R4 (dispatcher 仕様):** When the consolidated skill executes its main loop, it shall obtain each step's instructions from the CLI's data-driven next-action facility rather than encoding per-step procedures in the skill body.
- **R5 (universal guardrails):** When the consolidated skill runs any step, it shall enforce the universal guardrails already shared across the current three skills: approval waiting, no-auto-promote, worktree boundary, standardized choice format, issue-log recording, prohibition of chaining / backgrounding sdd-forge commands, and autoApprove exception handling.

**P1 — 付随:**

- **R6 (補助 skill 無干渉):** When the consolidation is applied, the shipped templates for auxiliary skills (auto / resume / status / sync) shall be byte-identical to the pre-change versions, and their installed locations on user projects shall not be modified by the upgrade cleanup.
- **R7 (進行中フロー無影響):** When a user has an active flow at the time of upgrade, the consolidation shall not break the ability to resume that flow; existing flow state, step identifiers, and next-action rules shall remain valid.
- **R8 (ドキュメント参照整合):** When documentation templates reference the legacy skill trigger names, those references shall be updated to the consolidated skill's trigger name so that generated project documentation guides users to the correct skill.

**P2 — 品質・検証:**

- **R9 (パッケージ構成テスト):** When the consolidation is released, it shall include a test asserting the presence of the new skill template and the absence of the three legacy skill templates in the shipped package.
- **R10 (cleanup 回帰防止テスト):** When the upgrade cleanup runs on a project with the three legacy skills installed and only the consolidated skill in active templates, it shall remove exactly those three legacy skills and preserve unrelated skills.

## Acceptance Criteria

- 新 package で upgrade 実行した既存プロジェクトにおいて、legacy 3 skill が installed skill ディレクトリから消失し consolidated skill が配置される
- 新規プロジェクトの setup / upgrade において consolidated skill のみが配置される
- 進行中 active flow が consolidated skill 配下で plan → impl → finalize 全 step を通過できる（step 識別子互換）
- 生成系ドキュメントが consolidated skill 名を参照している

## Out of Scope

- 補助 skill の機能変更
- next-action 機構本体（データ定義・スキーマ・問い合わせロジック）の変更
- upgrade 削除ロジック本体の変更（既存汎用実装に委任）
- 対話プロンプト群のデータ変更

## Impact on Existing Features

- **起動トリガー**: legacy 2 起動トリガー（plan 開始 / finalize 開始）が consolidated 1 トリガーに集約。alpha 方針のため旧名エイリアスは提供しない。
- **既存プロジェクトの installed skill**: 次回 upgrade で legacy skill が自動削除され consolidated が新規配置される。
- **生成系ドキュメント**: legacy skill 名参照箇所が consolidated に更新される。プロジェクト側の生成済みファイルはドキュメント再生成で反映。
- **active flow 継続**: 既存 flow state 形式・step 識別子・next-action rule 集合は不変。
- **CLI コマンドインターフェース**: 変更なし。

## Constraints

- 外部依存追加禁止（Node.js 組み込みのみ）
- alpha 方針: deprecated 期間なし、legacy 即削除、後方互換エイリアス禁止
- プロジェクト固有情報をパッケージ配布コードに含めない
- 新規の意味のある値型は OOP クラスで表現（本 spec では新規型の想定なし）
- テスト通過のためにテストコードを改変しない

## Edge Cases

- **upgrade 未実行プロジェクト**: legacy skill が残存。次回 upgrade で解消。冪等な upgrade に依存するためユーザー告知不要。
- **autoApprove モード**: consolidated skill でも autoApprove フラグ有効時の「質問省略 + 自動承認」挙動が継続すること。
- **worktree cleanup 後 cwd 失効**: finalize 完了後の cwd 復帰ガードが consolidated にも含まれること（既存共通部品を再利用）。
- **integration ステップを含む multi-task spec**: dispatcher が integration 系 step を既存 next-action rule に従って扱えること。

## Test Strategy

- **パッケージ構成テスト (R9)** — パッケージに consolidated skill が含まれ legacy 3 skill が含まれないこと
- **Upgrade cleanup 回帰テスト (R3 / R10)** — fixture で legacy 3 + 無関係 skill が installed 状態から、active templates を consolidated のみにして upgrade を走らせ legacy 3 のみが削除されることを確認
- **ドキュメント参照テスト (R8)** — 生成系ドキュメントテンプレが legacy skill 名を含まないことを確認
- **手動統合** — 実プロジェクトで upgrade → 新 skill 配置 → dispatcher ループ動作確認

## Alternatives Considered

1. **3 skill 維持 + 共通処理の抽出深化**: AI の skill 選択ミス / ユーザー記憶負荷が残る。Issue 要件の「単一化」に不合致のため却下。
2. **新 skill 追加 + legacy を deprecated 保持**: alpha 方針違反のため却下。
3. **dispatcher を CLI に寄せ skill を最小化**: 対話的選択肢提示・ユーザー入力待ちは skill 責務で CLI 側では実現不可のため却下。

## Future Extensibility

- 新ステップ追加時は next-action のデータ定義のみで skill 無修正
- 補助 skill 追加時も dispatcher ループに干渉しない

## Open Questions

なし。Gate 指摘があれば反映する。

## Q&A

### Q1 — Intent confirmation (decision)

- **Mode:** Decision
- **Basis:** Issue #199（明示的に 3→1 統合 / legacy 削除 / thin dispatcher を要件として列挙）
- **AI summary:** 3 skill 統合 / legacy 即削除 / upgrade 自動 cleanup / dispatcher + universal guardrails
- **User:** `[1] はい`

### Q2 — Scope proposal (decision)

- **Mode:** Decision
- **Basis:**
  - Existing code pattern: next-action 問い合わせ機構がデータ駆動化済み
  - Existing code pattern: upgrade の汎用 cleanup 機構が既存
  - Guardrail: alpha 方針「deprecated 期間なし」
  - Docs: 生成系ドキュメントテンプレが現状 legacy skill 名を参照
- **Proposal:** Pre-flow prelude + dispatcher loop + universal guardrails 構成。補助 skill / CLI 本体 / upgrade 本体は据え置き。生成系ドキュメント参照のみ同期。
- **User:** `[1] はい` + `use auto mode`（以降 autoApprove）

### Q3 (self) — 初期化前 / 初期化後の両ケース対応

- **Basis:** Existing code pattern — 現行 skill 群が 2 つの起動タイミングに分割されている（新規リクエスト時 / 実装完了時）
- **A:** consolidated skill はどちらのタイミングで起動されても正しく次アクションを判定できるものとする。詳細手順は spec / 実装フェーズで決定

### Q4 (self) — 次アクション非登録 step の扱い

- **Basis:** Existing code pattern — 一部 step は CLI 側 run コマンドが内部で step 遷移を管理し、next-action 問い合わせの対象にならない
- **A:** consolidated skill はこれらの step を明示的にハンドリングしない。既存 CLI 仕様に依存

### Q5 (self) — 生成系ドキュメント skill 名の同期

- **Basis:** Docs — 生成系ドキュメントテンプレが legacy skill 名を直接参照
- **A:** R8 として要件化

### Q6 (self) — skill と CLI prompts の所属

- **Basis:** Existing code pattern — 次アクション問い合わせが instructions 本文を payload として返す
- **A:** skill テンプレート側で step 別 prompts を重複保持しない（R4 に帰結）

### Q7 (self) — 初期化対話の所属

- **Basis:** Existing code pattern — インタラクティブ選択肢提示は skill 責務
- **A:** 初期化対話は skill 内に保持。詳細は spec / 実装フェーズで決定

## Decisions Summary

- 起動トリガー: consolidated skill 1 本に統一
- 削除: legacy 3 skill テンプレ
- 更新: 生成系ドキュメントテンプレの skill 名参照
- 無変更: 次アクション機構本体 / upgrade 本体 / 補助 skill

## User Confirmation

- [x] User approved this draft (autoApprove)
- Date: 2026-04-21
- Note: Q1 / Q2 明示承認後、`use auto mode` 指示で autoApprove 有効化。以降は self-Q&A で要件確定。
