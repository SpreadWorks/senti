## Summary

In `final-regression`, the conditions for generating completion evidence are not strict enough, and there are paths where a "completed" artifact can be left behind even when the final regression has not actually been satisfied.

There are currently three issues:

- `0 test` with exit code `0` can be treated as success.
- During a regression failure, `autoApprove` can still recommend `record-and-proceed`.
- The generated artifact is not exactly bound to the verified `HEAD` / `tree` / `command` / `result`.

This issue assumes the failure classification introduced in `#403`, and implements a corrective follow-up that strengthens the safety conditions for proceed / record on top of it.

## Problem

The purpose of `final-regression` is to leave behind verifiable evidence that either "the final regression passed" or "it did not pass, but the run proceeded through an explicit exception decision."

However, completion artifacts can currently be generated even in cases such as:

- Success-looking runs where no tests actually ran
- Runs where output is missing or truncated, so the result cannot be fully confirmed
- Runs where the commit / tree from execution time and the artifact binding are stale or mismatched
- Runs where `record-and-proceed` is selected semi-automatically despite a regression failure

In this state, the artifact can become a "record that looks complete" rather than "evidence of completion."

## Required Invariants

- Final regression is treated as complete only when there is positive test execution and complete results.
- `record-and-proceed` must be an explicit, evidence-backed exception flow and must not be selected automatically.
- Evidence must be exactly bound to the verified `HEAD` / `tree` / `command` / `result`.

## Scope

In scope:

- `src/flow/lib/run-final-regression.js`
- Related artifact schema
- Focused tests

Out of scope:

- Removing or weakening the failure classification added in `#403`

This issue does not replace `#403`; it is a corrective follow-up that supplements the safety conditions on top of it.

## Acceptance Criteria

- A run with `0 test` and exit code `0` is not treated as final regression completion.
- Runs whose results cannot be fully confirmed, such as truncated output, are not treated as final regression completion.
- Artifacts bound to stale or mismatched `HEAD` / `tree` values are not generated or accepted as completion evidence.
- `autoApprove` does not automatically select `record-and-proceed` for failed or incomplete regressions.
- Explicit proceed requires failure classification, operator-provided evidence / justification, and exact binding to the target commit / tree.
- Focused tests cover at least the following:
  - zero-test success-looking exit
  - truncated output
  - stale binding
  - proceed attempt for failed regression

## Evidence

- Recommended action selection around `src/flow/lib/run-final-regression.js:348`
- Zero-test validation paths around `src/flow/lib/run-final-regression.js:883` and `src/flow/lib/run-final-regression.js:988`
- Completed-fail artifact generation path in the same module

## Outcome

Completion artifacts are left behind only as evidence that can be strictly revalidated against the target commit / tree / command / result, proving either that "the regression passed" or that "it did not pass, but execution proceeded through an explicit, evidence-backed override."

<details>
<summary>ja</summary>

final-regressionのrecord-and-proceedに厳密な証跡を要求する

## Summary

`final-regression` では、完了証跡を生成する条件が十分に厳密ではなく、最終回帰が実際には成立していない実行でも「完了済み」の artifact を残せる経路がある。

現在の問題は次の 3 点。

- `0 test` かつ exit code `0` を成功として扱えてしまう。
- regression failure 時にも `autoApprove` が `record-and-proceed` を推奨できてしまう。
- 生成される artifact が、検証対象の `HEAD` / `tree` / `command` / `result` に exact binding されていない。

この issue では、`#403` で導入された failure classification を前提に、その上で proceed / record の安全条件を補強する corrective follow-up を行う。

## Problem

`final-regression` の目的は、「最終回帰が成立した」こと、または「成立していないが明示的な例外判断で proceed した」ことを、後から検証可能な形で残すことにある。

しかし現状は、以下のようなケースでも completion artifact を生成できる。

- 実際にはテストが 1 件も走っていない成功風の実行
- 出力が欠落または truncated しており、結果が完全に確認できない実行
- 実行時の commit / tree と artifact の結び付きが stale または mismatched な実行
- regression failure であるにもかかわらず、`record-and-proceed` が半自動的に選ばれる実行

この状態では、artifact が「完了の証跡」ではなく「完了に見える記録」になりうる。

## Required Invariants

- final regression は、正の test execution と完全な結果がある場合にのみ完了扱いにする。
- `record-and-proceed` は、明示的かつ根拠付きの例外フローとし、自動選択しない。
- 証跡は、検証対象の `HEAD` / `tree` / `command` / `result` に exact binding されている必要がある。

## Scope

対象:

- `src/flow/lib/run-final-regression.js`
- 関連 artifact schema
- focused tests

非対象:

- `#403` で追加された failure classification の削除や後退

本件は `#403` を置き換えるものではなく、その上に安全条件を補完する corrective follow-up とする。

## Acceptance Criteria

- `0 test` かつ exit code `0` の実行は、final regression 完了として扱わない。
- truncated output など、結果が完全に確認できない実行は、final regression 完了として扱わない。
- stale または mismatched `HEAD` / `tree` に bind された artifact は、完了証跡として生成または受理しない。
- `autoApprove` は、failed regression または incomplete regression に対して `record-and-proceed` を自動選択しない。
- explicit proceed には、failure classification、operator-provided evidence / justification、対象 commit / tree への exact binding を必須とする。
- focused tests で少なくとも以下を網羅する。
  - zero-test success-looking exit
  - truncated output
  - stale binding
  - failed regression での proceed attempt

## Evidence

- `src/flow/lib/run-final-regression.js:348` 付近の recommended action selection
- `src/flow/lib/run-final-regression.js:883` および `src/flow/lib/run-final-regression.js:988` 付近の zero-test validation path
- 同モジュール内の completed-fail artifact generation path

## Outcome

完了 artifact は「回帰が成立した」または「成立していないが、根拠付きの明示的 override で proceed した」ことを、対象 commit / tree / command / result に対して厳密に再確認できる証跡としてのみ残るようにする。

</details>