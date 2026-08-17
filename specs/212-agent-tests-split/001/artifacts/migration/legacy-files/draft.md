# Draft: 212-agent-tests-split

**開発種別:** refactor
**目的:** 実 AI エージェント（`claude` CLI）を呼び出すテストを通常のテスト実行経路から分離し、開発時に繰り返し走らせるデフォルトテストの所要時間を大幅短縮する。

## Requirements (priority order)
1. **[P1] When developers run the default test command, then tests that invoke a real AI agent shall be excluded** so that the default path stays focused on fast, deterministic checks.
2. **[P1] When developers need to validate AI-dependent behavior, then a dedicated command shall run only the AI-execution tests.**
3. **[P1] When CI (or a full validation run) is needed, then a single command shall run all tests including the AI-execution tests.**
4. **[P2] When AI-related source files are modified, then project documentation (CLAUDE.md) shall direct the developer to run the AI-execution test command.**
5. **[P2] When the AI-test selector is combined with other incompatible selectors, then the test runner shall reject the invocation with a clear error.**

## Scope Verification
- In scope:
  - Introducing a dedicated location for AI-execution tests
  - Updating the test runner and npm scripts so the three execution modes (default / AI-only / all) exist
  - Relocating the currently known AI-execution test into the new location without changing its assertions
  - Documenting the new workflow in CLAUDE.md
- Out of scope:
  - Rewriting the relocated test for speed / mocking
  - Changes to CI pipeline configuration (the resulting command-name change for CI is left to a follow-up spec)
  - Reclassification of other existing tests

## Impact on Existing Features
- 影響ありの既存機能:
  - Default `npm test` coverage — AI-execution tests will no longer run under the default command; callers that depended on this (including CI, if any) must switch to the all-tests command
  - Test runner selector semantics — a new selector axis is introduced; combinations with existing selectors need a defined resolution
- 影響なし:
  - Existing unit / e2e test content (other than the one relocated file)
  - Preset tests and `test:unit` / `test:e2e` / `test:acceptance` script behavior
  - Source code under `src/`

## Migration Plan
- 既存の `npm test` は挙動が変わる（AI 実行テストを含まなくなる）。移行手順は以下:
  1. 本 spec のマージ直後、リポジトリ CI 設定（`.github/workflows/*.yml` 等）を確認し、`npm test` を使用している箇所を `npm run test:all` に切り替える PR を別途提出する（本 spec の Out of scope）。
  2. ローカル開発者への周知として、CHANGELOG / CLAUDE.md に「`npm test` のスコープ変更」「フル検証は `npm run test:all`」「AI テスト単独実行は `npm run test:agent`」を明記する。
  3. 旧コマンド名（`npm test`）は廃止・リネームしない。意味変更のみ。旧コマンドを呼び続けるユーザーは高速パスを得るだけで、エラーにはならない（ソフトな非互換）。
  4. AI テストが万一 regress した場合の検知ポイントを `test:all` / `test:agent` の 2 経路に集約する。

## Q&A
- Q: AI 実行テストとして分離対象となるのはどの範囲か？
  - A (推奨): 現状 Issue の計測で唯一特定されている 1 本のみを移動対象とし、将来的に同種のテストが生まれた場合の受け皿ディレクトリを定義する。根拠は Issue のプロファイル結果（TOP1 が全体の約 40% を占有、残りは AI 実行を伴わない）と、既存テスト群が AI をモック化しているコードパターン。
- Q: デフォルト実行に AI テストを含めない方針で合意できるか？
  - A (推奨): 合意。根拠は CLAUDE.md の「テストは何度も走る」運用と、Issue の所要時間短縮目的。CI 用に「all」モードを別途残すことで回帰網羅性は担保する。
- Q: 新しいセレクタと既存セレクタ（preset / scope 等）の共存ポリシーは？
  - A (推奨): 新しい AI セレクタは排他的（AI テストのみを実行）とし、既存セレクタとの同時指定はエラーで拒否する。根拠は Complete Context ガードレール（曖昧な組合せを避ける）と、既存テストランナーのバリデーションパターン（不正入力時に非ゼロ終了する）。
- Q: ドキュメント更新はどこに置くか？
  - A (推奨): CLAUDE.md のテスト関連セクションに追記する。根拠は既存 CLAUDE.md のセクション構成（関連ルールを同一見出し配下に集約）。

## Open Questions
-

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-22
- Notes: auto mode による self-Q&A draft。
