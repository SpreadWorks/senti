# Draft: finalize 内サブコマンドの registry フック対応

## Goal

finalize の各ステップ（commit+retro+report, merge, sync, cleanup）を registry 経由で実行し、onError フックで失敗時に issue-log を自動記録する。

## 決定事項

### 1. finalize のベタ書きを廃止

現状 finalize 内で retro, merge, sync, cleanup がベタ書きされている。これらを registry のエントリとして定義し、finalize はその registry 定義を参照して実行する。

### 2. registry のフック構成

- commit の post フックに retro と report を定義（#68 の設計通り）
- 各ステップに onError フックを定義し、失敗時に issue-log に記録する
- merge, sync, cleanup も registry エントリとして定義

### 3. onError で issue-log 記録

全サブコマンドの onError フックで共通の issue-log 記録を行う。ステップ名とエラーメッセージを記録。

### 4. テスト

- spec 検証テスト: registry に onError 定義があること、finalize がベタ書きでないことを静的検証
- テストフローを作成し、あえてエラーを発生させて issue-log に記録されることを実際に確認

## 既存機能への影響

- CLI 経由の動作は変わらない
- finalize の出力フォーマットは維持
- alpha 版ポリシーにより後方互換は不要

- [x] User approved this draft
