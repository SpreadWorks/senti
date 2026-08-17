**開発種別:** 機能追加

**目的:** agent コマンド実行時にプロンプトを JSON Lines 形式でファイルに保存し、後からプロンプトの内容・実行時間・コンテキストを確認できるようにする。

## Q&A

**Q1: ログファイルの追記形式は？**
A: JSON Lines (`.jsonl`) — 1行1オブジェクト形式。追記が高速でファイルが壊れにくい。

**Q2: spec / phase のコンテキスト取得方法は？**
A: `callAgent` / `callAgentAsync` に `AgentLog` クラスのインスタンスを渡す方式。JSON エントリとマッピングされたクラス。引数デフォルトは `null`/`undefined` で、渡さない場合はログ処理をスキップ。

**Q3: デフォルトのログ保存先は？**
A: `{agent.workDir}/logs/prompts.jsonl`（`agent.workDir` に従う。デフォルト `.tmp/logs/prompts.jsonl`）。

## 設計まとめ

### ログエントリ形式（JSON Lines）

各 agent 呼び出しで1エントリを追記する。エントリには実行開始日時・終了日時・実行時間（秒）・spec 名・フェーズ名・プロンプトを含む。

### config.json スキーマ追加

`logs` セクションを新設:
- `logs.prompts`: ログ有効化フラグ（デフォルト `false`）
- `logs.dir`: ログ出力ディレクトリ（デフォルト `{agent.workDir}/logs`、ファイル名は `prompts.jsonl` 固定）

### 有効・無効条件

- `logs.prompts` が `true` のとき: agent 呼び出しのたびにログを追記する
- `logs.prompts` が `false` または未設定のとき: ログ処理は一切行わない
- エラー時: agent 呼び出しが失敗した場合もログエントリを記録する。エラー情報は記録しない（プロンプト・開始日時・終了日時・実行時間のみ記録する）

### ログファイルの管理

- `{agent.workDir}/logs/` ディレクトリは `.gitignore` 対象とする（デフォルト `.tmp/logs/`）
- ローテーション・サイズ上限は v1 では設けない（無制限に追記）

### AgentLog クラス

`src/lib/agent-log.js` に新設するクラス。ログエントリの JSON 形式とマッピングされ、spec・フェーズのコンテキストを保持する。

### callAgent / callAgentAsync の変更

`AgentLog` インスタンスをオプション引数として受け取る。引数が渡されない場合はログ処理を一切スキップする。呼び出し側は必要に応じて `AgentLog` インスタンスを生成して渡す。

### 影響範囲

- `src/lib/agent-log.js`: `AgentLog` クラス新規作成（JSON マッピング・ファイル書き込み担当）
- `src/lib/agent.js`: `callAgent` / `callAgentAsync` に `AgentLog` 引数追加・ログ処理追加
- `src/lib/config.js` または `src/lib/types.js`: `logs` スキーマ追加
- 各呼び出し元（`flow/commands/review.js` 等）: 必要に応じて `AgentLog` インスタンスを渡す

- [x] User approved this draft
