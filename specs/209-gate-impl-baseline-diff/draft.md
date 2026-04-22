---
issue: 207
---

# Draft: gate-impl baseline failure diff awareness

**開発種別:** feature

**目的:** gate-impl の AI 評価器が base branch に既存の test failure を「新規に壊れたテスト」と誤 FAIL 判定する問題を解消する。

## 背景

- 現状の gate-impl は head のテスト結果のみを AI に渡し、baseline と比較しない
- 結果として base 既存 failure が guardrail `impl-test-conflict-escalation` に誤って該当し FAIL 判定される
- spec 199 で実害確認済み

## Scope Verification

単一責務: **baseline 比較による誤 FAIL 排除**。
これを実現するための最小限の変更範囲として以下を含む:

1. baseline snapshot の取得タイミングと保存場所の定義
2. gate-impl が baseline と head を比較できる入力形式の定義
3. baseline 未取得時の安全な退避挙動

上記以外の改善（テストコマンド動的発見、prompt size 上限 config 化等）はスコープ外。

## Impact on Existing Features

- **gate-impl の評価入力**: head のみ → baseline + head
- **`flow run tests`**: baseline モードの追加。既存 flow への影響は baseline 未取得時のフォールバックで吸収
- **既存 active flow（本 spec マージ前に開始済み）**: baseline 未記録のまま gate-impl に到達しても破壊されず、従来相当の評価に退避される

## 制約

- **MUST NOT**: base branch で実際にテストを走らせる
- baseline は静的に記録・参照できる形で保持

## Requirements（優先順）

ガードレールの誤 FAIL 排除が主目的であり、以降の優先順は目的への寄与度で並べる:

### P1（必須・本 spec の中核）

- **R-P1-1**: When flow が開始されたとき、the system shall 最初のテスト実行結果を baseline として保存できる仕組みを提供する
- **R-P1-2**: When gate-impl が実行されるとき、the system shall baseline と head の両方を参照し、head にのみ出現する failure だけを評価対象にする
- **R-P1-3**: When テスト結果が記録されるとき、the system shall 失敗テストの識別子と理由を構造化データとして保持し、test 単位の状態遷移を判別可能にする

### P2（安全性・既存挙動保護）

- **R-P2-1**: When baseline が未取得の状態で gate-impl が実行されたとき、the system shall gate の合否判定ロジックを変更せず、機能無効である旨を警告として可視化する
- **R-P2-2**: When AI 側の経路から test 結果書き込みが試みられたとき、the system shall tool が実測した exitCode / count を保持し、上書きを拒否する

### P3（信頼性・運用）

- **R-P3-1**: When baseline と head を扱うとき、the system shall 同一の取得手順・同一のスキーマで両者を対称的に扱う
- **R-P3-2**: When ログ解析が失敗したとき、the system shall flow 全体を停止させず、警告付きで退避する

## Alternatives Considered

### 設計の選択肢比較（決定モード、ブレインストーミングではない）

gate-impl への入力形式と解析責務の担い手について、4 案を比較した:

- **A: テスト実行結果の原データをそのまま AI 評価器に投入** — 評価器側の負荷が大きく、将来のフレームワーク別対応もそのまま残る。推奨せず
- **B: 実装を行う主体が要約も行う** — 実装中の思考文脈が要約結果にバイアスとして載る懸念。推奨せず
- **C: 実装文脈を持たない独立した要約主体を介在させる — 採用** — 要約にバイアスが載らず、結果の監査可能性も高い。既存の仕組みで実現可能で新規インフラは不要
- **D: 独立主体がテスト実行まで担う** — 実行基盤の能力拡張が必要で、本 spec のスコープを超える。推奨せず

### Q&A の進行モード

本 draft の Q&A は **決定モード**。brainstorming ではなく、選択肢を提示 → ユーザーが採択 → 決定を記録 という流れで進行した。Guardrail "Confirm Brainstorm vs. Decision Before Critiquing" 準拠。

## Q&A

### Q1: Issue 解釈の確認
- **推奨と根拠**: Issue 本文から「baseline 既存 failure との差分認識」が本質と読み取れる → そのまま採用を推奨
- **結論**: 採用

### Q2: baseline 取得のトリガ
- **推奨と根拠**: CLI フラグ化 + skill 自動実行 = CLI 単独利用者も opt-in 可能で破壊的でない
- **結論**: CLI フラグ + skill 自動実行

### Q3: gate-impl への入力形式
- **推奨と根拠**: 議論開始時は「生ログ + 指示文」だったが、議論を経て構造化 JSON に変更。prompt 肥大と preset-specific parser 問題を一挙に解消
- **結論**: 構造化 JSON（baseline + head）

### Q4: baseline 未取得時の挙動
- **推奨と根拠**: 既存 flow を破壊せず、警告で機能無効を可視化するのが他プロジェクトのガードレール設計（alpha 版の段階的機能追加）と整合
- **結論**: 警告付きフォールバック

### Q5: baseline の陳腐化（main 前進時）— 取り下げ
- **デジレッション記録**: main rebase 時の baseline 無効化を検討したが、baseline は「自作業の開始時点」スナップショットなので main 前進で無効化する必要はないと判断し取り下げ
- **結論**: 陳腐化検知ロジックは追加しない

### Q6: テスト結果の情報粒度
- **推奨と根拠**: 件数だけでは個別テストの状態遷移を追えず要件 R-P1-3 を満たせない → 失敗テスト ID + 理由のリスト
- **結論**: 構造化リスト

### Q7: 誰がテスト結果を構造化するか
- **推奨と根拠**: 実装文脈を持たない独立主体に解析を任せることでバイアスを遮断し、監査可能性も高まる。既存の仕組みで実現可能で新規インフラ不要
- **結論**: 独立解析主体を介在させる。解析失敗時は flow 駆動側が補完する二段構え

### Q8: 本 spec のスコープ
- **推奨と根拠**: 動的テストコマンド発見は独立機能で本 spec の前提ではない → 別 spec に分離
- **結論**: 動的コマンド発見はボード `01be` に分離、agent 失敗時 skill fallback は本 spec 内

## スコープ外（別 spec / ボード化済み）

- テストコマンド動的発見（ボード hash `01be`）
- task/parent 粒度見直し・unit/e2e 個別指定（ボード hash `58ff`）
- ログ圧縮・prompt size 上限の config 化（構造化 JSON 採用で問題自体が縮小するため分離）

## 承認

- [x] User approved this draft
