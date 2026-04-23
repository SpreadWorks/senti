# Draft: 219-sync-spec-requirements

**開発種別:** bugfix
**目的:** retro ステップが finalize 時に「no requirements found」で失敗する問題を根本解決するため、requirements の source of truth を一本化する。

**Mode:** Decision — 設計方針は確定済み。Q&A は決定根拠の記録。

## Scope Verification
- In scope:
  - retro を含む finalize 下流ステップが、参照する requirements ソースが 1 つに統一されていること
  - 進捗状態（status: pending / in_progress / done / skipped）の永続先も同じソースに集約されていること
  - 従来の重複保持を廃止すること
- Out of scope:
  - requirements のデータ構造変更（既存スキーマを踏襲）
  - retro の評価アルゴリズム、出力フォーマットの変更
  - flow 状態ファイルの他フィールドの再設計

## Impact on Existing Features
- 影響ありの既存機能:
  - **retro**: requirements 参照先が変わり、現行の FAIL バグが解消される
  - **impl-confirm**: requirements 集計のソースが変わる（進捗値は引き継がれ、挙動は等価）
  - **flow get status**: requirements 集計のソースが変わる（出力 JSON 形状は不変）
  - **approval ステップ**: 「requirements を追加で転記」する手動手順が不要になる
  - **requirements 一括設定 CLI**: 廃止される
  - **requirements 単件ステータス更新 CLI**: 書き込み先が変わる（呼び出しインターフェース自体は不変）
- 影響なし:
  - 仕様書生成系（prepare-spec / spec / gate）
  - review / merge / finalize のその他ステップ
  - baseline / test 系の実行と集計

## Requirements (priority order)

- **R1 [must]**: When finalize が retro ステップを実行するとき, retro shall 仕様書側の requirements 定義を唯一のソースとして参照する。
- **R2 [must]**: If 仕様書に requirements が 1 件以上定義され、かつ base branch と HEAD の間に diff が存在する, then retro shall 「no requirements found」エラーを発生させず、retro 評価結果を生成する。
- **R3 [must]**: When 実装中に requirements のステータス更新が発生するとき, 更新は R1 で定めた単一ソース上で永続化され、スキーマバリデーションを通過する。
- **R4 [must]**: When フロー状態取得コマンドが呼ばれるとき, 返却される requirements 集計は R1 で定めた単一ソースから算出された値である。
- **R5 [should]**: When 仕様承認ステップが完了するとき, requirements を別ファイルに再転記するための追加手順を手動実行する必要がない。
- **R6 [should]**: If 既存 spec の requirements に status 値が未設定である, 読み取り側 shall 欠損値を `pending` として扱い、例外を投げない。
- **R7 [nice-to-have]**: When 廃止された CLI サブコマンドが呼ばれたとき, CLI shall 廃止を示す明示的なエラーメッセージで応答する（サイレントフォールバックはしない）。

## Migration Plan (廃止される CLI サブコマンド)

- **対象**: requirements 一括設定 CLI (R7 に該当するサブコマンド)
- **代替手段**: spec 承認ステップで requirements が単一ソース上に確定しているため、追加の転記コマンドは不要。呼び出していた箇所は削除すれば十分。
- **告知方針**: alpha 期間中のため非互換変更として扱う。CHANGELOG / コミットメッセージで廃止を明示する。
- **検知**: R7 によって廃止 CLI を呼ぶと明示的なエラーが返るため、既存スクリプトが残っていても silent failure にはならない。
- **期限**: 本 spec のリリースと同時に廃止。以降の sdd-forge バージョンでは受け付けない。

## Q&A

- Q: 単一ソースとして採用すべきは仕様書側と状態ファイル側のどちらか？
  - A: 仕様書側。理由: (1) 既にスキーマ化・バリデーション済みで status フィールドも定義済み (2) 既に retro が仕様書を直接読んでおり、状態ファイル側が重複 (3) 仕様書は仕様フローで構造的に生成されるため「書き忘れ」が発生しない。

- Q: 状態ファイル側を残し、承認ステップでミラーする案は？
  - A: 不採用。alpha 方針「後方互換コードは書かない／旧フォーマットは保持せず削除」に反する。ミラーは sync 漏れバグ再発の余地を残すため、構造的な単一化を優先する。

- Q: 関連 CLI サブコマンドの後方互換は？
  - A: 一括設定 CLI は廃止、単件ステータス更新 CLI は書き込み先のみ変更（インターフェース同じ）。alpha のため廃止通知期間は設けない。R7 で廃止エラーを出すことで検知可能にする。

- Q: 既存の仕様書に status が未設定の場合は？
  - A: R6 で `pending` デフォルト扱いを定義済み。スキーマ enum に含まれるため追加読み書きとも合法。

- Q: 受け入れ基準をどう定義するか？
  - A: R1〜R4 を MUST の受け入れ基準とする。R5〜R7 は SHOULD / NICE の位置づけ。

## Open Questions
- なし

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-23
- Notes: Auto mode — Issue #233 本文と関連ソース解析を根拠に、単一ソース化の設計判断を確定済み。
