# Draft: gate-draft-impl

**Issue**: #75 — draft/impl フェーズの gate チェック導入
**開発種別**: 機能追加
**目的**: guardrail が「お願いベース」のまま効いているか不明な状態を解消し、draft/impl フェーズで AI が PASS/FAIL で検証する仕組みを作る

## Q&A サマリー

### Q1: コマンド体系
- **決定**: A案 — 既存の `sdd-forge flow run gate` に `--phase draft` / `--phase impl` を追加
- **理由**: registry, hooks, テストの拡張が最小限。`filterByPhase()` がそのまま使える
- `pre`/`post` は廃止しない（ログ保存等で使用中）

### Q2: gate draft のチェック内容
- **決定**: テキスト構造チェック + guardrail AI チェックの2層
- テキスト構造チェック対象:
  - Q&A の有無
  - ユーザー承認（`- [x] User approved this draft`）
  - 開発種別（機能追加/バグ修正/新規開発 等）
  - 目的（ゴール）
- guardrail AI チェック: `phase: "draft"` でフィルタした guardrail 記事で判定

### Q3: gate impl のチェック内容
- **決定**: AI チェックのみ（テキスト構造チェックなし）
- spec.md の Requirements リストと git diff を AI に渡す
- 各要件の実装有無を PASS/FAIL で判定
- guardrail `phase: "impl"` でフィルタした記事での準拠チェックも実施

### Q4: gate のエラーハンドリング統一
- **決定**: gate チェック FAIL 時は throw ではなく `{ result: "fail", next: "<phase>" }` を return
- 全 gate（spec 含む）で統一
- 復旧不能エラー（ファイル未発見等）は従来通り throw
- gate FAIL は「チェックが正常に動いて不合格だった」= 正常結果（`ok: true`）
- post hook が FAIL 時も動作するようになる

### Q5: SKILL.md 配置
- **決定**: 既存 SKILL に挿入（spec gate と同じパターン）
- flow-plan: draft 完了後に gate draft ステップ追加
- flow-impl: implement 完了後に gate impl ステップ追加

## 既存機能への影響

### 変更が必要なファイル
- `src/flow/lib/run-gate.js` — phase 分岐追加 + throw → return 変更
- `src/flow/registry.js` — `--phase` の値域拡張、post hook の statusFn 更新
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` — gate draft ステップ追加
- `src/templates/skills/sdd-forge.flow-impl/SKILL.md` — gate impl ステップ追加
- `src/lib/flow-state.js` — step ID に `gate-draft`, `gate-impl` を追加（既存 `gate` は spec gate として維持）、または `gate` を3フェーズで共用
- `tests/unit/specs/commands/gate.test.js` — 新フェーズのテスト追加 + throw → return のテスト修正

### 影響なし
- `src/lib/guardrail.js` — `filterByPhase()` はそのまま使える
- `src/presets/base/templates/en/guardrail.json` — 既に `meta.phase` に draft/impl タグあり
- `src/flow/lib/get-guardrail.js` — 変更不要

## フロー上の位置づけ

```
draft → gate draft → spec → gate spec → approval → test → impl → gate impl → review → finalize
```

## Open Questions（解決済み）
- ~~gate draft/impl 用の step ID~~ → `gate-draft`, `gate`, `gate-impl` の3つを別々に新設
- ~~gate impl の git diff 取得方法~~ → `baseBranch` との diff（`git diff <baseBranch>...HEAD`）

---

- [x] User approved this draft (2026-04-03)
