---
spec: 191-preset-di-container
issue: 161
---

# Draft: 外部プリセットの DI 化

**開発種別:** enhance (リファクタ / 公開 API 設計)

**目的:** 外部プリセットが sdd-forge 内部実装に直接依存している現状を解消し、DI 契約の一本化によって sdd-forge の内部リファクタが外部 preset を壊さない構造を実現する。本 draft は「最終決定を得るための仕様書」であり、AI の批評や推奨は既に提示ずみの決定事項への追認として扱う（ブレインストーミング段階は完了）。

## Exploration (事前調査)

- **前提タスク**: #155（Container 基盤）は実装済み
- **preset の現状依存**: 内部 preset が sdd-forge 内部パスを相対 import している該当ファイルが 28 箇所確認された
- **公開 API の現状**: `sdd-forge/api` 経路は基底クラス 3 種のみを re-export しており、preset が必要とする他の機能は公開されていない
- **preset 総数**: `src/presets/` 配下に 37 プリセット（うち `base` 等の骨組みカテゴリを含む）
- **既存テスト**: preset 契約を横断検証する unit テストが 2 本存在

## Impact on Existing Features

| 領域 | 影響 |
|---|---|
| preset 読み込み経路 | 旧形式を前提とする読み込み経路は削除され、新しい依存契約のみを想定する形に置き換わる（破壊的） |
| 現行の公開 API エクスポート | 廃止。preset は依存契約経由のみで sdd-forge の機能にアクセスする（破壊的） |
| 内部 preset コード (37 プリセット) | すべて新形式に書き換え（内部変更、CLI/docs 出力は不変であることを acceptance で検証） |
| CLI コマンド / サブコマンド | 影響なし（CLI 契約は変更しない） |
| docs 生成パイプライン (scan→...→agents) | 段差なし（preset 実装差し替え後も同じ analysis を出力すること） |
| 外部 preset（ユーザー側）| sdd-forge のバージョン上げに伴い、新形式への追従が必要。`peerDependencies` で互換範囲を宣言する運用 |

## Requirements (優先度順)

### P0 — 契約の骨格

1. **When** sdd-forge が preset を読み込むとき, **the system shall** preset エントリは依存契約を引数として受け取り, 登録処理のみで完結する（登録以外のトップレベル I/O および内部 import を行わない）
2. **When** preset が sdd-forge の機能を利用するとき, **the system shall** sdd-forge 内部の実装パスに対する import 文が preset 側コードに 0 箇所である状態を維持する
3. **When** preset が親プリセットの資産を拡張するとき, **the system shall** 相対 import に頼らずに親の資産を取得する経路を依存契約側で用意する

### P1 — 移行範囲

4. **When** 本 spec を完了したとき, **the system shall** `src/presets/` 配下の 37 プリセット全てが新形式に書き換えられた状態にする
5. **When** 本 spec を完了したとき, **the system shall** 旧形式の preset loader 経路と現行 `sdd-forge/api` export を削除し, 後方互換コードを残さない
6. **When** preset がファイル走査・パス判定・言語別ソース解析など sdd-forge 内部ユーティリティを必要とするとき, **the system shall** それらを依存契約経由で提供し, preset 側で sdd-forge 内部パスを import する必要を無くす

### P2 — バージョニングと拡張

7. **When** preset と sdd-forge のバージョン整合を表現するとき, **the system shall** package.json のバージョンおよび `peerDependencies` のみを手段とし, Container 内部に独立した API バージョンフィールドを持たない
8. **When** 依存契約に新機能を追加するとき, **the system shall** 既存 preset のソースコード変更を 0 箇所で済ませられる拡張方式を採る

### P3 — 品質担保

9. **When** 本 spec の実装完了時, **the system shall** 移行前後で全 preset について `sdd-forge docs build` の出力差分がゼロであることを acceptance テストで検証する
10. **When** preset がエントリを実装したとき, **the system shall** 登録内容が契約通りであるかを検証する契約テストを全 preset に対して提供する
11. **When** 本 spec の実装完了時, **the system shall** 既存の preset 整合性テスト 2 本を合格し続ける

## Q&A

### Q1: 要件理解の確認（2026-04-17 合意）

**AI 推奨**: 本 issue の目的 + 検討ポイントを要約した理解で進める。根拠 — issue 本文に記載された背景・提案・設計ポイント 3 点をそのまま踏襲し, 前提 #155 の完了を確認済み。

ユーザー承認: [1] はい

### Q2: スコープの境界（内部 preset も対象か）

**AI 推奨**: [2] 内部・外部両方。根拠 — 内部 preset にも同じ相対 import 問題が存在し, 将来の外部配布予定があるなら契約を二重化しない方が保守コストが低い。

ユーザー選択: [2]。補足: 内部プリセットも今後外部化する予定。

### Q3: プリセットのエントリ形式

**AI 推奨**: 登録を副作用とするエントリ形式。根拠 — Q2 の決定により相対 import が禁止される中で「親 preset 継承」を実現できる方式が必要であり、エントリ時点で依存契約が渡る形態でないと成立しない。具体設計は spec フェーズで決定する。

ユーザー選択: 副作用登録方式。

### Q4: Container 公開 API の構造

**AI 推奨**: 既存 Container 実装と整合する単純な取得インターフェース。根拠 — 現行実装が既に文字列キーによる取得を採用済みであり、preset 層だけ別スタイルにすると二重仕様になる。具体仕様は spec フェーズで決定する。

ユーザー選択: 既存方式に合わせる。

### Q5: 本 spec のスコープ（どこまで含めるか）

**AI 推奨**: [3] 基盤 + 全 preset 一括移行。根拠 — CLAUDE.md の alpha ポリシー「後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する」に準拠。移行期間を持つと dead code が増える。

ユーザー選択: [3]。

### Q6: Container API バージョニング

**AI 推奨**: [1] バージョンフィールドを持たない。根拠 — alpha 期間の運用に既に定着している package.json バージョン表現で十分であり, 追加機構はデッドコードになる。

ユーザー選択: [1]。

### Q7: テスト戦略

**AI 推奨**: [3] 契約テスト + 移行前後の出力 diff 取得。根拠 — 大量ファイルの一括書き換えは回帰リスクが高く、実出力比較が最も高い信頼度を与える。

ユーザー選択: [3]。

### Q8: `sdd-forge/api` export の扱い

**AI 推奨**: [1] 削除。根拠 — Container 経由で基底クラスを取得可能となるため冗長。alpha ポリシーと整合。

ユーザー選択: [1]。

## Open Questions

実装フェーズで細部（横断ユーティリティの網羅漏れ等）が発生した場合は issue-log に記録する。

## User Confirmation

- [x] User approved this draft (2026-04-18)
