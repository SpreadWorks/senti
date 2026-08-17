# Feature Specification: 098-include-upgrade

**Feature Branch**: `feature/098-include-upgrade`
**Created**: 2026-03-29
**Status**: Draft
**Input**: `.tmp/flow/04-include-upgrade.md` + `.tmp/flow_improvement.md`

## Goal

skill テンプレートの重複を減らすため、`<!-- include("path") -->` ディレクティブと `upgrade` 時の再帰展開を実装する。共通セクションを `src/templates/partials/` に切り出し、plan/impl/finalize テンプレートを include 使用に書き換える。

**Why**: 現在 6 つの skill テンプレートで Choice Format, Core Principle, Worktree Mode 等のセクションが完全重複している。1箇所を変更すると最大 12 ファイル（en/ja × 6 skill）に手動で反映が必要。include で共通化することで保守コストを下げる。

## Scope

### 1. include 展開ライブラリ（`src/lib/include.js`）
- `resolveIncludes(content, opts)` 関数を実装
- opts: `{ baseDir, lang, templatesDir, presetsDir }`
- `<!-- include("path") -->` を検出し、対象ファイルの内容に置換
- 展開後は include ディレクティブ行が消える（内容に置き換わる）
- 再帰展開対応（include 先にさらに include があれば展開）
- パス解決ルール:
  - `name` — baseDir（同一フォルダ）内で探す
  - `/path/to/name` — PKG_DIR（`src/`）基準
  - `@templates/path/to/name` — `src/templates/` 基準
  - `@presets/<preset>/path/to/name` — `src/presets/<preset>/` 基準
- 禁止パス: `../` と `./` を含むパスはエラー
- 言語探索: `<lang>` → `en` のフォールバック（partials に lang フォルダがない場合はそのまま解決）
- エラー: ファイル未発見は throw（エラーメッセージにソースファイル名と include パスを含む）
- 循環参照: 展開中のパスを Set で追跡し、同じパスが再度現れたら throw

### 2. skills.js の統合
- `deploySkills()` で `resolveSkillFile()` 後に `resolveIncludes()` を呼ぶ
- 展開済みの完成品を `.agents/skills/` と `.claude/skills/` に書き出す
- 変更検出は展開後の内容で比較（展開前のソースではなく）

### 3. 共有パーツ作成（`src/templates/partials/`）
- `choice-format.md` — Choice Format セクション（plan, impl, finalize で共通）
- `core-principle.md` — Core Principle セクション（plan, impl で共通）
- `worktree-mode.md` — Worktree Mode セクション（plan, impl, finalize で共通）
- `flow-tracking.md` — Flow Progress Tracking の共通文面（step ID リストは各 skill が記述）
- `context-recording.md` — Context Recording の共通文面

### 4. skill テンプレートの include 化
- `sdd-forge.flow-plan/SKILL.en.md` と `SKILL.ja.md` — 共通セクションを `<!-- include("@templates/partials/xxx.md") -->` に置換
- `sdd-forge.flow-impl/SKILL.en.md` と `SKILL.ja.md` — 同様
- `sdd-forge.flow-finalize/SKILL.en.md` と `SKILL.ja.md` — 同様
- finalize の Worktree Mode は共通部分 + 追加2行があるため、共通部分を include し追加分はインラインで残す

### 5. upgrade.js のエラーハンドリング
- `deploySkills()` が throw した場合、`upgrade.js` の `main()` でキャッチし、エラーメッセージを表示して適切に終了

## Out of Scope

- docs テンプレート（`src/presets/*/templates/`）への include 適用
- include 以外の新ディレクティブ
- flow-sync, flow-resume, flow-status テンプレートの include 化（共通セクションが少ないため）

## Migration

`sdd-forge upgrade` を実行すると、include が展開された完成品がデプロイされる。ユーザーの `.agents/skills/` と `.claude/skills/` のファイルは展開済みの完全なファイルになるため、ユーザー側に include 処理は不要。

## Clarifications (Q&A)

- Q: include ディレクティブの構文は？
  - A: `<!-- include("path") -->`。1行に1つ。閉じタグなし（単独ディレクティブ）。
- Q: 共有パーツに言語別フォルダは必要か？
  - A: 不要。現在の共通セクションはすべて英語の指示文。partials 直下にフラットに配置。
- Q: エラー時に process.exit は使うか？
  - A: `resolveIncludes()` は throw のみ。process.exit は upgrade.js の main() で制御。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-29
- Notes: ドラフト Q&A 完了後に承認

## Requirements

優先順位順（P1: 必須, P2: 重要, P3: あると良い）:

1. **P1**: `src/lib/include.js` に `resolveIncludes(content, opts)` を実装する。`<!-- include("path") -->` を検出し、対象ファイル内容に再帰的に置換する
2. **P1**: パス解決ルール4種（`name`, `/path`, `@templates/path`, `@presets/<preset>/path`）を実装する
3. **P1**: `../` と `./` を含むパスを検出した場合にエラーを throw する
4. **P1**: 循環参照を検出した場合にエラーを throw する（展開中パスの Set 追跡）
5. **P1**: ファイル未発見時にソースファイル名と include パスを含むエラーメッセージを throw する
6. **P1**: `src/lib/skills.js` の `deploySkills()` で `resolveIncludes()` を呼び、展開済みの完成品をデプロイする
7. **P2**: `src/templates/partials/` に5つの共有パーツ（choice-format, core-principle, worktree-mode, flow-tracking, context-recording）を作成する
8. **P2**: flow-plan/flow-impl/flow-finalize の en/ja テンプレートの共通セクションを `<!-- include("@templates/partials/xxx.md") -->` に置換する
9. **P2**: `upgrade.js` の `main()` で `deploySkills()` の例外をキャッチし、エラーメッセージを表示して非ゼロ終了する
10. **P3**: 展開済み出力が include 前と同一内容になることを検証するテストを作成する

## Acceptance Criteria

1. `resolveIncludes()` が `<!-- include("path") -->` 行を対象ファイルの内容に置換する
2. `resolveIncludes()` が再帰展開をサポートする（include 先に include があれば展開）
3. `../` を含むパスでエラーが throw される
4. 循環参照でエラーが throw される
5. 存在しないファイルでソースファイル名を含むエラーが throw される
6. `sdd-forge upgrade` 実行後、`.agents/skills/sdd-forge.flow-plan/SKILL.md` に include ディレクティブが残っていない（展開済み）
7. `src/templates/partials/` に5つの共有パーツファイルが存在する
8. flow-plan/impl/finalize テンプレートのソースに `<!-- include("@templates/partials/...") -->` が含まれる
9. `sdd-forge upgrade` で include 解決に失敗した場合、エラーメッセージが表示され非ゼロ終了する

## Open Questions

- (なし)
