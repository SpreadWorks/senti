# Feature Specification: 178-remove-approach-phase

**Feature Branch**: `feature/178-remove-approach-phase`
**Created**: 2026-04-15
**Status**: Draft
**Input**: GitHub Issue #150 — approach フェーズ廃止 / draft 冒頭での意図確認統合

## Goal

独立した `approach` フェーズを flow 状態モデルおよび skill から廃止し、意図確認を draft フェーズの1問目として統合する。flow 開始から最初の draft 回答までに AI が提示する質問数を、現状の「意図確認 → work-env → base-branch」の3問から「work-env → base-branch → 意図確認（=draft Q1）」の3問に再編し、最初のユーザーの実質的な対話が「何を作るか」になる UX を実現する。

## Scope

1. `src/lib/flow-state.js` の `FLOW_STEPS` / `PHASE_MAP` から `approach` を削除し、関連ヘルパーを調整する。
2. `src/flow/lib/run-prepare-spec.js` の自動 done マーク対象から `approach` を除外する。
3. `src/flow/set/` 系の `init` コマンドを拡張し、`--issue N` と `--request "..."` を受け付けて preparing-flow 状態に保存する。
4. `src/flow/lib/run-prepare-spec.js` が preparing-flow 状態から `issue` と `request` を引き継ぎ、flow.json に転記する。既存 `--issue` / `--request` 引数は引き続き動作する（preparing-flow 値は CLI 引数が未指定の場合のみ使用）。
5. `src/templates/skills/sdd-forge.flow-plan/SKILL.md` のステップ順序を新モデル（init → work-env → base-branch → draft Q1 → prepare 内部実行 → draft 残り → gate-draft）に書き直す。
6. `src/templates/skills/sdd-forge.flow-auto/SKILL.md` / `src/templates/skills/sdd-forge.flow-status/SKILL.md` の `approach` 参照を削除する。
7. `src/templates/partials/core-principle.md` など skill で include される共有パーツから `approach` の例示を除去する。
8. 既存のユニット/e2e テスト（`tests/unit/flow-state.test.js`, `tests/e2e/flow-prepare.test.js` 等、現行 FLOW_STEPS を参照するもの）を新モデルに追従させる。
9. `specs/178-remove-approach-phase/tests/` に本 spec の検証用軽量スクリプトを配置する。

## Out of Scope

- `tests/acceptance/` への新規テスト追加。
- Linear / JIRA 等、外部 issue トラッカー対応の拡張。
- `gate` / `approval` / `test` / `impl` 等、他ステップの再設計。
- 旧 `approach` を含む flow.json の自動マイグレーションコードの実装（alpha 版ポリシーに従い後方互換コードを書かない）。

## Clarifications (Q&A)

本 Q&A は draft.md 合意事項の要旨を spec スコープで再掲したもの。

- **Q1: スコープ範囲**
  - A: コア + skill 一式。FLOW_STEPS と skill 側の `approach` 参照を同一 spec で同期する。
- **Q2: 実行順序**
  - A: `init → work-env → base-branch → draft Q1 → prepare（内部）→ draft 残り → gate-draft`。prepare は Q1 承認後に skill 内で内部的に実行され、ユーザーには追加質問として見えない。
- **Q3: preparing-flow への保存方式**
  - A: `sdd-forge flow set init` を拡張し `--issue N` `--request "..."` を preparing ファイルに格納する。新コマンドは追加しない。
- **Q4: draft Q1 の形式**
  - A: AI が preparing-flow / issue 本文から解釈要約を提示し、Choice Format `[1] はい [2] 修正する [3] その他` で確認する。
- **Q5: テスト戦略**
  - A: 既存のユニット/e2e テストを追従更新。acceptance テストは新設しない。

## Alternatives Considered

- **独立 approach フェーズの質問文言短縮案**: 質問数・ターン数が減らないため UX 目的を満たさず却下。
- **prepare を draft Q1 より前に配置する案**: 内部実装としてシンプルだが、spec ディレクトリ名がユーザー意図確認前に確定する。議論の結果、prepare を Q1 承認後の内部実行に変更し、Q1 を「最初の実質対話」と位置づける案を採用した。
- **新コマンド `sdd-forge flow preparing set` 追加案**: CLI 表層が増える割に責務分離の利得が小さく、「シンプルなインターフェースに十分な実装を隠す」モジュール設計原則に沿わないため却下。

## Why This Approach

- **UX 意図との整合**: Issue #150 の要請（flow 開始の儀式感を下げ、最初の対話を「中身」に近づける）は、単に質問文言を短くするのではなく質問の配置を入れ替えることで根本的に達成される。
- **既存インフラの再利用**: preparing-flow（`.active-flow.<runId>`）機構は既に runId キーでライフサイクル管理されており、issue/request の持ち運び先として自然。新規 API 面を増やさずに済む。
- **alpha 版ポリシーとの整合**: 旧 flow.json との後方互換コードを書かず、`approach` 参照を一度に除去することで「旧フォーマットを保持しない」方針に沿う。
- **skill 同期の必然性**: `flow-auto` の再開判定は FLOW_STEPS に依存するため、コア側の変更と skill 側の変更は同一 spec でまとめる必要がある。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-15
- Notes: gate PASS 後、全 Requirements / AC / Migration Plan を確認のうえ承認

## Requirements

優先度順（P1 が最優先、P3 が後回し可）。

**P1（コア flow 状態モデルの変更）**

- R1: When 新規 flow が `sdd-forge flow prepare` によって作成される、shall 作成された flow.json の `steps` 配列に `approach` ID を持つエントリが含まれない。
- R2: When `sdd-forge flow get status` が実行される（新モデル下で作成された flow に対し）、shall 出力の `steps` に `approach` が含まれない。
- R3: When `sdd-forge flow set init` が `--issue N` または `--request "..."` 引数とともに実行される、shall それらの値が preparing-flow 状態ファイルに保存される。
- R4: When `sdd-forge flow prepare` が preparing-flow 状態を消費する、shall CLI 引数で `--issue` / `--request` が未指定の場合に限り、preparing-flow 状態に保存された値を flow.json に転記する。
- R5: When `PHASE_MAP` が参照される、shall `approach` キーを含まない。

**P2（skill 表現の再構成）**

- R6: When `sdd-forge.flow-plan` skill が起動する、shall 最初にユーザーへ提示する質問は順に (a) work-env 選択、(b) base-branch 選択、(c) draft 1問目（意図確認）である。
- R7: When draft 1問目が AI により提示される、shall AI は preparing-flow / issue から読んだ情報を要約し Choice Format `[1] はい [2] 修正する [3] その他` で確認を求める。
- R8: If draft 1問目でユーザーが `[1] はい` を選択する、shall skill は `sdd-forge flow prepare` を内部実行し spec ディレクトリ・ブランチを作成してから draft 本文作成に進む。
- R9: When `sdd-forge.flow-auto` skill が flow 再開判定を行う、shall `approach` を判定条件に含めない。
- R10: When `sdd-forge.flow-status` skill の出力例または表示テンプレートが参照される、shall `approach` を含まない。

**P3（テスト・表層整合）**

- R11: When `npm test` が新 FLOW_STEPS の下で実行される、shall 既存のユニットおよび e2e テストが全てパスする。
- R12: When `sdd-forge.flow-plan` skill の `description` フィールドが参照される、shall 文字列 `approach` を部分一致で含まない。
- R13: When `sdd-forge flow set init` が不正な引数（例: `--issue` に非数値）を受け取って失敗する、shall プロセスは非0の終了コードを返し JSON envelope の `ok` を `false` にする。
- R14: When `sdd-forge flow prepare` が preparing-flow ファイルの読み込みに失敗する、shall プロセスは非0の終了コードを返し JSON envelope の `ok` を `false` にする。

## Acceptance Criteria

- AC1: 新規 flow を開始するとき、ユーザーが最初の draft 回答を入力するまでに skill が提示する選択質問は3問（work-env、base-branch、意図確認）で、意図確認が draft phase の1問目として扱われる。
- AC2: `sdd-forge flow get status`（新モデル下の flow）を実行したとき、`data.steps` 配列に `approach` ID のエントリが含まれない。
- AC3: `sdd-forge flow set init --issue 123 --request "test"` を実行した後、同一 `runId` の preparing ファイルを読んだとき、`issue: 123` と `request: "test"` が保存されている。
- AC4: 上記 AC3 の preparing ファイルを `sdd-forge flow prepare --title X --run-id <id>`（`--issue`/`--request` 未指定）で消費したとき、生成された flow.json に `issue: 123` および `request: "test"` が転記される。
- AC5: `sdd-forge.flow-auto` skill を `branch`/`prepare-spec` が pending な状態で起動しても、`approach` done 条件判定が存在せずに flow-plan 呼び出しが発生する。
- AC6: `npm test` が exit code 0 でパスする。

## Test Strategy

- **ユニットテスト (`tests/unit/`)**: `FLOW_STEPS` から `approach` が除去されていること、`buildInitialSteps()` の出力に含まれないこと、`PHASE_MAP` に `approach` キーが存在しないことを検証する。`sdd-forge flow set init` の引数追加と preparing ファイル書き込みを検証するテストを追加する。
- **e2e テスト (`tests/e2e/`)**: `sdd-forge flow prepare` が preparing ファイルから issue/request を引き継ぎ flow.json に転記する経路を検証する。既存の flow-prepare e2e テストのうち `approach` を含むアサーションを新モデルに合わせて更新する。
- **spec 検証用軽量スクリプト (`specs/178-remove-approach-phase/tests/`)**: skill SKILL.md の該当セクション（flow-plan のステップ順序、flow-auto の分岐、flow-status の表示）に `approach` 文字列が含まれないことを静的にチェックするスクリプトを配置する。本スクリプトは `npm test` には含めず、spec 検証履歴として残す。
- **エッジケース**:
  - Q1 で `[3] その他` を選択された場合: skill は意図確認を1回だけ再質問する。2回目も `[3] その他` の場合はユーザーに制御を戻し flow を中断する（再質問ループの上限 = 1回）。
  - prepare 実行時に `DIRTY_WORKTREE` エラー: skill は現行どおり dirty-worktree prompt を提示し、preparing ファイルは保持したまま再試行を可能とする。
  - `--issue` 未指定で `--request` のみの場合: Q1 要約は `request` 本文を素材として生成する。
  - 旧 `approach` 付き flow.json を含むリポジトリでの実行: 新モデル下では `steps` 参照が失敗する可能性があるため、リポジトリ内の進行中 flow を `git grep` 相当で確認し、存在すれば事前 finalize または手動除去で対処する。

## Migration Plan

**旧 flow.json の扱い**: alpha 版方針に従い自動マイグレーションは実装しない。以下の手順で整合を保つ。

- M1: 本 spec の実装前に、リポジトリ内に進行中の他 flow が存在しないことを確認する（進行中 flow があれば先に finalize する）。
- M2: 実装コミットのメッセージに「BREAKING: removed `approach` step from FLOW_STEPS」相当の明示を含める。
- M3: 外部ユーザーの進行中 flow については、`sdd-forge upgrade` 実行後に `steps` 配列から `approach` エントリを手動で除去する必要がある旨を、実装コミットに伴う CHANGELOG 相当の記述（現状 CHANGELOG 運用がない場合はコミットメッセージ）に記載する。

**CLI 表層の互換性**:

- `sdd-forge flow set init` の `--issue` / `--request` 追加は後方互換である（既存の引数なし起動は従来どおり動作）。
- `sdd-forge flow prepare --issue N --request "..."` は引き続き動作する。preparing-flow 状態に値がある場合、CLI 引数が明示されていなければ preparing の値を採用する優先順位とする。
- `sdd-forge flow set step approach done` 等の明示的な `approach` ステップ操作は以降エラーとなる（`FLOW_STEPS` に存在しないため）。alpha 版のため deprecation warning を経由せず直接削除する。

## Open Questions

なし（draft 段階で全項目解決済み）
