## Summary
The POSIX termination path in `src/lib/agent.js` continues polling for process tree death after sending `SIGKILL`, but that polling has no final deadline. In addition, `processGroupContainsOnlyZombies()` parses Linux `/proc/<pid>/stat` using a simple whitespace split, so it cannot correctly handle process names whose `comm` field contains spaces.

This combination can cause cleanup after a timeout to wait indefinitely. It also makes zombie detection and PID reuse detection inaccurate because they are too heavily based on PID alone.

## Problem

- The post-`SIGKILL` polling in `src/lib/agent.js:583-593` has no explicit final deadline, so the CLI can continue waiting if `_isPosixTreeDead()` keeps returning false.
- The `/proc/<pid>/stat` parser in `src/lib/agent.js:648-656` does not follow the Linux kernel format and cannot correctly handle the parenthesized `comm` field.
- The same repository already has a parser in `src/lib/process-identity.js:25-33` that accounts for the kernel format, while the liveness / identity checks in the agent termination path are weaker than that.
- The current checks do not sufficiently distinguish between “that PID exists” and “it is the same original process identity,” so zombies or reused PIDs can be mistaken for a live process tree.

## Scope

- POSIX termination escalation in `src/lib/agent.js`
- Post-`SIGKILL` polling and zombie / liveness detection in `src/lib/agent.js`
- A shared `/proc/<pid>/stat` parser aligned with `src/lib/process-identity.js`, if needed
- Focused automated tests using stubborn child / zombie / PID reuse / spaced `comm`

## Requirements

1. After `SIGTERM` -> `SIGKILL` escalation, polling must always be cut off by an explicit final deadline and reach a typed timeout / outcome in finite time.
2. The Linux `/proc/<pid>/stat` parser must correctly handle parenthesized `comm` and stably retrieve at least `state`, `pgrp`, and the information needed for the process identity fingerprint.
3. Liveness checks must distinguish between “the same PID exists” and “the same process identity is still continuing.”
4. Zombies and PID reuse must not be mistaken for the original live process.
5. After timeout, the identity and state of unterminated processes must be preserved in a diagnosable form.

## Acceptance Criteria

- Verify with a stubborn child fixture that post-`SIGKILL` polling always exits at an explicit deadline and settles as a bounded timeout.
- Verify with a zombie fixture that a zombie-only process group is not mistaken for a live process tree and does not improperly block settlement.
- Verify with a PID reuse fixture that a reused PID is not mistaken for the original process identity.
- Verify with a `/proc/<pid>/stat` fixture whose `comm` contains spaces that the required fields can be parsed correctly.
- Preserve the existing `normal exit -> SIGTERM -> SIGKILL` escalation order.
- Leave diagnostic information at timeout that can track the identity / state of unterminated members.

## Verification

- Add focused automated tests for the four cases above, and confirm they reproduce failures before the fix.
- Confirm there are no regressions in the existing normal-exit path or process identity checks.

## Evidence

- `src/lib/agent.js:583-593`
- `src/lib/agent.js:648-656`
- `src/lib/process-identity.js:25-33`

## Out of Scope

- Windows `taskkill` path
- Agent lifecycle refactors unrelated to this issue
- Public timeout policy changes beyond those needed to support a bounded post-`SIGKILL` deadline

<details>
<summary>ja</summary>

agent process treeの終了を有限化しprocess identityを安全に解析する

## Summary
`src/lib/agent.js` の POSIX termination path は `SIGKILL` 送信後も process tree の death polling を継続しますが、その polling に最終 deadline がありません。さらに `processGroupContainsOnlyZombies()` は Linux の `/proc/<pid>/stat` を単純な空白分割で解析しており、`comm` に space を含む process 名を正しく扱えません。

この組み合わせにより、timeout 後の cleanup が無期限待機に陥る可能性があります。また、zombie 判定と PID reuse 判定が PID 単体に寄った不正確なものになっています。

## Problem

- `src/lib/agent.js:583-593` の post-`SIGKILL` polling には明示的な最終 deadline がなく、`_isPosixTreeDead()` が継続的に false を返すケースで CLI が待機し続けうる。
- `src/lib/agent.js:648-656` の `/proc/<pid>/stat` parser は Linux kernel format を満たしておらず、parenthesized `comm` field を正しく扱えない。
- 同一 repository には `src/lib/process-identity.js:25-33` の kernel format を考慮した parser がすでに存在する一方、agent termination 側の liveness / identity 判定はそれより弱い。
- 現状の判定は「その PID が存在すること」と「元の process と同一 identity か」を十分に区別できず、zombie や PID reuse を live process tree と誤認しうる。

## Scope

- `src/lib/agent.js` の POSIX termination escalation
- `src/lib/agent.js` の post-`SIGKILL` polling と zombie / liveness 判定
- 必要に応じた、`src/lib/process-identity.js` と整合する共有 `/proc/<pid>/stat` parser
- stubborn child / zombie / PID reuse / spaced `comm` を使った focused automated tests

## Requirements

1. `SIGTERM` -> `SIGKILL` エスカレーション後の polling は、必ず明示的な最終 deadline で打ち切られ、有限時間で typed timeout / outcome に到達すること。
2. Linux の `/proc/<pid>/stat` parser は parenthesized `comm` を正しく扱い、少なくとも `state`、`pgrp`、process identity の fingerprint に必要な情報を安定して取得できること。
3. 生存判定では、「同じ PID が存在すること」と「同じ process identity が継続していること」を区別すること。
4. zombie と PID reuse を元の live process と誤認しないこと。
5. timeout 後も、未終了 process の identity と state を診断可能な形で保持すること。

## Acceptance Criteria

- stubborn child fixture で、post-`SIGKILL` polling が明示 deadline で必ず終了し、bounded timeout として settle することを検証する。
- zombie fixture で、zombie-only の process group を live process tree と誤認せず、settlement を不当に block しないことを検証する。
- PID reuse fixture で、再利用された PID を元の process identity と誤認しないことを検証する。
- `comm` に space を含む `/proc/<pid>/stat` fixture で、必要 field を正しく解析できることを検証する。
- 既存の `normal exit -> SIGTERM -> SIGKILL` のエスカレーション順序は維持する。
- timeout 時に、未終了 member の identity / state を追跡できる診断情報が残る。

## Verification

- 上記 4 ケースの focused automated tests を追加し、修正前に failure を再現できることを確認する。
- 既存の正常終了パスと process identity 判定に回帰がないことを確認する。

## Evidence

- `src/lib/agent.js:583-593`
- `src/lib/agent.js:648-656`
- `src/lib/process-identity.js:25-33`

## Out of Scope

- Windows の `taskkill` path
- 本件と無関係な agent lifecycle refactor
- bounded post-`SIGKILL` deadline を支える以上の public timeout policy 変更

</details>