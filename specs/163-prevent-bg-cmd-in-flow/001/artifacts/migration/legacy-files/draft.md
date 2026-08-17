**開発種別:** バグ修正

**目的:** sdd-forge コマンドがバックグラウンドに移行した場合でも、完了するまで次フェーズに進まず待機することを AI に義務付ける

## Q&A

**Q1: 問題の本質は何か？**
タイムアウトそのものではなく、バックグラウンド実行への移行が問題。バックグラウンドに移行すると AI が完了を検知できず、テストや finalize が終わっていないのに次ステップに進んでしまう。

**Q2: 対策の方向性は？**
バックグラウンド移行を防ぐことが難しい場合は「完了まで待機させる」しかない。中断・報告ではなく「処理が終わるまで次のフェーズに進まず待機する」が正しい要件。

**Q3: 対象コマンドの範囲は？**
特定のサブコマンドではなく `sdd-forge` コマンド全体。

**Q4: 変更箇所は？**
`src/templates/partials/core-principle.md` に追記する。この partial は plan / impl / finalize の各 SKILL.md から include されているため、新規ファイル不要で全スキルに反映される。

**Q5: 記述スタイルは？**
MUST で書く。

## 決定事項

- 変更対象: `src/templates/partials/core-principle.md`
- 追加内容: 「sdd-forge コマンドがバックグラウンドに移行した場合、完了通知を受け取るまで次フェーズに進んではならない」という MUST ルール
- 既存の「NEVER chain or background」ルールの直後に追記する

## 影響範囲

- `core-principle.md` を include する全 SKILL.md（flow-plan, flow-impl, flow-finalize）に自動反映
- プロダクトコード（`src/`）への変更なし
- テンプレート変更のため `sdd-forge upgrade` が必要

## Open Questions

なし

- [x] User approved this draft
