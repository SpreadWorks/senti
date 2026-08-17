# Draft: 100-remove-external-cmd-deps

## Q&A

### Q1: 方針
- Q: 細切れに小さなコマンドを増やすか、まとめて渡すか？
- A: まとめて渡す。設問結果を引数で渡して一括実行。AI の判断回数を減らす。

### Q2: 既存コマンドへの統合
- Q: 新規コマンドを最小限にできないか？
- A: resolve-context を拡張（dirty/branch/ahead/gh/lastCommit）、prepare-spec に dirty check 追加。finalize は新規で commit→merge→cleanup→sync を一括。

### Q3: flow run merge の --commit
- Q: merge に commit を統合するか？
- A: しない。merge は merge のみ維持。commit の統合は finalize に任せる。

### Q4: resolve-context の副作用
- Q: resolve-context に状態変更を入れてよいか？
- A: 入れない。get は読み取り専用。状態変更は run に。

### Q5: merge/cleanup の扱い
- Q: 個別の merge/cleanup は残すか？
- A: 削除して finalize に統合。呼び元が finalize skill のみなので不要。

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-29
