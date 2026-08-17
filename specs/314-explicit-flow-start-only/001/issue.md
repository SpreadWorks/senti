## Background

Currently, whenever a request for a feature addition or fix is received, the AI asks whether to start the `Spec-Driven Development flow` or handle it directly.

This confirmation can also occur during normal interactions such as:

- Consultation or direction-setting
- Minor investigation or confirmation requests
- Small fixes or implementations

As a result, the flow of conversation and work is interrupted, making the initial response to ordinary requests unnecessarily heavy.

The `Spec-Driven Development flow` is a useful approach, but it should not be treated as something that is always automatically started. It should be handled as a supplementary method used explicitly when needed.

## Purpose

Remove the automatic startup trigger for the `Spec-Driven Development flow` so that it starts only when the user explicitly instructs it to start.

## Scope

- Review the startup conditions for the `Spec-Driven Development flow`
- Remove automatic flow selection confirmations for ordinary requests
- Standardize related documentation and skill metadata wording so it does not depend on a specific client or execution environment

## Changes

- The `Spec-Driven Development flow` starts only when the user explicitly instructs it to start
- Do not automatically display flow startup confirmations for ordinary feature additions, fixes, investigations, or consultations
- Even if the AI determines that using the flow would be useful for a large change, it should not start automatically and should only be suggested when appropriate
- AGENTS.md and skill descriptions should not assume startup notation specific to a particular client, such as Codex or Claude, as a general condition

## Expected Result

- The rule that “a two-choice confirmation between flow and direct fix must always be shown for feature addition or fix requests” has been removed or replaced
- The flow startup condition is limited to “an explicit start instruction from the user”
- Documentation and skill metadata wording has been standardized to be independent of the execution environment

## Acceptance Criteria

- Ordinary utterances such as “please fix this,” “please implement this,” or “I want to discuss something” do not trigger a flow selection confirmation
- The flow starts only when the user explicitly requests starting the `Spec-Driven Development flow`
- Even if the AI determines that using the flow would be useful, it does not start automatically and only suggests it
- Documentation does not describe startup notation specific to a particular client as a general condition

## Non-Goals

- Removing the `Spec-Driven Development flow` itself
- Removing the ability to start the flow manually

## Notes

This change does not remove the `Spec-Driven Development flow` itself. It removes automatic startup and clarifies the startup conditions.

<details>
<summary>ja</summary>

Spec-Driven Development flow の自動起動トリガーを廃止する

## 背景

現状は、機能追加や修正の依頼を受けるたびに、AI が `Spec-Driven Development flow` を開始するか、直接対応するかの確認を挟む挙動になっている。

この確認は、以下のような通常のやり取りでも発生しうる。

- 相談や方針確認
- 軽微な調査や確認依頼
- 小規模な修正や実装

その結果、会話と作業の流れが分断され、通常依頼の初動が不必要に重くなっている。

`Spec-Driven Development flow` は有用な進め方ではあるが、常時自動起動される前提ではなく、必要な場面で明示的に利用される補助的な手段として扱うべきである。

## 目的

`Spec-Driven Development flow` の自動起動トリガーを廃止し、ユーザーが明示的に開始を指示した場合にのみ起動するようにする。

## スコープ

- `Spec-Driven Development flow` の起動条件を見直す
- 通常の依頼に対する自動的な flow 選択確認を廃止する
- 関連ドキュメントおよび skill metadata の表現を、特定クライアントや実行環境に依存しない記述へ統一する

## 変更内容

- `Spec-Driven Development flow` は、ユーザーが明示的に開始を指示した場合のみ開始する
- 通常の機能追加・修正・調査・相談では、flow 起動確認を自動表示しない
- AI が大きな変更で flow の利用が有用だと判断した場合でも、自動起動はせず、必要に応じて提案に留める
- AGENTS.md や skill 説明では、Codex や Claude など特定クライアント固有の起動記法を一般条件として前提にしない

## 期待する結果

- 「機能追加・修正リクエスト時に必ず flow / 直接修正の二択確認を出す」ルールが削除または置換されている
- flow の起動条件が「ユーザーによる明示的な開始指示」に限定されている
- ドキュメントおよび skill metadata の表現が、実行環境非依存の記述に統一されている

## 受け入れ条件

- 「修正して」「実装して」「相談したい」などの通常発話だけでは、flow 選択確認が発生しない
- ユーザーが `Spec-Driven Development flow` の開始を明示した場合のみ、flow が開始される
- AI が flow の利用を有用と判断した場合でも、自動開始せず、提案に留まる
- ドキュメントに、特定クライアント専用の起動記法を一般条件として記載しない

## 非目的

- `Spec-Driven Development flow` 自体を廃止すること
- flow を手動で開始する手段を削除すること

## 補足

この変更は `Spec-Driven Development flow` 自体の廃止ではなく、自動起動を廃止して起動条件を明確化するものである。

</details>