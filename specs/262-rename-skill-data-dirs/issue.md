## Background

The directory names `src/templates/` and `src/docs/data/` have drifted from their actual content due to historical reasons.

### Problem with `src/templates/`

True templates (inheritable/overridable via `{%extends%}`, `{%block%}`, `{{data}}`, `{{text}}`) have moved under presets. What remains in `src/templates/` is:

- `templates/skills/` — skill source assets (not overridable, static distributed assets)
- `templates/partials/` — fragments included by skills
- ~~`templates/review-checklist.md`~~ — already deleted (f63961d6)

The actual content is **skill source assets**, not templates. Furthermore, Claude Code skills can contain not just SKILL.md but also scripts and reference docs, and the `templates/` naming makes "templates but with scripts?" a confusing read that hinders extensibility.

### Problem with `src/docs/data/`

The DataSource mechanism was originally for docs builds, but since b25c it is also used for SKILL.md builds (RulesSource), making it a cross-cutting concept. Keeping it under `docs/` implies "docs-only" and is misleading.

### Same problem in experimental

`experimental/workflow/templates/skills/sdd-forge.exp.workflow/SKILL.md` also carries the same "templates" naming.

## Proposal

Re-home skill / DataSource related directories under `src/` and `experimental/` to names that reflect their actual content.

### Specific Changes

| Before | After |
|---|---|
| `src/templates/` | (removed; skill/partial/data content re-homed) |
| `src/templates/skills/` | `src/skills/` (drop `templates/` wrapper, promote `skills/` to top-level) |
| `src/templates/skills/rules.json` (added in b25c) | `src/skills/rules.json` |
| `src/templates/skills/<skillname>/` | `src/skills/<skillname>/` (skill module structure unchanged) |
| `src/templates/partials/` | `src/skills/partials/` (consolidate under `skills/` as skill-related shared content) |
| `src/docs/data/` | `src/data/` (DataSource framework is not docs-only) |
| `experimental/workflow/templates/skills/` | `experimental/workflow/skills/` (same cleanup) |

### Open Questions (at implementation time)

- Whether to place partials under skills or as a separate top-level `src/partials/` — since they are shared resources across multiple skills, placing them under skills seems reasonable, but warrants re-confirmation.

## Affected Areas

- Constants like `import { MAIN_SKILLS_TEMPLATES_DIR } from "src/lib/skills.js"` and all references
- Resolution path for `` directives (`src/lib/include.js`)
- Test fixture paths
- Copy source paths for `sdd-forge upgrade`
- Structure descriptions in `AGENTS.md` / `src/CLAUDE.md`
- Equivalent references in `experimental/workflow`

## Timing

**Begin after b25c (skill-rules.json injection mechanism) is implemented and its effectiveness is confirmed.**

Reasons:
- Large-scale renaming while the mechanism's effectiveness is unknown is unnecessary risk
- Once the effect is confirmed, "we're renaming to support future extensions like X" becomes a compelling rationale
- No backward compatibility needed during alpha, so renaming is always possible

## Out of Scope

- Mechanism changes (b25c side)
- Content changes
- Responsibility restructuring between files (rename only)

## Related

- `b25c`: skill-rules.json injection mechanism (prerequisite for this issue)
- Deleted: `src/templates/review-checklist.md` (f63961d6)

<details>
<summary>ja</summary>

[ENHANCE] src/ 構造整理: 'templates' → skill 関連名にリネーム, DataSource を docs/ から分離

## 背景

`src/templates/` と `src/docs/data/` のディレクトリ名が、過去の経緯で実体と乖離している。

### `src/templates/` の問題

真のテンプレート（`{%extends%}` `{%block%}` `{{data}}` `{{text}}` で継承・オーバーライド可能）は preset 配下に移っており、`src/templates/` 配下に残っているのは:

- `templates/skills/` — skill 本体 (override 不可、配布される静的アセット)
- `templates/partials/` — skill が include する断片
- ~~`templates/review-checklist.md`~~ — 既に削除 (f63961d6)

つまり実体は **skill source asset** で、template ではない。さらに、Claude Code の skill は本来 SKILL.md だけでなく scripts や reference docs も置ける構造で、現在の `templates/` 名前のせいで「templates なのに scripts?」と読めて拡張余地が阻害される。

### `src/docs/data/` の問題

DataSource 機構は元々 docs build 用だったが、b25c で SKILL.md ビルドにも使われるようになり (RulesSource)、cross-cutting concept になっている。docs/ 配下にとどめるのは「docs 専用」と読めて誤解を招く。

### experimental も同じ問題

`experimental/workflow/templates/skills/sdd-forge.exp.workflow/SKILL.md` も同じ "templates" 名前を引きずっている。

## 提案

src/ と experimental/ の skill / DataSource 関連ディレクトリを、実体に合った名前に整理する。

### 具体的な変更

| 旧 | 新 |
|---|---|
| `src/templates/` | (撤去。skill/partial/data 関連を re-home) |
| `src/templates/skills/` | `src/skills/` (templates/ wrapper を撤去、skills/ を top-level に) |
| `src/templates/skills/rules.json` (b25c で追加) | `src/skills/rules.json` |
| `src/templates/skills/<skillname>/` | `src/skills/<skillname>/` (skill module 構造は変えない) |
| `src/templates/partials/` | `src/skills/partials/` (skill 関連の shared content として skills/ 配下に集約) |
| `src/docs/data/` | `src/data/` (DataSource framework は docs 専用ではない) |
| `experimental/workflow/templates/skills/` | `experimental/workflow/skills/` (同様の整理) |

### 残る論点 (実装時)

- partial を skill 配下に置くか別 top-level (`src/partials/`) にするか — 複数 skill 横断の shared resource なので skill 配下が筋だが、要再確認

## 影響範囲

- `import { MAIN_SKILLS_TEMPLATES_DIR } from "src/lib/skills.js"` 等の定数 + 参照箇所
- `` directive の解決パス (`src/lib/include.js`)
- test fixture の path
- `sdd-forge upgrade` の copy 元 path
- `AGENTS.md` / `src/CLAUDE.md` の構造説明
- experimental/workflow の同様の参照

## 実施タイミング

**b25c (skill-rules.json 注入機構) の実装と効果測定後に着手する**。

理由:
- 機構が想定通りに効くか不明な段階で大規模リネームは無駄リスク
- 効果が確認できてから「将来こう拡張するためにリネームする」と説得的に進められる
- alpha 期間なので backward compat 不要、リネームはいつでも可能

## スコープ外

- 機構変更 (b25c 側)
- 中身の変更
- ファイル間の責務見直し (純粋にリネームのみ)

## 関連

- `b25c`: skill-rules.json 注入機構 (本 issue の前提として実装される)
- 削除済み: `src/templates/review-checklist.md` (f63961d6)

</details>