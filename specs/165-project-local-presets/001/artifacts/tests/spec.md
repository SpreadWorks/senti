# Test Design

### Test Design

---

#### 1. プリセット解決の優先順位（Requirement 1）

- **TC-1: ローカルプリセットが組み込みより優先される**
  - Type: unit
  - Input: `.sdd-forge/presets/hono/preset.json` と `src/presets/hono/preset.json` が両方存在する
  - Expected: `.sdd-forge/presets/hono/preset.json` が返され、`src/presets/hono/preset.json` は参照されない

- **TC-2: ローカルが存在しない場合は組み込みにフォールバック**
  - Type: unit
  - Input: `.sdd-forge/presets/hono/` が存在せず、`src/presets/hono/preset.json` が存在する
  - Expected: `src/presets/hono/preset.json` が返される

- **TC-3: 両方とも存在しない場合はエラー**
  - Type: unit
  - Input: `config.type = "nonexistent"`、どちらのパスにも `nonexistent/` が存在しない
  - Expected: プリセット未発見を示す明確なエラーがスローされる（未定義参照にはならない）

---

#### 2. ローカル `preset.json` の使用（Requirement 2）

- **TC-4: ローカル `preset.json` の `parent` が採用される**
  - Type: unit
  - Input: `.sdd-forge/presets/mypreset/preset.json` に `"parent": "hono"` が定義されている
  - Expected: 解決された定義に `parent: "hono"` が含まれ、`src/presets/mypreset/` の `parent` は参照されない

- **TC-5: ローカル `preset.json` の `scan` が採用される**
  - Type: unit
  - Input: `.sdd-forge/presets/mypreset/preset.json` に独自の `scan` ルールが定義されている
  - Expected: その `scan` ルールが使用される

- **TC-6: ローカル `preset.json` の `chapters` が採用される**
  - Type: unit
  - Input: `.sdd-forge/presets/mypreset/preset.json` に独自の `chapters` 配列が定義されている
  - Expected: その `chapters` 配列が使用される

- **TC-7: ローカル `preset.json` に `parent` が含まれない（parent なし）**
  - Type: unit
  - Input: `.sdd-forge/presets/mypreset/preset.json` が `{ "chapters": [...] }` のみ（`parent` なし）
  - Expected: parent チェーンなしで bare プリセットとして機能する

---

#### 3. `preset.json` 省略時の挙動（Requirement 3）

- **TC-8: ローカルディレクトリのみ・同名組み込みあり → 組み込み設定を継承**
  - Type: unit
  - Input: `.sdd-forge/presets/hono/` が存在するが `preset.json` がなく、`src/presets/hono/preset.json` が存在する
  - Expected: `src/presets/hono/preset.json` の `parent`, `scan`, `chapters` が使われる

- **TC-9: ローカルディレクトリのみ・同名組み込みあり → `data/` のみ上書き**
  - Type: integration
  - Input: 上記 TC-8 の状態で `.sdd-forge/presets/hono/data/` に DataSource を追加
  - Expected: 組み込みの設定を継承しつつ、`data/` は `.sdd-forge/presets/hono/data/` が使われる（組み込みの `data/` は上書きされる）

- **TC-10: ローカルディレクトリのみ・同名組み込みなし → bare プリセット**
  - Type: unit
  - Input: `.sdd-forge/presets/custom-brand/` が存在するが `preset.json` なし、`src/presets/custom-brand/` も存在しない
  - Expected: parent なし・空の scan/chapters で bare プリセットとして機能する（エラーにならない）

- **TC-11: ローカルディレクトリのみ・同名組み込みなし・`data/` あり → bare で data のみ有効**
  - Type: integration
  - Input: `.sdd-forge/presets/custom-brand/data/` に DataSource が存在する（`preset.json` なし）
  - Expected: bare プリセットとして機能し、DataSource は正常にロードされる

---

#### 4. DataSource ロード（Requirement 4）

- **TC-12: scan フェーズで `.sdd-forge/presets/<name>/data/` がロードされる**
  - Type: integration
  - Input: `.sdd-forge/presets/hono/data/mySource.js` が存在し、`sdd-forge docs scan` を実行
  - Expected: `mySource.js` が scan フェーズで実行され、解析結果に反映される

- **TC-13: data 解決フェーズで `.sdd-forge/presets/<name>/data/` がロードされる**
  - Type: integration
  - Input: 同上の状態で `sdd-forge docs data` を実行
  - Expected: `mySource.js` が data 解決フェーズでも実行され、出力に反映される

- **TC-14: 複数の DataSource ファイルが全てロードされる**
  - Type: integration
  - Input: `.sdd-forge/presets/hono/data/` に `source1.js`, `source2.js` が存在する
  - Expected: 両ファイルが両フェーズでロードされる

- **TC-15: `data/` が空ディレクトリの場合はスキップ（エラーなし）**
  - Type: unit
  - Input: `.sdd-forge/presets/hono/data/` が空
  - Expected: エラーなし、DataSource なしとして処理される

---

#### 5. `.sdd-forge/data/` の廃止（Requirement 5）

- **TC-16: `.sdd-forge/data/` が存在してもロードされない**
  - Type: integration
  - Input: `.sdd-forge/data/legacySource.js` が存在し、`sdd-forge docs scan` を実行
  - Expected: `legacySource.js` は一切ロードされず、解析結果に影響しない

- **TC-17: `.sdd-forge/data/` のみ存在・`.sdd-forge/presets/<name>/data/` なし → DataSource ゼロ**
  - Type: integration
  - Input: `.sdd-forge/data/` に DataSource、`.sdd-forge/presets/<name>/data/` が存在しない
  - Expected: DataSource ゼロとして動作する（旧動作との差異が明確）

---

#### 6. 廃止警告（Requirement 6 — 推奨）

- **TC-18: `.sdd-forge/data/` 存在時に deprecation 警告が stderr に出力される**
  - Type: integration
  - Input: `.sdd-forge/data/` が存在する状態でいずれかのコマンドを実行
  - Expected: stderr に deprecation メッセージが出力される。stdout には出力されない

- **TC-19: 警告メッセージに移行先パスが含まれる**
  - Type: integration
  - Input: `config.type = "hono"` で `.sdd-forge/data/` が存在する
  - Expected: stderr の警告に `.sdd-forge/presets/hono/data/` への移行案内が含まれる

- **TC-20: `.sdd-forge/data/` が存在しない場合は警告なし**
  - Type: unit
  - Input: `.sdd-forge/data/` が存在しない
  - Expected: stderr に deprecation 警告は出力されない

- **TC-21: 警告は 1 コマンドにつき 1 回のみ（重複しない）**
  - Type: integration
  - Input: 複数のフェーズをまたぐコマンド（例: `docs build`）で `.sdd-forge/data/` が存在する
  - Expected: 同一実行内で警告は 1 回だけ出力される

---

#### 7. parent チェーン解決との統合（複合シナリオ）

- **TC-22: ローカル `preset.json` が `parent` を持ち、その parent は組み込みで解決される**
  - Type: integration
  - Input: `.sdd-forge/presets/mypreset/preset.json` に `"parent": "hono"` があり、`src/presets/hono/preset.json` が存在する
  - Expected: parent チェーンが正しく解決され、hono の設定が継承される

- **TC-23: parent チェーンで参照される親がローカルにも存在する場合、親もローカル優先**
  - Type: integration
  - Input: `parent: "hono"` を持つローカルプリセット、かつ `.sdd-forge/presets/hono/` も存在する
  - Expected: 親の解決も `.sdd-forge/presets/hono/` が優先される

---

#### 8. 境界条件・エッジケース

- **TC-24: `.sdd-forge/presets/` ディレクトリ自体が存在しない**
  - Type: unit
  - Input: `.sdd-forge/presets/` が存在しない
  - Expected: エラーなし、組み込みプリセットのみで動作する

- **TC-25: `preset.json` が存在するが空ファイル**
  - Type: unit
  - Input: `.sdd-forge/presets/hono/preset.json` が 0 バイト
  - Expected: JSON パースエラーとして明確なメッセージを返す（スタックトレースの生出力は不可）

- **TC-26: `preset.json` が不正な JSON**
  - Type: unit
  - Input: `.sdd-forge/presets/hono/preset.json` が `{ invalid json }`
  - Expected: ファイルパスを含む明確なパースエラーメッセージを返す

- **TC-27: `data/` 内のファイルが DataSource として不正**
  - Type: unit
  - Input: `.sdd-forge/presets/hono/data/bad.js` が DataSource インターフェースを満たさない
  - Expected: どのファイルがエラーかを明示したエラーを返す

- **TC-28: プリセット名に記号・大文字が含まれる（パス安全性）**
  - Type: unit
  - Input: `config.type = "My-Preset_v2"`
  - Expected: パスとして安全に処理される、もしくは明確な検証エラーが返る（パストラバーサル等は発生しない）

---

#### テスト種別サマリー

| 種別 | 件数 | 割合 |
|------|------|------|
| unit | 16 | 57% |
| integration | 12 | 43% |
| acceptance | 0 | — |

> **Note**: acceptance テストは UI/CLI の End-to-End シナリオ（実プロジェクトディレクトリを用いた `sdd-forge docs build` 全体実行など）として別途追加を推奨する。特に TC-22〜TC-23 の parent チェーン統合シナリオは acceptance で補強すると価値が高い。
