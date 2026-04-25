## Symptom

When `flow run review` (impl phase) completes successfully, the envelope returns all counters as 0:

```json
{
  "artifacts": {
    "proposalCount": 0,
    "approved": 0,
    "rejected": 0
  },
  "output": "Approved proposals:\n  - 1. ...\n  - 5. ...\n\nReview the proposals above and in review.md."
}
```

Meanwhile, review.md correctly records multiple proposals (e.g., APPROVED 2 / REJECTED 3 out of 5), and the envelope's output field (stdout) also lists the APPROVED entries. **Only the counters are stuck at 0 and do not match stdout / review.md.**

Existing Issue #236 (hash=ac7d, resolved in spec 219) is a separate problem where out-of-scope proposals remain in review.md. This issue is different: review.md content is correct, only the counter side is broken.

## Root Cause

`src/flow/lib/run-review.js:170-178` parses the stderr of the spawned `review.js` subprocess using regex to extract counters:

```js
const proposalMatch = stderr.match(/(\d+) proposal\(s\) generated/);
const approvedMatch = stderr.match(/(\d+) approved/);
const rejectedMatch = stderr.match(/(\d+) rejected/);
```

On the `review.js` side, lines 1013 and 1029 write `X proposal(s) generated` / `N approved, M rejected` to stderr via `console.error`.

The problem is in the caller's `src/lib/process.js:26-36` `runCmd`:

```js
export function runCmd(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, { ... });
    return { ok: true, status: 0, stdout: String(stdout || ""), stderr: "", signal: null, killed: false };
  } catch (e) {
    return { ok: false, ..., stderr: String(e.stderr || ""), ... };
  }
}
```

`execFileSync` returns **only stdout** by spec; there is no way to capture stderr on success. As a result, runCmd returns an empty string for stderr on success, the regex on the caller side matches nothing, and all counters become 0. On **failure**, `e.stderr` is available in the catch block, so the fix from 81a0 (PR #97) works — but the **success path was never addressed** and remains broken.

Reproduction:

```
$ node -e "import('./src/lib/process.js').then(m => { const r = m.runCmd('node', ['-e', 'console.log(\"OUT\"); console.error(\"ERR\");']); console.log(JSON.stringify(r)); })"
{"ok":true,"status":0,"stdout":"OUT\n","stderr":"","signal":null,"killed":false}
```

## Impact

- `flow run review` envelope counters are always 0, causing the skill / upper logic to misidentify the result as "0 proposals"
- The skill branch (`approved === 0 ? "finalize" : "apply"`) always takes the finalize route, so auto-apply never fires
- The skill falls back to reading review.md and applying manually, so APPROVED proposals are never automatically reflected and the review improvement benefit is lost
- Any other locations that reference runCmd's stderr on the success path (if any) would exhibit the same symptom

## Proposed Fix

Replace `execFileSync` with `spawnSync` in `src/lib/process.js` `runCmd` so stderr is returned on success as well:

```js
const res = spawnSync(cmd, args, {
  cwd: opts.cwd, encoding: opts.encoding || "utf8", timeout: opts.timeout,
  maxBuffer: opts.maxBuffer, ...(opts.env && { env: opts.env }),
});
return {
  ok: res.status === 0 && !res.signal && !res.error,
  status: res.status ?? 1,
  stdout: String(res.stdout || ""),
  stderr: String(res.stderr || ""),
  signal: res.signal ?? null,
  killed: Boolean(res.error && res.error.code === "ETIMEDOUT"),
};
```

However, **if investigation during implementation reveals a more appropriate approach, that approach may be adopted** (e.g., keeping execFileSync while attaching a separate stderr-only pipe, capturing via an error handler, or changing the caller's contract from stderr-dependent to stdout-dependent). The priority is that "callers can observe stderr even on success."

As an alternative, the caller contract in `run-review.js` could be changed so that `review.js` outputs structured JSON to stdout and the parent parses that. This would be more robust than regex, but requires changing review.js's output spec and has a larger impact radius.

## Related

- Issue #236 (hash=ac7d) — consistency fix for review.md content. This issue is a separate bug on the envelope counter side
- 81a0 — runCmd failure-path stderr / signal preservation fix. This issue is a separate case for the success path
- `src/lib/process.js`, `src/flow/lib/run-review.js`, `src/flow/commands/review.js`

## Source

Discovered during spec 221 (fix-gate-phase-detection) implementation while running `flow run review` in auto mode. review.md was correctly generated with APPROVED 2 / REJECTED 3, and the APPROVED list appeared in the envelope's output field, but the same envelope's artifacts showed `proposalCount=0, approved=0, rejected=0`. Root cause was identified by inspecting the process.js implementation.

<details>
<summary>ja</summary>

[BUG] runCmd が成功時の stderr を捨てるため flow run review の envelope counter が常に 0 になる

## 症状

`flow run review`（impl phase）が正常完了した場合、envelope は次のように全 counter が 0 で返る:

```json
{
  "artifacts": {
    "proposalCount": 0,
    "approved": 0,
    "rejected": 0
  },
  "output": "Approved proposals:\n  - 1. ...\n  - 5. ...\n\nReview the proposals above and in review.md."
}
```

一方 review.md には複数の提案（例: 5 件中 APPROVED 2 / REJECTED 3）が正しく記録されており、envelope の output フィールド（stdout）にも APPROVED の一覧が出力されている。**counter のみが 0 で固定されて stdout / review.md と一致しない**。

既存 Issue #236 (hash=ac7d, spec 219 で解決済み) は「out-of-scope 提案が review.md に残る」別問題。本件は review.md の内容は正しく、counter 側だけが壊れている。

## 原因

`src/flow/lib/run-review.js:170-178` は、spawn した `review.js` サブプロセスの stderr を正規表現で解析して counter を抽出する:

```js
const proposalMatch = stderr.match(/(\d+) proposal\(s\) generated/);
const approvedMatch = stderr.match(/(\d+) approved/);
const rejectedMatch = stderr.match(/(\d+) rejected/);
```

`review.js` 側は line 1013 と 1029 で `console.error` 経由で `X proposal(s) generated` / `N approved, M rejected` を stderr に書いている。

問題は呼び出し側の `src/lib/process.js:26-36` の `runCmd`:

```js
export function runCmd(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, { ... });
    return { ok: true, status: 0, stdout: String(stdout || ""), stderr: "", signal: null, killed: false };
  } catch (e) {
    return { ok: false, ..., stderr: String(e.stderr || ""), ... };
  }
}
```

`execFileSync` は戻り値として **stdout のみ** を返す仕様で、成功時には stderr を取得する手段がない。そのため runCmd は成功時に stderr を空文字で返し、呼び出し側の正規表現は何もマッチせず counter が全て 0 になる。**失敗時** は `catch` 節で `e.stderr` を取れるため既存 81a0 (PR #97) の改修が効いているが、**成功時は影響範囲外**で未対処のまま残っている。

再現:

```
$ node -e "import('./src/lib/process.js').then(m => { const r = m.runCmd('node', ['-e', 'console.log(\"OUT\"); console.error(\"ERR\");']); console.log(JSON.stringify(r)); })"
{"ok":true,"status":0,"stdout":"OUT\n","stderr":"","signal":null,"killed":false}
```

## 影響

- `flow run review` envelope の counter が常に 0 で、skill / 上位ロジックが「提案 0 件」と誤認する
- skill の分岐（`approved === 0 ? "finalize" : "apply"`）が常に finalize ルートに入り、自動適用が発火しない
- skill が review.md を読んで手動適用を行う形になるため、APPROVED の自動反映が働かず、レビュー改善の恩恵を得られない
- 他にも runCmd の stderr を success path で参照している箇所（あれば）は同様の症状を抱える

## 対応案

`src/lib/process.js` の `runCmd` を `execFileSync` から `spawnSync` に置き換え、成功時も stderr を返す:

```js
const res = spawnSync(cmd, args, {
  cwd: opts.cwd, encoding: opts.encoding || "utf8", timeout: opts.timeout,
  maxBuffer: opts.maxBuffer, ...(opts.env && { env: opts.env }),
});
return {
  ok: res.status === 0 && !res.signal && !res.error,
  status: res.status ?? 1,
  stdout: String(res.stdout || ""),
  stderr: String(res.stderr || ""),
  signal: res.signal ?? null,
  killed: Boolean(res.error && res.error.code === "ETIMEDOUT"),
};
```

ただし **実装時の調査で別の方法が適切と判断された場合は、その方法を採用して良い**（例: execFileSync を残したまま stderr-only パイプを別途張る、error ハンドラ経由で取る、呼び出し側の契約を stderr 依存から stdout 依存に変更する等）。優先事項は「成功時でも呼び出し側が stderr を観測できる」こと。

副次的に、呼び出し側 `run-review.js` の契約を「review.js 側が structured JSON を stdout に出し、親はそれを parse」に改めるのも選択肢。こちらのほうが regex よりも堅いが、review.js の出力仕様変更を伴うため影響範囲大。

## 関連

- Issue #236 (hash=ac7d) — review.md 内容側の整合修正。本件は envelope counter 側の別バグ
- 81a0 — runCmd 失敗時の stderr / signal 保持改修。本件は成功時の別ケース
- `src/lib/process.js`, `src/flow/lib/run-review.js`, `src/flow/commands/review.js`

## 出典

spec 221 (fix-gate-phase-detection) 実装時に auto モードで `flow run review` を実行。review.md は APPROVED 2 / REJECTED 3 で正しく生成され、envelope の output フィールドにも APPROVED リストが出力されていたが、同 envelope の artifacts は `proposalCount=0, approved=0, rejected=0`。process.js の実装を確認して原因特定。

</details>