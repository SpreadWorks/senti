Currently, agent.js unconditionally attempts JSON parsing for all providers and has no mechanism to determine whether a JSON output flag is present. When the jsonFlag() method and jsonOutputFlag config property were removed in spec 189, both flag injection and output format declaration were deleted together without separation. Restore jsonOutputFlag as a property of the provider config and implement the following branching in agent.js: (1) if set, inject it into args and JSON-parse via provider.parse(); (2) if not set, skip injection and parse, returning { text: stdout, usage: null } directly. Even without the JSON flag, downstream consumers (gate, review, etc.) extract JSON from AI responses via extractJsonCandidate, so functionality is unaffected — the only difference is whether usage metrics are available. This is required for multi-agent support.

<details>
<summary>ja</summary>

[ENHANCE] agent provider に jsonOutputFlag を復活し、出力パース分岐を実装する

現状 agent.js は全 provider に対して無条件に JSON パースを試みており、JSON 出力フラグの有無を判定する仕組みがない。spec 189 で jsonFlag() メソッドと jsonOutputFlag config プロパティを廃止した際、フラグ注入と出力形式宣言を分離せず両方削除してしまった。jsonOutputFlag を provider config のプロパティとして復活させ、(1) 設定されていれば args に注入し provider.parse() で JSON パースする、(2) 設定されていなければ注入せず parse をスキップして { text: stdout, usage: null } を直接返す分岐を agent.js に実装する。JSON フラグなしでも downstream（gate, review 等）は extractJsonCandidate で AI 応答中の JSON を抽出するため機能に影響はなく、usage メトリクスの有無だけが差になる。マルチエージェント対応に必須。

</details>