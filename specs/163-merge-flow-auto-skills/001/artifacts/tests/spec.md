# Test Design

### Test Design

---

#### Priority 1 — Core（スキル統合）: `/sdd-forge.flow-auto` 引数ルーティング

- **TC-1: 引数 `on` で flow-auto-on フローが実行される**
  - Type: acceptance
  - Input: `/sdd-forge.flow-auto on` を実行
  - Expected: フロー確認 → autoApprove 有効化 → フロー継続 の手順が実行される（旧 `flow-auto-on` と同一シーケンス）

- **TC-2: 引数なしで `on` と同等の処理が実行される**
  - Type: acceptance
  - Input: `/sdd-forge.flow-auto`（引数なし）を実行
  - Expected: TC-1 と同一のフローが実行される。引数 `on` と動作に差異がない

- **TC-3: 引数 `off` で flow-auto-off フローが実行される**
  - Type: acceptance
  - Input: `/sdd-forge.flow-auto off` を実行
  - Expected: autoApprove 無効化 → 確認表示 の手順が実行される（旧 `flow-auto-off` と同一シーケンス）

- **TC-4: 無効な引数でエラーメッセージを表示して STOP する**
  - Type: acceptance
  - Input: `/sdd-forge.flow-auto foo`
  - Expected: エラーメッセージ（例: "Invalid argument: foo. Use on or off."）が表示され、フロー処理は一切実行されずに終了する

- **TC-5: 引数の大文字・小文字混在は拒否される**
  - Type: unit
  - Input: 引数 `ON`, `Off`, `OFF` などの大小混在文字列
  - Expected: 無効引数として扱われ、TC-4 と同様にエラーで STOP する（仕様で `on`/`off` の完全一致のみ有効と解釈）

- **TC-6: 空文字列引数は引数なしと区別される**
  - Type: unit
  - Input: 引数として空文字列 `""` が渡される
  - Expected: 無効引数として扱われるか、または引数なし扱いとして `on` フローが実行される。仕様を満たす一方の動作に統一されていること

- **TC-7: `on` フロー実行中に既に autoApprove が有効な場合の挙動**
  - Type: integration
  - Input: autoApprove がすでに `true` の状態で `/sdd-forge.flow-auto on`
  - Expected: エラーにならず、現状を確認して継続（冪等）または適切なメッセージを表示して終了する

- **TC-8: `off` フロー実行中に既に autoApprove が無効な場合の挙動**
  - Type: integration
  - Input: autoApprove がすでに `false` の状態で `/sdd-forge.flow-auto off`
  - Expected: エラーにならず、冪等に処理されるか適切なメッセージを表示して終了する

---

#### Priority 1 — 旧スキルとの後方互換／移行

- **TC-9: 旧 `sdd-forge.flow-auto-on` スキルが upgrade 後に削除される**
  - Type: integration
  - Input: `sdd-forge upgrade` を実行（テンプレートに `flow-auto-on` が存在しない状態）
  - Expected: `.claude/skills/sdd-forge.flow-auto-on/` および `.agents/skills/sdd-forge.flow-auto-on/` が削除される（TC-11 と連動）

- **TC-10: 旧 `sdd-forge.flow-auto-off` スキルが upgrade 後に削除される**
  - Type: integration
  - Input: `sdd-forge upgrade` を実行（テンプレートに `flow-auto-off` が存在しない状態）
  - Expected: `.claude/skills/sdd-forge.flow-auto-off/` および `.agents/skills/sdd-forge.flow-auto-off/` が削除される

---

#### Priority 2 — Core（upgrade クリーンアップ）

- **TC-11: 配置元テンプレートに存在しないスキルが削除される**
  - Type: integration
  - Input: `.claude/skills/sdd-forge.obsolete/` が存在するが `src/templates/` に対応エントリがない状態で `sdd-forge upgrade` を実行
  - Expected: `sdd-forge.obsolete` ディレクトリが `.claude/skills/` と `.agents/skills/` 両方から削除される

- **TC-12: `.agents/skills/` 側も同様に削除対象となる**
  - Type: integration
  - Input: `.agents/skills/sdd-forge.obsolete/` が存在し、テンプレートに対応なし
  - Expected: `.agents/skills/sdd-forge.obsolete/` も削除される（TC-11 と対称）

- **TC-13: `sdd-forge.*` プレフィックスを持たないスキルは削除されない**
  - Type: unit
  - Input: `.claude/skills/my-custom-skill/` が存在する状態で `sdd-forge upgrade` を実行
  - Expected: `my-custom-skill` は削除対象に含まれず、そのまま保持される

- **TC-14: experimental スキルは削除されない**
  - Type: integration
  - Input: `.claude/skills/sdd-forge.exp.workflow/` が存在し、`src/templates/experimental/` 配下に対応エントリがある
  - Expected: `sdd-forge.exp.workflow` は削除されない

- **TC-15: experimental スキルがテンプレートに存在しない場合も削除されない**
  - Type: unit
  - Input: `.claude/skills/sdd-forge.exp.legacy/` が存在し、テンプレートの `experimental/` 配下に対応なし
  - Expected: `experimental/` 由来スキルは削除対象から除外されるため保持される（要件 6 の明示的保護）

- **TC-16: 削除されたスキル名がログに表示される**
  - Type: integration
  - Input: 削除対象スキルが複数ある状態で `sdd-forge upgrade` を実行
  - Expected: 標準出力に削除されたスキル名（例: `Removed: sdd-forge.obsolete`）が列挙される

- **TC-17: 削除スキルがない場合はログに削除メッセージが表示されない**
  - Type: integration
  - Input: 全スキルがテンプレートに対応している状態で `sdd-forge upgrade` を実行
  - Expected: 削除関連のログ行は出力されない（または "0 skills removed" のような中立メッセージ）

- **TC-18: 削除対象スキルのディレクトリが空でない場合も削除される**
  - Type: unit
  - Input: `.claude/skills/sdd-forge.obsolete/` 配下にファイルが存在する
  - Expected: ディレクトリごと再帰的に削除される

- **TC-19: `.claude/skills/` が存在しない場合にエラーが発生しない**
  - Type: unit
  - Input: `.claude/skills/` ディレクトリ自体が存在しない状態で `sdd-forge upgrade`
  - Expected: エラーなく処理が完了する（スキップまたは graceful handling）

- **TC-20: 一方のスキルディレクトリのみ存在する場合に片方だけ削除される**
  - Type: unit
  - Input: `.claude/skills/sdd-forge.obsolete/` は存在するが `.agents/skills/sdd-forge.obsolete/` は存在しない
  - Expected: 存在する `.claude/` 側のみ削除され、エラーは発生しない

---

#### Priority 3 — Enhancement（参照更新）

- **TC-21: `core-principle.md` の参照が `/sdd-forge.flow-auto` に更新されている**
  - Type: unit
  - Input: `src/templates/partials/core-principle.md` のファイル内容を確認
  - Expected: `/sdd-forge.flow-auto-on` の文字列が存在せず、`/sdd-forge.flow-auto` に置き換えられている

- **TC-22: `core-principle.md` の他の記述が破壊されていない**
  - Type: unit
  - Input: `src/templates/partials/core-principle.md` の全文
  - Expected: 参照置換箇所以外のテキスト・構造が変更前と同一である

- **TC-23: `sdd-forge upgrade` 後に配置されたスキルファイルに旧参照が残らない**
  - Type: integration
  - Input: `sdd-forge upgrade` を実行し、生成された `.claude/` 配下のファイルを検索
  - Expected: `/sdd-forge.flow-auto-on` の文字列が配置済みファイルに含まれない

---

#### クロスカット／回帰

- **TC-24: `sdd-forge upgrade` の既存スキル配置処理が壊れていない**
  - Type: integration
  - Input: テンプレートに存在する全スキルに対して `sdd-forge upgrade` を実行
  - Expected: 既存スキルが正常に配置・更新され、削除クリーンアップは削除対象のみに限定される

- **TC-25: `flow-auto on` と旧 `flow-auto-on` の実行シーケンスが等価である**
  - Type: acceptance
  - Input: 同一の初期状態から `flow-auto on` と旧 `flow-auto-on`（もしあれば）を比較実行
  - Expected: autoApprove の最終状態、表示メッセージ、フロー継続の結果が一致する
