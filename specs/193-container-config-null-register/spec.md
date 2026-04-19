# Feature Specification: Container 初期化時の config フォールバックを null に変更

**Feature Branch**: `feature/193-container-config-null-register`
**Created**: 2026-04-19
**Status**: Draft
**Input**: Issue #175

## Goal

Container 初期化時の config 欠落を空オブジェクト `{}` で握りつぶさず、欠落を明示する専用値 (`null`) を register する。config を必要とするコマンドの必須チェックを共通前処理層（コマンドディスパッチの共通 lifecycle）で一元化し、`setup` 未実行状態で config 必須コマンドを実行した場合の silent failure を排除する。

## Why This Approach

- **既存コードパターンとの整合:** Container 初期化は既に内部で config ロード成否 (`configLoaded`) を追跡している。その情報を container 登録値のセマンティクスに反映するだけで、空オブジェクトによる silent failure を根絶できる。
- **集約された前提条件チェック:** CLI には全コマンドが通る共通前処理層（dispatcher の lifecycle）が既に存在し、前提条件チェックの追加先として自然。各コマンドに散らばるチェックを一元化できる。
- **後方互換コードの不要化:** downstream 消費者 (Agent, ProviderRegistry, Logger, paths) は既に欠落値を optional chaining や内部フォールバックで受容しており、追加の防御コードは不要（alpha 版ポリシー「後方互換コードを書かない」に合致）。
- **Issue #175 proposal との合致:** register レベルで欠落を表現し、dispatcher 側で統一チェックを行うという提案をそのまま採用。

## Scope

- Container 初期化時の config フォールバック値を `{}` から `null` へ変更
- config 必須チェックの共通前処理層への一元化
- 各コマンドの config 必須性を宣言するメタデータフラグの追加
- 既存の局所的な `NO_CONFIG` チェックの削除（共通層へ移譲）
- コマンド本体の防御的 config フォールバック（`|| {}` 等）の削除
- 契約レベルの unit / integration テスト追加

## Out of Scope

- config スキーマ validation の強化
- setup 以外のコマンドから config を自動生成する機能
- config 以外の前提条件（active flow 必須等）の統一チェック（将来の同一パターン拡張として想定するが、本 spec では扱わない）
- 他の `container.get(...)` 呼び出しの全面 audit

## Clarifications (Q&A)

draft.md の Q1〜Q10 参照。要点は以下:

- **Q1–Q3:** アプローチ方針（null register + 共通前処理層での統一チェック）を確定。
- **Q4:** config 必須コマンドと不要コマンド (`setup`, `help`, `upgrade`, `presets`) の境界を確定。宣言方式はデフォルト不要・必要なコマンドで明示宣言。
- **Q5:** 後段消費者 (Agent / ProviderRegistry / Logger / paths) は既に欠落値を受容する設計であることをコードインスペクションで確認済み。
- **Q6:** コマンド本体の防御フォールバックは共通チェックの一元化に伴い削除。
- **Q7:** migration plan 確定（CLI 構文不変、エラーメッセージ文言維持、deprecation 期間なし）。
- **Q8:** 契約レベルの formal tests（`tests/` 配下）を採用。

## Alternatives Considered

1. **現状維持（`{}` register）:** 却下。型セマンティクスが緩くバグ発見が遅れる（Issue #175 指摘事項）。
2. **各コマンドで個別にローカルチェックを追加:** 却下。重複が増え「統一」目標に反する。guardrail「シンプルなインターフェースに十分な実装を隠す」にも反する。
3. **欠落の明示 (`null` register) + 共通前処理層での一元チェック（採用）:** Issue #175 proposal、既存コードパターン、guardrail のすべてに合致。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: auto mode による承認。Issue #175 提案に従い進行。

## Requirements

### P1 (MUST)

**R1.** Container 初期化後、config が利用不可能な場合は container に登録される config 値が `null`（空オブジェクトでも未登録でもない）であること。利用可能な場合は読み込んだ config オブジェクトそのものであること。
*トリガ:* `sdd-forge <cmd>` 実行時に config が存在しない、または読み込みに失敗した場合
*期待挙動:* `container.get("config")` は `null` を返す。config が有効な場合は config オブジェクトそのものが返る。呼び出し側は `config === null` または `config == null` で欠落を判定できる

**R2.** config を必須として宣言したコマンドを config 欠落状態で実行したとき、コマンドの業務処理に入る前に停止し、エラーコード `NO_CONFIG` と既存メッセージ `config.json not found. Run sdd-forge setup first.` で非ゼロ exit code により失敗すること。
*トリガ:* config 必須宣言を持つコマンドを config 欠落状態で実行した場合
*期待挙動:* envelope `{ ok: false, errors: [{ code: "NO_CONFIG", messages: ["config.json not found. Run sdd-forge setup first."] }] }` を出力し、非ゼロ exit code で終了する

**R3.** registry エントリは `requiresConfig: true` という共通フラグをサポートし、「config 欠落時に本変更前から明示的に失敗させていた（あるいは本変更で明示失敗に統一したい）コマンド」がその必要性を宣言できること。デフォルト値は「必要とせず素通り」（optional 扱い）。フラグ適用範囲は本変更時点で既存の局所チェック相当のもの（= `flow prepare`）に限定する。config を読むが欠落時に既定値で degrade する設計のコマンド（`docs` 系のスキャン・README・changelog 等）はフラグを付与しないこと。
*トリガ:* 実装時および将来のコマンド追加時
*期待挙動:* registry でフラグが宣言されているコマンドは 1 つ（`flow prepare`）であり、そのエントリだけが config 欠落時に `NO_CONFIG` で停止する。他のコマンドは宣言されておらず、欠落時も degrade 動作を維持する

### P2 (SHOULD)

**R4.** `NO_CONFIG` エラーを生成する経路は 1 箇所の共通前処理層に集約され、複数コマンドファイルに重複した局所チェックが存在しないこと。
*トリガ:* リファクタ実施時
*期待挙動:* `NO_CONFIG` を返すコードパスがコードベース全体で 1 箇所のみ

**R5.** コマンド本体のコードから、config 値そのものを別値に置換する防御的フォールバック（例: `container.get("config") || {}`, `cfg = cfg || defaultConfig` 等、欠落時にダミーのプレースホルダーオブジェクトを代入するパターン）を削除すること。config の個別プロパティ参照時の optional chaining (`cfg?.foo?.bar`) は null を許容する正常な読み取りパターンであり削除対象ではない。
*トリガ:* リファクタ実施時
*期待挙動:* コマンド本体に `|| {}` / `|| defaultConfig` 等の「空オブジェクト / 暫定 config オブジェクト」代用パターンが存在しない。個別プロパティ読み取りでの optional chaining はそのまま許容する

### P3 (MUST for correctness)

**R6.** config 不要コマンド (`setup`, `help`, `upgrade`, `presets`) は config 欠落状態でも本変更前と同一の出力・同一の終了コードで動作すること。
*トリガ:* config 欠落状態で config 不要コマンドを実行した場合
*期待挙動:* `NO_CONFIG` を返さず、正常に処理を完了する

**R7.** CLI の外部インターフェース（コマンド名・引数・オプション）は変更しないこと。
*トリガ:* 本 spec の実装
*期待挙動:* 既存のコマンド呼び出し構文がそのまま動作する（失敗タイミングと形式は R2 に従い変化するが、呼び出し側の構文には影響しない）

## Acceptance Criteria

1. config 欠落状態で `container.get("config")` が `null` を返し、有効時は config オブジェクトを返す (R1)
2. config 必須コマンドを config 欠落状態で実行すると、`NO_CONFIG` コード・既存文言・非ゼロ exit code で即座に失敗する (R2)
3. registry に `requiresConfig: true` を宣言したエントリが存在し、grep で一括抽出できる (R3)
4. `NO_CONFIG` を生成するコード経路がコードベース全体で 1 箇所のみである (R4)
5. コマンド本体に `container.get("config") || {}` 相当の「config 全体を別オブジェクトで置換する」防御フォールバックが存在しない (R5)
6. `setup`, `help`, `upgrade`, `presets` が config 欠落状態で本変更前と同一の終了コードで動作する (R6)
7. CLI の外部インターフェース（コマンド名・引数・オプション）が本変更前と完全一致する (R7)
8. 追加したテストと既存テスト (`npm test`) の両方がパスする（regression なし）

## Test Strategy

契約レベルの formal tests として `tests/` 配下に配置する（将来の回帰が常にバグとなる契約のため、`specs/` 配下の一時テストではない）。

### Unit tests

- Container 初期化テスト:
  - config が存在する場合 → `container.get("config")` が config オブジェクトを返す
  - config が欠落（`ERR_MISSING_FILE`）する場合 → `container.get("config")` が `null` を返す
  - config 読み込みで他のエラーが発生した場合 → stderr に警告が出力され、config は `null` で register される

### Integration tests (dispatcher level)

- config 必須コマンド (`flow prepare` など代表 1〜2 件) を config 欠落状態で実行
  - envelope `{ ok: false, errors: [{ code: "NO_CONFIG", ... }] }` を出力
  - 非ゼロ exit code で終了
  - コマンド本体の業務処理が実行されない
- config 不要コマンド (`help`, `presets`) を config 欠落状態で実行
  - 正常終了
  - `NO_CONFIG` を返さない

### Regression

- 既存 `npm test` がパスすることを確認
- 既存の `flow.js:63` 相当の挙動が共通層経由でも維持されることを確認

## Impact on Existing Features

- **変化するもの:** setup 未実行状態で config 必須コマンドを叩いた際の失敗タイミングが「downstream の config 参照時の不定エラーまたは silent failure」から「コマンド業務処理開始前の `NO_CONFIG` 即時失敗」に早まる。エラーメッセージ文言・コードは既存と同一。
- **変化しないもの:**
  - docs 生成パイプライン (`scan → enrich → init → data → text → readme → agents → translate`) の挙動
  - flow 遷移、spec gate、issue-log 等の flow 系機能
  - CLI のコマンド名・引数・オプション
  - config 不要コマンド (`setup`, `help`, `upgrade`, `presets`) の動作
  - 有効な config での全コマンドの動作

## Migration Plan

- エラーメッセージは既存の `NO_CONFIG` と完全同一（コード・文言・envelope 形式）。ユーザーは引き続き `sdd-forge setup` を実行することで解消可能。
- CLI の外部インターフェースは無変更のため、ドキュメント変更は不要。
- alpha 版ポリシーに従い deprecation 期間は設けない。本変更は silent failure の改善であり、互換破壊ではない。

## Open Questions

（なし — すべての論点は Q&A で解消済み）
