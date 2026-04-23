# Draft: 221-fix-gate-phase-detection

**開発種別:** bugfix
**目的:** `sdd-forge flow run gate` の `--phase` 省略時デフォルトが実状態を無視して固定値を用いる結果、誤ったフェーズ評価と多重 in_progress を引き起こすバグを是正する。

## Requirements (優先順位付き)

### P1（必須）

- **R1:** `--phase` 省略時、`sdd-forge flow run gate` は flow state（および active task がある場合は task state）に記録された「進行中の gate 系 step」から gate phase を決定すること。複数該当する場合は、state 内で最も後にステータスが `in_progress` に遷移した step を採用する（順序は flow state に記録された遷移タイムスタンプで比較可能とする）。
- **R2:** gate 系 step が一つも `in_progress` でない状態で `--phase` 省略実行された場合、gate 評価を実行せずエラー終了すること。エラー出力には `--phase` の有効値候補を列挙し、明示指定を促すメッセージを含める。

### P2（R1 を補完する回復動作）

- **R3:** gate 系 step が2件以上 `in_progress` だった場合、R1 で採用しなかった古い方を `done` に自動遷移し、遷移を行った旨を stderr に警告出力すること。警告は「どの step をどの状態に遷移したか」「理由（本リカバリ動作によるもの）」を含む1行で十分とする。

### P3（既存挙動の維持）

- **R4:** `--phase` を明示指定した場合の挙動（現状の phase 値検証と evaluation ロジック）は変更しない。既存の `--phase` 引数の文書・スクリプト・テスト期待値はすべて現行どおり動く。

## Scope Verification

- In scope:
  - `flow run gate` の `--phase` 省略時デフォルトの見直し（R1 / R2）
  - 多重 in_progress 発生時の自動リカバリ挙動（R3）
  - `--phase` 明示指定時の現行挙動保持（R4）
- Out of scope:
  - 多重 in_progress を `flow run gate` 起動前にエラーにする代替対応
  - gate 系以外の step の遷移ロジック変更
  - `flow run review` / `flow run impl-confirm` など他コマンドの phase 推論

## Impact on Existing Features

- 影響ありの既存機能:
  - `sdd-forge flow run gate --phase` 省略実行のデフォルト挙動（固定値 `spec` から実状態に基づく推論へ）
- 影響なし:
  - `--phase` を明示指定する既存の CLI 呼び出し・ドキュメント例（R4 で保証）
  - task-less flow の正常系（gate 系 step が1件のみ `in_progress` である限り、結果は現行と同一）
  - docs / spec コマンド、setup / upgrade などの他サブコマンド

## Migration Plan (CLI 挙動変更)

- R1 によりデフォルト挙動が変わるが、以下の理由で移行は自然に進む:
  - 従来「`--phase` 省略 = 常に spec」であったため、spec phase 以外で `--phase` を省略していたスクリプトは既に誤った評価を受けていた（本 issue の症状そのもの）。正しい挙動への回帰であり、新挙動で壊れる想定ユースケースは無い。
  - `--phase` を明示指定する呼び出しは R4 により一切変わらない。既存ドキュメント・CI スクリプトで `--phase` を渡しているものは影響を受けない。
- 追加の互換フラグは設けない（alpha ポリシーにより後方互換コードを持ち込まない方針）。
- 挙動変更は CHANGELOG に記載する。ユーザー向けの移行ガイド更新は不要（壊れる呼び出しが想定されないため）。

## Q&A

- Q: 対応方針は案 A + C で進めるか
  - A: はい（A = state からの gate phase 推論、C = stale in_progress の自動 `done` 遷移）。案 B（多重 in_progress で pre-hook エラー）は採用しない（R3 の自動リカバリで代替）。
- Q: gate 系 step が一つも in_progress でない場合の挙動
  - A: R2 で規定のとおりエラーで中止。根拠: ユーザー確認 [1]（「明示的 `--phase` 指定要求」）、および `guardrail.md` の Unambiguous Requirements（検証可能条件を優先）と、`src/AGENTS.md` の「フォールバック値の抑制」（必須値不足時は黙ってデフォルト動作せずエラー）に整合する。
- Q: 多重 in_progress の古い step をどう扱うか
  - A: R3 のとおり `done` に自動遷移。根拠: 本 issue で報告された典型パターンは「gate 評価は PASS したが post-hook による `done` 遷移が走り切らなかった」ケースであり、実態と整合する遷移は `done`。ユーザー確認 [1] でもこの方針を選択済み。
- Q: `gate-impl` 単独 in_progress のケース B はどう解決されるか
  - A: R1 により state ベースで `task-impl` / `integration` が正しく解決され、同一ロジックで解決される。
- Q: 「後に in_progress に遷移した step」の判定根拠はどこに置くか
  - A: 「flow state に記録済みの遷移順序情報を正とする」を要件とする。具体的な根拠データの選定（既存記録の活用 / 追加記録の導入）は spec で詳細化する。

## Open Questions

- R3 の自動 `done` 遷移が既存のメトリクス（gate リトライ等）や issue-log 記録に副作用を持つか（spec 段階で要確認）。
- R1 の「最新」判定に使える情報が現状の state に存在するか、存在しない場合の代替策は何か（spec で決定）。

## User Approval

- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: 対応方針 A+C、未 in_progress 時は --phase 明示要求エラー、多重 in_progress は最新採用+古い方 done 化、alpha ポリシーにより移行互換フラグなし
