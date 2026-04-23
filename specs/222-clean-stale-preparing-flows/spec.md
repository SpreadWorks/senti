# Feature Specification: 222-clean-stale-preparing-flows

**Feature Branch**: `feature/222-clean-stale-preparing-flows`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #245

## Goal
新規 flow を開始するたびに表示される「preparing flow が N 件存在する」警告の件数が増え続ける問題を解消する。

## Background
preparing flow は `.sdd-forge/.active-flow.<runId>` として書き出される中間状態ファイルで、新規 flow 開始と spec 準備完了までの数分間だけ存在する ephemeral な状態を保持する。正常系では spec 準備完了時に自動削除されるが、中断・auto-check rejection・別 runId での再 init・prepare 失敗後の再試行等の経路では孤児として残留する。現状、孤児ファイルは 24 時間経過後に初めて削除候補となり、かつ削除処理自体も spec 準備成功時にしか起動しないため、単一セッション内の複数 init でも、複数日にまたがる開発でもファイルが累積する。

## Impact on Existing Features
- 影響あり: `flow set init` — 実行時に `cleanStalePreparingFlows` が追加で呼ばれる。これまで 24 時間未満かつ警告に含まれていた preparing flow のうち、新基準（1 時間）で stale となるものが自動削除されるため、警告件数が減少する。CLI インターフェース（オプション・引数・戻り値 JSON schema）は変更しない。
- 影響あり: `PREPARING_TTL_MS` を参照する既存の呼び出し元（`PreparingFlowStore.cleanStale()` のみ）— 1 時間を超過したファイルを stale として扱うようになる。既存呼び出し元の挙動が TTL 値の変更に連動する。
- 影響あり: `flow prepare` 成功時の cleanup（`run-prepare-spec.js`）— 同じ `cleanStalePreparingFlows` を呼び出しているため、新しい TTL 値が適用される。呼び出し位置・実装は変更しない。
- 影響なし: active flow (`flow.json`)、`ActiveFlowRegistry`、`FlowStore`、その他の永続データ。
- 影響なし: 閾値以内の preparing flow — 1 時間以内のファイルは保護され、並行 flow 実行中のファイルは壊れない。
- 影響なし: 読み取り系コマンド (`flow get *`) — cleanup を組み込まないため挙動変更なし。

## Scope
- When `flow set init` is invoked, the system shall automatically run preparing flow stale cleanup before listing preparing flows for the warning message.
- When stale cleanup runs, it shall treat preparing flow files with modification timestamp older than 1 hour (3,600,000 ms) as stale and shall delete them.
- The warning count displayed by `flow set init` shall report only preparing flows that remain after the automatic cleanup.

## Out of Scope
- 状態参照（read-only）コマンドへの cleanup 組み込み。`flow get status` などの観測系コマンドに write 副作用を持たせない。
- 明示的な手動 cleanup サブコマンドの追加。自動 cleanup で要件を充足するため不要。
- 並行 flow 実行中の preparing flow に対する特別な保護機構の追加。1 時間閾値以内のファイルが保護されるため、現状のしきい値ベースで十分。
- `PREPARING_TTL_MS` 以外のフロー状態のライフサイクル管理。

## Constraints
- 外部依存を追加しない（Node.js 組み込みモジュールのみ）。
- 既存 CLI インターフェース（オプション・引数・戻り値 JSON schema）を変更しない。
- 既存の cleanup 呼び出し箇所（spec 準備完了時）の挙動を変更しない。呼び出し点を追加するのみ。
- alpha 版ポリシーに従い、旧閾値（24h）のフォールバック・後方互換コードは保持しない。
- cleanup 処理は単一プロセス内の file I/O で完結し、再帰処理・無制限ループ・無制限データロードを発生させない。スキャン対象は既存 `PREPARING_SCAN_LIMIT` で有界化されている。
- cleanup 中の I/O エラーは silent に握り潰さず、ENOENT 以外はエラーログを出力する（既存 `cleanStale()` の挙動を維持）。
- `flow set init` の失敗時はこれまで通り non-zero exit code を返す（既存の `Envelope.fail` 経路を維持）。

## Design Principles
- 最小差分原則: 既存の `cleanStalePreparingFlows` 関数を再利用し、呼び出し位置と閾値定数のみを変更する。
- Read-only 境界: 状態参照コマンドに write 副作用を導入しない。cleanup は明示的な「新規 flow 開始」トリガーにのみ紐づける。
- 閾値は preparing flow の本来の寿命（数分）に見合う値に設定する。作業を短時間中断して戻るケースを許容できる範囲を上限として 1 時間とする。
- Requirements priority order (highest first): REQ-P1 (set-init で cleanup を呼ぶ) > REQ-P3 (TTL 値の変更) > REQ-P2 (cleanup 内部での stale 判定と削除) > REQ-P4 (warning 件数の正確性) > REQ-P5 (read-only 境界維持) > REQ-P6 (空状態での no-op)。REQ-P1 と REQ-P3 を満たせば主要な累積問題は解消する。REQ-P2 は既存実装の再利用で自動的に満たされる前提。REQ-P4 は REQ-P1 + REQ-P2 の帰結。REQ-P5/P6 は回帰防止。

## Overview
### Modules
- `src/flow/lib/set-init.js`: 新規 flow 初期化コマンド。`listPreparingFlows` / 警告出力の直前に `cleanStalePreparingFlows` を呼ぶ。
- `src/lib/flow-helpers.js`: `PREPARING_TTL_MS` 定数。24 時間から 1 時間へ短縮。
- `src/lib/preparing-flow-store.js`: `cleanStale()` メソッドが `PREPARING_TTL_MS` を参照。実装変更なし（再利用のみ）。

### Data Flow
- 1. User invokes `flow set init`.
- 2. `SetInitCommand.execute()` calls `flowManager.cleanStalePreparingFlows()` before listing existing preparing flows.
- 3. Files with `now - mtimeMs > PREPARING_TTL_MS` are deleted.
- 4. `flowManager.listPreparingFlows()` reads the remaining files and emits the warning.
- 5. A new preparing flow is created for the current runId.

### Decisions
- 閾値は 1 時間 (3,600,000 ms)。preparing flow の平均寿命（数分）と「短時間の中断許容」のバランス点。
- cleanup の呼び出し点は「新規 flow 開始」トリガーのみに追加。読み取り系コマンドには追加しない。
- 手動 cleanup サブコマンドは追加しない。自動 cleanup で要件を充足するため。

## Clarifications (Q&A)
- Q: 閾値を 1 時間にしたのはなぜか？
  - A: preparing flow の本来の寿命は `flow set init` → spec 準備完了の数分間。1 時間は「中断して戻る」ケースを許容しつつ単一セッション内累積を抑える balance point。短すぎる値（例: 10 分）は並行 flow や長めの draft 検討を壊す懸念がある。
- Q: なぜ `flow get status` にも cleanup を入れないのか？
  - A: read-only コマンドに write 副作用を持たせると呼び出し側の期待を裏切る（Single Responsibility / semantics 違反）。状態参照は頻繁に呼ばれる想定のため、毎回 I/O 削除を走らせるのも望ましくない。
- Q: 並行 flow が走っている場合、他セッションの preparing flow を誤って削除しないか？
  - A: cleanup は時間閾値ベースで、1 時間以内のファイルは保護される。1 時間を超える preparing flow は既に孤児とみなして差し支えない。

## Alternatives Considered
- 閾値を 24 時間のまま、cleanup 呼び出し点だけ追加 — across-session 累積は解消するが、本件の観測事例（単一セッション内で 7 件）は解決できない。却下。
- 閾値を 10 分に短縮 — より積極的に累積を抑える。しかし draft 検討に時間をかける正常ケース・並行 flow の preparing 状態を壊す懸念が大きい。却下。
- `flow clean preparing` 明示サブコマンドを追加 — 手動削除の柔軟性を提供できるが、自動 cleanup で要件を満たすため CLI 表面を増やすコストに見合わない。Defer。
- `flow get status` に cleanup を組み込む — より早い cleanup トリガーが得られるが、read-only コマンドへの write 副作用は semantic 違反。却下。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: Issue #245 対応として、set-init での cleanup と TTL 短縮の両方を承認。

## Requirements
- REQ-P1 [must]: When `flow set init` is invoked, the system shall call `cleanStalePreparingFlows` before listing preparing flows for the warning message.
- REQ-P2 [must]: When `cleanStalePreparingFlows` evaluates each preparing flow file, it shall delete files whose modification timestamp is older than `PREPARING_TTL_MS`.
- REQ-P3 [must]: When any caller evaluates preparing-flow staleness via `PREPARING_TTL_MS` (defined in `src/lib/flow-helpers.js`), the constant shall equal `60 * 60 * 1000` (1 hour in milliseconds) so that files older than 1 hour are classified as stale.
- REQ-P4 [must]: When `flow set init` emits the `preparing flow(s) already exist` warning, the reported count shall equal the number of preparing flows remaining after the automatic cleanup.
- REQ-P5 [must]: When a request is handled by any read-only state-observation command handler (e.g. `flow get status`, `flow get next-action`), the handler shall not invoke `cleanStalePreparingFlows` directly or indirectly, so that read-only commands remain free of file-deletion side effects.
- REQ-P6 [must]: When `flow set init` runs on a `.sdd-forge/` directory that contains no preparing flow files, it shall complete successfully and shall emit no `preparing flow(s) already exist` warning.

## Acceptance Criteria
- AC-1 (REQ-P1, REQ-P4): Given 2 preparing flow files in `.sdd-forge/` with mtimes older than 1 hour and 1 file with mtime within 1 hour, when `flow set init` is invoked, the 2 stale files are deleted and the warning reports exactly 1 pre-existing preparing flow.
- AC-2 (REQ-P2, REQ-P3): Given `PREPARING_TTL_MS` is `60 * 60 * 1000`, when `cleanStalePreparingFlows` is invoked with one file aged 59 minutes and one aged 61 minutes, only the 61-minute file is deleted and the returned runId list contains its runId.
- AC-3 (REQ-P5): A unified diff of the implementation shall show no added call to `cleanStalePreparingFlows` inside any handler under `src/flow/get/` or any handler whose module path indicates a read-only observation command.
- AC-4 (REQ-P6): When `flow set init` runs and no preparing flows exist, the command exits with code 0, emits no warning, and creates a new preparing flow for the generated runId.
- AC-5 (REQ-P3): A unified diff shall show `PREPARING_TTL_MS` in `src/lib/flow-helpers.js` changed from `24 * 60 * 60 * 1000` to `60 * 60 * 1000` and no other definitions of this constant.

## Implementation Targets
- src/lib/flow-helpers.js
- src/flow/lib/set-init.js

## Open Questions
- [ ]
