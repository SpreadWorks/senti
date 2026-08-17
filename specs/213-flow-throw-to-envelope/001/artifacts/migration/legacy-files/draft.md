# Draft: 213-flow-throw-to-envelope

**開発種別:** refactor
**目的:** flow コマンド群の throw のうち「判定結果」「ユーザー操作で回避可能」「CLI 引数バリデーション」カテゴリの約 28 箇所を ok:false + code 返却に置き換え、「throw = 復旧不能 or 想定外のみ」という統一規約を確立する。

## Requirements

優先順位 (C: 現行フロー阻害 → B: 運用改善 → D: 一貫性):

- **R1 (highest, 分類 C「判定結果」):** When flow コマンドが「auto-check 不適格」「gate retry 予算超過」「gate-impl 前回 FAIL 以降コード変更なし」を判定したとき、throw ではなく ok:false + machine-readable code で返却し、判定根拠（スコア内訳・予算・前回失敗ハッシュ等）を呼び出し側が参照できる形で含めなければならない (shall)。
- **R2 (high, 分類 B「操作回避可能」):** When flow コマンドが「retro.json が既存」「diff なし」などユーザー操作で回避可能な条件に遭遇したとき、throw ではなく ok:false + code + 回避策を示す hint を返さなければならない (shall)。
- **R3 (medium, 分類 D「CLI 引数バリデーション」):** When flow set 系コマンドが CLI 引数不正（usage / 不正な値 / 不正な phase / 不正な status / JSON parse 失敗 等）を検出したとき、throw ではなく ok:false + code で返さなければならない (shall)。
- **R4 (medium, 既存挙動の保持):** When 復旧不能または想定外のエラー（schema 破損・必須ファイル欠損・git 失敗・AI response 不正 等）が発生したとき、従来通り throw しなければならない (shall)。
- **R5 (low, エコシステム整合):** When 呼び出し側が ok:false envelope を受け取ったとき、`errors[0].code` は SCREAMING_SNAKE_CASE の machine-readable な値であり、各 code の正常返却がテストで検証可能でなければならない (shall)。

## Scope Verification
- In scope:
  - 分類 C（判定結果 3 箇所）の throw 廃止と ok:false 返却への置換
  - 分類 B（操作回避可能 2 箇所）の throw 廃止と code + hint 返却
  - 分類 D（CLI 引数バリデーション ~23 箇所）の throw 廃止と code 付与
  - 既存テストの throw 期待 assertion を envelope 期待 assertion に置換
  - 新規テストで各 code の正常返却を検証
- Out of scope:
  - 分類 A（復旧不能）の throw 変更
  - dispatcher 内部のエラー伝達構造の全面刷新
  - skill 側の契約書き換え（SKILL.md の error-code reference table 整備は別 draft）
  - `flow get next-action` の NO_IN_PROGRESS_STEP throw（skill 契約に深く絡むため別 spec）

## Impact on Existing Features
- 影響ありの既存機能:
  - auto モード有効化コマンド: 拒否時に非ゼロ exit は据え置きだが、envelope に構造化された code と判定根拠が露出する。skill 側は現在「拒否即 STOP」扱いで振る舞い変化なし。
  - gate retry 超過 / no-progress 検出: exit code 据え置き、code と judgment 根拠が structured になる。
  - retro コマンド: 既存 retro がある／diff がないケースで envelope 返却。hint 情報（--force 誘導・commit 後再実行案内）が errors に載る。
  - flow set 系コマンド: 不正引数時に envelope JSON が stdout に吐かれ、JSON パースで分岐できる。
  - 既存テスト: throw を期待していた assertion（詳細件数は test phase で enumerate）が envelope 期待に書き換わる。
- 影響なし: 分類 A の throw、envelope の schema、呼び出し側の envelope パス、`flow.json` フォーマット、他未対象コマンド。

### Migration Plan
- 既存 CLI インターフェース（コマンド名・オプション名・exit code の 0/非 0 区別）は不変。envelope の `ok` / `errors[0].code` / `data` 形式も既存のまま。
- 振る舞いが変わるのは「例外が CLI クラッシュ風に伝播していた箇所が envelope JSON で帰ってくる」点のみ。既存の envelope パース経路を持つ呼び出し元（skill / テスト）は無改修で受信可能。
- stderr 依存のスクリプトがある場合のみ追従が必要 → リリースノートで「throw → envelope 化した code 一覧」と「stdout JSON を見るべき旨」を通知する。
- 旧挙動（throw）を残す互換フラグは導入しない（alpha 版ポリシー）。

## Q&A
- Q: exit code は ok:false 時に 1 を維持するか？
  - A: 維持する。
  - Basis: envelope 出力ヘルパーが ok フラグから exit code を機械的に付ける既存仕様。exit code 意味論の変更は scope 爆発になる。呼び出し側は `errors[0].code` で分岐する前提。
- Q: 分類 D の code 粒度は？1 つに統一 vs 細分化？
  - A: 細分化（発生根拠ごとに別 code）。
  - Basis: guardrail `unambiguous-requirements` の観点で、呼び出し側が code から修正方針を決められる粒度が望ましい。同じ "usage" メッセージでも発生根拠が違えば code を分ける。
- Q: auto-check の eligibility 問い合わせコマンドが既に ok:true で結果を返している点との整合は？
  - A: 問い合わせ側は本 spec 変更不要。本 spec で直すのは「有効化しようとしたが再 check で拒否」された際の有効化 set 側のみ。
  - Basis: コード調査で問い合わせ側は既に envelope 返却、有効化 set 側のみ throw と判明。役割分離を尊重。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-22
- Notes: issue #219、daf8 議論から派生。オプション [3] C+B+D 一括で合意。
