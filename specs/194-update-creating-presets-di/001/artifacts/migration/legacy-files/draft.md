# Draft: update-creating-presets-di

**開発種別:** documentation update

**目的:** preset 作成ガイド (`.sdd-forge/templates/ja/docs/creating_presets.md` と `en/` 版) を spec 191 で導入した preset DI factory 契約に同期させ、ガイドを唯一の参照とする読者が誤った契約で preset を実装することを防ぐ。

## Impact on Existing Features

- 既存のランタイム動作・CLI コマンド・プリセット実装・テストへの影響なし (ドキュメントのみ変更)。
- 既存プリセット (src/presets/**) は spec 191 で既に factory 形式に移行済み。本 spec はその契約を正としてガイドに反映する。

## Requirements (Priority)

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

## Q&A

**Brainstorm vs. Decision 区分**: 以下の Q&A は draft 作成前に選択肢をブレインストーミングした上で採用案を決定した結果である。採用の根拠は対応する参照元 (spec 191 / `src/CLAUDE.md` / 既存 preset の実装パターン / プロジェクト `CLAUDE.md` の alpha 版ポリシー) に限定する。

### Q1: 完成度の基準

**A:** AI エージェントがこのガイドだけを読んで新規 preset を実装できる状態を到達点とする。基準は R1〜R9 の要件で検証する。
**根拠:** user Q1 回答「AI がこのドキュメントを読んで間違いなく実装できる文章にする」、および spec 191 で移行完了した既存 preset が参考実装として存在。

### Q2: 複数言語の扱い

**A:** 正とする言語で編集し、他言語は章構造を同期させる方針。
**根拠:** `src/CLAUDE.md` の「契約変更は全言語を同じコミット内で必ず更新する」MUST ルール。

### Q3: Container キーの網羅

**A:** 現行コードベースで登録される全キーを一覧として提示する (R7)。
**根拠:** spec 191 の Container 設計方針。preset が sdd-forge 内部パスに直接 import しないために、キー一覧が唯一の取得経路になる。

### Q4: 親 preset 継承の扱い

**A:** 親クラスおよび親 Entry を Container の preset registry 経由で取得する方針を採用する。具体的な取得経路は spec 以降で決定する。
**根拠:** 既存 webapp-chain (cakephp2 / laravel / symfony) の継承パターン。

### Q5: test-only helper の扱い

**A:** DataSource 実装ファイルは sdd-forge 内部に対する直接依存を禁止される。テスト専用ヘルパーの配置方針は spec 以降で決定する。
**根拠:** spec 191 の R2「preset から sdd-forge 内部パス import 0 件」制約。

### Q6: 旧 entry 形式の扱い

**A:** 旧形式は spec 191 で loader 側の互換分岐が削除されているため、現行ガイドでは禁止として明示し、代替経路は残さない。
**根拠:** プロジェクト `CLAUDE.md` の alpha 版ポリシー「後方互換コード・非推奨パスを保持せず削除」。

### Q7: 外部 preset の互換性表現

**A:** 単一の公式手段を提示し、代替 (Container API への独立 version field 等) を禁止として記述する。
**根拠:** spec 191 R7、および外部 preset の peerDependencies 運用方針。

### Q8: テスト戦略

**A:** ドキュメント変更であるため、R1〜R9 の遵守を静的に検証するテストを用意する。具体的なテストコード配置はテストフェーズで決定する。
**根拠:** プロジェクト `CLAUDE.md`「テストを通すためにテストコードを修正してはならない」を遵守しつつ、ドキュメント特有の静的検証で十分な保証が得られるため。

### Q9: 改訂方針の選択 (brainstorm → decision)

ブレインストーミング結果と採用根拠:

| 案 | 採否 | 根拠 |
|---|---|---|
| A: 最小 patch (旧記述の局所差し替え) | 却下 | R1〜R5 を満たすには構造的説明も更新が必要 |
| B: 全面書き換え (旧契約記述をゼロに) | **採用** | alpha 版ポリシー (後方互換記述を残さない) と整合 |
| C: 旧契約と新契約を並記 | 却下 | alpha 版ポリシー違反、AI が迷う |

### Q10: 将来拡張性

Container キー一覧は独立章とし、将来のキー追加時に 1 行追加のみで済む構造にする。
**根拠:** spec 191 R8「依存契約は追加のみで既存キー不変」と整合。

## User Confirmation

- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-19
- Notes: user Q1 回答「autoで進めてください」、かつ「AI がこのドキュメントを読んで間違いなく実装できる文章にする」を要件として明示
