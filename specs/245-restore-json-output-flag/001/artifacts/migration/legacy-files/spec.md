# Feature Specification: 245-restore-json-output-flag

**Feature Branch**: `feature/245-restore-json-output-flag`
**Created**: 2026-04-29
**Status**: Draft
**Input**: GitHub Issue #294

## Goal
provider config に jsonOutputFlag プロパティを復活させ、agent.js で JSON 出力フラグの有無に基づく出力パース分岐を実装する。マルチエージェント対応で JSON 非対応 CLI を provider として追加可能にする。

## Background
spec 189 で Provider.jsonFlag() メソッドと config の jsonOutputFlag プロパティを同時に削除した。削除の意図は args への自動注入の廃止だったが、出力形式の宣言まで一緒に失われた。結果、agent.js は全 provider に対し無条件に JSON パースを試み、失敗時にフォールバックする設計になっている。JSON 非対応 CLI をマルチエージェント構成に追加する際、この設計では正しく分岐できない。

## Scope
- (must) config.json の provider スキーマに jsonOutputFlag (string, optional) を追加
- (must) builtin profile (ClaudeProvider, CodexProvider) の builtinProfiles() に jsonOutputFlag を追加
- (must) agent.js で jsonOutputFlag の有無による出力パース分岐を実装
- (should) src/CLAUDE.md の Provider builtin profile セクションに jsonOutputFlag の説明を追加
- (should) src/lib/types.js の AgentProvider typedef に jsonOutputFlag プロパティ (string, optional) を追加する
- (should) tests/unit/lib/provider.test.js を更新し、全 builtin profile に jsonOutputFlag が含まれることをアサートする

## Out of Scope
- Provider クラスに jsonFlag() メソッドを復活させること（spec 189 で禁止済み）
- args への JSON フラグ自動注入（args に literal で書く方針は変更しない）
- UserProvider.parse() の変更

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- jsonOutputFlag は args 注入に使用せず、出力パース分岐の宣言としてのみ機能する
- 既存の builtin provider (claude, codex) の動作を変更しない

## Design Principles
- フラグ注入（入力側）と出力形式宣言（出力側）の分離。spec 189 が禁止したのは前者であり、後者は正当な concern
- profile レベルの宣言に基づく明示的な分岐。Provider クラスのメソッドではなく profile データで制御する

## Overview
### Modules
- src/lib/config.js — provider スキーマに jsonOutputFlag プロパティを追加
- src/lib/provider.js — builtinProfiles() の戻り値に jsonOutputFlag を含める
- src/lib/agent.js — _callOnce で jsonOutputFlag の有無に基づき parse 分岐を実装
- src/lib/types.js — AgentProvider typedef に @property {string} [jsonOutputFlag] を追加

### Data Flow
- config.json → ProviderRegistry._mergeProfiles → profile.jsonOutputFlag → agent._callOnce で分岐判定

### Decisions
- jsonOutputFlag を string 型にする。boolean でなく string にすることで、将来の args 整合性検証（args に対応するフラグが含まれているか確認する lint 的機能）に拡張可能。
- jsonOutputFlag 未定義の場合は provider.parse() をスキップし { text, usage: null } を返す。downstream は extractJsonCandidate で独立に JSON 抽出するため機能影響なし。
- ユーザーが config で builtin profile を上書きした場合、ユーザー定義が優先される。jsonOutputFlag を省略すれば JSON パースが無効になる。

## Clarifications (Q&A)
- Q: jsonOutputFlag は args に注入されるか？
  - A: されない。args に literal で書く既存方針を維持する。jsonOutputFlag は出力パース分岐の宣言としてのみ機能する。
- Q: UserProvider の parse() は変更されるか？
  - A: 変更しない。jsonOutputFlag 未設定の場合は parse() 自体が呼ばれないため、UserProvider.parse() の実装は現状維持で問題ない。

## Alternatives Considered
- boolean hasJsonOutput — 存在チェックのみなら boolean で十分だが、将来の args 整合性検証に使えないため string を選択
- Provider.jsonFlag() メソッドの復活 — spec 189 で禁止された設計（args 自動注入）の復活になるため却下
- parse() 内で try-catch してフォールバック — parse() を呼ばないほうが意図が明確。無駄な try-catch を避ける

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: config.json の provider スキーマ (src/lib/config.js) に jsonOutputFlag (type: string, optional) を追加する。既存の config で jsonOutputFlag が未定義でもバリデーションが通ること。
- R2 [must]: ClaudeProvider.builtinProfiles() の各 profile エントリに jsonOutputFlag を追加する。値は '--output-format json'。CodexProvider.builtinProfiles() の各 profile エントリに jsonOutputFlag を追加する。値は '--json'。
- R3 [must]: agent.js の出力パース処理で、profile.jsonOutputFlag が truthy の場合のみ provider.parse(stdout) を呼び出す。falsy の場合は parse() を呼ばず { text: stdout.trim(), usage: null } を返す。
- R4 [should]: src/CLAUDE.md の「Provider の builtin profile」セクションを更新し、jsonOutputFlag の位置づけ（出力パース分岐の宣言、args 注入には使用しない）を明記する。
- R5 [should]: src/lib/types.js の AgentProvider JSDoc typedef に @property {string} [jsonOutputFlag] を追加する。typedef が config スキーマと一致すること。
- R6 [should]: tests/unit/lib/provider.test.js を更新し、ClaudeProvider および CodexProvider の builtinProfiles() 全エントリに jsonOutputFlag フィールドが含まれることをアサートする。

## Acceptance Criteria
- R1: config.json で providers.<name>.jsonOutputFlag に string を設定してもバリデーションエラーにならない
- R1: config.json で providers.<name>.jsonOutputFlag を省略してもバリデーションエラーにならない
- R2: ClaudeProvider.builtinProfiles() の全 profile に jsonOutputFlag フィールドが含まれる
- R2: CodexProvider.builtinProfiles() の全 profile に jsonOutputFlag フィールドが含まれる
- R3: jsonOutputFlag が設定された profile で agent を呼び出すと provider.parse() が実行される
- R3: jsonOutputFlag が未設定の profile で agent を呼び出すと provider.parse() がスキップされ { text, usage: null } が返る
- R4: src/CLAUDE.md に jsonOutputFlag の説明が追記されている
- R5: AgentProvider typedef に jsonOutputFlag フィールドが含まれる（config スキーマと一致）
- R6: tests/unit/lib/provider.test.js の builtinProfiles アサーションがテストコードを修正せずに通る

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add jsonOutputFlag to provider config schema, builtin profiles, and typedef
  - config.json の provider スキーマに jsonOutputFlag を追加し、ClaudeProvider / CodexProvider の builtinProfiles() にフラグ値を含める。src/lib/types.js の AgentProvider typedef に @property {string} [jsonOutputFlag] を追加する。tests/unit/lib/provider.test.js を更新し、全 builtin profile に jsonOutputFlag が含まれることをアサートする。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Implement parse branching in agent._callOnce based on jsonOutputFlag
  - agent.js の _callOnce で profile.jsonOutputFlag の有無に基づき、provider.parse() の呼び出しを分岐する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update src/CLAUDE.md with jsonOutputFlag documentation
  - src/CLAUDE.md の Provider builtin profile セクションを更新し、jsonOutputFlag の位置づけを明記する。
  - see `tasks/T-3.md` for full spec
