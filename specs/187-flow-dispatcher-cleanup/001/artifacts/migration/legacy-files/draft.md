# Draft: flow ディスパッチャ整理 (Phase3)

**開発種別:** リファクタリング (refactoring)

**目的:** Container + FlowManager 基盤上で flow レイヤーの dispatcher / registry / hook 周りを整理し、責務分離・エラー処理・OOP 方針との整合性を改善する。

## 背景

`.tmp/1877.md` の指摘 12, 13, 14, 23, 24, 25, 26, 27, 31 を対象とする Phase3。Container 基盤 (Phase1) と FlowManager (Phase2B) が既に投入済みで、その上で flow 層を最終整理する。

## 探索の事前実施

ユーザーへの質問前に flow dispatcher・registry・base-command・envelope・関連ガイドライン（OOP 方針、alpha 版ポリシー）を確認済み。質問は意図確認・スコープ範囲・post hook 設計判断・テスト戦略の 4 件に最小化した。

## 要件 (Requirements)

要件は When/If + shall 形式で記述する。実装詳細（具体的な API 形状、関数名、配置先パス）は spec.md にて確定する。

### R1: FlowCommand の Container 接続 (指摘31)

- **When** 任意の FlowCommand サブクラスがコマンドとして実行される場合、
- **shall** 基底クラスは依存コンテナを経由して flowManager / config 等の依存にアクセスできる構造を提供する。
- **shall** dispatcher はサブクラス側に共通依存を再構築させない。

### R2: registry hook から domain logic 分離 (指摘14, 26)

- **When** flow run gate の post / onError hook が起動する場合、
- **shall** issue-log の I/O は registry hook 内に直書きされず、専用の責務単位に集約される。
- **shall** hook は flow 状態の内部構造に直接アクセスしない。

### R3: 非定型エラーの再 throw (指摘12, 25)

- **When** ステップ状態更新または issue-log 書き込み中にエラーが発生した場合、
- **shall** 「想定内エラー」（flow.json 不在に相当する欠落エラー）のみ警告ログに記録して継続する。
- **shall** 上記以外のエラーは呼び出し元へ再 throw され、サイレント失敗を起こさない。

### R4: post hook 実行タイミング (指摘24)

- **When** dispatcher がコマンド実行を完了した場合、
- **shall** post hook は envelope の標準出力前に同期実行され、post hook の失敗は envelope 上で呼び出し側に観測可能となる。
- **shall** post hook 失敗時もコマンド本体の成否は変えない。

### R5: Envelope の OOP 化 (指摘23)

- **When** flow コマンドが結果を返す場合、
- **shall** envelope は OOP 方針に従う型として表現され、成功 / 失敗 / 警告 と stdout 出力 + 終了コード設定を型自身の責務として保持する。
- **shall** alpha 版ポリシーに従い旧 API（関数 export）は残さない。

### R6: 未使用 finally スロット削除 (指摘27)

- **When** registry エントリが定義される場合、
- **shall** 使用されていない hook フィールドは予約せず、対応する dispatcher 側の分岐も削除される。

## 既存機能への影響

- 全 FlowCommand サブクラス: R1 によりシグネチャ変更を伴う追従修正が必要。
- flow dispatcher: R1 / R4 / R6 により実行ライフサイクルが変わる。
- envelope を import している全モジュール（flow / experimental/workflow を含む）: R5 により API 形態が変わるため追従が必要。
- registry: R2 / R3 により hook 内ロジックを縮小する。
- 既存テスト: 振る舞い不変なので緑のまま維持。R5 については新規 unit test を追加。

## 制約・原則

- **alpha 版ポリシー** (`CLAUDE.md`): 後方互換コード禁止。旧 API は残さない。
- **OOP 方針** (`src/CLAUDE.md`): 意味のある値はクラスとし、振る舞いを型自身に所属させる。
- **過剰な防御コード禁止**: 想定内エラー以外の握りつぶしを行わない。
- **外部依存禁止**: Node.js 組み込みモジュールのみ使用。

## 優先度

1. R5 (Envelope OOP 化) — 他項目の前提
2. R4 (post hook 実行タイミング) — Envelope を前提に dispatcher 整理
3. R1 (FlowCommand Container 接続) — 基底クラス変更 + 全サブクラス追従
4. R2 (hook から domain logic 分離)
5. R3 (非定型エラーの再 throw)
6. R6 (未使用 finally 削除)

## Q&A

### Q1: 意図確認

- 推奨: [1] 6項目を Phase3 として実施。
- 根拠: `.tmp/1877.md` の指摘グルーピングに従い、Container + FlowManager 基盤上の最終整理として一貫している。
- ユーザー回答: [1] はい

### Q2: スコープ範囲

- 推奨: [1] 1つの spec で実施。
- 根拠: 親タスク 1877 で Phase3 として明示的にグルーピング、結合度高、alpha なので一括変更しやすい。
- ユーザー回答: [1] 1つの spec で実施

### Q3: post hook 実行タイミング (R4)

- 推奨: [1] post hook を出力前に同期実行 + 失敗を envelope 警告として含める。
- 根拠: 呼び出し側は envelope 出力のみで成否判定するため、stderr 副情報は誤判定を招く。R5 と整合し、警告経路で観測可能性を確保。
- ユーザー回答: [1] post hook を出力前に実行 + 失敗を warn として含める

### Q4: テスト戦略

- 推奨: [1] 既存テスト緑維持 + Envelope 型の unit test 追加。
- 根拠: 既存 e2e/unit が dispatcher / hook / gate を回帰カバー済み。Envelope は新規 OOP 型なので invariant テスト必要。
- ユーザー回答: [1] 既存テスト緑維持 + Envelope unit test 追加

## Open Questions

- なし

## User Confirmation

- [x] User approved this draft (2026-04-17)
