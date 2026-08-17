# Draft: fix-pipeline-os-import

**開発種別:** バグ修正 (テストファイルの Node.js 標準 module 参照不備)

**目的:** baseline (main ブランチ) の受け入れテスト実行時に参照エラーで失敗している 2 テストを、テストヘルパー側の不備を解消することで PASS 状態に復旧させる。

## 背景 (事前探索)

Issue #170 の報告内容と issue-log (spec 188 で記録済み) を確認したうえで、該当ファイルの現状をコードで直接検証済み:

- `tests/acceptance/lib/pipeline.js` の冒頭 import 群に `node:os` が無く、本文中で参照されている状態であることを確認。
- 影響は該当ヘルパーを経由する受け入れテスト 2 件 (`acceptance report: pipeline traceability` / `acceptance report: JSON output`) に限定。production code 側には参照なし。

この事前探索により、追加のユーザ質問は不要と判断し、Q1 は意図確認の単一質問に限定した。

## 要求事項 (Requirements)

- **R1**: 受け入れテストヘルパー `tests/acceptance/lib/pipeline.js` が参照する Node.js 標準 module について、**参照元のファイル内で必要な import が揃っている状態** を満たすこと。
  - Trigger: `node tests/run.js` 実行時
  - Shall: 当該ヘルパー経由のテストは `ReferenceError` を出さずに実行可能でなければならない。
- **R2**: baseline で失敗していた 2 テスト (`acceptance report: pipeline traceability` / `acceptance report: JSON output`) は、本修正後 **PASS すること**。
  - Trigger: 修正適用後にテストランナーで該当 2 テストを個別実行
  - Shall: 両テストとも PASS し、`ReferenceError: os is not defined` が再発してはならない。
- **R3**: production code には変更が波及してはならない。
  - Trigger: 変更差分レビュー時
  - Shall: `src/` 配下のファイル差分は 0 でなければならない。

## Scope

- 受け入れテストヘルパー `tests/acceptance/lib/pipeline.js` における Node.js 標準 module 参照の不備解消。

## Out of Scope

- production code (`src/`) の変更
- 他テストファイル全般の import 監査 (本 spec では対象外。必要なら別 spec)
- テストフレームワークや実行環境の整備

## 制約

- **alpha 版ポリシー**: 後方互換コードは書かない。
- **CLAUDE.md**: テストを通すためにテスト期待値を書き換えてはならない — 本件はヘルパーの欠陥なので、ヘルパー側を正しい状態にすることで要件を満たす。

## 隣接する含意 (Proactive Implications)

- **リグレッション懸念**: `tests/` 配下の他ファイルで同種の import 漏れが潜んでいる可能性がある。ただし本 spec のスコープ外とし、別途監査するか Issue 化するのが望ましい。
- **CI / acceptance スイート全体**: 本修正後に acceptance スイート全体が通るかは別途確認するのが望ましいが、ユーザ選択 (Q2=[1]) により該当 2 テストのみを検証対象とする。全体実行はリグレッション段階で任意に実施可能。
- **spec 188 issue-log**: 当該 spec の issue-log に baseline 失敗として記録済み。本 spec 完了後は Issue がクローズされ、issue-log 側の扱いは現状維持で問題ない。

## エッジケース

- 追加すべき import が他にも存在する場合: 本 spec のスコープ R1 は「該当ファイルが必要とする標準 module が揃う」状態を要求するため、付随的に発見された不足 import も最小範囲で合わせて解消してよい。ただし波及範囲を拡大する場合は Out of Scope に触れるので、その時点でユーザに確認する。

## 検証戦略

- テストランナーで該当 2 テストを実行し PASS を確認する。
- 追加の新規テストは作成しない: 既存 2 テストの復旧自体が本修正の検証条件そのものであり、別途ユニットテストを足しても冗長。

## 代替案

- **代替1 (不採用)**: 標準 module 参照を排し、テンポラリディレクトリ取得を別手段 (例: 環境変数) で実装する。
  - 却下理由: 既存実装の意図は標準 module 利用であり、本件は欠陥補修であって実装方針の変更ではない。
- **採用**: 不足している import を補う最小修正。
  - 採用理由: Issue #170 の指定、最小影響範囲、CLAUDE.md の「過剰な変更を避ける」方針に整合。

## 将来拡張性

- 本修正は既存コードの欠陥補修であり、将来機能追加・変更への制約を生まない。

## Q&A

### Q1: Issue 意図確認 (事前探索後の単一確認)
- **AI 推奨と根拠**: Issue #170 の記述・spec 188 issue-log・ファイル現状 (code 読取) から、修正意図は明確。ユーザには「AI の解釈が Issue と一致しているか」のみを確認した (Explore Before Asking 準拠)。
- **User**: [1] はい

### Q2: 検証方法
- **AI 推奨と根拠**: 本修正は該当 2 テストの復旧が目的で、影響範囲もそこに限定される。全体テストはリグレッション検出には価値があるが、本 spec のスコープとしては該当 2 テストで十分。推奨は [1]。
- **User**: [1] 該当 2 テストのみを走らせて PASS 確認

## Approval

- [x] User approved this draft
- 承認日: 2026-04-18
