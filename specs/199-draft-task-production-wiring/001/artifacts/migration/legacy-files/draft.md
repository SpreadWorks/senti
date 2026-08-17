# Draft: draft-task-production-wiring

**開発種別:** enhancement

**目的:** `sdd-forge flow run draft-task` が stub 無し・実 provider 経由で production 品質の addition task draft を生成し、full gate（task-spec phase, guardrail AI 準拠判定含む）で検証され、FAIL 時は reasons を次リトライ prompt に組み込んで再生成する経路を確立する。spec 198 (#186) で scaffold 止まりだった REQ-P3 の残作業。

## Goal

addition origin 自律 draft 生成経路を scaffold から production 品質へ引き上げる。具体的には次の 3 点を確立する:

1. 内部 simpleGate（見出し/非空チェックのみ）を廃し、`task-spec` phase の full gate で評価する
2. gate FAIL 時の reasons を次リトライ prompt に注入し、AI が失敗点を修正して再生成できるようにする
3. skill 経路が `sdd-forge flow run draft-task` を呼ぶだけで動く手続き的フローを SKILL.md に明文化する

## Impact on Existing Features

- **addition task 向け draft 生成コマンド**: 内部評価ロジックのみ置換。外部 CLI インターフェース（引数、終了コード、JSON envelope の形式）は不変。既存呼び出し側は影響なし。
- **scaffold 互換スタブ経路**: 維持。既存テスト利用を継続。
- **task-spec phase gate**: 利用者として呼び出すのみ。gate 本体のロジックは変更しない。
- **flow-impl skill**: 手順に addition task 分岐が追加されるが、既存の通常 task 経路には影響しない。
- **その他 CLI コマンド・docs パイプライン・preset システム**: 影響なし。

## Scope

- `flow run draft-task` の内部評価経路を simpleGate から task-spec phase full gate へ置換
- retry 時の prompt に前回 FAIL reasons を注入する仕組みの追加
- flow-impl skill テンプレートへの手続き的ステップ追加
- unit test による配線検証（agent resolve、retry ループ、prompt 注入）

## Out of Scope

- `agent.resolve()` の未登録 commandId 警告ロジック追加
- `task-spec` phase gate 本体のロジック変更
- default agent.providers テンプレートへの明示的 commandId マッピング追加
- 既存 `SDD_FORGE_AGENT_STUB` 経路の削除

## Requirements

要件の優先順位は記述順（P1 が最優先）。P1–P3 が Issue の中核要求であり、P4–P6 はそれらを支える互換性・検証要件。

1. **[P1]** When addition task 向けの draft 生成コマンドが draft を生成したとき、当該コマンドは guardrail AI 準拠判定を含む task-spec phase の full gate でその draft を評価し、gate PASS のみを承認シグナルとして扱わなければならない。
2. **[P2]** When 上記 gate が FAIL を返したとき、retry ループは前回 FAIL の理由を次回の draft 生成プロンプトに構造化された形で提供しなければならず、初回プロンプトには当該フィードバックを含めてはならない。
3. **[P3]** When flow-impl skill の手順が addition task を検出したとき、skill は draft 生成ツールを呼び出し、gate PASS を確認してから後続ステップに進まなければならない。skill 自身が draft を独自生成してはならない。
4. **[P4]** When 自動テストが draft 生成プロンプトの組み立てロジックを検証するとき、前回 FAIL フィードバックの有無によるプロンプト差分を自動テストから検証できなければならない。
5. **[P5]** When agent 設定が既定値以外に `flow.draft-task` 固有のマッピングを持たない場合でも、当該コマンドは既定 provider で解決できなければならない。
6. **[P6]** When 既存の scaffold 互換スタブ経路が有効化されているとき、本 spec の変更は当該経路の契約（task 情報入力と draft 出力の形式）を破壊してはならない。

## Acceptance Criteria

- scaffold 互換スタブ無効時でも、addition task 向け draft 生成コマンドが実 provider 経由で draft を生成できる
- gate FAIL 発生時、次回 retry のプロンプトに前回 FAIL 理由が反映され、AI が異なる内容の draft を生成する経路が成立する
- flow-impl skill は draft を独自生成せず、draft 生成ツールの呼び出しに一本化されている
- 本 spec で削除する内部最小 gate のロジックに依存していた既存テストが PASS を維持する

## Alternatives Considered

- **gate 評価を既存の実行モデル外で行う方式**: 却下。既存 flow 系コマンドの実行モデルと一貫性が取れず、呼び出しコストと結果取り出しの複雑さが増す。
- **FAIL フィードバックを恒常ルール領域に混ぜる方式**: 却下。恒常ルールと試行依存フィードバックが混在し、AI の認識が曖昧になる（guardrail "Unambiguous Requirements" の精神）。分離配置が構造的に明確。
- **既定 provider 設定に固有マッピングを明示追加する方式**: 却下。既存の fallback 機構で解決される。冗長追加は保守負担を増やすだけで挙動変化ゼロ（alpha 版ポリシー「後方互換コードを書かない」と逆行）。

## Q&A

1. **内部最小 gate 置換時の gate 呼び出しはどう行うべきか?**
   推奨: 既存 flow 系コマンドと同じ実行モデルで呼び出す。
   根拠: **既存コードパターン** — flow 系コマンドは統一された実行モデルで動作しており、本件のみ例外扱いすると一貫性を損なう。

2. **FAIL フィードバックを retry プロンプトにどう組み込むべきか?**
   推奨: 再試行時のみ専用セクションをプロンプトに追加。
   根拠: **guardrail "Unambiguous Requirements"** — AI に渡す指示は一貫した条件と期待動作の対を保つべき。恒常ルールに混ぜるとセマンティクスが曖昧になる。

3. **agent profile への明示登録は必要か?**
   推奨: 不要。既定 fallback で動作することを自動テストで検証するのみ。
   根拠: **既存コードパターン** — 既存の最長一致機構がヒットなしの場合に既定値を返すため、冗長登録は alpha 版ポリシー「後方互換コードを書かない」と逆行する追加負債となる。

4. **skill テンプレート更新の範囲は?**
   推奨: skill 手順に addition task 検出分岐を追加。
   根拠: **既存コードパターン** — 他の skill 手順（例: 通常 task の write-tests / implement）は全て手順セクションに具体的フローを列挙する形式を採る。本件のみ手順外の方針テキストに留める理由がなく、一貫性確保のため手順セクションに統合する。

5. **FAIL フィードバック伝播のテスト方式は?**
   推奨: プロンプト組み立てロジックを自動テストから直接検証する。
   根拠: **既存コードパターン** — sdd-forge のテストは純粋関数の I/O 検証が主流であり、末端経路の end-to-end 検証より分離度が高い。既存スタブ経路の入出力契約を変更する必要もない。

## User Confirmation

- [x] User approved this draft (autoApprove, 2026-04-20)
