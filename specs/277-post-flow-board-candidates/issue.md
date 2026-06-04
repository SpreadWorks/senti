## Background
Near the end of the flow, candidates derived from the issue-log are presented as "select candidates to add as board drafts," but this is a separate post-processing step from the main SDD flow. Currently, it is included as a pre-process before finalize-cleanup, so an optional board registration decision is inserted before the flow is complete.

## Fix Policy
- Remove the Pre-cleanup workflow board integration from src/flow/prompts/impl/finalize-cleanup.md.
- Add board registration candidate presentation as optional post-flow processing after the loop exit in src/skills/sdd-forge.flow/SKILL.md.
- Limit the execution conditions to cases where finalize-cleanup has succeeded, flow get status is active:false, and workflow.flowIntegration in .sdd-forge/config.json is enable.
- After cleanup, use .sdd-forge/last-finalized-spec and run issue-log-import --spec <lastFinalizedSpec> from the finalized spec on the main repo side.
- Treat failures in issue-log-import or workflow add as post-processing failures after flow completion, and do not let them affect the flow completion state.

## Suggested Wording
"Board registration candidates"

The flow is complete.
There are candidates from notes left in the issue-log that can be registered on the board as separate tasks.
This is optional post-processing and does not affect the completion state of this flow.

Options:
[1] Register by specifying numbers — for example, choose like 1,3
[2] Register all — add all displayed candidates to Ideas
[3] Do not register — add nothing to the board

## Test Points
- Confirm that finalize-cleanup.md no longer contains candidate presentation processing for issue-log-import / workflow add.
- Confirm that the sdd-forge.flow skill contains post-flow candidate presentation.
- Confirm that post-flow processing is guided only when workflow.flowIntegration is enable.
- Since src/skills/ is changed, run sdd-forge upgrade after implementation.

## References
- src/flow/prompts/impl/finalize-cleanup.md
- src/skills/sdd-forge.flow/SKILL.md
- src/workflow/lib/commands/issue-log-import.js
- src/workflow/registry.js
- specs/270-workflow-flow-integration/tests/templates.test.js

<details>
<summary>ja</summary>

[ENHANCE] flow 完了後にボード登録候補を提示する

## 背景
flow の最後の方で issue-log 由来の候補を「board draft に追加する候補を選択」として提示しているが、これは本筋の SDD flow とは別の後処理である。現在は finalize-cleanup の前処理に入っているため、flow 完了前に任意のボード登録判断が挟まってしまう。

## 修正方針
- src/flow/prompts/impl/finalize-cleanup.md の Pre-cleanup workflow board integration を削除する。
- src/skills/sdd-forge.flow/SKILL.md の loop exit 後に、任意の post-flow 処理としてボード登録候補提示を追加する。
- 実行条件は、finalize-cleanup 成功後、flow get status が active:false、かつ .sdd-forge/config.json の workflow.flowIntegration が enable の場合に限定する。
- cleanup 後は .sdd-forge/last-finalized-spec を使い、main repo 側の finalized spec から issue-log-import --spec <lastFinalizedSpec> を実行する。
- issue-log-import や workflow add の失敗は flow 完了後の後処理失敗として扱い、flow 完了状態には影響させない。

## 文言案
「ボード登録候補」

flow は完了しています。
issue-log に残った気づきから、別タスクとしてボードに登録できる候補があります。
これは任意の後処理で、今回の flow の完了状態には影響しません。

選択肢:
[1] 番号を指定して登録 — 例: 1,3 のように選ぶ
[2] すべて登録 — 表示した候補をすべて Ideas に追加
[3] 登録しない — ボードには何も追加しない

## テスト観点
- finalize-cleanup.md に issue-log-import / workflow add の候補提示処理が残っていないこと。
- sdd-forge.flow skill 側に post-flow の候補提示があること。
- workflow.flowIntegration が enable のときだけ post-flow 処理が案内されること。
- src/skills/ を変更するため、実装後に sdd-forge upgrade を実行すること。

## 参考箇所
- src/flow/prompts/impl/finalize-cleanup.md
- src/skills/sdd-forge.flow/SKILL.md
- src/workflow/lib/commands/issue-log-import.js
- src/workflow/registry.js
- specs/270-workflow-flow-integration/tests/templates.test.js

</details>