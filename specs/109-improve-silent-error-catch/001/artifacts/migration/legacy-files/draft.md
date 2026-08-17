# Draft: 109-improve-silent-error-catch (autoApprove self-Q&A)

## 1. Goal & Scope

- Q: Issue は7箇所と記載だが実際は66箇所ある。全部対応するか？
- A: Issue 記載の箇所に限定する。66箇所全部は別 spec。Issue の箇所は代表的なパターンをカバーしており、ここで方針を確立すれば残りは同じパターンで対応できる。

- Q: `logger.debug` が存在しない。どうするか？
- A: Issue の改善方針は `logger.debug` だが、現状 `createLogger` には `log` と `verbose` しかない。しかし CLAUDE.md のコーディングルールに「過剰な防御コードを書かない」とある。catch の中身を変えるだけの修正に `debug` メソッド追加は過剰。代わりに既存の `verbose` を使うか、ENOENT チェックだけ入れて非 ENOENT は rethrow する。

- Q: rethrow vs verbose logging？
- A: 対象箇所の多くは「ファイルがなければデフォルトで続行」のパターン。ENOENT 以外のエラー（パーミッション、JSON 破損）を rethrow するとプロセスが停止する可能性がある。Issue の趣旨は「デバッグ困難」の解消なので、rethrow ではなく ENOENT 以外を stderr に出力する方が適切。ただし logger が import されていないファイルでは `process.stderr.write` か `console.error` を使う。

- A(修正): CLAUDE.md に「エラーの黙殺禁止 — エラーはログ出力またはリスローすること」とある。Issue の方針に従い、ENOENT は無視、それ以外は `console.error` で出力する。logger を新たに import する必要はない。

## 2. Impact on existing

- 対象ファイル（Issue 記載）: setup.js, flow/run/impl-confirm.js, lib/agent.js, lib/flow-state.js (2箇所), lib/skills.js (2箇所), docs/commands/changelog.js
- 既存テストへの影響: catch の中身が変わるだけで外部動作は変わらない。ENOENT 時は今まで通り黙って続行。非 ENOENT 時に stderr に出力が増えるが、テストに影響しない

## 3. Constraints

- 外部依存なし（Node.js 組み込みのみ）
- alpha 版ポリシー（後方互換不要）
- 過剰な防御コード禁止

## 4. Edge cases

- ENOENT 以外で頻繁に発生するエラー: EACCES（パーミッション）, EISDIR, JSON SyntaxError
- `fs.unlinkSync` の catch (agent.js:369, flow-state.js:152,225): unlink は ENOENT が最も多い。EBUSY 等もあり得る
- `JSON.parse` の catch: SyntaxError が発生。これは黙殺すべきではない

## 5. Test strategy

- specs/<spec>/tests/ にテストを配置（この spec 固有の検証）
- ENOENT 時に例外が throw されないことを確認
- 非 ENOENT 時に stderr に出力されることを確認（可能なら）

- [x] User approved this draft (autoApprove)
