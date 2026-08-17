# Draft: 170-flow-runid-state-bootstrap

**Development Type:** ENHANCE
**Goal:** 一時ファイル運用を `/tmp` 固定から `agent.workDir` 解決へ統一し、指示プロンプト（skill共有パーツ）とCLI実装を整合させる。

## Context

- 実行環境によっては `/tmp` 利用時に承認フローが増え、作業効率が落ちる。
- 現運用では一時出力パスのルールが分散し、指示と実装の不一致が起こりやすい。
- ルールを `agent.workDir` 起点で統一することで、運用と実装の一貫性を確保したい。

## Q&A

1. Q: 今回の対象テーマは何か？
   A: 一時ファイル運用を `/tmp` 固定から `config.agent.workDir` 解決へ統一し、運用ルールを整備する。

2. Q: 適用範囲はどこまでか？
   A: 指示プロンプトは skill の共有パーツへ実装し、CLI 側では `agent.workDir` 解決ヘルパーを実装する。

3. Q: `agent.workDir` の解決優先順位は？
   A: `SDD_FORGE_WORK_DIR`（環境変数） > `config.agent.workDir` > `.tmp`（フォールバック）。

4. Q: `.tmp` 固定運用にするか？
   A: しない。固定値ではなく設定ベースで解決する。

## Requirement Checklist Coverage

- Goal & Scope: 一時ファイル運用の統一と、プロンプト/CLI実装の整合を対象化。
- Impact on existing: flow系スキル文言とCLI一時パス解決ロジックに影響。
- Constraints: `agent.workDir` 未設定時の互換フォールバックを維持。
- Edge cases: 環境変数指定時、config未設定時、相対パス時の解決。
- Test strategy: 解決優先順位の単体テスト、既存挙動の回帰確認。
- Alternatives considered: `.tmp` 固定案は不採用（設定柔軟性を失うため）。
- Future extensibility: 一時パス解決をヘルパーに集約し、他コマンドでも再利用可能にする。

## Prioritized Requirements

- P1: CLIに `agent.workDir` 解決ヘルパーを導入し、`env > config > .tmp` 優先順位で解決する。
- P1: 指示プロンプト（skill共有パーツ）に「`/tmp` 直書き回避・`agent.workDir` 利用」ルールを明記する。
- P1: 既存機能が依存する一時出力処理で後方互換（未設定時 `.tmp`）を維持する。
- P2: 関連ドキュメント/ヘルプ文言を実装に合わせて整備する。

## Open Questions

- なし

## Approval

- [x] User approved this draft
- Notes: approved by user in flow-plan draft step on 2026-04-13.
