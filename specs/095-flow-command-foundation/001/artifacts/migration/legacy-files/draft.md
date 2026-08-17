# Draft: 095-flow-command-foundation

## Q&A

### Q1: ルーティング方式
- Q: flow コマンドの内部構造は？
- A: 2段階ディスパッチ。`flow.js` → `get.js/set.js/run.js` → `get/*.js`, `set/*.js`, `run/*.js`

### Q2: JSON envelope
- Q: レスポンスの共通形式は？
- A: `{ok, type, key, data, errors[{level: "warn"|"fatal", code, messages}]}`。warnings フィールドは不要、errors の level で区別。

### Q3: 既存コマンドの廃止
- Q: 既存の flow status/review/merge/cleanup/resume/start はどうするか？
- A: alpha 版ポリシーにより即座に廃止。後方互換コードは書かない。

### Q4: スコープ
- Q: 01 の scope を分割するか？
- A: 分割しない。全 key にハンドラを作り、1つの spec で実装。コミットで段階的に分ける。

### Q5: guardrail / prompt の実装範囲
- Q: flow get guardrail と flow get prompt は完全実装か？
- A: 両方とも完全実装。

### Q6: flow get prompt のレスポンス形式
- Q: テキストか構造化か？
- A: 構造化 JSON。`{phase, step, current, total, prompt, description, recommendation, choices[{id, label, description, recommended}]}`

### Q7: flow start の扱い
- Q: flow start は残すか？
- A: 削除。flow run prepare-spec に置き換え。skill flow-plan に置き換え済みのレガシーコマンド。

### Q8: flow resume の扱い
- Q: flow resume はどうするか？
- A: flow get resolve-context にリネーム。skill flow-resume は内部で呼ぶ。

### Q9: flow get qa-count
- Q: 何を返すか？
- A: 回答済み質問数のみ。質問総数は AI が決める。

### Q10: flow set metric のスキーマ
- Q: metric の構造は？
- A: `{draft,spec,gate,test}×{question,redo,docsRead,srcRead}`。`flow set metric <step> <counter> <value>` でインクリメント。

### Q11: flow set redo のインターフェース
- Q: redo の入力は？
- A: `--step`, `--reason`, `--trigger`, `--resolution`, `--guardrail-candidate` のオプション形式。redolog.json に追記。

### Q12: spec コマンドのロジック移動
- Q: spec init/gate/guardrail show を flow に移すか？
- A: ロジックごと移動。spec guardrail show のみ flow get guardrail に移動。spec guardrail init/update は残す。spec コマンド全体の整理は別スコープ。

### Q13: flow get check の target
- Q: check が確認する対象は？
- A: `impl`, `finalize`, `dirty`, `gh` の4つ。

### Q14: flow run の共通レスポンス
- Q: run コマンドの data 形式は？
- A: `{result, changed, artifacts, next}`

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-29
