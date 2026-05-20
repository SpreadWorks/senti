## Background
`skill` / prompt / docs should reference `sdd-forge flow get status` as the canonical command, but during operation the incorrect form `sdd-forge flow status` is sometimes used.

The problem is not that the old form is unsupported, but that an incorrect command form is mixed in somewhere among instruction sources or navigation paths. Under the alpha policy, `flow status` should not be kept as an alias.

## Goals
- Audit `skill` / prompt / docs / help for any incorrect references to `sdd-forge flow status` and unify them to the canonical form `sdd-forge flow get status`
- Do not add a `flow status` alias to the CLI
- When `flow status` is executed, exit with non-zero and explicitly indicate that the correct form is `sdd-forge flow get status`
- Fix in tests that "`flow status` does not succeed, but guidance to the canonical command is shown"

## Acceptance Criteria
Only the canonical command `sdd-forge flow get status` remains in instruction sources, and `sdd-forge flow status` remains unsupported and is clearly treated as mistyped input.

<details>
<summary>ja</summary>

[ENHANCE] flow: status 誤入力を正規コマンドへ統一する

## 背景
`skill` / prompt / docs には正規コマンドとして `sdd-forge flow get status` を書くべきだが、運用中に `sdd-forge flow status` という誤った形が選ばれることがある。

問題は旧形式をサポートしていないことではなく、指示源や導線のどこかで誤ったコマンド形が混ざることにある。alpha 版ポリシー上も、`flow status` を alias として残すべきではない。

## やりたいこと
- `skill` / prompt / docs / help に `sdd-forge flow status` のような誤った記述がないか確認し、正規形 `sdd-forge flow get status` に統一する
- CLI には `flow status` の alias を追加しない
- `flow status` が実行された場合は非ゼロ終了のまま、正しくは `sdd-forge flow get status` であることを明示する
- テストで「`flow status` は成功しないが、正規コマンドへの誘導は出る」ことを固定する

## 完了条件
指示源に正規コマンド `sdd-forge flow get status` だけが残り、`sdd-forge flow status` はサポートされないまま明確に誤入力として扱われる。

</details>