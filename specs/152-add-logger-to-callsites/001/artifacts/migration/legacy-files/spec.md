# Feature Specification: 152-add-logger-to-callsites

**Feature Branch**: `feature/152-add-logger-to-callsites`
**Created**: 2026-04-07
**Status**: Draft
**Input**: GitHub Issue #104

## Goal

spec 151 で整備済みの AgentLog + logger 基盤を全 callAgent/callAgentAsync 呼び出し元で有効化し、エージェント呼び出しのログ記録を実現する。

## Scope

- Logger クラスのシングルトン化（init/log インターフェース）
- Log 基底クラスへの finalize フック追加
- AgentLog の自動計測対応（開始時刻・終了時刻・経過時間）
- CLI エントリポイント（sdd-forge.js）での Logger 初期化
- 全 19 箇所の callAgent/callAgentAsync 呼び出し元へのログ記録導入
  - flow 系 12 箇所（spec/phase あり）
  - docs 系 7 箇所（spec/phase なし）

## Out of Scope

- 同期版ロガー（loggerSync）の追加（ボード ffe7）
- callAgent 引数のオブジェクト化・バケツリレー解消（ボード 1877）
- 統合 JSONL ログ設計（type 区別・コンビニエンスメソッド）（ボード 8469）
- 既存の callAgent/callAgentAsync 関数シグネチャの変更
- ログの閲覧・分析機能

## Clarifications (Q&A)

- Q: sync 関数内で async な logger をどう扱うか？
  - A: fire-and-forget（`logger().catch(() => {})`）で呼ぶ。ログ欠損は許容する。対象は run-gate.js (2), get-context.js (1), init.js (1), template-merger.js (1) の計 5 箇所。

- Q: Logger が初期化されていない場合の挙動は？
  - A: console.error で警告メッセージを出し、ログ書き込みをスキップする。エラーは投げない。テスト・直接実行時に init されないケースを考慮。

- Q: callAgent が例外を投げた場合にログを残すか？
  - A: 残す。try/finally で Logger.log() を呼び、失敗した呼び出しの実行時間も記録する。

## Alternatives Considered

- **ctx.logger 方式（引数引き回し）**: 設計としてはきれいだが、19 箇所すべてで ctx から logger を取り出すコードが必要になり、変更箇所が増える。シングルトンの方が呼び出し側がシンプル。
- **loggerSync の追加**: sync 関数内での確実なログ書き込みが可能になるが、この spec のスコープを超える。fire-and-forget で実用上の問題はない。
- **2段階初期化（getInstance + init）**: sdd-forge.js を必ず通るため init 忘れの実害はないが、コンストラクタで完結させる方がシンプル。ただし Logger はシングルトンとして getInstance().init() で初期化する方式を採用（Q&A での合意）。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-07
- Notes: gate PASS 後に承認
- [x] User approved test change for `toJSON returns null for unset fields` (R3 仕様変更によるアサート変更、impl gate にて承認、2026-04-07)

## Requirements

### R1: Logger シングルトン化 [P1]

- Logger クラスにシングルトンアクセスメソッドと init メソッドを実装する
- init は cwd と cfg を受け取り、内部に保持する
- init 未呼び出し時に log メソッドが呼ばれた場合、console.error で警告を出しスキップする（エラーは投げない）

### R2: Log 基底クラスへの finalize フック [P1]

- Log 基底クラスに finalize メソッドを追加する（デフォルトは空実装）
- Logger の log メソッド内で、書き込み前に finalize を呼ぶ

### R3: AgentLog の自動計測 [P1]

- AgentLog のコンストラクタで executeStartAt を自動設定する
- AgentLog の finalize で executeEndAt と executeTime を計算する
- 呼び出し側は「AgentLog 生成 → エージェント呼び出し → Logger.log()」の 3 ステップのみ

### R4: CLI エントリポイントでの初期化 [P2]

- sdd-forge.js で Logger.getInstance().init(cwd, cfg) を呼ぶ
- config 読み込み後、コマンドディスパッチ前に初期化する

### R5: flow 系呼び出し元への導入（12 箇所） [P3]

- review.js (8), run-gate.js (2), run-retro.js (1), get-context.js (1)
- flow 系は spec と phase を AgentLog に設定する
- async 関数内では `await Logger.getInstance().log(log)` で呼ぶ
- sync 関数内（run-gate.js, get-context.js）では fire-and-forget で呼ぶ
- callAgent が例外を投げた場合も try/finally でログを記録する

### R6: docs 系呼び出し元への導入（7 箇所） [P3]

- text.js (2), forge.js (1), enrich.js (1), init.js (1), translate.js (1), agents.js (1), template-merger.js (1)
- docs 系は spec: null, phase: null で AgentLog を生成する
- async 関数内では await で呼ぶ
- sync 関数内（init.js, template-merger.js）では fire-and-forget で呼ぶ
- callAgent が例外を投げた場合も try/finally でログを記録する

## Acceptance Criteria

- AC1: `cfg.logs.prompts` が有効な状態で sdd-forge コマンドを実行し、callAgent/callAgentAsync が呼ばれた後に prompts.jsonl にエントリが追記される
- AC2: 各ログエントリに executeStartAt, executeEndAt, executeTime, spec, phase, prompt フィールドが含まれる
- AC3: Logger が未初期化の状態でコマンドを直接実行した場合、console.error に警告が出力され、プロセスは正常に完了する
- AC4: callAgent がタイムアウト等で例外を投げた場合も、ログエントリが記録される（executeTime が記録される）
- AC5: 既存の callAgent/callAgentAsync の動作（戻り値、例外、タイムアウト）に変更がない

## Test Strategy

- Logger シングルトンの init/log/未初期化時の挙動をユニットテストで検証する
- AgentLog の自動計測（finalize による時刻・経過時間の計算）をユニットテストで検証する
- 呼び出し元のログ導入は、実際のエージェント呼び出しを伴うため spec verification テスト（specs/ 配下）で検証する

## Open Questions

- (none)
