# Feature Specification: 249-json-schema-profile-props

**Feature Branch**: `feature/249-json-schema-profile-props`
**Created**: 2026-05-01
**Status**: Draft
**Input**: GitHub Issue #304

## Goal
jsonSchemaFlag と jsonSchemaMode を Provider クラスのメソッドからプロファイルプロパティに移行し、agent.js の provider.constructor.key ハードコード分岐を除去する

## Background
agent.js の _buildInvocation に provider.constructor.key === 'codex' というハードコード分岐があり、JSON schema の渡し方式（ファイルパス vs インライン）を provider key で判定している。jsonSchemaFlag は Provider クラスのメソッドだが、UserProvider は既にプロファイルプロパティから読む設計になっており、builtin provider（Claude/Codex）だけがメソッドに固定されている。この非対称性を解消し、全 provider で統一された profile プロパティベースの設計に移行する。

## Scope
- [must] `src/lib/provider.js` — builtinProfiles() の各エントリに `jsonSchemaFlag` と `jsonSchemaMode` プロパティを追加。`Provider`/`ClaudeProvider`/`CodexProvider`/`UserProvider` から `jsonSchemaFlag()` メソッドを削除
- [must] `src/lib/agent.js` — `_buildInvocation` の jsonSchema 処理を `resolved.profile` のプロパティベースに変更。`provider.constructor.key === 'codex'` 分岐を除去
- [must] `src/lib/config.js` — `agent.providers` スキーマに `jsonSchemaFlag` と `jsonSchemaMode` プロパティを追加
- [must] `src/lib/types.js` — `AgentProvider` typedef に `jsonSchemaFlag` と `jsonSchemaMode` を追加
- [should] `specs/249-json-schema-profile-props/tests/` — jsonSchemaFlag/jsonSchemaMode のプロファイルプロパティ経由テスト（agent _buildInvocation、builtin profile プロパティ、config バリデーション）

## Out of Scope
- `systemPromptFlag()` / `workDirFlag()` の同様の移行（別 Issue）
- `src/templates/` や `src/presets/` の変更（profile 定義はこれらに含まれない）
- `docs/` や `src/AGENTS.md` の更新（自動生成ドキュメントは `sdd-forge build` で再生成する）
- 過去の spec テスト（`specs/247-*/tests/` 等）の更新（旧 spec のテストは本 spec のスコープ外）

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換コードは書かない
- agent.call() の外部インターフェース（引数・戻り値）は変更しない

## Design Principles
-

## Overview
### Modules
- src/lib/provider.js — Provider 抽象化。builtinProfiles() で jsonSchemaFlag/jsonSchemaMode をプロファイルプロパティとして宣言する
- src/lib/agent.js — AI agent サービス。_buildInvocation で resolved.profile から jsonSchemaFlag/jsonSchemaMode を読み取り、schema 渡し方式を決定する
- src/lib/config.js — config.json バリデーション。agent.providers スキーマに新プロパティを追加する

### Data Flow
- builtinProfiles() → ProviderRegistry._mergeProfiles() → resolveProfile() → Agent._buildInvocation()

### Decisions
- jsonSchemaFlag を Provider メソッドから profile プロパティに移行する。UserProvider が既にこのパターンを採用しており、jsonOutputFlag も同じ形式。統一することで provider 間の非対称性を解消する
- jsonSchemaMode: 'file' | 'inline' を新設し、provider.constructor.key 分岐を置き換える。未指定時は 'inline' デフォルト
- profile の上書きは既存の全置換方式を維持する。deep merge には変更しない

## Clarifications (Q&A)
- Q: 既存機能への影響は？
  - A: agent.call() の外部インターフェース（引数・戻り値）は不変。_buildInvocation 内部の jsonSchema 処理ロジックのみ変更。config.json の agent.providers に jsonSchemaFlag と jsonSchemaMode が新規 optional プロパティとして追加されるが、既存の config はバリデーションエラーなしで動作する。Provider.jsonSchemaFlag() メソッドは agent.js 以外に呼び出し箇所がないため削除しても外部影響なし。プリセット・テンプレートは jsonSchemaFlag を参照しておらず影響なし

## Alternatives Considered
- jsonSchemaFlag() メソッドを残し、profile プロパティへのフォールバックにする — alpha 版ポリシーにより後方互換は不要。二重のアクセスパスは複雑性を増すだけ
- boolean (useFile: true/false) で schema mode を表現する — 文字列 enum ('file' | 'inline') の方がセマンティクスが明確で可読性が高い
- systemPromptFlag/workDirFlag も同時に移行する — 変更範囲が広がりレビュー負荷が増す。Issue #304 のスコープに従い jsonSchemaFlag/jsonSchemaMode のみを対象とする
- provider.jsonSchemaConfig() メソッドを新設して flag と mode を返す — agent.js は既に resolved.profile を直接参照するパターンを採用しており、不要な間接層になる

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: `ClaudeProvider.builtinProfiles()` の各エントリに `jsonSchemaFlag: "--json-schema"` と `jsonSchemaMode: "inline"` プロパティを追加する
- R2 [must]: `CodexProvider.builtinProfiles()` の各エントリに `jsonSchemaFlag: "--output-schema"` と `jsonSchemaMode: "file"` プロパティを追加する
- R3 [must]: `Provider` 基底クラスおよび `ClaudeProvider`/`CodexProvider`/`UserProvider` から `jsonSchemaFlag()` メソッドを削除する
- R4 [must]: `agent.js` の `_buildInvocation` で `provider.jsonSchemaFlag()` 呼び出しを `profile.jsonSchemaFlag` プロパティ参照に置き換える。`jsonSchemaFlag` が falsy の場合は既存の `fmtFallback` パスを維持する
- R5 [must]: `agent.js` の `_buildInvocation` で `provider.constructor.key === 'codex'` 分岐を `profile.jsonSchemaMode === 'file'` に置き換える。未指定時は `'inline'` として扱う
- R6 [must]: `config.js` の `agent.providers` additionalProperties に `jsonSchemaFlag: { type: "string" }` と `jsonSchemaMode: { type: "string", enum: ["file", "inline"] }` を追加する
- R7 [must]: `src/lib/types.js` の `AgentProvider` typedef に `jsonSchemaFlag?: string` と `jsonSchemaMode?: "file"|"inline"` を追加する
- R8 [must]: `specs/249-json-schema-profile-props/tests/` に jsonSchemaMode: 'inline'（schema がインラインで渡される）、jsonSchemaMode: 'file'（schema がファイルパスで渡される）、jsonSchemaFlag なし + fmtFallback あり（fallback がプロンプトに prepend される）、および cross-provider（codex command + inline mode、非 codex command + file mode）のテストケースを追加する
- R9 [must]: `specs/249-json-schema-profile-props/tests/` で builtin profile に `jsonSchemaFlag` と `jsonSchemaMode` プロパティが含まれることを検証し、config バリデーションで有効な値の受け入れと無効な `jsonSchemaMode` の拒否を検証するテストを追加する

## Acceptance Criteria
- agent.js に `provider.constructor.key` への参照が存在しない（provider.js の ProviderRegistry.resolveByCommand() は対象外）
- agent.js に `provider.jsonSchemaFlag()` メソッド呼び出しが存在しない
- Provider/ClaudeProvider/CodexProvider/UserProvider に `jsonSchemaFlag()` メソッドが存在しない
- 全 builtin profile エントリに jsonSchemaFlag と jsonSchemaMode プロパティが存在する
- config.json バリデーションが jsonSchemaFlag と jsonSchemaMode を受け入れる
- 既存の npm test が全て PASS する

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: builtinProfiles に jsonSchemaFlag/jsonSchemaMode プロパティを追加
  - ClaudeProvider と CodexProvider の builtinProfiles() 返却値に jsonSchemaFlag と jsonSchemaMode プロパティを追加する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Provider から jsonSchemaFlag() メソッドを削除し agent.js を profile プロパティベースに移行
  - Provider/ClaudeProvider/CodexProvider/UserProvider から jsonSchemaFlag() メソッドを削除し、agent.js の _buildInvocation を profile.jsonSchemaFlag/jsonSchemaMode ベースに変更する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: config.js スキーマと types.js typedef に jsonSchemaFlag/jsonSchemaMode を追加
  - agent.providers の config スキーマと AgentProvider typedef に jsonSchemaFlag と jsonSchemaMode プロパティを追加する
  - see `tasks/T-3.md` for full spec
