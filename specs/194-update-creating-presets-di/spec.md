# Feature Specification: 194-update-creating-presets-di

**Feature Branch**: `feature/194-update-creating-presets-di`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User request — creating_presets.md を spec 191 の factory 形式 DI 契約に合わせて更新する (ja/en 両言語)

## Goal

preset 作成ガイド (`.sdd-forge/templates/ja/docs/creating_presets.md` と `en/` 版) を spec 191 で導入した preset DI factory 契約に同期させ、ガイドを唯一の参照とする読者 (AI 含む) が現行契約どおりに新規 preset を実装できる状態にする。

## Scope

1. ガイドの全面改訂 — ja / en 両ファイルを現行契約に整合させる
2. Container キー一覧章の追加 — preset が取得する全依存を一覧化
3. 外部 preset の互換性表現の章の追加
4. 旧契約記述の除去 — 現行契約と矛盾する例・import・落とし穴項目を削除または置換
5. 静的検証テストの追加 — R1〜R9 の遵守を確認する spec ローカルテスト

## Out of Scope

- 既存 preset 実装コード (src/presets/**) の変更 — spec 191 で完了済み
- Container 設計の変更 — spec 191 で確定済み
- CLI コマンドインターフェースの変更 — 不変
- 日本語 / 英語以外の言語版の追加 — 現行 2 言語のみ対象

## Impact on Existing Features

本 spec はドキュメントのみの変更であり、既存機能への振る舞い影響は以下のとおり:

- **CLI コマンド (`sdd-forge docs build` / `sdd-forge docs scan` / `sdd-forge flow ...` 等)**: 影響なし。
- **既存ビルトインプリセットの実装・テスト**: 影響なし (spec 191 で既に現行契約へ移行済み)。
- **既存プロジェクトローカルプリセットのランタイム挙動**: 影響なし。
- **`setup` / `upgrade` コマンドが配布するテンプレート**: 対象の `creating_presets.md` 2 ファイルの内容が更新される。既存プロジェクトで `upgrade` を実行すると差分検出で該当ファイルが新内容に置換されるが、このファイルは人間/AI 向けの参考ドキュメントのため、機能的影響はない。
- **他のドキュメント生成パイプライン (scan / enrich / init / data / text / readme / agents / translate)**: 影響なし。

## Clarifications (Q&A)

draft.md の Q1〜Q10 を反映済み。主要決定:

- 改訂方針: 全面書き換え (alpha 版ポリシー「後方互換記述を残さない」に整合)
- ja / en 同期: 章構造 (見出しの数・順序・タイトル対応) を一致させる
- Container キー提示: `initContainer()` で登録される全キーを列挙する章を追加
- 外部 preset 互換性: peerDependencies のみを許可、独立 version field を禁止
- test-only helper 分離: DataSource 実装から sdd-forge 内部 import を禁止するための方針を記載

## Alternatives Considered

| 案 | 採否 | 理由 |
|---|---|---|
| 最小 patch (旧 import 例のみ差し替え) | 却下 | R1〜R5 を満たすには構造的説明も更新が必要 |
| 全面書き換え (旧契約記述をゼロに) | 採用 | alpha 版ポリシー整合、AI 読者の混乱を避ける |
| 旧契約と新契約を並記 | 却下 | alpha 版ポリシー違反、AI が迷う |
| Container キー一覧を body 内に分散記載 | 却下 | 将来キー追加時に編集箇所が散らばる |
| Container キー一覧を独立章に集約 | 採用 | 拡張時の影響範囲を局所化 |

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: autoApprove 経由で承認 (user instruction: "autoで進めてください")

## Requirements

### P0 — 契約の正確な反映

- **R1**: **When** ガイドが DataSource エントリの実装方法を説明する, **the guide shall** 現行契約の entry 形式 (factory) を唯一の方法として提示する。
- **R2**: **When** ガイドが sdd-forge 内部の基底クラス・ユーティリティを preset が取得する方法を説明する, **the guide shall** Container 経由の取得手順を提示する。
- **R3**: **When** ガイドが親 preset の資産を継承する方法を説明する, **the guide shall** Container の preset registry 経由で親クラスと親 Entry を取得する手順を提示する。

### P1 — 旧契約の除去

- **R4**: **When** ガイド本文に現行契約と矛盾する記述 (削除済み公開経路・旧 entry 形式等) が含まれるとき, **the guide shall** それらを現行契約に置換し、旧パターンの痕跡を残さない。
- **R5**: **If** 旧契約前提で書かれていた落とし穴・FAQ 項目が現行契約では該当しない, **then** その項目は削除または現行契約の落とし穴に置換されること。

### P2 — 言語同期

- **R6**: **When** ガイドが複数言語で提供される, **the guide shall** 各言語版で見出しの数・順序・タイトル対応が一致する。

### P3 — Container キーと外部 preset

- **R7**: **When** ガイドが Container 経由で取得できる依存を提示する, **the guide shall** 現行コードベースで登録される全キーを列挙する。
- **R8**: **When** ガイドが外部配布 preset の互換性表現を説明する, **the guide shall** ひとつの手段のみを許可として記載し、代替 (Container API への独立 version field 等) は禁止事項として記載する。

### P4 — 自己完結性

- **R9**: **When** 読者が他ドキュメントを参照せずガイドだけを読む, **the guide shall** 定義・配置・実装・テスト・検証の各手順をガイド内に含める。

## Acceptance Criteria

1. ja 版 (`.sdd-forge/templates/ja/docs/creating_presets.md`) と en 版 (`.sdd-forge/templates/en/docs/creating_presets.md`) が両方書き換えられている。
2. ガイド内のサンプルコードが現行 preset (base / cakephp2 / laravel / symfony / webapp 等の `src/presets/**/data/*.js`) の実装パターンと整合する。
3. ガイド内の Container キー一覧が `src/lib/container.js` の `initContainer()` で register される全キー (および `registerPreset` 経由の preset registry) を含む。
4. ガイド内に旧公開経路 (`sdd-forge/api` / `sdd-forge/presets/*` subpath import 等、spec 191 で削除されたもの) の記載が残っていない。
5. ja 版と en 版の見出しの数・順序・タイトル対応が一致する。
6. spec ローカルの静的検証テスト (`specs/194-update-creating-presets-di/tests/*`) が PASS する。

## Open Questions

実装中に判明する以下の事項は発生時点で issue-log に記録する:

- 既存落とし穴項目のうち、現行契約でも引き続き該当するが記述が古いものの扱い
- en 版翻訳時に ja 版の用語と乖離する箇所の表記統一
