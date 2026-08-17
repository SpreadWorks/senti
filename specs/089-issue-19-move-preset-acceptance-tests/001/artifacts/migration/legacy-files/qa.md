# Clarification Q&A

- Q: 仕様書の作成方法は？
  - A: Q&A で要件を整理してから仕様書を作成する。
- Q: 作業環境は？
  - A: `development` から Git worktree を作成して進める。
- Q: docs が source より古い状態だが、`sdd-forge build` を実行するか？
  - A: 実行せずこのまま進める。
- Q: 今回の spec のスコープはどこまで含めるか？
  - A: テスト移設に必要な周辺変更は一式含める。
- Q: 公開物と運用ルールの更新を必須成果物に含めるか？
  - A: 含める。`.npmignore` 等の publish 対応と `src/AGENTS.md` 更新もスコープに含める。
- Q: 移設対象の preset 範囲は？
  - A: 現在 `tests/acceptance/` にある acceptance テスト一式を対象にする。
- Q: fixture の配置方針は？
  - A: fixture は原則 preset 配下へ移し、共有せず各 preset 内で閉じる。
- Q: 移設後の acceptance テストファイル名は？
  - A: 対応する preset ディレクトリ配下へ移し、ファイル名は `<preset>.test.js` ではなく `test.js` に統一する。
- Q: acceptance テストの実行入口はどうするか？
  - A: `tests/acceptance/run.js` は残し、探索先だけ preset 配下へ変更する。

## Confirmation
- Before implementation, ask the user:
  - "この仕様で実装して問題ないですか？"
- If approved, update `spec.md` -> `## User Confirmation` with checked state.
