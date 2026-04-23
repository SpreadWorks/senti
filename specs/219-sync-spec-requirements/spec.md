# Feature Specification: 219-sync-spec-requirements

**Feature Branch**: `feature/219-sync-spec-requirements`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #233

## Goal
- finalize の retro ステップが `no requirements found in flow.json` で失敗する問題を根本解決するため、requirements の source of truth を単一化する。

## Background
- spec 207/T8 で spec.json に requirements が構造化され、`id` / `desc` / `priority` / `status` フィールドを持つスキーマが定義された。
- 一方で flow state 側にも同名の requirements 配列が残り、承認ステップで AI が手動コマンドを実行して複製するフローになっていた。
- AI が複製コマンドを実行しなかった場合、flow state 側は空のまま retro が呼ばれ、retro は状態側を参照して fail する。
- retro 自体はすでに spec.json を読み込む処理（T8 由来）を持つ。つまり二重保持は冗長であり、構造的な単一ソース化で根本解決できる。

## Scope
- retro / impl-confirm / flow get status / resume / approval プロンプト が requirements を参照する際、spec.json.requirements を唯一のソースとする。
- requirements の進捗ステータス（pending / in_progress / done / skipped）更新も spec.json 側に永続化する。
- flow state 側の requirements 保持ロジックおよび一括設定 CLI は廃止する。

## Out of Scope
- spec.schema.json の requirements スキーマ変更（現状の `id` / `desc` / `priority` / `status` を踏襲）。
- retro の評価アルゴリズム、AI プロンプト、retro.json フォーマットの変更。
- flow state ファイル内のその他フィールド（steps / metrics / notes / test など）の再設計。
- 旧 CLI の後方互換レイヤ追加（alpha 方針により不要）。

## Constraints
- 外部依存を追加しない（Node.js 組み込みのみ）。
- alpha 方針に従い、旧フォーマットとの互換コードは残さない。
- spec.schema.json のバリデーションは書き込み後も必ず通過する。
- `src/` 配下にプロジェクト固有情報を書かない。

## Design Principles
- Single Source of Truth: requirements は一箇所にのみ永続化する。
- 構造的安全性: 単一ソース化により「同期忘れ」が文法的に発生しない状態にする。
- 深いモジュール: 読み取り側は薄いラッパー越しではなく、スキーマ付きローダを直接使う。
- OOP による型表現: 読み取り結果は専用の値（既存の spec-json ローダの戻り値）として扱う。

## Overview
### Modules
- retro 実行モジュール: finalize フェーズで requirements をソースとして読み込み、diff と突き合わせて評価する。
- impl-confirm モジュール: 実装完了確認で requirements の集計を行う。
- flow status 取得モジュール: requirements 一覧と進捗集計を返す。
- resume モジュール: 再開時に requirements コンテキストを提供する。
- requirements ステータス更新モジュール: 単件のステータス変更を永続化する。
- requirements 一括設定 CLI モジュール: 廃止対象。
- approval プロンプト: requirements 転記手順を削除する。

### Data Flow
- prepare-spec → spec.json 生成（requirements は空配列で初期化）。
- spec / gate → AI が spec.json.requirements を編集・承認。
- 実装フェーズ → ステータス更新コマンドが spec.json.requirements[i].status を書き換える。
- finalize/retro → spec.json.requirements を読み、diff と照合し retro.json を生成する。
- flow get status → spec.json.requirements を読んで進捗集計を返す。

### Decisions
- 単一ソース = spec.json。理由は Background と Alternatives Considered を参照。
- flow state 側の requirements プロパティは削除する（残すと読み書き両方で意図しないパスが発生する）。
- status 未設定の既存 spec.json は `pending` として扱う。
- 廃止 CLI は明確なエラーメッセージ + 非ゼロ終了コードで応答する。
- 既存テストで spec.json fixture を前提にできるものは fixture を整備して移行する。

## Clarifications (Q&A)
- Q: flow state 側の requirements を残してミラーする選択肢は？
  - A: 不採用。alpha 方針「後方互換コードは書かない／旧フォーマットは保持せず削除」に反するため。構造的単一化を優先する。
- Q: 廃止 CLI の呼び出し元は？
  - A: 現状は approval プロンプトのみ。該当箇所を手順削除と同時に取り除く。
- Q: 既存 spec.json の status 未設定ケースは？
  - A: 読み取り時に `pending` を補完する。スキーマ enum に含まれる値なので書き戻しても問題ない。
- Q: 受け入れ基準の verifiability は？
  - A: すべて unified diff とテスト結果のみで PASS/FAIL 判定できる形にする（Acceptance Criteria を参照）。

## Alternatives Considered
- **案 A: retro の参照先だけ spec.json に切り替える（他は flow state のまま）**
  - 採用せず。状態が二重化したまま残るため、別のコマンドで同じクラスのバグが再発する余地が残る。
- **案 B: approval ステップで spec.json → flow state の requirements を自動ミラーする**
  - 採用せず。alpha 方針に反する。承認経路を通らない実装更新（CLI 単体更新）では再び乖離が起きる。
- **案 C（採用）: spec.json を単一ソースとし、flow state 側を廃止する**
  - 採用理由: (1) 既にスキーマ化・検証済み、(2) retro がすでに spec.json を読んでいる、(3) 構造的に乖離が起きない、(4) alpha 方針と整合。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-23
- Notes: Auto mode — draft gate PASS 後の構造化。Issue #233 の設計判断を踏襲。

## Requirements

- **R1 [must]**: When finalize の retro ステップが実行されるとき, retro は spec.json.requirements を唯一の requirements ソースとして参照し、flow state 側の requirements を読み取ってはならない。
- **R2 [must]**: If spec.json.requirements に 1 件以上の要件が存在し、かつ base branch と HEAD の間に diff が存在する, then retro は `no requirements found` 系のエラーを発生させず、retro.json を spec ディレクトリに生成する。
- **R3 [must]**: When 単件のステータス更新コマンドが呼ばれるとき, 指定インデックスの requirements[].status を spec.json に書き込み、spec.schema.json のバリデーションを通過する。
- **R4 [must]**: When `sdd-forge flow get status` が呼ばれるとき, 返却 JSON の `requirements` と `requirementsProgress` は spec.json.requirements のみを集計対象として算出される。
- **R5 [must]**: When requirements 一括設定 CLI（`flow set summary`）が呼ばれたとき, 非ゼロ終了コードと廃止を明示するエラーメッセージを返し、spec.json / flow state のいずれも変更しない。
- **R6 [should]**: When 実装確認コマンド・resume コマンドが requirements を参照するとき, 参照元は spec.json であり flow state ではない。
- **R7 [should]**: If spec.json.requirements の要素に `status` フィールドが未設定である, reader は欠損値を `pending` として扱い例外を発生させない。
- **R8 [should]**: When approval ステップのプロンプトが表示されるとき, プロンプト本文に requirements を追加転記するための手動コマンド実行手順は含まれない。

## Acceptance Criteria

- AC1 (R1): retro 実装のソースに対する unified diff に、flow state 側の requirements を参照するコードが残っていない（参照行が 0 件）。
- AC2 (R2): 1 件以上の requirements を持つ spec.json と、base との差分を持つコミットを用意した統合テストで retro を実行すると、retro.json が生成され、exit code が 0 である。
- AC3 (R3): 単件ステータス更新コマンドを呼ぶ単体テストで、spec.json.requirements[i].status が指定値に更新され、更新後の spec.json が spec.schema.json で valid と判定される。
- AC4 (R4): `flow get status` の単体テストで、spec.json.requirements を準備し flow state 側の requirements を空にした状態でも、返却 JSON の requirements 件数と進捗が spec.json 由来で一致する。
- AC5 (R5): 廃止 CLI を呼ぶ単体テストで exit code が非ゼロ、stderr または envelope のエラーメッセージに廃止を示す文言が含まれる。
- AC6 (R6): 実装確認・resume の単体テストで、spec.json.requirements のみを参照して集計結果が返る（flow state の同フィールドを空にしてもテストが PASS する）。
- AC7 (R7): `status` 未設定の requirements を含む spec.json を入力した単体テストで、各 reader が例外を投げず、集計上 `pending` 扱いとなる。
- AC8 (R8): approval プロンプトテンプレートの差分に、requirements 転記の手動コマンドが含まれていない（grep で 0 件）。

## Test Strategy

- **単体テスト**: retro / impl-confirm / flow get status / resume / set-req / 廃止 CLI の関数レベル挙動を spec.json fixture で検証する。既存テストは spec.json 経路に合わせて更新する。
- **統合テスト**: worktree を用意し、prepare-spec → spec.json 編集 → 実装 → finalize まで実行し retro.json 生成を確認するシナリオを既存統合テスト群に揃える形で整備する。
- **スキーマ検証**: status 書き換え後の spec.json が spec.schema.json の validate を通ることを単体テストで確認する。
- **後方互換**: 廃止 CLI の呼び出しが非ゼロ終了することをテストで保証する。
- **回帰**: `npm test` がすべて PASS する。AI 実行を伴うテスト (`tests/agent/`) は変更影響がないため通常実行不要。

## Migration Plan

- **廃止対象**: 要件リストを flow state に一括転記する CLI サブコマンド。
- **代替手段**: spec gate を通過した spec.json が単一ソースとなるため、追加転記は不要。呼び出していた手順（approval プロンプトの該当行）を削除する。
- **告知方針**: alpha 期間につき非互換変更として CHANGELOG / コミットメッセージで明示する。
- **検知**: 廃止 CLI を呼ぶと R5 により非ゼロ終了コード + エラーメッセージで応答するため silent failure にならない。
- **適用時期**: 本 spec リリースと同時。以降のバージョンでは受け付けない。

## Implementation Targets

- retro 実行モジュール (flow の retro コマンド実装)
- impl-confirm モジュール
- flow get status モジュール
- resume モジュール
- 単件ステータス更新モジュール
- 一括設定 CLI モジュール（廃止エラー応答に置換）
- flow 状態の永続化ロジック（requirements 廃止対応）
- approval プロンプトのテンプレート
- 対応する既存テスト群

## Open Questions
- [ ] なし
