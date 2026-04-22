# Feature Specification: 210-gate-impl-noop-rerun-guard

**Feature Branch**: `feature/210-gate-impl-noop-rerun-guard`
**Created**: 2026-04-22
**Status**: Approved
**Input**: GitHub Issue #210

## Goal
- gate-impl の「FAIL → 修正せず再実行」アンチパターンを物理的に防止し、retry ceiling を AI 判定ブレ専用の予算として温存する。

## Background
- spec 201 で導入された retry ceiling (=3) 到達が、AI が直前 FAIL 後に作業ツリーを一切変更せずに再実行することで浪費されているケースが issue-log (`specs/207-spec-json-primary`, `specs/207-overview-structured-merge`, `specs/203-next-action-cli`, `specs/204-unify-ai-prompt-style` 等) で実証されている。
- 現行の `src/flow/prompts/impl/gate-impl.md` は修正を要求するだけで、変化があったことの証跡や判定機構は一切無い。
- 現行の `src/flow/lib/run-gate.js` の `executeDiffBasedGate` は作業ツリー状態の変化を問わず AI 評価に進むため、無変化での再実行を機械的に止める経路が無い。

## Scope
- `src/flow/prompts/impl/gate-impl.md` にガイダンス層の MUST を 2 件追加する（修正証跡の明示義務、無変化再実行禁止）。
- `src/flow/lib/run-gate.js` の FAIL 記録経路（`appendIssueLogFromGateResult`）に作業ツリー状態識別子を追加する。
- `src/flow/lib/run-gate.js` の `executeDiffBasedGate` の冒頭に、直前 FAIL と同一状態なら AI 呼び出し前に拒否する機械ガードを追加する。
- 対象 phase は `RETRY_TRACKED_PHASES`（task-impl / integration）に揃える。
- `NO_PROGRESS_SINCE_LAST_FAIL` エラーコードを新設する。

## Out of Scope
- AI 判定ブレ（REQ-SPEC の PASS/FAIL 揺れ等）の安定化。
- retry ceiling 値（default 3）の変更。
- retry counter reset 機構（spec 209 で実装済み）。
- diff-based でない gate（draft / spec / task-spec）への適用。
- pre-existing FAIL エントリ（状態識別子を持たないもの）の後方変換。

## Constraints
- 外部 npm 依存を追加しない（既存プロジェクトポリシー）。
- alpha 版ポリシーに従い、FAIL エントリの旧 shape 互換コードは書かない。ただし既存 issue-log の読み込み時に状態識別子フィールドが無い場合は「比較対象なし（拒否しない）」として扱う。これは後方互換のためではなく、「直前 FAIL に情報が無ければ拒否判定不能＝スルー」という自然な挙動である。
- 作業ツリー状態識別子は `git` コマンドで算出し、Node 組み込み `crypto` のみを利用する。
- 拒否時の exit code は既存の `ESCALATE_RETRY_EXHAUSTED` と同じく non-zero。

## Design Principles
- 2 層構成（ガイダンス層 + 機械ガード層）。AI が指示を拾い損ねても物理的に停止する。
- 既存の retry counter のメンタルモデル（PASS で reset、phase scope で分離）と揃える。
- 拒否は FAIL/PASS のどちらでもない「受付拒否」。retry counter を消費しない。
- 状態識別子は `headSha`（現在の HEAD のコミット SHA）と `worktreeHash`（未コミット変更を表すダイジェスト）の 2 フィールドで表現する。両方が一致した場合のみ「無変化」とみなす。

## Overview

### Modules
- `src/flow/lib/run-gate.js` — `executeDiffBasedGate` 先頭にガード処理を追加。`appendIssueLogFromGateResult` で FAIL エントリに状態識別子を追記。
- `src/flow/prompts/impl/gate-impl.md` — MUST 2 件を追加。
- 既存の `src/flow/lib/set-issue-log.js` / `git-helpers.js` は変更しない（読み書きは既存経路を使う）。

### Data Flow
1. gate-impl 実行開始時、`executeDiffBasedGate` が最新の HEAD SHA と worktree hash を算出する。
2. 直前の同一 phase FAIL エントリが存在し、その `headSha` / `worktreeHash` 両方が現在の値と一致する場合、AI 呼び出し前に `NO_PROGRESS_SINCE_LAST_FAIL` で early FAIL を返す。この結果は retry counter を増やさない特別な result として扱い、既存の post-hook (`updateGateRetryCounter`) が delta を発火しないよう result shape で区別する。
3. 通常 FAIL 時は、`appendIssueLogFromGateResult` が追記する FAIL entry に `headSha` と `worktreeHash` を含める。
4. 通常 PASS 時は既存通り（状態識別子は不要）。

### Decisions
- **状態識別子の算出**: HEAD SHA は `git rev-parse HEAD`。worktree hash は `git status --porcelain=v1 -z` の出力 + 各 modified/added tracked ファイルの内容（`git diff HEAD` の出力全体）を結合して `crypto.createHash("sha256")` で digest する。untracked ファイルは `git status --porcelain=v1` の出力に `?? path` として含まれるため追跡外の追加も検知できる。
- **拒否時の retry counter 非消費**: result オブジェクトに `skipRetryCount: true` フラグを付ける。`updateGateRetryCounter` 側でこのフラグがある場合は FAIL でも delta を増やさない。
- **プロンプトの MUST 表現**: 既存の gate-impl.md の体裁（箇条書き）に合わせて 2 項目を追加する。

## Clarifications (Q&A)
- Q: worktree hash 算出に `git stash create` を使わない理由は？
  - A: `git stash create` は commit オブジェクトを生成する副作用がある。副作用のない `git diff HEAD` + `git status --porcelain` の出力ハッシュで十分同等の識別能力を持つ。
- Q: `NO_PROGRESS_SINCE_LAST_FAIL` の拒否は早期 FAIL として返すか、エラー throw か？
  - A: `ESCALATE_RETRY_EXHAUSTED` と同様に `err.code = "NO_PROGRESS_SINCE_LAST_FAIL"` で throw する。これにより `flow run gate` の envelope は `ok:false` + `errors[].code` として返り、既存の escalation 経路と同形。

## Alternatives Considered
- プロンプト層のみ: AI の指示取りこぼしで機能しないことが既存 issue-log で実証済み。却下。
- 機械ガード層のみ: 拒否理由が AI に伝わらず、AI の次の行動に結びつかない。却下。
- 2 層同時実装（採用）: プロンプトで行動変容、機械ガードで最後の防波堤。両方入れて初めて目的を果たす。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-22
- Notes: auto-approve mode。draft と同設計。

## Requirements

### Priority
1. REQ-2, REQ-3 — 機械ガード本体（拒否判定）。目的の直接実現。
2. REQ-1 — FAIL 時の状態識別子記録。REQ-2/REQ-3 の前提。
3. REQ-4 — retry counter 非消費。ceiling 健全化の仕上げ。
4. REQ-5, REQ-6 — プロンプト層の MUST。AI 行動変容を促す補強。
5. REQ-7, REQ-8 — エッジケース（古いエントリ・PASS を挟んだ場合）の扱い。

- **REQ-1** When gate-impl (phase が `task-impl` または `integration`) が FAIL で終了するとき, システムは FAIL 時点の `headSha`（`git rev-parse HEAD` の結果）と `worktreeHash`（`git diff HEAD` の出力と `git status --porcelain=v1 -z` の出力を連結した SHA-256 digest）を当該 issue-log FAIL エントリに追加して記録する shall.
- **REQ-2** When `sdd-forge flow run gate --phase <task-impl|integration>` が実行されるとき, システムは AI 評価を開始する前に、同一 phase の直前 FAIL エントリ（存在する場合）の `headSha` / `worktreeHash` と、現在算出した値を比較する shall.
- **REQ-3** If REQ-2 の比較で直前 FAIL エントリが存在し、かつ `headSha` と `worktreeHash` の両方が現在値と一致する, then システムは AI を呼び出さずに `err.code = "NO_PROGRESS_SINCE_LAST_FAIL"` の Error を throw し、メッセージに直前 FAIL の `reason` と「修正後に再実行してください」を含める shall.
- **REQ-4** When REQ-3 による拒否が発生する, システムは retry counter を増加させてはならない shall not.
- **REQ-5** When `src/flow/prompts/impl/gate-impl.md` が AI に提示される, 文書は「再実行前に何を修正したか（または修正不要の根拠）を明示すること」を MUST として含む shall.
- **REQ-6** When `src/flow/prompts/impl/gate-impl.md` が AI に提示される, 文書は「直前 FAIL から作業ツリー差分に変化が無い状態で再実行してはならない」を MUST として含む shall.
- **REQ-7** If 直前 FAIL エントリに `headSha` または `worktreeHash` フィールドが無い（古いエントリ）, then システムは比較不能として拒否せず通常通り AI 評価に進む shall.
- **REQ-8** If 直前の該当 FAIL より後に PASS エントリが存在する, then その PASS より後の FAIL のみを直前 FAIL として扱う shall（PASS 後は自然リセット）.

## Acceptance Criteria
- `src/flow/prompts/impl/gate-impl.md` に REQ-5 / REQ-6 に対応する MUST 項目 2 件が存在する。
- ユニットテスト: FAIL エントリ追加時に `headSha` / `worktreeHash` が含まれることを検証する。
- ユニットテスト: 同一 `headSha` / `worktreeHash` の直前 FAIL 存在下で gate-impl 実行が `NO_PROGRESS_SINCE_LAST_FAIL` で throw されることを検証する。
- ユニットテスト: 拒否時、retry counter が増加しないことを検証する（`countGateRetry` が変わらない）。
- ユニットテスト: 直前 FAIL エントリに状態識別子が無い場合、拒否されずに AI 評価に進むことを検証する。
- ユニットテスト: 直前 FAIL より後に PASS が挟まっている場合、同一ハッシュでも拒否されないことを検証する。

## Implementation Targets
- `src/flow/lib/run-gate.js`
- `src/flow/prompts/impl/gate-impl.md`

## Open Questions
- （なし）

## Test Strategy
- ユニットテスト (`tests/unit/flow/run-gate-noop-rerun-guard.test.js` 新規): mock した `flowState.metrics` と fixture 化した `issue-log.json` を使い、REQ-1〜REQ-4 / REQ-7 / REQ-8 の挙動を直接検証する。`git` 呼び出しは `git-helpers` 経由で外部 spawn されるため、既存テストと同様に tmp repo fixture で実ファイルを作って実測する。
- プロンプト内容（REQ-5 / REQ-6）は内容存在チェックの静的テストで検証する。
