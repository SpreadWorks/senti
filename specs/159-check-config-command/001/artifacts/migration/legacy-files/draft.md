# Draft: sdd-forge check config

**開発種別:** 機能追加（新サブコマンド）
**目的:** `config.json` の妥当性を診断する `sdd-forge check config` コマンドを実装し、セットアップミスを早期発見できるようにする。

## Q&A

### 1. Goal & Scope

**Q: ゴールとスコープは明確か？**

A: 明確。`sdd-forge check config` を `check` グループの新サブコマンドとして追加する。
検証対象は `.sdd-forge/config.json` のみ。次の3種類のチェックを行う：

1. **スキーマ検証** — 既存の `validateConfig()` を呼び出してエラーを収集
2. **preset 存在確認** — `type` フィールドに指定されたプリセットが `src/presets/` 内に存在するか
3. **JSON パース** — ファイルの存在・JSON パースエラーを最初に確認

スコープ外: `analysis.json` の検証、`flow.json` の検証（別コマンドで対応すべき）。

---

### 2. Impact on Existing Code

**Q: 既存コードへの影響は？**

A: 最小限。

- `src/check.js` の `SCRIPTS` マップに `config: "check/commands/config.js"` を追加する（1行）
- 新規ファイル `src/check/commands/config.js` を作成
- `validateConfig()` は既存のまま変更なし（再利用）
- `PRESETS` / `resolveChain()` は既存のまま変更なし（再利用）

---

### 3. Constraints

**Q: 非機能要件・制約は？**

A:
- 外部依存なし（Node.js 組み込みのみ）
- `scan.js` のパターンに倣う（`parseArgs`, `runIfDirect`, `EXIT_ERROR`）
- `--format text|json` をサポート（md は不要：診断コマンドなので）
- config が存在しない場合もクラッシュせず、エラーとして報告する

---

### 4. Edge Cases

**Q: エッジケースは？**

A:
| ケース | 動作 |
|--------|------|
| `config.json` が存在しない | エラー報告して exit 1 |
| JSON パース失敗 | エラー報告して exit 1 |
| スキーマエラーあり | 全エラーを列挙して exit 1 |
| `type` のプリセットが存在しない | スキーマ PASS でも追加エラーとして報告 |
| `type` が配列で一部のみ存在しない | 存在しないものだけをエラーとして報告 |
| 全チェック PASS | "config is valid" を表示して exit 0 |

---

### 5. Test Strategy

**Q: テスト戦略は？**

A: `specs/159-check-config-command/tests/` に検証テストを配置する。

テストするシナリオ：
- 正常な config.json → exit 0
- 存在しない config.json → exit 1、エラーメッセージ含む
- 無効な JSON → exit 1
- 必須フィールド欠損 → exit 1、欠損フィールド名が出力に含まれる
- `type` が存在しないプリセット名 → exit 1
- `--format json` でのJSON出力構造確認

---

### 6. Alternatives Considered

**Q: 他のアプローチは？**

A:
- **`validateConfig()` をプリセット確認まで含むよう拡張する** → 却下。`types.js` は純粋なバリデーションライブラリでありプリセット探索ロジックを持つべきでない。関心の分離を維持する。
- **`sdd-forge setup` の一部として検証** → 却下。`check` グループに独立したコマンドとして持つほうが、CI での使用など汎用性が高い。

---

### 7. Future Extensibility

**Q: 将来の拡張への影響は？**

A: `check` グループのパターンを確立する。将来 `sdd-forge check flow` や `sdd-forge check agents` を追加する際も同じ構造で拡張できる。

---

- [x] User approved this draft (autoApprove)
