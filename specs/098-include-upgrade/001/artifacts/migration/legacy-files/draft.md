# Draft: 098-include-upgrade

## Q&A

### Q1: include 関数の配置
- Q: どこに実装するか？
- A: `src/lib/include.js` に `resolveIncludes(content, opts)` として実装。

### Q2: 共有パーツの配置
- Q: どこに置くか？
- A: `src/templates/partials/` に配置。include 参照は `@templates/partials/xxx.md`。

### Q3: 展開タイミング
- Q: いつ展開するか？
- A: `deploySkills()` 内。読み込み後に展開し、展開済み完成品をデプロイ。

### Q4: エラー処理
- Q: エラー時の振る舞いは？
- A: `resolveIncludes()` は throw のみ。process.exit は親側（upgrade.js）で制御。

### Q5: 切り出し範囲
- Q: 仕組みだけか、実際の切り出しもか？
- A: 両方やる。5つの共有パーツを切り出し、plan/impl/finalize を include 使用に書き換え。

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-29
