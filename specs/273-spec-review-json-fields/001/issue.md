## Problem
The spec-review provider returned JSON missing blockingFindings / nonBlockingImprovements, causing CLI schema validation to fail. The same failure occurred 3 consecutive times, making it impossible to create the spec-review artifact.

## Why This Is a Problem
The CLI cannot mechanically determine whether blocking findings are genuinely zero or whether required fields are simply absent. As a result, it cannot create the review trace needed to proceed to subsequent steps.

## Proposed Improvements
- Explicitly state required fields in the spec-review prompt so that empty arrays are returned even when there are no findings.
- On the CLI side, if only these 2 fields are missing, auto-fill them with empty arrays.
- If auto-fill is not possible, re-prompt using a schema-repair-only prompt to get corrected output.

<details>
<summary>ja</summary>

[BUG] spec-review provider が必須 field を含む JSON を返せない

## 問題
spec-review provider が blockingFindings / nonBlockingImprovements を含まない JSON を返し、CLI の schema validation に失敗した。同じ failure が3回連続で発生し、spec-review artifact を作成できなかった。

## なぜ問題か
CLI は blocking finding が 0 件なのか、必須 field が欠落しているだけなのかを機械的に判断できない。そのため後続 step に進めるための review 証跡を作れない。

## 改善方向
- spec-review prompt で必須 field を明示し、指摘なしでも空配列を返させる。
- CLI 側でも、この2 field の欠落だけなら空配列補完する。
- 補完不能な場合は schema 修復専用 prompt で再出力させる。

</details>