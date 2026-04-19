# Feature Specification: 192-log-sensitive-info-masking

**Feature Branch**: `feature/192-log-sensitive-info-masking`
**Created**: 2026-04-18
**Status**: Approved
**Input**: Issue #178 — Sensitive information masking design for sdd-forge logs

## Goal

Logger 経由で出力される全ログ（agent prompt log, git log, event log）の機微情報を一貫してマスキングし、ログをコミット・共有した場合の漏洩リスクを低減する。

## Scope

- Logger クラスが永続化する JSONL エントリおよび prompt JSON ファイル
- agent / git / event の3ドメイン全て

## Out of Scope

- `process.stderr.write` による直接出力
- ソースコード内のコメント、docs 生成物
- 設定による on/off 切替機能
- マスキング前 raw データの保存

## Impact on Existing Features

- **Logger 呼び出し側コード（`src/lib/agent.js`, `src/lib/git-helpers.js`, `src/flow/*`, `src/docs/*` ほか全モジュール）:** 影響なし。既存 API（`logger.agent()` / `logger.git()` / `logger.event()`）のシグネチャ・呼び出し規約は変更しない。マスキングは Logger 内部で自動適用されるため、呼び出し側に差分は発生しない。
- **ログ出力スキーマ（JSONL フィールド、prompt JSON の階層構造）:** 影響なし。追加・削除・改名は行わない。値のみ `***` に置換する。
- **既存ログファイル（過去に生成されたもの）:** 影響なし。遡及マスキング（retroactive masking）は対象外。
- **既存テスト:** 機微パターンを含まないフィクスチャは挙動変化なし。マスキングに関連する新規テストを追加する。
- **config スキーマ（`.sdd-forge/config.json`）:** 影響なし。マスキング有効化/無効化のフラグは追加しない（R6）。
- **CLI コマンド・オプション:** 影響なし。既存コマンドの挙動変更はない。
- **ドキュメント（`docs/`, `README.md`）:** 変更なし。内部挙動の追加であり公開インターフェース変更ではない。

## Clarifications (Q&A)

- Q: マスキングパターンの粒度は？
  - A: 既知パターン辞書方式（汎用高エントロピー検出は採用しない）+ プロジェクトルート外の絶対パスもマスク対象
- Q: マスク後の置換文字列は？
  - A: `***` 単純置換（パターン名は残さない）
- Q: 適用範囲は？
  - A: Logger 全出力を再帰的に走査。event の free-form fields も対象
- Q: 設定による disable は可能か？
  - A: 常時 ON。config フラグ等で disable できない。raw 保存もしない

## Alternatives Considered

- 汎用（高エントロピー）検出: 誤検出で可読性低下のため却下
- config で on/off 可能化: 「本番 off 事故」リスクのため却下
- raw データ別ファイル保存: 漏洩面拡大で本要件と矛盾するため却下
- `[REDACTED:<PATTERN>]` 形式: 情報量より簡潔性を優先し `***` を選択

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: Q&A で確定した設計判断を要件・受け入れ基準の形に再構成した。

## Requirements

**P1 (MUST):**

- **R1:** When Logger がログエントリを永続化する時、値に含まれる既知パターンの機微情報を shall マスク文字列で置換する
- **R2:** When ログ値に以下の機微パターンが含まれる時、shall 該当部分をマスクする:
  - GitHub PAT (`ghp_`, `gho_`, `ghs_`, `ghr_`, `github_pat_` プレフィックス)
  - HTTPS 認証情報入り URL（`https://<user>:<token>@host/...` の user:token 部）
  - Bearer token（`Bearer <token>` の token 部）
  - AWS アクセスキー ID（`AKIA...`）
- **R3:** When ログ値にプロジェクトルート（`SDD_WORK_ROOT`）外の絶対ファイルパスが含まれる時、shall 該当パスをマスクする。When パスがルート配下の時、shall マスクしない
- **R4:** When マスク置換を行う時、shall 置換文字列として `***` を用いる
- **R5:** When Logger 利用側コードが既存 API でログを呼び出す時、shall マスキングは Logger 側で自動適用される（呼び出し側の変更は不要）
- **R6:** When ログ出力が行われる時、shall マスキングは常時有効であり、config フラグ等で無効化できない

**P2 (SHOULD):**

- **R7:** When Logger が値を書き出す時、shall マスキング前の raw 値を別ファイルや別レコードに保存しない
- **R8:** When Logger が値を再帰走査する時、shall 走査深度の上限を 10 とし、10 を超える深さのサブツリーは走査対象外とする。When 巡回参照（同一オブジェクトを祖先として再訪する構造）を検出した時、shall その枝を走査対象外とする
- **R9:** When 1エントリのログ値に対してマスキング正規表現を適用する時、shall 1パターンあたりの入力文字列長に線形のコストで動作する（バックトラッキング爆発を避ける anchored pattern を用いる）

## Acceptance Criteria

- AC1: agent prompt ログ（JSONL + prompt JSON）の system/user/response 各テキストに GitHub PAT を含めた場合、永続化後の値が `***` に置換されている
- AC2: git ログの cmd 配列および stderr に HTTPS 認証情報入り URL を含めた場合、永続化後の値が `***` に置換されている
- AC3: event ログの free-form field に Bearer token / AWS キーを含めた場合、永続化後の値が `***` に置換されている
- AC4: ネストしたオブジェクト（`{ outer: { inner: "ghp_..." } }`）の深い位置の機微情報もマスクされる
- AC5: `SDD_WORK_ROOT` 配下のパス（例: `{workRoot}/specs/192-xxx/spec.md`）はマスクされず素通しされる
- AC6: `SDD_WORK_ROOT` 外の絶対パス（例: `/home/other/secrets`）はマスクされる
- AC7: 非文字列値（数値、boolean、null、配列要素の数値等）はマスク対象外で元のまま
- AC8: 一つの文字列内に複数の機微パターンがある場合、全て `***` に置換される
- AC9: Logger 呼び出し側コード（`agent.js`, `git-helpers.js` 等）は本 spec の変更で差分がない
- AC10: ログ出力を disable にする config フラグが存在しない（常時 ON）

## Test Strategy

- **手段:** Node.js 組み込み `node:test` を用いたユニットテスト（既存 `tests/unit/lib/log.test.js` の拡張、および必要に応じた補助テストファイル）
- **配置:** formal tests (`tests/unit/`) — Logger のパブリック契約変更であり、本 spec のスコープを超えて長期的に維持するため
- **フィクスチャ:** 一時ディレクトリに `LOG_DIR` を作成し、Logger で書き出した JSONL / prompt JSON ファイルを読み戻して値を検証する（実 I/O を経由することでマスキングが永続化パスで確実に作用することを担保）
- **検証項目対応:**
  - AC1–AC3（各ドメインでのマスキング）: 各ドメインに機微パターンを含むログを投入し、書き出されたファイルを読み戻し `***` 置換を検証
  - AC4（再帰走査）: ネスト構造を含む入力で深い位置の値も置換されることを検証
  - AC5–AC6（パス判定）: `SDD_WORK_ROOT` 環境変数を明示設定し、ルート配下と配下外で分岐することを検証
  - AC7（非文字列素通し）: 数値・真偽値・null を含むログ値で非文字列部分が保持されることを検証
  - AC8（複数マッチ）: 1文字列に複数パターンを含む入力で全て置換されることを検証
  - AC9（呼び出し側無変更）: 差分検証は git 上で実施（Logger 呼び出し側ファイルに変更がないことを PR diff で確認）
  - AC10（disable 不可）: config スキーマに該当フラグが無いことをユニット/設定検査で確認
- **性能検証:** R9 の linear cost 性質は追加のベンチマークテストを必須としない（正規表現設計で保証）。ただし巡回参照検出（R8）はユニットテストで検証する

## Open Questions

なし。
