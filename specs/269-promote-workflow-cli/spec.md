# Feature Specification: 269-promote-workflow-cli

**Feature Branch**: `feature/269-promote-workflow-cli`
**Created**: 2026-05-29
**Status**: Draft
**Input**: GitHub Issue #348

## Goal
experimental/workflow.js とその依存一式を src/workflow/ へ移設し、`sdd-forge workflow <subcommand>` として公式 CLI surface（docs/spec/flow と peer）に組み込む。サブコマンド（add/update/show/search/list/publish）の振る舞いは保持し、enable ゲートを撤廃して常時利用可能にする。config キーを experimental.workflow.* から workflow.* へ移行し、方法論未確定を [EXPERIMENTAL] ラベルと docs で明示する。

## Background
workflow（GitHub Projects ボードのドラフト管理 + issue 化）は実運用され実装は安定しているが、skill `sdd-forge.exp.workflow` 経由で `node experimental/workflow.js` を直接呼ぶ現状は他コマンド（sdd-forge docs/spec/flow）と異なり CLI surface として一貫性がない。一方で運用方法論（ボードに何を載せるか、Ideas ステータスからの繰り上げ昇格判断、published issue との突き合わせ）は未確定である。本 spec は CLI 一貫性問題を解決しつつ、方法論未確定性を [EXPERIMENTAL] ラベルと docs で明示する。experimental/ は npm パッケージに含まれない（files: ["src/"]）ため、src/ へ移すと配布対象になる。

## Scope
- [must] experimental/workflow.js とその依存一式（registry.js, lib/*, lib/commands/*, skills/）の src/workflow/ への移設と import パス調整
- [must] src/sdd-forge.js の NAMESPACE_SCRIPTS への workflow ルート追加
- [must] enable ゲート撤廃（workflow.js の NOT_ENABLED チェックと src/upgrade.js の条件分岐の削除）
- [must] config キー experimental.workflow.* → workflow.* 移行（config スキーマと languages.source/publish 読み取り箇所）
- [must] skill を src/skills/sdd-forge.exp.workflow/ へ移し MAIN_SKILLS_DIR から無条件配置、EXPERIMENTAL_WORKFLOW_SKILLS_DIR の削除
- [must] skill 本文の `node experimental/workflow.js` → `sdd-forge workflow` 書き換え
- [must] experimental/workflow.js と移設済みファイルの削除、experimental/AGENTS.md の改訂
- [must] experimental/tests/*.test.js の tests/unit/ への移動と import パス調整
- [should] `sdd-forge workflow --help` 冒頭への [EXPERIMENTAL] ラベル表示
- [should] README.md / CLAUDE.md(AGENTS.md) への experimental 旨の記載
- [should] 昇格条件の src/workflow/AGENTS.md への明記

## Out of Scope
- skill 名 sdd-forge.exp.workflow → sdd-forge.workflow へのリネーム（Issue が別途検討と明記）
- サブコマンドの振る舞い変更・新規サブコマンド追加
- 運用方法論（ボード章立て、Ideas ステータスからの繰り上げ昇格ルール）の確定
- experimental.workflow.* 旧 config キーの後方互換維持（alpha 版ポリシーにより非互換）

## Constraints
- 外部依存を追加しない（Node.js 組み込みのみ）。
- alpha 版ポリシーに従い後方互換コードを書かない。experimental.workflow.* 旧キーのフォールバックは設けない。
- src/ 配下にプロジェクト固有情報を埋め込まない。
- backward-compatible-cli-interface: `node experimental/workflow.js` という呼び出し経路を `sdd-forge workflow` へ置き換える破壊的変更だが、experimental かつ alpha 期間であり旧経路はボード運用 skill 経由の内部利用に限られるため alias を残さず移行する。skill 本文と experimental/AGENTS.md を同時更新して移行を案内する。
- コマンド実装は既存のコマンドクラス構造（base-command の run/execute）と src/ の OOP 型表現・カプセル化ルールを維持する。

## Design Principles
- CLI surface の一貫性（全コマンドが sdd-forge <ns> 形式）を回復する。
- experimental の性質（方法論未確定）は [EXPERIMENTAL] ラベルと docs で表現し、有効化ゲートとは分離する。
- skill 配置経路を MAIN_SKILLS_DIR の 1 本に統一する。

## Overview
### Modules
- src/workflow/ — 新設。dispatcher（workflow.js 相当）, registry.js, lib/（config, graphql, board-helpers, hash, validation, category, base-command）, lib/commands/（add/update/show/search/list/publish）。
- src/sdd-forge.js — NAMESPACE_SCRIPTS に workflow を追加。
- src/lib/config.js — config スキーマの experimental.workflow を workflow（languages のみ、enable 廃止）へ移行。
- src/lib/skills.js — EXPERIMENTAL_WORKFLOW_SKILLS_DIR を削除。
- src/upgrade.js — experimental.workflow.enable 条件分岐を削除し MAIN_SKILLS_DIR 一本化。
- src/skills/sdd-forge.exp.workflow/ — skill 移設先。
- tests/unit/ — workflow 関連テスト移設先。

### Data Flow
- sdd-forge workflow <sub> → src/sdd-forge.js が NAMESPACE_SCRIPTS で src/workflow.js（または src/workflow/index）へルーティング → registry でサブコマンド解決 → コマンドクラス run(ctx) → JSON envelope 出力。

### Decisions
- [VERIFY] enable ゲートは workflow.js:114 の NOT_ENABLED チェックと src/upgrade.js:101 の条件分岐の 2 箇所に存在。q2=B で両方を撤廃する。
- [VERIFY] config キー experimental.workflow.languages.{source,publish} は config スキーマ src/lib/config.js:270-287 と publish コマンド experimental/workflow/lib/commands/publish.js:33-34 で参照。workflow.languages.* へ移行する。enable はスキーマから削除。
- [VERIFY] skill 配置は src/lib/skills.js:16 EXPERIMENTAL_WORKFLOW_SKILLS_DIR を src/upgrade.js:101-106 が enable=true 時のみ deployProjectSkills。q3=A で src/skills/ へ移し deploySkills(MAIN_SKILLS_DIR) で無条件配置に統一し、当該 dir 定数と条件分岐を削除する。
- config 検証テスト experimental/tests/workflow-config-validation.test.js は experimental.workflow を検証している。移行後は workflow.* を検証するよう tests/unit/ で更新する。テストはシナリオ妥当（新キー検証）なので期待値を新キーへ修正する（テストを通すための修正ではなく仕様変更の反映）。
- [CORRECTION] root の AGENTS.md と CLAUDE.md は別個の通常ファイル（symlink ではない）。experimental 旨は README.md・AGENTS.md・CLAUDE.md それぞれの非生成領域（{{data}}/{{text}} ディレクティブ外）へ記載する。具体箇所は実装時に確定する。
- [VERIFY] top-level help は src/help.js の静的 LAYOUT + locale ui:help.commands.* で構成され workflow 未登録。registry.js の各 help 文字列は `Usage: workflow.js ...` をハードコード。昇格に伴い help.js LAYOUT・locale・registry usage 文字列を更新し、ユーザー向け `workflow.js` 呼称を除去する。

## Clarifications (Q&A)
- Q: 昇格後の有効化ゲートと config キー名前空間をどうするか。
  - A: enable ゲートを撤廃し常時利用可能にする。config キーを experimental.workflow.* から workflow.* へ移行する（draft q2=[2]）。
- Q: skill ソースの配置先と配置モデル。
  - A: src/skills/sdd-forge.exp.workflow/ へ移し MAIN_SKILLS_DIR から無条件配置。EXPERIMENTAL_WORKFLOW_SKILLS_DIR と条件分岐を削除（draft q3=[1]）。
- Q: 昇格条件の記載先。
  - A: src/workflow/AGENTS.md（draft q4=[1]）。

## Alternatives Considered
- enable ゲートと experimental.workflow.* キーを維持（最小変更） — 公式 CLI surface への first-class 昇格というゴールに対し opt-in ゲートが残るのは中途半端。ユーザーが常時利用可能化を選択したため不採用。
- skill を src/workflow/skills/ に置き条件付き配置を維持 — enable ゲートを撤廃した方針と矛盾し、skill 配置だけがゲートに依存し続けるため不採用。
- 昇格条件を CHANGELOG.md に記載 — リリース履歴に埋もれ継続参照に不向き。コードと co-locate する AGENTS.md を採用。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-29T08:05:05.475Z
- Notes: ユーザー承認。q2=2/q3=1/q4=1 確定、spec review blocking 2 件修正済み。R1-R12, T-1〜T-12。

## Requirements
- R1 [must]: experimental/workflow.js とその依存一式（registry.js, lib/config.js, lib/graphql.js, lib/board-helpers.js, lib/hash.js, lib/validation.js, lib/category.js, lib/base-command.js, lib/commands/*）を src/workflow/ へ移設し、import パスを src/ 構造に合わせて調整する。
- R2 [must]: src/sdd-forge.js の NAMESPACE_SCRIPTS に workflow を追加し、`sdd-forge workflow <subcommand>` が src/workflow ディスパッチャへルーティングされる。
- R3 [must]: enable ゲートを撤廃する。`sdd-forge workflow` は config に enable フラグがなくても実行でき、NOT_ENABLED エラーパスは削除される。
- R4 [must]: config キーを experimental.workflow.* から workflow.* へ移行する。config スキーマは workflow.languages.{source,publish} を定義し enable を持たない。languages.source/publish の読み取り箇所を workflow.languages.* に更新する。旧キーの後方互換は持たない。
- R5 [must]: skill ソース（SKILL.md）を src/skills/sdd-forge.exp.workflow/ へ移し、flow 系 skill と同じく MAIN_SKILLS_DIR から無条件配置する。EXPERIMENTAL_WORKFLOW_SKILLS_DIR と src/upgrade.js の enable 条件付き配置分岐を削除する。
- R6 [must]: skill 本文の `node experimental/workflow.js` 呼び出しを `sdd-forge workflow` に書き換える。languages.source 参照も workflow.languages.source に更新する。
- R7 [should]: `sdd-forge workflow --help` の冒頭（タイトル行・サブコマンド一覧の頭）に [EXPERIMENTAL] ラベルを表示する。
- R8 [should]: README.md・AGENTS.md・CLAUDE.md それぞれの非生成領域（{{data}}/{{text}} ディレクティブ外）に workflow が experimental（usage patterns may change）である旨を記載する。3 ファイルとも対象（AGENTS.md と CLAUDE.md は別個の通常ファイル）。
- R9 [should]: 昇格条件（運用方法論が docs/skill に再現可能な手順として明文化済み、サブコマンド名・フィールド名・status enum の契約が固定済み、ideas からの publish フローが skill に手順化され契約変更なしに実行可能、既存ユーザー向け breaking change を伴わない API）を src/workflow/AGENTS.md に明記する。
- R10 [must]: experimental/workflow.js と src/workflow/ へ移設したファイルを experimental/ から削除し、experimental/AGENTS.md を「workflow.js を唯一の入口とする」記述から「src/ 昇格前の試験コード置き場」へ改訂する。
- R11 [must]: experimental/tests/*.test.js を tests/unit/ へ移動し、import パスを src/workflow/ に合わせて調整する。npm test で実行・パスする。
- R12 [must]: top-level `sdd-forge help` が workflow を [EXPERIMENTAL] 公式コマンドとして列挙する（src/help.js の LAYOUT と src/locale/{en,ja} の該当キー追加）。workflow ディスパッチャ／registry の全 usage 文字列が `sdd-forge workflow <subcommand>` を使い、ユーザー向け `workflow.js` 呼称が残らない。

## Acceptance Criteria
- `sdd-forge workflow --help` が [EXPERIMENTAL] ラベル付きでサブコマンド一覧を表示する。
- `sdd-forge workflow list` 等が config に enable フラグなしで動作する（ボード設定がある前提）。
- config に workflow.languages.source を設定すると publish の翻訳元言語に反映される。experimental.workflow.* キーは検証スキーマに存在しない。
- `sdd-forge upgrade` が sdd-forge.exp.workflow skill を enable フラグに関係なく配置する。
- experimental/workflow.js が存在しない。
- experimental/AGENTS.md が workflow.js を入口とする記述を含まず、experimental/ の新しい位置づけを記載している。
- src/workflow/AGENTS.md に昇格条件が記載されている。
- tests/unit/ に移設した workflow テストが npm test でパスする。
- skill 本文が sdd-forge workflow を呼び、node experimental/workflow.js を含まない。
- README.md・AGENTS.md・CLAUDE.md の 3 ファイルとも非生成領域に experimental 旨が記載されている。
- `sdd-forge help` の出力に workflow が [EXPERIMENTAL] 公式コマンドとして表示される。
- workflow ディスパッチャ／registry の usage 文字列に `workflow.js` が残らず `sdd-forge workflow` を使う。

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Relocate workflow source to src/workflow/
  - experimental/workflow.js とその依存一式を src/workflow/ へ移設し、import パスを src/ 構造に合わせて調整する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add workflow route to dispatcher
  - src/sdd-forge.js の NAMESPACE_SCRIPTS に workflow を追加し peer コマンド化する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Remove enable gate from workflow command
  - workflow コマンド実行時の enable ゲート（NOT_ENABLED）を撤廃する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Migrate config key to workflow.*
  - config キーを experimental.workflow.* から workflow.* へ移行する。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Move skill source and deploy unconditionally
  - skill ソースを src/skills/ へ移し無条件配置に統一する。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Rewrite skill body to call sdd-forge workflow
  - skill 本文の呼び出しを新 CLI に書き換える。
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Add [EXPERIMENTAL] label to workflow help
  - `sdd-forge workflow --help` 冒頭に [EXPERIMENTAL] ラベルを表示する。
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Document experimental note in README, AGENTS.md, CLAUDE.md
  - workflow が experimental である旨を README.md・AGENTS.md・CLAUDE.md の 3 ファイルに記載する。
  - see `tasks/T-8.md` for full spec
- **T-9** [pending]: Document graduation criteria in src/workflow/AGENTS.md
  - 昇格条件を src/workflow/AGENTS.md に明記する。
  - see `tasks/T-9.md` for full spec
- **T-10** [pending]: Delete experimental workflow files and revise experimental/AGENTS.md
  - 移設元ファイルを削除し experimental/AGENTS.md を改訂する。
  - see `tasks/T-10.md` for full spec
- **T-11** [pending]: Move workflow tests to tests/unit/
  - experimental/tests/*.test.js を tests/unit/ へ移動し import を調整する。
  - see `tasks/T-11.md` for full spec
- **T-12** [pending]: Register workflow in top-level help and locales
  - top-level `sdd-forge help` に workflow を [EXPERIMENTAL] 公式コマンドとして登録する。
  - see `tasks/T-12.md` for full spec
