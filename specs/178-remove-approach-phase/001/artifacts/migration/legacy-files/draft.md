# Draft: approach フェーズ廃止と draft 冒頭での意図確認統合

**開発種別:** enhance (UX 改善)
**目的:** 独立した `approach` フェーズを廃止し、ユーザーが flow 開始時に最初に回答する「意図確認」を draft フェーズの1問目として統合する。これにより flow 開始から最初のユーザー回答までに提示される質問数を、現状の3問（意図確認・work-env・base-branch）から1問（意図確認）に削減する。

## 背景

GitHub Issue #150 に準ずる。現状 `FLOW_STEPS` に含まれる `approach` は prepare 時に自動 done マークされる placeholder であり、ユーザー対話としての意図確認は `flow-plan` SKILL.md step 1 が担う。この意図確認が prepare 前の独立した質問として存在し、その後さらに work-env・base-branch の技術セットアップ質問が連続するため、ユーザーが「何を作るか」の議論に入るまでに3往復を要する。

## スコープ

1. flow 状態モデルから `approach` ステップを削除する
2. `sdd-forge flow set init` が issue 番号および request テキストを受け取り preparing-flow 状態に保持できるようにする
3. `sdd-forge flow prepare` が preparing-flow 状態から issue/request を引き継ぐ
4. `sdd-forge.flow-plan` skill のステップ順序を「init → work-env → base-branch → draft Q1（意図確認）→ prepare（内部実行）→ draft 残り → gate-draft」に再構成する
5. `sdd-forge.flow-auto` / `sdd-forge.flow-status` skill の `approach` 参照を新モデルに追従させる
6. 既存ユニット/e2e テストを新 FLOW_STEPS に追従させる

## Out of Scope

- acceptance テストの新設
- Linear / JIRA 等の外部 issue トラッカーへの対応拡張
- flow 状態モデルの他ステップ（gate / approval / test 等）の再設計

## Requirements

優先度順（P1 が最優先、P3 が後回し可）。

**P1（コアモデル変更）**

- R1: `approach` ステップが flow 状態モデルに存在しない。When 新規 flow を作成する、shall flow.json の steps 配列が `approach` を含まない。
- R2: When `sdd-forge flow set init` が issue 番号または request テキストを引数で受け取る、shall それらを preparing-flow 状態に保存する。
- R3: When `sdd-forge flow prepare` が preparing-flow 状態を消費する、shall 保存されている issue 番号と request テキストを flow.json に転記する。

**P2（skill 動作変更）**

- R4: When `sdd-forge.flow-plan` が起動する、shall 最初にユーザーへ提示する質問は work-env 選択、続いて base-branch 選択、続いて draft 1問目（意図確認）の順である。
- R5: When draft 1問目が実行される、shall AI は preparing-flow 状態から issue/request を読み、解釈要約を提示し、ユーザーに Choice Format で確認を求める。
- R6: If draft 1問目でユーザーが承認する、shall skill は内部的に `flow prepare` を実行し、spec ディレクトリとブランチを作成したうえで draft 本文作成を継続する。
- R7: When `sdd-forge.flow-auto` が flow 再開判定を行う、shall `approach` を判定条件に含めない。
- R8: When `sdd-forge.flow-status` が flow 状態を表示する、shall `approach` を含めない。

**P3（テスト・表層整合）**

- R9: When `npm test` が新しい FLOW_STEPS の下で実行される、shall 既存のユニット/e2e テストが全てパスする。
- R10: When ユーザーが `sdd-forge.flow-plan` の skill description を参照する、shall そこに `approach` 相当の文言が含まれず新しい対象範囲を表す文言に更新されている。

## Acceptance Criteria

- AC1: 新規 flow 開始後、ユーザーが最初の draft 回答を終えるまでに AI が提示する質問は「work-env・base-branch・意図確認」の3問となり、そのうち意図確認が draft phase の1問目として扱われる。
- AC2: 新規 flow の flow.json を目視または `sdd-forge flow get status` で確認した際、steps 配列に `approach` が含まれない。
- AC3: `--issue N` を付けて `sdd-forge flow set init` を実行した後、draft 1問目の時点で `sdd-forge flow get issue` 相当の情報が preparing-flow から取得できる（flow.json 作成前）。
- AC4: `sdd-forge.flow-auto` skill を `approach` done 前の状態で起動しても flow-plan 呼び出しが発生しない（approach 判定条件が削除されている）。
- AC5: 全プロジェクト共通の `npm test` がパスする。

## Migration Plan

**既存 flow.json の扱い**: alpha 版ポリシー（後方互換コードを書かない）に従い、旧 `approach` ステップを含む flow.json のマイグレーションコードは実装しない。代わりに以下を実施する。

- M1: リリース前に本リポジトリ内に進行中の他 flow が無いことを確認する（`find . -name flow.json` で確認）。存在する場合はリリース前に当該 flow を finalize するか、手動で `steps` 配列から `approach` エントリを除去する。
- M2: リリースノート相当のコミットメッセージに「approach ステップ削除により旧 flow.json と非互換」を明記する。
- M3: 本 spec の変更は `sdd-forge upgrade` がユーザー環境に skill 差分を配布するため、外部ユーザーの進行中 flow についても初回 upgrade 時に同等の手動対応が必要になる旨を skill README または CHANGELOG に追記する。

**CLI 表層の互換性**: `sdd-forge flow set init` への `--issue` / `--request` 追加は後方互換（既存起動は引数なしで動作）。`sdd-forge flow prepare --issue N` も引き続き動作するが、preparing-flow 経由のパスが優先される。

## Q&A

本 Q&A は意思決定済みの記録であり、ブレインストーミングではなく合意済みの決定事項として扱う。

- **Q1: 本 spec のスコープ**
  - A: コア + skill 一式（案A）。根拠: (3) 既存コードパターン — flow-auto skill が FLOW_STEPS を参照して分岐するため、コアから `approach` を除去する際に skill 側も同一 spec 内で同期する必要がある。
- **Q2: 実行順序（prepare と意図確認 Q の前後）**
  - A: 「work-env/base-branch を先行、draft Q1 はその後、prepare は Q1 承認後に内部実行」。根拠: (2) guardrail `Draft Stays at Requirements Level` / UX 観点 — 最初のユーザー対話が「中身」であるべきで、技術セットアップは機械的に先行させる方が認知負荷が低い。
- **Q3: preparing-flow への issue 番号保存**
  - A: 案A（`sdd-forge flow set init` 拡張）。根拠: (3) 既存コードパターン — `cleanStalePreparingFlows` 等の preparing-flow ライフサイクル管理が既存のため、新コマンドを増やさず既存コマンドに引数追加する方がモジュール設計原則「深いモジュール」に合致する。
- **Q4: draft Q1 の形式**
  - A: 案A（AI 解釈要約 + Choice Format）。根拠: (2) guardrail `Present Recommendations with Reasoning` / `Choice Format` — Skill 全体が Choice Format 縛りであり、自由入力より Choice の方が一貫する。
- **Q5: ステップ順序**
  - A: `init → work-env → base-branch → draft Q1 → prepare（内部）→ draft 残り → gate-draft`。根拠: (2) UX 観点 + (3) 既存コード — spec dir 名が Q1 承認後に確定するため意図変更時のリネーム発生を避けられる。
- **Q6: テスト戦略**
  - A: 案A（既存テスト更新のみ）。根拠: (1) docs/CLAUDE.md のテスト方針 — 「テスト環境構築は別 spec」の原則に沿い、acceptance 新設は本 spec スコープ外。

## Alternatives Considered

- 独立フェーズを維持しつつ質問文言を短縮する案: 質問数が減らないため目的（開始時の質問数削減）を満たさず却下。
- prepare を Q1 より先に配置する案: spec ディレクトリ名がユーザー確認前に確定するが、ディレクトリ名はラベルに過ぎず内容は draft.md が正であるため許容可。ただし Q1 を draft phase の1問目として位置づけるほうが「最初の対話＝中身」という UX 意図に沿うため、prepare を Q1 承認後の内部実行に変更して採用した。

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-04-15
- Notes: Q1〜Q6 の合意事項に基づき承認
