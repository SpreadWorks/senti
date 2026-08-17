# Feature Specification: 341-finite-agent-termination-v2

**Feature Branch**: `feature/341-finite-agent-termination-v2`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #462

## Goal
POSIX agent process-tree timeout を SIGKILL 後も有限時間で settle させ、Linux process stat の正しい解析により zombie と PID reuse を元の live member と誤認しない。

## Background
現在の POSIX timeout path は SIGKILL 後に process group が消えるまで polling を続ける。group liveness は /proc stat を空白で分割して pgrp と zombie state を読むため、parenthesized comm に空白があると field mapping がずれる。PID の存在だけでは reuse した別 process と元の member を区別できない。

## Scope
- src/lib/agent.js の POSIX SIGTERM/SIGKILL escalation と SIGKILL 後の process-tree polling
- agent liveness と src/lib/process-identity.js で共有する Linux /proc/<pid>/stat の parenthesized comm 解析
- final deadline 時の AgentTimeoutError.unterminatedMembers diagnostics
- stubborn child、zombie-only group、PID reuse、spaced comm、normal escalation order の automated tests

## Out of Scope
- platform === "win32" branch と taskkill invocation の変更
- agent profile resolution、prompt cache、retry count、metrics accumulation の変更
- AgentTimeoutError.timeoutMs、graceMs、finalAction、killed の既存意味の変更

## Constraints
- 新しい外部依存を追加しない。
- Linux stat の意味のある解析結果は constructor で field invariant を検証する専用 class として表現する。
- Windows-specific timeout behavior は変更しない。

## Design Principles
- Linux process stat の field mapping は liveness と process identity で共有し、別々の split/index 実装を残さない。
- timeout outcome は一度だけ settle し、settle 後に tree-death polling timer を残さない。

## Overview
### Modules
- src/lib/agent.js: ChildProcessSupervisor の POSIX escalation、process-group liveness、AgentTimeoutError を担当する。
- src/lib/process-identity.js: Linux PID の boot identity と numeric start fingerprint による process identity assessment を担当する。
- src/lib/agent.js: ChildProcessSupervisor owns the final-deadline timer that bounds POSIX post-SIGKILL tree-death polling.
- src/lib/process-identity.js: LinuxProcessStat parses a kernel stat record and enforces pid, state, pgrp, and numeric startFingerprint invariants.
- src/lib/agent.js: PosixProcessMemberIdentity preserves the PID and start fingerprint of members present immediately before SIGKILL.
- src/lib/agent.js: UnterminatedProcessMember is the immutable diagnostic value retained on AgentTimeoutError.
- specs/341-finite-agent-termination-v2/tests/posix-timeout-settlement.test.js: deterministic ChildProcessSupervisor regression coverage for POSIX timeout settlement.

### Data Flow
- timeout -> SIGTERM -> grace expiry -> SIGKILL -> shared stat parser and original-member liveness check -> tree death settlement or final-deadline AgentTimeoutError
- SIGKILL -> bounded tree-death poll -> AGENT_TIMEOUT settlement -> timer cleanup
- /proc/<pid>/stat -> LinuxProcessStat.parse -> process identity or process-group liveness consumer
- SIGKILL preparation -> snapshot original process-group identities -> shared stat scan -> live matching non-zombie members only
- final deadline -> collect matching non-zombie original members -> AgentTimeoutError.unterminatedMembers
- synthetic child and /proc stat fixtures -> ChildProcessSupervisor settlement and AgentTimeoutError assertions -> R1-R5 executable regression evidence

### Decisions
- [VERIFY] SIGKILL 後の polling は現在 final deadline を持たず、tree death まで再スケジュールされる。
- [VERIFY] process identity は parenthesized comm の終端から start fingerprint を解析しており、この field mapping を liveness に共有できる。
- [VERIFY] current liveness は agent.js 内で stat を単純 split するため、comm に space がある record の state/pgrp index を誤る。
- [VERIFY] AgentTimeoutError は timeoutMs、graceMs、finalAction、killed を公開するため、追加 diagnostics は既存 property の意味を変えない。
- [VERIFY] Existing behavior impact: POSIX timeout API は normal close -> SIGTERM -> SIGKILL order、AGENT_TIMEOUT code、既存 error properties を保持し、final-deadline diagnostics だけを追加する。
- [VERIFY] Migration parity: agent.js の local stat split/index parsing を shared stat parser に置換し、ProcessIdentity と ProcessIdentitySource の public constructor/assessment contract は維持する。
- T-1: Reuse graceMs as the internal post-SIGKILL final deadline, preserving the public timeout policy while guaranteeing finite settlement.
- T-2: Use the final parenthesized comm delimiter before indexing Linux stat fields; ProcessIdentity retains its string fingerprint contract by converting the shared numeric value at that boundary.
- T-3: A current PID is live only when it matches a retained pre-SIGKILL start fingerprint and is non-zombie; unmatched reused PIDs and zombie members no longer block settlement.
- T-4: Preserve existing AgentTimeoutError timeout, grace, action, and killed fields while adding immutable diagnostics only for original non-zombie members still present at settlement.
- T-5: Model POSIX timeout outcomes with controlled fake-child events and fixtures so regression coverage does not depend on real process timing.

## Clarifications (Q&A)
- Q: 今回の Goal または Scope に変更はあるか。
  - A: ない。Issue #462 と auto mode entry で承認された request の POSIX timeout、stat parsing、zombie/PID reuse 判定を対象とする。
- Q: timeout diagnostics に追加要件はあるか。
  - A: ない。final deadline で unfinished non-zombie member を識別できることを満たす。

## Alternatives Considered
- agent.js 内の空白 split parser を維持する — comm に空白がある stat record で field mapping を誤り、process-identity.js の既存解析とも重複するため採用しない。
- process group に残る PID をすべて live member と扱う — zombie-only group と reused PID を元の live process と誤認するため採用しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T07:26:47.720Z
- Notes: User approved the gate-passed spec.

## Requirements
- R1 [must]: POSIX の SIGKILL 後 polling は明示的な final deadline を持ち、deadline 到達時は一度だけ AGENT_TIMEOUT で settle して全 timer を cleanup する。
- R2 [must]: 共有 Linux stat parser は parenthesized comm の終端から state、pgrp、numeric startFingerprint を正しく抽出し、comm 内の空白で field mapping をずらさない。
- R3 [must]: POSIX process-group liveness は original member の PID と startFingerprint を照合し、zombie-only group と reused PID を original live member と扱わない。
- R4 [must]: final deadline の AgentTimeoutError は original かつ non-zombie の unfinished member ごとに pid、state、pgrp、startFingerprint を unterminatedMembers へ保持する。
- R5 [must]: normal close、SIGTERM、SIGKILL の既存 escalation order と Windows timeout path の behavior を維持する。

## Acceptance Criteria
- R1: stubborn child の process group が SIGKILL 後も live と報告される場合、final deadline で AGENT_TIMEOUT が一度だけ返り、polling timer は残らない。
- R2: spaced comm を持つ synthetic Linux stat record から state、pgrp、startFingerprint が Linux field numbering に従って取得される。
- R3: zombie-only group は tree settlement を妨げず、同じ PID でも異なる startFingerprint の member は original live member と扱われない。
- R4: final-deadline error の unterminatedMembers は original non-zombie member の pid、state、pgrp、startFingerprint を記録する。
- R5: normal close -> SIGTERM -> SIGKILL order の既存 test が pass し、Windows taskkill path は変更されない。
- R1-R5: specs/341-finite-agent-termination-v2/tests の spec-local test は // spec: R1 R2 R3 R4 R5 header を持ち、各 requirement の executable coverage を提供する。

## Implementation Targets
- src/lib/agent.js
- src/lib/process-identity.js
- tests/unit/lib/agent.test.js
- specs/341-finite-agent-termination-v2/tests/posix-timeout-settlement.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Bound post-SIGKILL settlement
  - POSIX SIGKILL 後の tree-death polling に finite deadline を導入する。deadline outcome は一度だけ settle し、timer cleanup を完了する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Parse Linux process stats
  - parenthesized comm を安全に越えて Linux stat record を読む shared parser を作る。state、pgrp、startFingerprint の invariant を parser value が保証する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Classify process-group members
  - original process-group member identity を基準に POSIX liveness を判定する。zombie-only group と reused PID を live member から除外する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Report unfinished timeout members
  - final deadline で返す AgentTimeoutError に unfinished original non-zombie member diagnostics を追加する。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Cover POSIX timeout settlement
  - finite timeout、stat parsing、liveness、diagnostics の behavior を automated regression suite に固定する。
  - see `tasks/T-5.md` for full spec
