# 対象

senti workflow 機能の完全 plugin 化。workflow 実装、skill、config、tests、flow integration、GitHub Projects 操作を `/home/nakano/workspace/senti-workflow-plugin` 側へ移し、本体 repo から workflow 固有実装を削除する。

# 問題

現在の workflow plugin は command / skill / config の登録だけが plugin 側にあり、実行時は本体の `src/workflow/index.js` を import している。また plan draft や finalize 後の処理が flow prompt / skill 文面に直書きされており、AI の認識と実行に依存している。

# 原因

workflow の実行ロジック、flow lifecycle integration、GitHub Projects 操作、agent 呼び出し、help、tests が本体 repo に残っている。plugin command / hook runtime は 1/3 の plugin 基盤に依存して整備する必要がある。

# 改善方針

2/3 として、1/3 の plugin 基盤が提供する command / hook / config / agent API を使い、workflow を plugin repository 側へ完全移行する。9f78 の workflow 関連決定を圧縮せず、下記の方針を実装対象にする。

# workflow plugin での利用想定
- prepare.post: linked issue が確定した状態で workflow plugin の issue-start 相当を実行する。
- finalize-cleanup.post: finalize-cleanup 成功後、.senti/last-finalized-spec が書かれ active flow が終了した状態で workflow plugin の board idea 候補抽出を実行する。
- workflow add 相当の候補登録はユーザー選択を伴うため、finalize hook で自動登録まではしない。まず候補抽出と artifact / follow-up action の記録までを deterministic に行い、自動登録は別途明示 opt-in にする。

# workflow 移行の詳細方針

## workflow skill / flow prompt の直書き除去
hook 基盤実装後、src/skills/senti.flow/SKILL.md と src/flow/prompts/plan/draft.md に残る workflow 固有指示を削除する。workflow 固有の flowIntegration 判定や issue-start / issue-log-import は workflow plugin hook 側へ移す。

## official workflow plugin bootstrap 方針
完全移行後、本体は workflow command 名を知らない。upgrade が resolveCommand("workflow") を見て official workflow plugin を入れる現在の特別扱いは削除対象。workflow plugin は明示 install のみで有効化する。setup でも workflow 固有選択肢としては扱わない。

## workflow tests 移行方針
workflow plugin 完全移行後、本体 repo の tests には workflow 固有の test / fixture / 期待値を残さない。workflow の具体機能テストは workflow plugin repo 側へ移す。

本体 repo に残すのは、plugin command / hook / config / preset loader など plugin 基盤の contract test のみとする。必要な fixture も workflow という名前や workflow 固有文言を使わず、汎用 plugin fixture に置き換える。

## plugin command runtime API 方針
workflow plugin の通常 command も、hook と同じく本体 package / internal path を import しない factory 形式にする。現状の `export async function main(argv, ctx)` に本体 ctx を渡すだけの形にはしない。

想定例。

```js
export default function register(api) {
  return {
    async main(argv, context) {
      // plugin command logic
    }
  };
}
```

plugin command loader は `register(api)` を呼び、返された command object の `main(argv, context)` を実行する。Envelope、config、agent、project root など本体側機能は api / context 経由で提供する。

## workflow plugin の AI 呼び出し設定方針
workflow plugin 内で AI を実行する箇所はすべて設定可能にする。AI refinement を hook 実行の deterministic 性だけを理由に削除する方針は採らない。

本体ルールとして src/AGENTS.md に「AI を実行するすべての呼び出し箇所は config から provider/profile を変更できる設定キーを持つこと」を追加した。workflow plugin では publish / issue-log-import classify / compose など、AI を呼ぶ処理ごとに `plugin.config.workflow.agent.<name>` の override を解決できるようにする。未設定時は通常の agent default にフォールバックする。

## workflow 移行スコープ原則
workflow 移行では、既存機能を基本的にすべて移行する。移行時に機能を削ぎ落とす、挙動を変える、大きくリファクタリングすることは、明確な必要性がある場合を除き行わない。

移行タスクの目的は本体から workflow 実装を外して plugin repository 単体で動作させることであり、機能整理や仕様変更を同時に混ぜない。issue-log-import の AI refinement など既存の best-effort 機能も、削除せず plugin 側へ移す。AI 呼び出し箇所はすべて設定可能にする。

## workflow command / hook ロジック共有方針
hook から `senti workflow ...` CLI command を呼ぶのではなく、command と hook が同じ内部 service/function を呼ぶ構造にする。

例:

```text
workflow/lib/services/issue-start.js
  runIssueStart(input, deps)

workflow/lib/commands/issue-start.js
  CLI ctx / args を input に変換
  runIssueStart(input, deps)

workflow/hooks/issue-start.js
  hook context を input に変換
  runIssueStart(input, deps)
```

issue-log-import も同様に、候補抽出 service を command と finalize-cleanup.post hook で共有する。failure policy / envelope 出力だけ呼び出し側で分ける。

## finalize 後 workflow follow-up UX 方針
finalize-cleanup.post hook は issue-log から board candidate 抽出を必ず試み、候補がある場合もない場合も summary を残す。artifact 保存だけではユーザーが気づけないため、hook result を本体 runner が標準 follow-up として finalize-cleanup の結果に載せる。

候補の詳細をその場に全部出すのではなく、候補数と確認コマンドを確実に表示する。

例:

```text
flow 中に記録された問題から、ボード候補を確認できます。
候補数: 3
確認するには: senti workflow ideas --spec specs/123-example
```

候補ゼロの場合も「workflow plugin checked issue-log: board-ready candidates were not found」のように、抽出が実行され候補がなかったことを分かる形で残す。自動で `workflow add` はしない。

## workflow ideas command 方針
finalize 後 follow-up の確認コマンドとして `senti workflow ideas --spec <spec>` を追加する。`issue-log-import` は名前と内容が合っていないため移行時に置き換え、既存 public subcommand としては残さない。

内部では issue-log から board idea 候補を抽出する service を作り、`ideas` command と finalize-cleanup.post hook が同じ service を使う。follow-up UX / help / skill では `ideas` のみを案内する。

## workflow issue-start command 方針
`senti workflow issue-start` は移行時に public subcommand から削除する。hook 化後は prepare.post hook が内部 service を直接使って linked issue の board item を In Progress に更新するため、通常ユーザー向け CLI として残さない。

手動ユーティリティが必要になった場合は、`issue-start` ではなく「何をどの status に移動するか」が分かる汎用 command（例: move / update の拡張）として別途設計する。移行タスクでは新規汎用 command 追加は必須にしない。

## workflow command 名と plugin command 衝突方針
workflow plugin の top-level command 名は `workflow` のまま残す。plugin 化は実装配置の変更であり、ユーザー向け CLI 名は変更しない。

今後 plugin が増えた時の名前衝突に備え、plugin command registry には duplicate detection を追加する。core command 名は plugin が上書きできない既存方針を維持し、enabled plugin 同士が同じ command 名を contribute した場合は後勝ちにせず hard fail する。

## workflow config migration 方針
top-level `workflow` config を `plugin.config.workflow` へ自動移動する migration は実装しない。完全移行後、本体 schema から top-level `workflow` を削除し、残っている場合は config validation error とする。

ユーザーはエラーを見て top-level `workflow` を削除する。workflow plugin を使う場合は必要な設定を `plugin.config.workflow` に明示的に書く。本体 upgrade / migration に workflow 固有処理を残さない。

## workflow skill 移行方針
`senti.workflow` skill は workflow plugin 側に残し、既存の board 操作ルールを基本維持する。移行で削るのは flow 連携の直書き指示のみ。

config 参照は完全移行後の namespace に合わせて `config.workflow.languages.source` から `plugin.config.workflow.languages.source` へ更新する。これは動作に必要な変更であり、機能変更として扱わない。

flow finalize 後の `issue-log-import` / `workflow add` 直書き案内は削除し、hook follow-up と `senti workflow ideas --spec <spec>` の案内に置き換える。

## workflow GitHub Projects 実装方針
workflow plugin の GitHub Projects 操作は、現行どおり `gh` CLI / GraphQL 呼び出し前提のまま移行する。認証方式変更、API client 化、非同期化などは移行タスクに混ぜない。

## workflow 完全削除の完了条件
workflow plugin 完全移行後、本体 repo から `src/workflow` を削除する。加えて bundled compatibility copy である `src/official-plugins/senti-workflow-plugin/` も不要なので削除する。workflow 実装・skill・config・tests・hook は `/home/nakano/workspace/senti-workflow-plugin` 側へ移す。

完了条件は、本体 runtime / source / test / package metadata / current project config の範囲で `workflow` という単語が出ないこと。主な対象は `src/`, `tests/`, `package.json`, `.senti/config.json` など。`senti workflow` command 名や workflow 固有文言は plugin repo 側にのみ存在させる。`specs/`, `docs/`, 過去 report / issue-log / retro, 生成物や履歴 artifact, `.github/workflows` のような外部 convention は対象外とする。

## この repo での workflow plugin 運用方針
workflow 完全移行後も、この senti repo 自身のボード運用では workflow plugin を installed / enabled の状態で使う。ただし移行検証では一度 workflow plugin を消し、外部 plugin repository から install / enable し直して動作確認する。

これは本体に workflow 実装を残すという意味ではない。`.senti/` 配下の利用者設定として workflow plugin が入っている状態は許容する。

# workflow 完全移行の追加決定事項

## config 移行
完全移行後、top-level `workflow` config は validation error とする。`senti upgrade` による `plugin.config.workflow` への自動 migration は実装しない。この repo 自身も移行作業の中で `.senti/config.json` を明示的に更新する。

## workflow 固有 agent entry
`agent.profiles.*.workflow.publish` のような workflow 固有 agent entry は core / top-level agent profile から削除対象にする。validation で検出できるなら error。現行 schema 上検出できない場合は workflow plugin から参照せず、実質無視する。override したい場合だけ `plugin.config.workflow.agent.publish` に書く。

## deployed skill の残存
移行後に古い deployed skill が `.agents/skills/` や `.claude/skills/` に残る場合はユーザー側の責務とし、`senti upgrade` で更新する。core 側で古い workflow 固有記述の残存検出や特別な warning / error は実装しない。

## GitHub Projects 操作
workflow plugin は現行どおり `gh` CLI / GraphQL を直接実行する。core は GitHub / `gh` 用 public API を提供しない。認証、`gh` availability、GraphQL 呼び出し、error handling は workflow plugin 側の責務とする。

## plugin command / hook の戻り値と出力
plugin command / plugin hook はどちらも必ず Envelope 互換 object を返す。stdout / stderr への最終出力、exit code、flow warning への反映、issue-log / artifact への保存は本体 dispatcher / hook runner の責務とする。plugin 側は直接出力しない前提にする。

## import 時 side effect
plugin hook / command module は import 時 side effect を書いてはならない。enabled plugin は実行コードとして扱うため、初期実装では機械的な side effect 検査は入れず、規約と review で担保する。plugin install / update で scripts は実行しないが、runtime import される plugin code は信頼済み plugin の責務とする。

## 既存 active flow
hook snapshot がない既存 active flow は、黙って hook なしで続行する。live discovery fallback、warning、migration、再 prepare 要求は行わない。

## plugin command help
plugin command contribution は core command と同等の help metadata を持つ。top-level help、command help、subcommand help、locale 別文言、experimental 表示を静的 metadata から解決する。help 表示のために command module を import しない。plugin command metadata は core command registry と同じ情報構造に寄せ、core / plugin を同じ help rendering pipeline に流す。plugin 固有の薄い help 経路は作らない。

## 旧 workflow subcommand
`senti workflow issue-start` と `senti workflow issue-log-import` は後方互換なしで削除する。完全移行後に呼ばれた場合は通常の unknown subcommand 扱いにする。

## hook failure policy
hook の `run()` 中で起きる業務処理エラー、たとえば board 更新失敗、`gh` 失敗、候補抽出失敗、AI refinement 失敗は best-effort とし、flow 本体を止めない。warning / issue-log / follow-up に残す。

hook 機構そのもののエラー、たとえば snapshot に載っている hook が import できない、`register(api)` 形式ではない、`FlowCommandHook` を継承していない、metadata が壊れている場合は plugin hook runtime の整合性破損として flow command を止める。

## hook snapshot の整合性
snapshot に載っている plugin / hook が途中で disabled、removed、unresolved になった場合は環境破損として hard fail にする。runner が勝手に snapshot を変更したり、黙って skip したりしない。

## workflow artifact の詳細
`ideas` command や finalize hook が保存する候補 artifact のファイル名や schema は workflow plugin 側の実装詳細として任せる。人が直接見ることを前提にしない artifact は、core 側で名前や形式を固定しない。core は plugin namespace 下の保存場所と、必要な場合の follow-up 表示だけを扱う。

# workflow 完全移行の追加決定事項 2

## plugin throw の扱い
plugin command / hook が throw した場合、本体 dispatcher / hook runner が捕捉して Envelope.fail 相当に正規化する。command では失敗 envelope と non-zero exit にし、hook では業務処理エラーとして warning / issue-log / follow-up に変換する。hook の run 中の throw は flow 本体を止めない。

## flowIntegration default
workflow plugin の `plugin.config.workflow.flowIntegration` default は `enable` とする。workflow plugin が installed / enabled なら prepare / finalize の flow integration は原則有効。無効化したい project だけ `plugin.config.workflow.flowIntegration: "disable"` を明示する。

この default は runtime merge のみで、`.senti/config.json` には自動書き込みしない。`loadConfig()` の戻り値にだけ default が見える形にする。

## board / gh 前提不足の扱い
workflow plugin enabled かつ flowIntegration enable でも、board 設定不足、`gh` 不在、認証不足などは config validation error にしない。install / enable 時の事前 alert / check も初期実装では行わない。

実行時に hook が best-effort skip / fail envelope を返し、flow 本体は続行する。必要な情報は warning / issue-log / follow-up に残す。

## finalize follow-up の責務
finalize hook 後に表示する follow-up 文面は workflow plugin 側の責務とする。hook envelope の data に `followUps` などの表示可能な値を返し、core は workflow 固有文言を持たず、それを flow result に載せるだけにする。候補ゼロ時のメッセージも workflow plugin 側が決める。

follow-up data の厳密な標準 schema は初期実装では作らない。core は workflow 固有 schema を解釈せず、慣例として `data.followUps` のような値があればそのまま表示する程度にする。

## languages default
workflow plugin の language 設定は、完全移行後も `plugin.config.workflow.languages.source ?? config.lang` と `plugin.config.workflow.languages.publish ?? config.lang` を使う。

# workflow 完全移行の追加決定事項 3

## plugin agent API の責務境界
workflow 固有の agent key は workflow plugin 側だけが知る。本体は `workflow.publish` や `publish` のような workflow 固有用途名を解釈しない。

AI を実行する実装ロジックは本体側の既存 agent 実行機構を使う。一方で、いつ、何のために、どの prompt で AI を実行するかは workflow plugin 側の責務とする。

本体が plugin に渡すのは workflow 非依存の汎用 agent 実行 API のみとする。plugin は `plugin.config.workflow.agent.<name>` を自分で読み、override があれば provider/profile として汎用 agent API に渡す。override がなければ provider/profile を指定せず、本体の汎用 default agent で実行する。

概念例。

```js
await api.agent.run({
  provider: pluginConfig.agent?.publish,
  prompt,
  input
});
```

この API は workflow 固有の用途名を受け取らない。実行判断と workflow 固有 config key の解釈は plugin 側に閉じる。

# workflow command discovery 方針更新

workflow plugin の command 登録は、`plugin.json` の `contributions.commands[]` に command 名・path・help metadata を列挙する方式ではなく、`commands/` 配下の command class discovery に寄せる。

## 採用方針
- workflow plugin は `commands/` 配下に command class を置く。
- command class は static metadata として command 名、usage、help、args/options、subcommand metadata、experimental 表示などを持つ。
- 本体の plugin command registry / help renderer は `commands/` を discovery し、command class の metadata から `senti workflow` の top-level help / command help / subcommand help を構築する。
- 実行時も discovery された command class を使って dispatch する。
- `plugin.json` は command の詳細列挙を持たない。plugin identity や package-level metadata に寄せ、command 追加・削除時の更新漏れを避ける。
- hook の `hooks/*.js` discovery と同じ思想に揃える。

## import 時 side effect
help 表示や registry 構築のために command module を import して static metadata を読む。command module の top-level は import と class / function 宣言に限定する規約とし、import 時 side effect を禁止する。初期実装では機械検査は入れず、規約と review で担保する。

## 既存記述との関係
この方針更新により、先に書かれている `contributions.commands[]` へ help metadata を持たせる案は採用しない。workflow plugin の command / help single source は command class の static metadata とする。

# workflow command class 構成の追加決定

workflow plugin の command は top-level command と subcommand class を分ける。

想定構成。

```text
commands/
  workflow.js
  workflow/
    add.js
    update.js
    show.js
    search.js
    list.js
    publish.js
    ideas.js
```

- `commands/workflow.js` は namespace command として `senti workflow` を提供する。
- `commands/workflow/*.js` は各 subcommand class とし、それぞれ static metadata と実行ロジックを持つ。
- `workflow.js` は配下 subcommand class を discovery / dispatch し、help も subcommand class metadata から組み立てる。
- 1ファイルに全 subcommand metadata / dispatch を集約する方式は、肥大化と drift を避けるため採らない。

## command 基底クラス
plugin command / subcommand 用の基底クラスは本体側の plugin 基盤として用意する。workflow plugin 側は本体が api 経由で渡す基底クラスを継承する。

基底クラスは command 名、usage、help、args/options、experimental、subcommand metadata などの static metadata 契約と、`run(context)` / Envelope 返却契約を表現する。

この基底クラス整備は workflow plugin 移行タスクではなく、先行する plugin 基盤整備タスクのスコープに含める。

# workflow command file layout 方針更新

workflow plugin の command file layout はフラットにする。path 階層から command / subcommand 名を推論する設計は採らない。

想定構成。

```text
commands/
  workflow.js
  workflow-add.js
  workflow-update.js
  workflow-show.js
  workflow-search.js
  workflow-list.js
  workflow-publish.js
  workflow-ideas.js
```

- `commands/**/*.js` ではなく、初期方針として `commands/*.js` のフラット discovery にする。
- command / subcommand 名は file path から推論せず、command class の static metadata を優先する。
- helper / lib / service は `commands/` 配下に置かない。command 以外は plugin root の `lib/` や feature-specific service directory に置く。
- `commands/` 配下の JS file はすべて command class として validation する。command class でなければ hard fail。
- path と static name の一致検査を設計上必要にしない。rename / grouping は file 名ではなく static metadata を source of truth とする。

## 先行記述との関係
先に書かれている `commands/workflow/*.js` のような階層型 subcommand discovery 案は採用しない。subcommand もフラットな command class として置き、namespace 関係は static metadata で表現する。

# workflow command dispatch 方針更新

フラットな `commands/*.js` discovery では、top-level command と subcommand の親子関係を command class の static metadata で表現する。

例。

```js
export default function register(api) {
  const { PluginCommand } = api;

  return class WorkflowAddCommand extends PluginCommand {
    static name = "add";
    static parent = "workflow";
    static usage = "senti workflow add <title>";
  };
}
```

- `static name = "workflow"` かつ parent なしの class は top-level command。
- `static parent = "workflow"` がある class は `senti workflow <name>` の subcommand。
- parent が存在しない subcommand は validation hard fail。
- 同じ parent 配下の name 重複は validation hard fail。

## 実行 dispatch
`senti workflow add ...` は、現行本体の workflow dispatcher と同じく、親の `WorkflowCommand` が subcommand を解決して呼ぶ。

ただし親 command に subcommand 一覧や metadata を手書きで重複させない。plugin command registry が discovery 済みの child command class を親 command に渡し、親はその registry から対象 subcommand を解決する。実処理は leaf の `WorkflowAddCommand` などが担当する。

このため親 command は namespace / help / unknown subcommand handling / child dispatch を担い、leaf command は各 subcommand の args / help / 実処理を担う。

# workflow command / subcommand 配置の最終方針

plugin の `commands/` は本体 plugin registry が discovery する top-level command の置き場とする。workflow の subcommand は `commands/` 直下に置かず、workflow plugin 内部の `lib/commands/` に置く。

想定構成。

```text
commands/
  workflow.js

lib/
  commands/
    add.js
    update.js
    show.js
    search.js
    list.js
    publish.js
    ideas.js
  services/
    issue-start.js
    ideas.js
```

- 本体 plugin registry が知るのは `commands/workflow.js` が提供する top-level `workflow` command だけ。
- `senti workflow add` などの subcommand は workflow plugin 内部実装であり、本体は `add` / `publish` / `ideas` などの workflow 固有 subcommand を知らない。
- `commands/workflow.js` は現行本体の `src/workflow/index.js` と同じく、namespace dispatcher として subcommand を解決して呼ぶ。
- subcommand の実装、args、help metadata は `lib/commands/*.js` の command class に持たせる。
- 親の `workflow.js` は `lib/commands/` を discovery / registry 化し、help と dispatch を subcommand class metadata から組み立てる。
- 親 command に subcommand 一覧や help を手書きで重複させない。

## 先行記述との関係
先に書かれている `commands/workflow-add.js` などのフラット subcommand file 案、および `commands/workflow/*.js` の階層型 subcommand discovery 案は採用しない。

`commands/` は plugin top-level command の discovery 境界、`lib/commands/` は workflow plugin 内部の subcommand 境界として分ける。

# workflow subcommand interface 方針

workflow plugin 内部の `lib/commands/*.js` も、top-level plugin command や hook と同じく `register(api)` 形式にする。

例。

```js
export default function register(api) {
  const { PluginCommand } = api;

  return class WorkflowAddCommand extends PluginCommand {
    static name = "add";
    static usage = "senti workflow add <title>";

    async run(context) {
      return context.envelope.ok({});
    }
  };
}
```

- 本体 plugin registry が discovery / validate / dispatch するのは `commands/workflow.js` の top-level command だけ。
- 本体は `add` / `publish` / `ideas` など workflow 固有 subcommand 名を知らない。
- `commands/workflow.js` が plugin 内部で `lib/commands/*.js` を discovery / validate / dispatch する。
- `lib/commands/*.js` の subcommand class も `register(api)` で本体から渡された汎用基底クラスを継承し、Envelope 返却契約、args/help metadata、run interface を top-level command / hook と揃える。
- 本体が提供するのは workflow 非依存の汎用基底クラスと汎用 API だけであり、workflow 固有 subcommand registry は workflow plugin 内部に閉じる。

# ボードに載せる理由

workflow は本体から最初に切り出す大きな plugin 実装であり、plugin command / hook / config / agent API の実利用例にもなる。1/3 の基盤実装後にこの移行を完了させることで、本体から workflow 固有文言と実装依存を取り除ける。