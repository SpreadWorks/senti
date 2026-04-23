# Feature Specification: 217-finalize-report-wiring

**Feature Branch**: `feature/217-finalize-report-wiring`
**Created**: 2026-04-23
**Status**: Approved
**Input**: GitHub Issue #225

## Goal
- finalize 完了後の Report 表示指示が、skill テンプレートを直接読む経路・envelope を機械的に解釈する経路・dispatcher prompt を読む経路のどの経路からでも欠落しない配線にする (bugfix)。

## Background
- Issue #212 (board 4142) で `sdd-forge flow report show` CLI と `.sdd-forge/last-finalized-spec` ポインタは実装済み。
- 「AI 転記」から「コマンド実行」への切り替え方針は Issue #212 で Done だが、指示文面は `src/flow/prompts/impl/finalize.md` にのみ存在する。
- spec 216 (gate-envelope-issue-log) の finalize 完了後、Report が画面に出ないケースが発生し (Issue #225)、skill・envelope への配線漏れが原因と特定された。

## Scope
- `src/templates/skills/sdd-forge.flow/SKILL.md` の Worktree boundary 節に「finalize 完了後に `sdd-forge flow report show` を実行し、stdout を fenced code block に表示する」旨の MUST 行を追加する。
- `src/flow/lib/run-finalize.js` の成功 envelope (`result === "ok"`) の `data` に `nextCommand: "sdd-forge flow report show"` を追加する。
- 上記 2 点の配線を検証するユニットテストを `tests/unit/flow/` 配下に追加する。
- `sdd-forge upgrade` の実行 (テンプレート変更のため) は finalize の sync ステップで自動処理される (この spec では明示実行は不要)。

## Out of Scope
- dispatcher のステップ配列に `show-report` ステップを追加して status 上で未実行を可視化する強化策 (既存配列への侵襲大)。
- Report 本文のフォーマット変更。
- `src/flow/prompts/impl/finalize.md` の既存文言の変更 (既に正しい)。
- `result === "preflight_failed" | "merge_failed" | "dry-run"` の envelope への hint 付与 (Report 未生成/無意味)。
- `sdd-forge flow run finalize` 以外のコマンド envelope への hint 付与。

## Constraints
- alpha 版ポリシー: 後方互換コードを書かない。既存フィールドを削る変更は含まないので抵触しない。
- 外部依存を増やさない (Node.js 組み込みのみ)。
- `src/` には特定プロジェクトの情報を埋めない (本変更の追加文言は汎用 skill テンプレートおよび汎用 envelope フィールドのため抵触しない)。
- コミットメッセージは英語。

## Design Principles
- Defense in depth: 独立した 3 つの AI 参照経路 (skill / dispatcher prompt / envelope) に同趣旨の指示を冗長配置する。
- Fail-safe: 失敗経路には hint を出さない (誤誘導回避)。

## Overview
### Modules
- `src/templates/skills/sdd-forge.flow/SKILL.md` — skill テンプレート (配布元)。編集後に `sdd-forge upgrade` で各プロジェクトに反映される。
- `src/flow/lib/run-finalize.js` — `RunFinalizeCommand.execute()` の戻り値に関するロジック。
- `tests/unit/flow/` — ユニットテスト追加先。

### Data Flow
- finalize 実行 → success envelope 返却 → AI が envelope の `data.nextCommand` を読み取り、または skill/prompt から指示を取得 → `sdd-forge flow report show` 実行 → stdout を fenced code block で表示。

### Decisions
- envelope の新規フィールド名は `nextCommand` (単数。現状 1 コマンドのみを想定)。
- 付与位置はトップレベル `data` 配下 (既存の `result`, `steps`, `artifacts` と同列)。
- 付与条件は `result === "ok"` かつ `dryRun !== true` の success envelope のみ。
- skill テンプレートへの追記箇所は既存の Worktree boundary 節の cwd 復元 MUST 行の直後。

## Clarifications (Q&A)
- Q: draft 採択の根拠は？
  - A: draft で gate PASS 済み (2026-04-23, autoApprove)。Issue #225 の本文内容と整合。

## Alternatives Considered
- A1: prompt (`finalize.md`) のみを改善する (文言強化)。却下理由: prompt を読まない経路がそもそも存在するため根本解決にならない。
- A2: dispatcher ステップ配列に `show-report` ステップを追加。却下理由: 既存のステップ配列への侵襲が大きく、Out of Scope 扱い。
- A3 (採択): skill + envelope + 既存 prompt の 3 経路に冗長配線 (defense in depth)。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23 (autoApprove)
- Notes: draft で autoApprove 済み。auto モード自動承認。

## Requirements

優先度順:

1. **[最優先] skill テンプレートへの Report 表示指示の配線**
   - When: `sdd-forge upgrade` を経由して配布された skill テンプレート (`src/templates/skills/sdd-forge.flow/SKILL.md`) を AI が読み込むとき。
   - Shall: Worktree boundary 節内に、「finalize 完了後 (cd back 完了後) に `sdd-forge flow report show` を実行し、stdout を fenced code block に表示する」旨の MUST 行が 1 行以上存在すること。
   - 検証: `src/templates/skills/sdd-forge.flow/SKILL.md` に文字列 `sdd-forge flow report show` が 1 箇所以上存在する。

2. **[次点] finalize 成功 envelope への nextCommand フィールド付与**
   - When: `sdd-forge flow run finalize` が成功 (`result === "ok"` かつ `dryRun === false`) した場合。
   - Shall: 返却 envelope の `data.nextCommand` が文字列 `"sdd-forge flow report show"` と完全一致すること。
   - When: `result` が `"preflight_failed" | "merge_failed" | "dry-run"` のいずれか、あるいは `dryRun === true` の場合。
   - Shall: 返却 envelope の `data` に `nextCommand` プロパティが存在しないこと。
   - 検証: 対応するユニットテスト (下記要件 3) で envelope を実際に生成して JSON 比較する。

3. **[付随] 要件 1, 2 を検証する自動テスト**
   - When: `npm test` を実行するとき (CI および開発者の回帰検知想定)。
   - Shall: (a) 要件 1 の文字列存在検証が失敗した場合、非ゼロ終了コードで失敗すること。(b) 要件 2 の成功 envelope 検証が失敗した場合、非ゼロ終了コードで失敗すること。(c) 失敗メッセージに該当要件を特定できる文言 (対象ファイルパスまたは `nextCommand` フィールド名) を含むこと。
   - 検証: テスト追加後、該当要件を意図的に破壊する暫定パッチで `npm test` が失敗することを確認し、パッチを戻す。

## Acceptance Criteria
- AC1: `git grep -c "sdd-forge flow report show" src/templates/skills/sdd-forge.flow/SKILL.md` の出力が 1 以上。
- AC2: `sdd-forge flow run finalize` の成功時 envelope (ユニットテストで構築) の `data.nextCommand === "sdd-forge flow report show"`。
- AC3: `sdd-forge flow run finalize` の失敗系 envelope (preflight_failed / merge_failed) および dry-run 時 envelope の `data` に `nextCommand` プロパティが存在しない。
- AC4: `npm test` が PASS し、要件 1/2 の検証テストが含まれている。
- AC5: baseline (feature/217-finalize-report-wiring 作成直後) と head の失敗テスト集合の差が 0 件 (回帰なし)。

## Implementation Targets
- `src/templates/skills/sdd-forge.flow/SKILL.md`
- `src/flow/lib/run-finalize.js`
- `tests/unit/flow/run-finalize-next-command.test.js` (新規、仮称)
- `tests/unit/flow/skill-report-show-wiring.test.js` (新規、仮称)

## Open Questions
- [ ]
