# Feature Specification: 151-refactor-agent-log-base-class

**Feature Branch**: `feature/151-refactor-agent-log-base-class`
**Created**: 2026-04-06
**Status**: Draft
**Input**: GitHub Issue #103

## Goal

callAgent / callAgentAsync 内部に密結合しているログ処理を分離し、汎用ログ基盤（Log 基底クラス + logger 関数）を導入する。これにより関心の分離を達成し、将来のログ種別追加を容易にする。

## Scope

- `src/lib/log.js` を新規作成し、Log 基底クラスと logger 関数を配置する
- `src/lib/agent-log.js` の AgentLog を Log 継承クラスに変更する
- `src/lib/agent.js` の callAgent / callAgentAsync から agentLog, cfg 末尾引数を削除する
- appendAgentLog と resolveLogDir を `src/lib/log.js` に移動する
- 全呼び出し箇所（flow 系4ファイル12箇所、docs 系7ファイル各1箇所）の引数を更新する

## Out of Scope

- GitLog 等の新しいログ種別の実装（Issue #103 で例示されているが実装対象外）
- ログフォーマット（JSONL 形式）の変更
- resolveLogDir のロジック変更（worktree 対応含む、既存ロジックをそのまま移動）
- 呼び出し元での try/finally ログパターンの追加（基盤のみ整備し、実際のログ有効化は別 spec）

## Clarifications (Q&A)

- Q: なぜ呼び出し元にログ責務を移すのか？
  - A: callAgent はエージェント呼び出しに専念すべきであり、ログの有無・種別・書き込み先の判断を持つべきではない。呼び出し元に移すことで、flow 系はフロー文脈（spec/phase）付きログを、docs 系はログなし/汎用ログを独立に制御できる。
- Q: 既存動作への影響は？
  - A: 現状すべての呼び出し元が agentLog=null, cfg=null で呼んでおり、ログは実質未使用。引数を削除しても外部動作は一切変わらない。
- Q: logger のエラーハンドリングは？
  - A: 現行の appendAgentLog と同じポリシーを維持する。ログ書き込みの失敗は stderr に出力し、例外を throw しない。ただしガードレール「エラーの黙殺禁止」に従い、空 catch ではなく stderr.write でエラーメッセージを出力する。

## Alternatives Considered

- **callAgent 内部にログを残す案**: 関心の分離が達成できない。callAgent がログの有無・種別・書き込み先の判断を持ち続けることになる。
- **appendAgentLog をそのまま外部化する案**: 汎用性がなく、将来新しいログ種別を追加する際に類似の関数が増殖する。Log 基底クラスによるポリモーフィズムの方が拡張性が高い。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-06
- Notes: autoApprove mode — gate passed all 15 guardrail checks

## Requirements

1. **[P1] Log 基底クラスの作成**: `src/lib/log.js` に Log クラスを新規作成する。Log は `static filename`（サブクラスで override）、`isEnabled(cfg)`（デフォルト true）、`toJSON()`（サブクラスで実装）を持つ。
2. **[P1] logger 関数の作成**: `src/lib/log.js` に logger 関数を配置する。logger は `log.isEnabled(cfg)` で有効判定し、`resolveLogDir(cwd, cfg)` でディレクトリ解決し、`log.constructor.filename` でファイル名を取得し、`log.toJSON()` を JSONL 形式で追記する。書き込み失敗時は stderr に出力し throw しない。
3. **[P1] AgentLog の Log 継承化**: `src/lib/agent-log.js` の AgentLog を Log の継承クラスに変更する。`static filename = "prompts.jsonl"`、`isEnabled(cfg)` は `cfg?.logs?.prompts` を返す、`toJSON()` は既存実装を維持する。
4. **[P1] callAgent / callAgentAsync の引数削除**: `src/lib/agent.js` の callAgent と callAgentAsync から末尾2引数（agentLog, cfg）とそれに関連するログ処理コードを削除する。
5. **[P1] appendAgentLog と resolveLogDir の移動**: `src/lib/agent-log.js` から appendAgentLog と resolveLogDir を `src/lib/log.js` に移動する。appendAgentLog は logger に置き換える。resolveLogDir はそのまま移動する。
6. **[P2] 全呼び出し箇所の引数更新**: callAgent / callAgentAsync の全呼び出し箇所で末尾の agentLog, cfg 引数を削除する。現状すべて null なので動作変更なし。

## Acceptance Criteria

- `src/lib/log.js` が存在し、Log クラスと logger 関数を export している
- AgentLog が Log を継承しており、`static filename`、`isEnabled`、`toJSON` が正しく動作する
- callAgent / callAgentAsync のシグネチャから agentLog, cfg 引数が削除されている
- appendAgentLog が `src/lib/agent-log.js` から削除され、logger に置き換えられている
- resolveLogDir が `src/lib/log.js` に移動している
- 全呼び出し箇所がエラーなく動作する（引数の不一致がない）
- `npm test` が全て通る
- logger に isEnabled=false のログオブジェクトを渡した場合、ファイルシステム操作が行われない
- logger の書き込み失敗時、stderr にメッセージが出力され例外が throw されない

## Test Strategy

- **Log 基底クラス**: toJSON がデフォルトで空オブジェクトを返す、isEnabled がデフォルトで true を返す、static filename が undefined（サブクラスで定義）
- **AgentLog**: 既存の toJSON テストを維持。isEnabled が cfg.logs.prompts を正しく参照する
- **logger**: isEnabled=false 時にファイル書き込みが行われない、正常書き込み時に JSONL が追記される、書き込みエラー時に stderr 出力のみで throw しない
- **テスト配置**: Log/logger のテストは `tests/unit/` に配置（汎用基盤のため、spec 限定ではない）

## Open Questions

なし。

## Impact on Existing Features

- **外部動作への影響なし**: 現状 agentLog=null で全箇所が呼ばれており、ログは未使用。引数削除は外部動作を変えない。
- **内部 API の変更**: callAgent / callAgentAsync のシグネチャが変わるため、これらを直接呼んでいる全ファイルの更新が必要。
- **CLI への影響なし**: 内部 API のみの変更。コマンドラインインターフェースに変更はない。
