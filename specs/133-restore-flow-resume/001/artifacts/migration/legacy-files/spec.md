# Feature Specification: 133-restore-flow-resume

**Feature Branch**: `feature/133-restore-flow-resume`
**Created**: 2026-04-03
**Status**: Draft
**Input**: GitHub Issue #78

## Goal
`flow resume` コマンドを復活させ、コンパクション後や worktree 外からフローを発見・復帰できるようにする。
同時に、`get-resolve-context` と共通のフロー探索ロジックを共通ヘルパーに抽出して重複を排除する。

## Scope
- 共通フロー探索ヘルパー関数の作成（`flow-state.js` に追加）
- `flow resume` コマンドの実装（`src/flow/lib/run-resume.js`）
- `registry.js` へのコマンド登録（トップレベル、`prepare` と対称）
- `flow.js` ディスパッチャへの resume ルーティング追加
- `get-resolve-context.js` のリファクタ（共通ヘルパーを使用）
- `src/templates/skills/sdd-forge.flow-resume/SKILL.md` の更新
- `sdd-forge upgrade` でプロジェクト側スキルに反映

## Out of Scope
- `get-resolve-context` の出力構造の変更
- 新しい `flow get/set` サブコマンドの追加
- 複数フロー同時実行時の選択 UI

## Clarifications (Q&A)
- Q: resume と get-resolve-context の関係は？
  - A: 共通ヘルパーにフロー探索ロジックを抽出し、両方から使う。resume は独立したトップレベルコマンド。
- Q: scanAllFlows（3段目フォールバック）の扱いは？
  - A: 共通ヘルパーに含め、resume と get-resolve-context の両方で使えるようにする。
- Q: 出力フォーマットは？
  - A: JSON envelope 形式で、get-resolve-context と同構造のデータを返す。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-03
- Notes: Gate PASS 後に承認

## Requirements

Priority order: 1 → 2 → 3 → 4 → 5 → 6 → 7（依存順）

1. **共通ヘルパー** [P1]: `flow-state.js` に `resolveActiveFlow(root, flowState)` 関数を追加する。When: resume または get-resolve-context がフローを探索する必要があるとき、この関数が3段階フォールバック（flowState → loadActiveFlows → scanAllFlows）でフローを探索し、`{ state, specId, worktreePath }` を返す shall。フローが見つからない場合は null を返す shall。複数フローが見つかった場合は Error を throw する shall。
2. **resume コマンド** [P1]: `src/flow/lib/run-resume.js` に FlowCommand（`requiresFlow: false`）として実装する。When: ユーザーが `sdd-forge flow resume` を実行したとき、共通ヘルパーでフローを探索し、get-resolve-context と同構造の JSON を返す shall。フローが見つからない場合は "no active flow found" エラーを返す shall。
3. **registry 登録** [P1]: When: `flow.js` が resume コマンドをディスパッチするとき、`registry.js` にトップレベルコマンドとして resume が登録されている shall（`prepare` と同列）。
4. **ディスパッチャ** [P1]: When: ユーザーが `sdd-forge flow resume` を実行したとき、`flow.js` が `group === "resume"` を認識して resume コマンドにルーティングする shall。
5. **get-resolve-context リファクタ** [P2]: When: `sdd-forge flow get resolve-context` が実行されたとき、フロー探索部分が共通ヘルパー呼び出しに置換されている shall。出力構造は変えない。
6. **SKILL.md 更新** [P2]: When: AI がフロー復帰スキルを使うとき、`src/templates/skills/sdd-forge.flow-resume/SKILL.md` が `sdd-forge flow resume` の出力を読んで表示するだけの設計になっている shall。
7. **upgrade 反映** [P3]: When: spec の実装が完了したとき、`sdd-forge upgrade` でプロジェクト側の `.claude/skills/sdd-forge.flow-resume/SKILL.md` を更新する shall。

## Acceptance Criteria
- `sdd-forge flow resume` がフロー進行中に実行でき、request, phase, progress, goal, scope, requirements, notes, recommendedSkill を含む JSON envelope を返す
- フローが存在しない場合、エラーメッセージを含む JSON envelope を返す
- `get-resolve-context` の出力が共通ヘルパー導入前と変わらない
- `sdd-forge flow --help` に resume が表示される
- SKILL.md テンプレートが `sdd-forge flow resume` を呼ぶ設計になっている

## Open Questions
- [x] `scanAllFlows` が複数フローを見つけた場合の挙動 → 現行 get-resolve-context と同様にエラーとする。複数フロー選択UIはスコープ外。
