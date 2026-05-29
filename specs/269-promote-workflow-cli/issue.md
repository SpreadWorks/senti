## Goal

Promote `experimental/workflow.js` to `src/workflow/` and integrate it into the official CLI surface as `sdd-forge workflow <subcommand>`. The experimental label explicitly indicates that the "usage methodology" is not yet finalized.

## Background

- The workflow feature (GitHub Projects board draft management + issue publishing) is actively used in production in OOS_spread_commerce and this repository, and the implementation is stable.
- However, the **methodology is not finalized**: what to put on the board, the promotion logic from ideas → todo, and reconciliation with published issues.
- The current approach of calling `node experimental/workflow.js` directly via the `sdd-forge.exp.workflow` skill is inconsistent as a CLI surface (all other commands use `sdd-forge xxx`).

## Plan

### Placement and CLI Surface

- Placement: `src/workflow/` (directly, not under `src/experimental/`)
- CLI: `sdd-forge workflow <subcommand>` (peer of `docs` / `spec` / `flow`)
- Subcommands follow the existing experimental/workflow.js: `add`, `update`, `show`, `search`, `list`, `publish`
- Add a `workflow` route to the dispatcher in `src/sdd-forge.js`

### Expressing the Experimental Label

Indicate "implementation is stable, usage patterns are not finalized" in 2 places:

1. **Display an `[EXPERIMENTAL]` label at the top of `sdd-forge workflow --help`** — not buried in the description, but at a prominent position before the subcommand listing in the title line.
2. **README.md and CLAUDE.md** — explicitly state "workflow is experimental (usage patterns may change)", in a location reachable via the skill's reference to official documentation.

A per-execution stderr warning is too noisy and will not be adopted.

### Skill Update

- Rewrite the `sdd-forge.exp.workflow` skill body from `node experimental/workflow.js` to `sdd-forge workflow`.
- Whether to keep the skill name as `sdd-forge.exp.workflow` or rename it to `sdd-forge.workflow` is a separate discussion. Renaming has a memory cost for users, so proceed carefully.

### Handling the experimental/ Directory

- Delete `experimental/workflow.js` once the migration to `src/` is complete.
- Keep the `experimental/` directory itself. Redefine its purpose going forward as "test code before promotion to src/". The operational model is: once it works, promote it to src/.

## Graduation Criteria (Conditions to Remove the Experimental Label)

Define upfront the conditions under which "experimental" can be removed in the future:

- The methodology (operational rules for ideas → todo → published, board structure) is documented at a level reproducible via docs / skill
- No undecided elements remain in subcommand names, field names, or status enums
- At least one usage pattern (e.g., the publish flow from ideas) is stable
- The API does not involve breaking changes for existing users

Document these in `CHANGELOG.md` or `src/workflow/AGENTS.md`.

## Acceptance Criteria

- The existing `experimental/workflow.js` functionality is ported under `src/workflow/`
- `sdd-forge workflow <subcommand>` works
- `sdd-forge workflow --help` displays an `[EXPERIMENTAL]` label at the top
- README.md / CLAUDE.md note that workflow is experimental
- The `sdd-forge.exp.workflow` skill is updated to call the new CLI
- `experimental/workflow.js` is deleted
- Graduation criteria are documented in the docs

## Related

- skill_architecture: background on skill integration
- Existing `sdd-forge.exp.workflow` skill

<details>
<summary>ja</summary>

[ENHANCE] workflow を src/ 直下に昇格して sdd-forge workflow コマンド化（experimental ラベル付き）

## ゴール

`experimental/workflow.js` を `src/workflow/` に昇格させ、`sdd-forge workflow <subcommand>` として正式な CLI surface に組み込む。ただし「使い方（methodology）」が未確定であることを experimental ラベルで明示する。

## 背景

- workflow（GitHub Projects board ドラフト管理 + issue 化）は OOS_spread_commerce や本リポジトリで実運用されており、実装は安定している。
- 一方で「ボードに何を載せるか」「ideas → todo の昇格判断」「published issue との突き合わせ」など **methodology が確定していない**。
- skill `sdd-forge.exp.workflow` 経由で `node experimental/workflow.js` を直接呼ぶ現状は CLI surface として一貫性がない（他コマンドは `sdd-forge xxx`）。

## 方針

### 配置と CLI surface

- 配置: `src/workflow/`（`src/experimental/` ではなく直置き）
- CLI: `sdd-forge workflow <subcommand>`（`docs` / `spec` / `flow` と peer）
- subcommand は現状の experimental/workflow.js を踏襲: `add`, `update`, `show`, `search`, `list`, `publish`
- ディスパッチャは `src/sdd-forge.js` に `workflow` ルートを追加

### experimental ラベルの表現

「実装は安定、使い方未確定」を 2 箇所で示す:

1. **`sdd-forge workflow --help` の冒頭に `[EXPERIMENTAL]` ラベル**を表示。説明文の中ではなく、タイトル行・サブコマンド一覧の頭で目立つ位置に置く。
2. **README.md と CLAUDE.md** に「workflow は experimental（usage patterns may change）」を明記。skill が公式ドキュメントを参照する経路で伝わるようにする。

実行毎の stderr warning は noise が大きいので採用しない。

### skill の更新

- `sdd-forge.exp.workflow` skill の本文を `node experimental/workflow.js` から `sdd-forge workflow` に書き換える。
- skill 名自体は `sdd-forge.exp.workflow` のまま残すか、`sdd-forge.workflow` に rename するかは別途検討。skill 名変更はユーザーの記憶コストがあるため慎重に。

### experimental/ ディレクトリの扱い

- `experimental/workflow.js` は src/ への移行完了後に削除。
- `experimental/` 自体は残す。今後の用途は「src/ に上げる前の試験コード」に再定義。動いたら src/ に昇格する運用とする。

## experimental ラベルが取れる条件（昇格条件）

将来「experimental が取れた」と判断するための条件を最初に決めておく:

- methodology（ideas → todo → published の運用ルール、ボードの章立て）が docs / skill で再現可能なレベルで明文化されている
- subcommand 名・フィールド名・status enum に未確定箇所がない
- 1 つ以上の利用パターン（ideas からの publish フロー等）が安定している
- 既存ユーザーへの breaking change を伴わない API になっている

これを `CHANGELOG.md` または `src/workflow/AGENTS.md` に明記しておく。

## 完了条件

- `src/workflow/` 配下に既存 experimental/workflow.js の機能が移植されている
- `sdd-forge workflow <subcommand>` が動作する
- `sdd-forge workflow --help` 冒頭に `[EXPERIMENTAL]` ラベルが表示される
- README.md / CLAUDE.md に experimental である旨が記載されている
- `sdd-forge.exp.workflow` skill が新 CLI を呼ぶよう更新されている
- `experimental/workflow.js` が削除されている
- 昇格条件が docs に明記されている

## 関連

- skill_architecture: skill 統合の経緯
- 既存の `sdd-forge.exp.workflow` skill

</details>