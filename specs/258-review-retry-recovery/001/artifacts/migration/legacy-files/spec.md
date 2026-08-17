# Feature Specification: 258-review-retry-recovery

**Feature Branch**: `feature/258-review-retry-recovery`
**Created**: 2026-05-17
**Status**: Draft
**Input**: GitHub Issue #327

## Goal
review retry / recovery model を整理し、review verdict FAIL、subprocess failure、provider failure、input size failure、maxAttempts 到達を区別して扱えるようにする。CLI envelope / next-action / status から停止理由と復旧操作を判断できる状態にする。

## Background
review retry / recovery 周辺では、review verdict FAIL、subprocess failure、provider failure、input size failure、maxAttempts exceeded が別々の場所で扱われている。既に reviewRetry と REVIEW_MAX_ATTEMPTS_EXCEEDED、flow set retry reset、definition.js の maxAttempts 集約は存在するが、provider quota / input size failure が retry budget を消費しないことや、停止理由と復旧手順を CLI から一貫して読める contract が弱い。この spec は既存 flow 構造を保ちながら、failure classification と recovery contract を明確化する。

## Scope
- review verdict FAIL、subprocess failure、provider failure、input size failure、maxAttempts exceeded の failure taxonomy を定義する。
- 各 failure classification について reviewRetry 消費、step status、issue-log 記録、recovery hint の扱いを定義する。
- run-review の subprocess retry 対象 / 非対象を明示的な分類にし、mechanical retry は既存既定値の最大3回の subprocess 試行に収める。
- provider quota、rate limit、API error、input length error に対して、reviewRetry を消費しない recovery hint を返す。
- REVIEW_MAX_ATTEMPTS_EXCEEDED の envelope data に recovery command を含める。
- next-action / status で review 停止理由と復旧操作を表示できるようにする。
- task-scope review retry policy を、next-action maxAttempts（現在は TASK_DEFINITION の既定値 1）を上限とする soft limit として明文化する。

## Out of Scope
- review の blocking / non-blocking 分離そのもの。
- review-test の入力削減。
- project-level tests の破壊検知。
- gate-impl の no-progress guard。
- GitHub Issue publish workflow の変更。
- AI provider CLI 自体の quota や rate limit 回避。

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 CLI 構造で実装する。
- alpha 版ポリシーに従い、旧フォーマットや非推奨パスの後方互換コードを追加しない。
- 同じ failure classification / recovery hint 生成が複数箇所に必要な場合は共通ヘルパーに抽出する。
- 分類や recovery hint を意味のある値として扱う場合は、オブジェクトリテラルの type 風 union ではなく専用クラスで invariant と振る舞いを持たせる。
- src/ 以下にプロジェクト固有情報を含めない。
- 既存 CLI コマンドや option の意味は削除・変更しない。追加 field と表示情報で既存 contract を拡張する。
- CLI 失敗条件は non-zero exit code の JSON envelope として返す。provider / input size / maxAttempts の failure envelope は機械処理可能な data を持つ。
- この spec では新しい user-facing CLI argument を追加しない。既存の flow run review / flow get next-action / flow get status / flow set retry の入力 validation は維持する。
- no-overengineering guardrail の design confirmation evidence は、この spec の gate PASS 後に user_approval.approved=true と autoApprove 選択が記録されたこと、および実装完了前にユーザーが review 通過扱いで次フェーズへ進める指示を出したこととする。

## Design Principles
- review verdict FAIL と subprocess failure を別分類として扱い、reviewRetry の消費条件を混同しない。
- 復旧操作は message parsing に依存せず、envelope data または status / next-action の構造化 field から取得できるようにする。
- task-scope review は next-action maxAttempts（現在は1）を上限とする soft limit として扱い、flow-scope retry enforcement とは明確に区別する。
- transient provider failure は issue-log を汚さず、workaround や手動復旧が発生した場合だけ issue-log に記録する。

## Overview
### Modules
- src/flow/lib/run-review.js: review execution wrapper。reviewRetry enforcement、subprocess retry、review command output parsing、post-hook retry counter update を扱う。
- src/flow/lib/set-retry.js: flow set retry reset <gate|review> <phase> --yes の reset entry 記録を扱う。
- src/flow/lib/get-next-action.js: active step の next-action envelope を返す。review 停止時の復旧情報表示候補。
- src/flow/lib/get-status.js: flow status と metricsSummary を返す。review 停止理由の要約表示候補。
- src/flow/definition.js: flow / task step と maxAttempts の single source of truth。
- src/flow/prompts/task/review.md と src/flow/prompts/impl/review.md: task-scope / impl review の retry policy を利用者に伝える prompt。

### Data Flow
- flow run review は、実行前に flow-scope reviewRetry count と maxAttempts を比較し、超過時は REVIEW_MAX_ATTEMPTS_EXCEEDED envelope を返す。
- subprocess 実行結果は failure taxonomy に分類され、mechanical retry、reviewRetry 消費、step status、recovery hint の扱いを決める。
- provider / input size failure は reviewRetry を消費せず、recovery hint を failure data として返す。workaround が必要な場合だけ issue-log に残す。
- run-review は classified stop を flow.json の reviewStop に保存する。reviewStop は phase、classification、reason、retryBudgetConsumed、recoveryHint、recoveryCommand、updatedAt を持つ。
- src/flow/commands/review.js は provider / input size failure を検出した場合、stderr に machine-readable marker を1行出力する。run-review はこの marker を優先して分類する。
- next-action と status は active review step と failure data / metrics から、停止理由と復旧コマンドを利用者向けに表示する。
- reviewStop は同じ phase の review 成功時、同じ phase の新規 review 試行開始時、または flow set retry reset review <phase> --yes の成功時に clear される。

### Decisions
- [VERIFY] run-review の flow-scope maxAttempts pre-check は source と一致。task-scope では currentTaskId により enforcement をスキップする。
- [VERIFY] subprocess retry は review verdict retry とは別扱い。signal / killed と TEST_REVIEW_PROMPT_TOO_LARGE は非 retry、それ以外の失敗は mechanical retry 対象。
- [VERIFY] maxAttempts data は phase / attempts / max を持つが recovery command は message 側のみ。spec では data.recoveryCommand 追加を要求する。
- [VERIFY] maxAttempts は src/flow/definition.js が source of truth。plan review は review-draft-questions / coverage / spec が 1、review-test が 3。
- task-scope review はこの spec では next-action maxAttempts（現在は1）を上限とする soft limit として残す。CLI enforcement 統一は task lifecycle まで広がるため扱わない。
- next-action は停止理由・retry 消費有無・復旧コマンドの詳細表示、status は現在止まっている理由と次操作の要約表示を担う。
- provider failure の下位 reason として rate limit / quota / API error を扱い、input length は input size failure として別分類にする。
- review stop state は flow.json reviewStop に永続化する。stdout の fail envelope だけでは後続 CLI が provider/input stop reason を復元できないため。
- child review command は stderr marker で provider/input failure を wrapper に渡す。run-review は marker を parse し、raw stderr 推測は fallback に限定する。

## Clarifications (Q&A)
- Q: task-scope review の retry policy は flow-scope と同じ CLI enforcement に揃えるか。
  - A: この spec では next-action maxAttempts（現在は TASK_DEFINITION の既定値 1）を上限とする soft limit として残し、policy を明文化する。CLI enforcement 統一は task lifecycle と currentTaskId の扱いまで広がるため扱わない。
- Q: 停止理由と復旧操作はどこに表示するか。
  - A: next-action に詳細、status に要約を表示する。next-action は AI / skill の次操作、status は人間の状況把握に使う。
- Q: REVIEW_MAX_ATTEMPTS_EXCEEDED の recovery command は data に含めるか。
  - A: 含める。message parsing に依存せず機械処理できる contract にする。
- Q: provider failure / input size failure は issue-log に必ず残すか。
  - A: 必須にしない。reviewRetry 非消費と recovery hint を主契約とし、workaround、仕様判断、未解決の手動復旧が発生した場合だけ issue-log に記録する。
- Q: no-overengineering guardrail の pre-implementation design confirmation はどの証跡で満たすか。
  - A: 実装前に gate PASS 済み spec と user_approval.approved=true が存在し、flow notes に autoApprove selected [1] が記録されているため、設計方向の確認済み証跡として扱う。実装後 review の retry 上限到達については、ユーザーが review 通過扱いで次フェーズへ進めるよう明示した。

## Alternatives Considered
- task-scope review も flow-scope と同じ CLI enforcement に揃える — 今回は採用しない。task lifecycle、currentTaskId、task-level retry metrics まで変更範囲が広がり、Issue #327 の完了条件である policy 明文化を超える。
- provider failure ごとに issue-log を必ず追加する — 今回は採用しない。transient quota / rate limit で issue-log がノイズ化するため、復旧ヒントを主契約にし、workaround や手動復旧時だけ記録する。
- recovery command を error message のみに残す — 採用しない。next-action / status が message parsing に依存するため、data.recoveryCommand を追加する。
- rate limit / quota / API error をすべて独立した上位 classification にする — 採用しない。上位分類は Issue の語彙に合わせ、provider failure の reason として扱うことで retry / status 判定を単純に保つ。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-17T08:03:25.151Z
- Notes: autoApprove selected [1] after spec gate PASS

## Requirements
- R1 [must]: review failure taxonomy をコードまたは CLI-facing docs に定義し、少なくとも review verdict failure、subprocess failure、provider failure、input size failure、maxAttempts exceeded を区別する。
- R2 [must]: run-review の mechanical subprocess retry は failure taxonomy を参照し、retry する失敗 / retry しない失敗を明示的に分類する。signal / killed と input size failure は retry しない。subprocess 試行回数は既存既定値の最大3回を超えない。
- R3 [must]: provider failure と input size failure は reviewRetry を消費せず、failure envelope data と flow.json reviewStop に classification、reason、retryBudgetConsumed=false、recoveryHint、recoveryCommand を含める。
- R4 [must]: REVIEW_MAX_ATTEMPTS_EXCEEDED の envelope data は phase、attempts、max、recoveryCommand を含む。既存の phase / attempts / max は維持する。
- R5 [must]: flow get next-action は flow.json reviewStop または reviewRetry metrics から review 停止時の stopReason、classification、retryBudgetConsumed、recoveryCommand を返す。
- R6 [must]: flow get status は active review step が停止している場合、flow.json reviewStop または reviewRetry metrics から停止理由と次の復旧操作を要約表示する。
- R9 [must]: src/flow/commands/review.js は provider failure または input size failure を検出した場合、run-review wrapper が parse できる machine-readable stderr marker を1行出力する。marker には classification、reason、recoveryHint、recoveryCommand を含める。
- R7 [should]: task-scope review は next-action maxAttempts（現在は1）を上限とする soft limit として残すことを prompt または CLI-facing status 表示に明記し、flow-scope review enforcement と区別できるようにする。
- R8 [should]: issue-log は provider / input size failure ごとに必ず記録しない。workaround、仕様判断、未解決の手動復旧が発生した場合に記録する policy を明文化する。

## Acceptance Criteria
- R1: failure taxonomy の定義箇所を見れば、5つの上位分類と provider failure reason の関係が分かる。
- R2: run-review の subprocess retry 判定は文字列散在ではなく、分類または共通 helper を通じて判断される。
- R3: provider quota / rate limit / API error / input length error を模した失敗で reviewRetry が増えず、recoveryHint と recoveryCommand が envelope data と flow.json reviewStop に出る。
- R4: reviewRetry が maxAttempts に達した状態で flow run review を実行すると、data.phase / data.attempts / data.max / data.recoveryCommand が返る。
- R5: maxAttempts exceeded、provider failure、input size failure のいずれかで review が停止した状態を作ると、flow get next-action から復旧操作を読み取れる。
- R6: 同じ停止状態で flow get status から停止理由と次の復旧操作の要約を読み取れる。
- R7: task-scope review の soft limit policy が task review prompt または CLI-facing output に現れ、next-action maxAttempts（現在は1）を上限とすることと flow-scope enforcement ではないことが分かる。
- R8: provider / input size failure だけでは issue-log 追加が必須にならず、workaround や手動復旧時の記録 policy が確認できる。
- R9: child review command の machine-readable stderr marker を含む subprocess 失敗を run-review に渡すと、raw stderr 推測ではなく marker 内容で classification される。
- reviewStop clear: 同じ phase の review 成功、新規 review 試行開始、または flow set retry reset review <phase> --yes 成功後に、古い reviewStop が next-action/status に残らない。

## Implementation Targets
- src/flow/lib/run-review.js
- src/flow/commands/review.js
- src/flow/lib/get-next-action.js
- src/flow/lib/get-status.js
- src/flow/lib/set-retry.js
- src/flow/prompts/task/review.md
- src/flow/prompts/impl/review.md
- tests/unit/flow/run-review-advisory.test.js
- tests/unit/flow/get-next-action.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define review failure taxonomy
  - Add a single review failure classification model that represents review verdict failure, subprocess failure, provider failure, input size failure, and maxAttempts exceeded with recovery metadata.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Apply taxonomy to run-review
  - Use the taxonomy in run-review so subprocess retry, provider / input size failures, reviewRetry consumption, and maxAttempts envelopes follow one contract.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Surface review recovery state
  - Expose review stop reasons and recovery operations through next-action and status so users and agents can recover without parsing raw error text.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Document task review policy
  - Make task-scope review's soft limit policy explicit: the upper bound is the next-action maxAttempts value, currently 1 from the TASK_DEFINITION default, and it remains distinct from flow-scope CLI enforcement.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add recovery regression tests
  - Add spec-local and existing unit coverage for the review recovery contract so retry consumption and recovery display do not regress.
  - see `tasks/T-5.md` for full spec
