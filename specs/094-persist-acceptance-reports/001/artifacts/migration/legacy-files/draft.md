# Draft: 094-persist-acceptance-reports

## Q&A

### Q1: レポートの永続化先
- Q: レポートをどこに永続化するか？
- A: プロジェクトルートの `.sdd-forge/output/`。一時ディレクトリは削除されるため、プロジェクトルートに集約する。

### Q2: 書き出し方針
- Q: 一時ディレクトリとプロジェクトルートの両方に書くか？
- A: 両方に書く。一時ディレクトリには従来通り `acceptance-report.json`、プロジェクトルートには `acceptance-report-{preset}.json`。

### Q3: サマリーレポート
- Q: 全プリセットのサマリーレポートは必要か？
- A: 不要。個別ファイルのみ。必要になれば別 issue で対応。

### Q4: 再実行時の動作
- Q: 同じプリセットのレポートが既に存在する場合は？
- A: 上書きする。履歴管理は git に任せる。

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-28
