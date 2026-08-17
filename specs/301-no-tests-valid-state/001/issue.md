## Background
The regression-test-related steps in flow assume that tests exist in the project. In reality, depending on the project or the nature of the changes, there are cases where tests are not written or do not exist, so the absence of tests needs to be expressible as a valid state rather than a broken state.

## Current Problems
- test-execute assumes that a spec-local test_file / test_name always exists for each testable requirement.
- When there are zero spec-local tests and there are testable requirements, it constructs missing.test.js as evidence, but then hits ENOENT while reading the file, so test-execute-result.json and the raw log are not created.
- When there is no project-level regression command, final-regression classifies the case as invalid_project_test instead of a valid skip due to no tests.
- As a result, projects without tests are treated as having broken test configuration, producing nextAction=test-repair on the first run and nextAction=stop on the second run.
- Downstream steps also treat test-execute-result.json / test-result-review.json / retro.json / final-regression-result.json as contracts that assume test execution, with no explicit state for no tests.

## Expected State
- Add valid result states to flow's state model, such as no_tests_declared / not_applicable / skipped_by_project_policy.
- Do not directly turn the absence of tests into a prerequisite failure or invalid_project_test; instead, explicitly record it in artifacts as skip / not applicable based on project configuration, spec requirements, and change type.
- Make it possible to mechanically validate the absence of tests in schemas and post-hook checks for files such as test-execute-result.json.
- Treat this as a matter of artifact contract and step promotion design, rather than simply swallowing ENOENT.

## Confirmed Behavior
- Zero spec-local tests + testable requirements present: test-execute fails with ENOENT for missing.test.js, and the normal artifacts are not created.
- No project-level regression command: final-regression creates a fail artifact with invalid_project_test.
- Only when there are zero testable requirements can test-execute succeed with summary: [].

<details>
<summary>ja</summary>

[BUG] flow がテストなしプロジェクトを正当な状態として扱えない

## 背景
flow の回帰テスト系 step が、プロジェクトにテストが存在することを前提にしている。実際には、プロジェクトや変更内容によってはテストを書かない/持たないケースがあるため、テスト不在を壊れた状態ではなく正当な状態として表現できる必要がある。

## 現状の問題
- test-execute は testable requirement ごとに spec-local test_file / test_name が必ず存在する前提になっている。
- spec-local テストが 0 件かつ testable requirement がある場合、missing.test.js を証跡として組み立てた後にファイル読み込みで ENOENT になり、test-execute-result.json と raw log が作られない。
- final-regression は project-level regression command が無い場合、テストなしの正当スキップではなく invalid_project_test と分類する。
- その結果、テストを持たないプロジェクトが「テスト設定が壊れている」扱いになり、1 回目は nextAction=test-repair、2 回目は nextAction=stop になる。
- downstream も test-execute-result.json / test-result-review.json / retro.json / final-regression-result.json をテスト実行ありきの contract として扱っており、no tests の明示状態がない。

## 期待する状態
- flow の状態モデルに no_tests_declared / not_applicable / skipped_by_project_policy のような正当な結果状態を追加する。
- テストが無いことを prerequisite failure や invalid_project_test に直結させず、プロジェクト設定・spec 要件・変更種別に基づいて明示的に skip / not applicable として artifact に残す。
- test-execute-result.json などの schema と post-hook 判定で、テスト不在を機械的に検証できるようにする。
- 単に ENOENT を握りつぶすのではなく、artifact contract と step promotion の設計として扱う。

## 確認済みの挙動
- spec-local テスト 0 件 + testable requirement あり: test-execute が missing.test.js の ENOENT で落ち、通常 artifact が作られない。
- project-level regression command なし: final-regression が invalid_project_test で fail artifact を作る。
- testable requirement 0 件の場合だけ、test-execute は summary: [] で成功しうる。

</details>