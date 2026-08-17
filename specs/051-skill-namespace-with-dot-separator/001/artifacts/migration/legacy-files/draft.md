# Draft: Skill Namespace with Dot Separator

## 決定事項

### 1. スキル名のドット区切り名前空間
- 現在: `sdd-flow-start`, `sdd-flow-close`, `sdd-flow-status`
- 変更後: `sdd-forge.flow-start`, `sdd-forge.flow-close`, `sdd-forge.flow-status`
- ディレクトリ名も同様にドット入り (`sdd-forge.flow-start/SKILL.md`)
- SKILL.md の `name:` フィールドも変更。プロンプト本文は変更なし

### 2. シンボリックリンク廃止
- `.agents/skills/` → `.claude/skills/` のシンボリックリンクを廃止
- AGENTS.md → CLAUDE.md のシンボリックリンクも廃止
- すべて直接コピー / 直接配置に変更

### 3. スキル配置方法
- `src/templates/skills/` (npm パッケージ内の原本) → 各エージェントディレクトリに直接コピー
- 今回は `.claude/skills/` と `.agents/skills/` の両方に直接配置
- setup 時の複数エージェント選択 UI は次の spec で対応

### 4. AGENTS.md / CLAUDE.md の独立管理
- エージェントと対応ファイルのマッピング:
  - Claude → CLAUDE.md
  - Codex → AGENTS.md
- 挙動はユーザー環境に応じて変える:
  - ファイルが存在しない → setup 時に指定されたエージェントに応じて配置
  - ファイルが存在するがディレクティブなし → ディレクティブを差し込み
  - ファイルが存在しディレクティブあり → 更新
  - 両ファイルが存在する → それぞれに差し込み/更新

### 5. sdd-forge リポジトリ自体の変更
- `.agents/skills/` を削除
- `.claude/skills/` に `sdd-forge.flow-*` で直接配置

## スコープ外（次の spec で対応）
- setup 時の複数エージェント選択 UI
- タスク別エージェント/モデル設定 (`.tmp/multi-agent-task-config.md` 参照)

## Approval
- [x] User approved this draft
