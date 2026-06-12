Background:
When trying to publish workflow plugin board item b6fb, the plugin itself was discovered and the workflow command could be executed, but publishing failed with: No agent configured. Set agent.default in config.json or run senti setup.

Direct cause:
The core-side Agent instance was passed into the plugin context, but Agent.resolve("workflow.publish") could not resolve a provider/profile. As a result, when the workflow plugin's publish reached ctx.agent.call(), it failed with No agent configured.

Observed configuration:
The core config contains agent.default and agent.useProfile, but agent.default: "codex" is not a resolvable profile key, and the useProfile: "codex-only" profile did not have mappings for workflow.publish / workflow.*. Therefore, even when the plugin command fell back to the generic default agent, it could not be resolved.

Temporary workaround:
Adding plugin.config.workflow.agent.publish.provider = "codex/gpt-5.5" or similar to the ignored local overlay .senti/config.local.json made publishing succeed. b6fb was eventually published as issue #377.

Problem:
Plugin commands are designed to use the core public Agent context, so even when the plugin side passes a commandId, the core-side generic default agent / active profile fallback needs to work as expected. Currently, if the plugin commandId is not registered in the project profile, there are cases where resolution fails even though a default setting exists.

Expected fix:
- The generic default agent should be resolved even for ctx.agent.call(prompt, { commandId: "<plugin>.<operation>" }) from a plugin command
- Clarify whether agent.default accepts a provider alias or a profile key, and if the existing config value agent.default: "codex" is meant to have meaning, make it resolvable
- When there is no plugin-specific override, resolve the agent using the same fallback policy as normal commands
- If resolution fails, return an error that shows which commandId / profile / default were checked

Test considerations:
- ctx.agent.call({ commandId: "workflow.publish" }) in a plugin command context is resolved through the project default profile
- Even when the active useProfile does not contain the plugin commandId, it falls back to the default profile / default provider
- If a plugin-specific provider override exists in the local overlay, it takes precedence
- If agent.default is set to an unresolvable value, the error includes the commandId and the attempted profile/default

Classification:
The direct bug is on the core side. There is room for improvement on the plugin side to make the error clearer when the required agent configuration is missing.

<details>
<summary>ja</summary>

[BUG] plugin commandでdefault agentが解決されない問題を修正する

背景:
workflow plugin の board item b6fb を publish しようとした際、plugin 自体は discover され、workflow command も実行できていたが、publish 時に No agent configured. Set agent.default in config.json or run senti setup. で失敗した。

直接原因:
plugin context には本体側 Agent instance が渡っていたが、Agent.resolve("workflow.publish") が provider/profile を解決できなかった。結果として workflow plugin の publish が ctx.agent.call() に到達した時点で No agent configured になった。

観測された設定:
本体 config には agent.default と agent.useProfile が存在するが、agent.default: "codex" は解決可能な profile key ではなく、useProfile: "codex-only" の profile に workflow.publish / workflow.* の対応がなかった。そのため plugin command が generic default agent に fallback しても解決できなかった。

暫定回避:
ignored local overlay の .senti/config.local.json に plugin.config.workflow.agent.publish.provider = "codex/gpt-5.5" などを追加すると publish は成功した。b6fb は最終的に issue #377 として publish できた。

問題:
plugin command は本体の public Agent context を使う設計なので、plugin 側が commandId を渡した場合でも、本体側の generic default agent / active profile fallback が期待通りに機能する必要がある。現状は plugin commandId が project profile に登録されていないと、default 設定があっても解決不能になるケースがある。

期待する修正:
- plugin command からの ctx.agent.call(prompt, { commandId: "<plugin>.<operation>" }) でも generic default agent が解決されること
- agent.default に provider alias か profile key のどちらを許容するのかを明確化し、既存 config の agent.default: "codex" が意味を持つなら解決できるようにすること
- plugin-specific override がない場合でも、通常の command と同じ fallback policy で agent が解決されること
- 解決不能な場合は、どの commandId / profile / default を見て失敗したか分かる error にすること

テスト観点:
- plugin command context の ctx.agent.call({ commandId: "workflow.publish" }) が project default profile で解決される
- active useProfile に plugin commandId がない場合でも default profile / default provider へ fallback する
- local overlay の plugin-specific provider override がある場合はそれが優先される
- agent.default が解決不能な設定の場合、エラーに commandId と試行した profile/default が含まれる

分類:
直接のバグは本体側。plugin 側には必要 agent 設定がない場合のエラーを分かりやすくする改善余地がある。

</details>