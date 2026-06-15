Improve AI agent config generation in `senti setup` and how agent settings are presented.

## Current Behavior
- Agent selection in setup is an either/or choice between claude and codex.
- If codex is selected, `agent.default` is saved as `codex/gpt-5.4`; if claude is selected, it is saved as `claude/sonnet`.
- Because setup / upgrade seed `profiles/providers` into config, provider keys / model names in existing configs tend to become outdated when models are updated.
- The reason `profiles/providers` were expanded into config was to make users aware of what settings are available.

## Expected Behavior
- Setup should allow selecting multiple agents to make available.
  - Examples: claude only, codex only, claude + codex.
- If multiple agents are selected, ask an additional question about which one should be the main/default agent.
- `agent.default` should save a shortened family alias, not a concrete provider key.
  - codex main: `agent.default = "codex"`
  - claude main: `agent.default = "claude"`
- `agent.useProfile` should be set according to the selected agent configuration and main agent.
  - codex only: `codex-only`
  - claude only: `claude-only`
  - claude + codex with codex main: `codex-main`
  - claude + codex with claude main: `claude-main`
- Consider saving only the user-selected intent and overrides in config, and avoid bulk-copying built-in profiles/providers during normal setup.

## Setting Discoverability
- Explain configurable built-in profiles/providers in docs/help instead of seeding them into config.
- When setup completes, briefly display the selected main/useProfile and available built-in profile names.
- Add explanations and override examples for `agent.default`, `agent.useProfile`, `agent.profiles`, and `agent.providers` to existing help / docs.
- If necessary, consider a list command for checking currently active built-in profiles/providers.
- A sample generation command such as `senti config example agent` is unnecessary.

## Upgrade / Migration Notes
- At the time of investigation, `src/upgrade.js` calls `mergeAgentDefaults(raw.agent)` as long as `raw.agent` exists, and writes `profiles/providers` to config add-only.
- As-is, even if setup stops seeding, the next `senti upgrade` will expand built-in profiles/providers into config again, contradicting the policy of following model updates.
- During implementation, stop seeding agent defaults in upgrade, or limit it to explicit legacy migration / opt-in.
- Specify how to handle existing configs that already contain seeded profiles/providers.
  - Respect them as-is and treat them as fixed overrides.
  - Provide a migration that deletes/compacts only entries that can be identified as managed by senti.
  - For entries that cannot be identified, it is safest to preserve them as user changes.
- `validate()` in `src/lib/config.js` currently validates `agent.useProfile` only when it is defined inside `agent.profiles`. If the design no longer keeps built-in profiles in config, both validation and the runtime resolver need to be able to resolve built-in profile names.
- The role names and comments in `src/lib/agent-defaults.js` also need to be revised from seed-oriented defaults to runtime built-in defaults.

## Design Notes
- Prepare a resolver that can reference built-in profiles/providers at runtime, so recommended model updates in the package are reflected in existing projects too.
- If the user explicitly writes `config.agent.providers / profiles`, prioritize those overrides and do not overwrite them automatically.
- Users who want to pin a model should write a custom provider/profile in config. Treat this as an explicit pin that does not follow updates.
- Organize setup questions in an order such as: "select multiple available agents" -> "select main/default agent" -> "choose AGENTS.md / CLAUDE.md generation targets".

## Impact Scope
- `src/setup.js`
- `src/upgrade.js`
- `src/lib/config.js`
- Resolver design around `src/lib/agent.js` / `src/lib/provider.js` / `src/lib/agent-defaults.js`
- Config generation / migration tests for setup / upgrade
- Tests for agent default alias / useProfile / profile resolution
- Help / locale / docs wording

<details>
<summary>ja</summary>

setup の agent 選択を複数選択化し default/useProfile を適切に設定する

senti setup の AI agent 設定生成と、agent 設定の見せ方を改善する。

## 現状
- setup の agent 選択が claude / codex の 2 者択一になっている。
- codex を選ぶと agent.default が codex/gpt-5.4、claude を選ぶと claude/sonnet として保存される。
- setup / upgrade が profiles/providers を config に seed するため、モデル更新時に既存 config 内の provider key / model 名が古くなりやすい。
- config に profiles/providers を展開していた理由は、ユーザーに「どういう設定が可能か」を認知させるためだった。

## 期待動作
- setup では利用可能にする agent を複数選択できるようにする。
  - 例: claude のみ、codex のみ、claude + codex。
- 複数選択された場合は、どちらを main/default agent にするか追加で聞く。
- agent.default は具体 provider key ではなく、短縮 family alias を保存する。
  - codex main: agent.default = "codex"
  - claude main: agent.default = "claude"
- agent.useProfile は選択された agent 構成と main agent に応じて設定する。
  - codex のみ: codex-only
  - claude のみ: claude-only
  - claude + codex かつ codex main: codex-main
  - claude + codex かつ claude main: claude-main
- config にはユーザーが選んだ intent と override だけを保存し、通常 setup では built-in profiles/providers を大量コピーしない方向を検討する。

## 設定の認知性
- 設定可能な built-in profiles/providers は config へ seed するのではなく、docs/help で説明する。
- setup 完了時に、選択された main/useProfile と、利用可能な built-in profile 名を短く表示する。
- 既存の help / docs に agent.default, agent.useProfile, agent.profiles, agent.providers の説明と override 例を載せる。
- 必要なら現在有効な built-in profiles/providers を確認できる一覧コマンドを検討する。
- senti config example agent のようなサンプル生成コマンドは不要。

## upgrade / migration 注意点
- 調査時点で src/upgrade.js は raw.agent が存在するだけで mergeAgentDefaults(raw.agent) を呼び、profiles/providers を add-only で config に書き込む。
- このままだと setup 側だけ seed をやめても、次回 senti upgrade で built-in profiles/providers が再び config に展開され、モデル更新追従方針と矛盾する。
- 実装時は upgrade の agent defaults seed を停止するか、明示的な legacy migration / opt-in に限定する必要がある。
- 既存 config に既に seed 済みの profiles/providers がある場合の扱いを仕様化する。
  - そのまま尊重して固定 override とみなすのか。
  - senti 管理由来と判定できるものだけ削除/縮約する migration を用意するのか。
  - 判定不能なものはユーザー変更として保持するのが安全。
- src/lib/config.js の validate() は現状、agent.useProfile が agent.profiles 内に定義されている場合だけ検証する。built-in profile を config に持たない設計にするなら、validate と runtime resolver の両方が built-in profile 名を解決できる必要がある。
- src/lib/agent-defaults.js の役割名・コメントも、seed 用から runtime builtin defaults 用へ見直す必要がある。

## 設計メモ
- 実行時に built-in profiles/providers を参照できる resolver を整備し、package 側の推奨モデル更新が既存プロジェクトにも反映されるようにする。
- ユーザーが明示的に config.agent.providers / profiles を書いた場合は、その override を優先し、勝手に上書きしない。
- モデルを固定したいユーザーは custom provider/profile を config に書く。これは更新追従しない明示的な固定として扱う。
- setup の質問順は「利用可能 agent を複数選択」→「main/default agent を選択」→「AGENTS.md / CLAUDE.md 生成対象をどうするか」のように整理する。

## 影響範囲
- src/setup.js
- src/upgrade.js
- src/lib/config.js
- src/lib/agent.js / src/lib/provider.js / src/lib/agent-defaults.js 周辺の resolver 設計
- setup / upgrade の config 生成・migration テスト
- agent default alias / useProfile / profile 解決テスト
- help / locale / docs 文言

</details>