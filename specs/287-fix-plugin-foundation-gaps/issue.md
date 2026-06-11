# Target

The gap between the plugin foundation acceptance criteria and the current implementation. Scope includes hook discovery, snapshot hook execution, and artifact storage location.

# Problem

The completed plugin foundation still has places where requirements and implementation do not match. Hook discovery does not reject imports from core internal paths. When a plugin or hook recorded in the snapshot has been removed or disabled, execution does not hard-fail and treats it as a warning. The artifact storage location is also under `.senti` instead of under the spec directory as required.

# Cause

Hook shape validation and normalization of business errors during hook execution were implemented, but validation for plugin runtime boundary consistency failures is still missing. The artifact helper storage location was fixed to the implementation-side behavior while the issue body and test expectations remained misaligned.

# Improvement Direction

Reject imports from core internal paths before importing a hook module or during validation. During snapshot execution, verify plugin enabled state and module resolution; disabled, removed, unresolved, and metadata mismatches must hard-fail. Business failures during hook execution should continue to be warnings and issue-log candidates. Update the artifact helper to write to `plugin-artifacts` under the spec directory, and add spec-local tests for the unmet cases.

# Why This Belongs On The Board

The upcoming full workflow plugin migration depends on plugin boundaries and snapshot consistency. If this gap remains, core-internal dependencies and broken snapshots can go undetected after migration, reducing confidence in plugin separation.

<details>
<summary>ja</summary>

[BUG] plugin基盤の未充足受け入れ条件を修正する

# 対象

plugin基盤の受け入れ条件と実装の差分。hook discovery、snapshot hook 実行、artifact 保存先を対象にする。

# 問題

完了済みのplugin基盤に、要求と実装が一致しない箇所が残っている。hook discoveryでcore内部pathのimport拒否がない。snapshotに載ったpluginやhookが削除または無効化された場合もhard failにならずwarning扱いになる。artifact保存先も要求のspec配下ではなく.senti配下になっている。

# 原因

hookのshape検証とrun中の業務エラー正規化は実装されたが、plugin runtime境界の整合性破損を別扱いする検証が不足している。またartifact helperの保存先について、issue本文の指定とテスト期待値がずれたまま実装側に固定された。

# 改善方針

hook moduleのimport前または検証時にcore内部pathへのimportを拒否する。snapshot実行時はpluginのenabled状態とmodule解決を確認し、disabled、removed、unresolved、metadata不整合はhard failにする。一方でhook run中の業務失敗は従来どおりwarningとissue-log候補にする。artifact helperは要求に合わせてspec配下のplugin-artifactsへ保存し、spec-local testに未充足ケースを追加する。

# ボードに載せる理由

次のworkflow完全plugin移行ではplugin境界とsnapshot整合性が前提になる。この未充足を放置すると、移行後にcore内部依存や壊れたsnapshotが検出されず、plugin分離の信頼性が落ちるため。

</details>