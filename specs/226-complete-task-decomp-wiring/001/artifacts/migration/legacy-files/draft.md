# Draft: 226-complete-task-decomp-wiring

**開発種別:** bugfix
**目的:** spec 215 で着手されながら未配線のまま放置されている「タスク分解機能」の本体を、plan 入口からタスク完了遷移まで production で動作する状態にする。既存 flow.json の救済と dogfood 検証は後続 Issue（board draft `3f91`）で実施する 2 spec 分割方針。

**参考資料:** 本 draft は要件レベルに限定して記述している。議論で採用した具体的な設計判断、スキーマ案、ライフサイクル詳細、実装方針の背景調査結果は `specs/226-complete-task-decomp-wiring/reference.md` を参照のこと。spec phase 以降の実装設計の基礎資料として活用する。

## Scope Verification

### In scope（spec 226 本体）

要件は優先度順に整理する（P1 が最優先）。詳細な設計判断と根拠は reference.md を参照。

**P1 — タスク必須化と構造化（タスク分解を強制する基盤）**

- **REQ-1**: When 新規 spec の spec.json にタスク定義が空配列または未定義の状態で spec gate が実行される時、shall spec gate は FAIL verdict を返し、non-zero exit code で終了する
- **REQ-2**: When AI が plan フェーズで spec.json のタスク定義を記入する時、shall 各タスクは構造化されたフィールド群（目的 / 受入条件 / 実装ノート / テスト戦略 / 親タスク参照）で記述される
- **REQ-3**: When spec.json のタスク定義スキーマが検証される時、shall 目的フィールドは必須であり、受入条件 / 実装ノート / テスト戦略 / 親タスク参照は optional として受け入れられる

**P2 — タスク遷移の自動化（production 経路の配線）**

- **REQ-4**: When spec の approval post-hook が実行された時、shall 最初に実行すべき pending タスクが currentTaskId として自動的に設定される
- **REQ-5**: When 実行中のタスクが完了判定の契機（本 spec の Q&A Q20 で決定された step）に達した時、shall 次の pending タスクが currentTaskId として自動的に設定される
- **REQ-6**: When 親タスクを持つ子タスク群の全てが done 状態になった時、shall 親タスクも done 状態に自動遷移する
- **REQ-7**: When 全てのタスクが done 状態になった時、shall currentTaskId は null になり、後続の flow-scope step へ遷移する

**P3 — forest 構造の運用とタスク個別仕様書**

- **REQ-8**: When spec.json のタスク定義スキーマが検証される時、shall 親タスク参照フィールドは string または null を受け入れる（optional）
- **REQ-9**: When spec 承認時に spec.json のタスク定義が flow.json に差分反映される時、shall spec.json 側の親タスク参照が flow.json 側のタスク定義にそのまま転写される
- **REQ-10**: When sdd-forge spec render が実行された時、shall 各タスクごとの仕様 markdown ファイル（specs/<spec-dir>/tasks/<task-id>.md）が spec.json のタスク定義から自動生成される
- **REQ-11**: When タスク個別の仕様 markdown が生成された時、shall 生成物は手動編集禁止であり（spec.md と同じ SSOT 原則）、再生成で上書きされる

**P4 — guardrail と prompt による粒度の担保**

- **REQ-12**: When spec gate または task-spec gate が実行された時、shall タスク単一責任の guardrail が各タスクの concern 単一性を評価し、違反時は FAIL verdict を返す
- **REQ-13**: When plan/spec 系 prompt の内容が検証される時、shall プロンプト内に以下の要素が明示的に記述されている: タスク分解の 1 concern 原則、title は 1 verb phrase で表現可能であること、無関係な actions を 1 task に束ねない制約、各タスクの必須フィールド（goal）と任意フィールド（acceptance / implementation_notes / test_strategy）の役割
- **REQ-14**: When plan/draft 系 prompt の内容が検証される時、shall プロンプト内に以下が記述されている: 要件を concern 単位に整理すべき旨、後続の spec 段階で concern 単位にタスク分解する前提で要件整理すべき旨

**P5 — task-scope step 構成の再編**

- **REQ-15**: When task-scope の step 構成が検証される時、shall 現行の 7 step 構成が 5 step 構成（テスト作成 / 実装 / テスト実行 / レビュー / task 単位 gate）に再編されている
- **REQ-16**: When 既存の task 単位の再承認 / task 仕様書の gate / 独立した overview 更新 step が検索される時、shall それらは task-scope の step 構成から削除されている
- **REQ-17**: When task 実装が完了した時、shall 当該タスクによる parent spec の overview への貢献追記が実装 step 内で行われる（既存 spec 207 メカニズムを再利用）

**P6 — タスクの手動制御 CLI**

- **REQ-18**: When ユーザーがタスクの状態を手動で操作する必要がある時、shall タスク開始とタスク完了の CLI コマンドが利用可能である
- **REQ-19**: When 手動 CLI が呼ばれてタスク状態を変更した時、shall 自動遷移ロジック（次タスクの promote、親タスクの自動完了）が同様に適用される

### Out of scope（board draft `3f91` に分離、spec 226 merge 後に着手）

- **NOT-1**: When 本 spec が merge された時、shall 既存 flow.json のタスク定義空状態の一括マイグレーションは本 spec の scope に含まれない
- **NOT-2**: When タスク必須化が完全適用される時、shall 既存 flow の load strict 化と flat fallback 経路の完全廃止は本 spec の scope に含まれない
- **NOT-3**: When spec 215 の scenario-reopen-flow.test.js の削除作業が行われる時、shall 本 spec の scope に含まれない
- **NOT-4**: When 新規 E2E integration test の追加が行われる時、shall 本 spec の scope に含まれない
- **NOT-5**: When forest 構造を用いた自 spec の dogfood 検証が行われる時、shall 本 spec の scope に含まれない

### Out of scope（別 Issue 化済みまたは将来検討）

- **NOT-6**: When gate-impl の REQ-SPEC 判定基準が強化される時、shall 本 spec の scope に含まれない（board draft `212f`）
- **NOT-7**: When 撤去済み skill 名への dead reference の解消作業が行われる時、shall 本 spec の scope に含まれない（board draft `fd80`）
- **NOT-8**: When 並列タスク実行機構が導入される時、shall 本 spec の scope に含まれず、spec 196 の方針を踏襲し将来の破壊的拡張として留保する

## Impact on Existing Features

- 影響あり:
  - 新規 spec の spec gate: タスク定義が空のままでは通過しなくなる
  - タスク定義スキーマ: 破壊的変更（後方互換 shim なし、alpha ポリシー準拠）。ただし既存 spec.json は全件タスク定義を持たない状態のため、現存データへの影響は発生しない
  - AI への spec 作成指示: タスク分解の記述を要求するよう変化
  - 今後の全 spec: タスク粒度の単一責任 guardrail により、雑な分解は gate で reject される
  - spec render: 各タスク個別の仕様ドキュメント（tasks/<id>.md）が新たに生成される
  - task-scope step 構成: 7 step → 5 step の破壊的再編（現 task-scope を通過している active flow は存在しないため現存データへの影響なし）
  - completeTask 発火契機: task 完了を判定する step が再設計により変わる

- 影響なし:
  - 既存の finalized spec / docs / skill / preset
  - 既存 active flow の flat 実行経路（本 spec では flat fallback 経路を残す。完全廃止は `3f91`）
  - consumer project の既存運用（新 prompt と新 guardrail は npm update で反映される）

## Q&A

**議論モード**: decision（意思決定）。各 Q は選択肢から合意形成を行う形式で進めた。ブレインストーミングではなく、最終決定を目的として実施した。議論開始時にユーザーから「ドラフトでとことんやりとりをして、完全に実装しきるようにしたいです」との意図が提示され、意思決定モードであることを合意済み。

### Q1. この理解で進めるか
- 提示した概要: spec 215 のタスク分解機能を、plan 入口から task 完了遷移まで production 動作させる
- A: [1] はい

### Q2. タスク定義を必須化するか
- 現状: タスク定義が空のまま flat 実行経路で完走できる構造が spec 215 の未完成の根本原因
- A: 必須化する。ただし既存 flow.json 救済を含む破壊的適用は後続 Issue `3f91` に分離し、本 spec では新規 spec のみを対象に spec gate で reject する形にする

### Q3. 既存 flow.json の救済方式
- A: 本 spec の scope 外（board draft `3f91` で対応）。先行 spec 208 のパターンを踏襲する一度きりの migration を想定

### Q4. Acceptance Criteria
- 初期案: 新規 E2E integration test + 自 spec dogfood の両輪
- A: Q12 の分割判断により E2E と dogfood は board draft `3f91` に移動。本 spec のアクセプタンスは、unit 粒度のテストでタスク分解関連コンポーネントの挙動を検証し、新 CLI を使った最小 integration test で 2 件 forest の 1 サイクル動作を確認する

### Q5. タスク遷移の配線
- A: 完全自動化。spec 承認時点で最初のタスクを自動起動、各タスク完了で次タスクへ自動遷移、親子関係がある場合は子の完了で親が完了に遷移、全タスク完了で後続フェーズへ移行。手動復旧のための CLI も併設

### Q6. タスク分解記述の配置
- A: spec 作成フェーズの prompt にタスク分解ルールを明記する。draft フェーズの prompt には抽象的な予告のみを加える（guardrail "Draft Stays at Requirements Level" と整合）

### Q7. 既存 spec 215 の scenario test の扱い
- 事実確認: 当該 test は task 状態遷移を production path を通さず JSON 直接編集で代用しており、REQ-12 の acceptance を実質的に検証していない。個別関数の unit coverage は他の既存 test で網羅されている
- A: 削除（ただし本 spec の scope 外、board draft `3f91` で対応）

### Q8. gate-impl の判定甘さ対策
- A: 本 spec の scope 外（board draft `212f` で独立追跡）

### Q9. タスク粒度の guardrail 導入
- A: spec / task-spec phase に「タスク単一責任」guardrail を新設する。さらに spec 作成 prompt にも分解ルールの指示を含めることで、reactive（gate での reject）と proactive（prompt での事前指示）の両輪で粒度の品質を担保する

### Q10. タスク分解粒度の設計思想
- A: タスクは「品質が担保される最小単位」として設計する。単なる作業分解ではなく、1 task 完了時点で 1 concern が閉じる粒度を目指す

### Q11. 既存 schema の forest 構造の状態
- 事実確認: data model には親子関係の field が spec 196 時点で追加されているが、実運用経路には配線されていない。spec 215 と同じ「schema 先行、運用未配線」パターン
- A: 本 spec で forest 構造を運用可能にする。親子関係を spec.json から flow.json に正しく継承し、遷移ロジックが親子を理解し、親タスクは全子タスクの完了で自動的に完了する

### Q12. bootstrap 問題と 2 spec 分割
- 論点: 226 自身を forest で dogfood すると、forest 経路は 226 で新規実装するため bootstrap 問題が生じる
- A: 2 spec に分割する。spec 226 は forest 配線の本体（Issue #256 の Critical 欠陥 A-E を解消）、board draft `3f91` が既存 flow 救済と forest dogfood と新 E2E test を担う

### Q13. schema 変更の後方互換性
- 事実確認: 既存 spec.json は全件タスク定義を持たない状態であり、top-level でタスク定義は optional
- A: schema の破壊的変更は既存 spec.json に影響しない。タスク必須化は schema の required ではなく spec gate の判定ロジック側で行うことで、既存 spec.json の読込互換性を維持する

### Q14. 他 worker の作業中 flow との衝突
- 事実確認: 現プロジェクトに並行 worktree は存在せず、本 spec は既存 flat 経路を維持するため既存 active flow への影響はない
- A: 本プロジェクト内では衝突リスクなし。consumer project 向けには Migration Plan で案内する

### Q15. sdd-forge upgrade の consumer 影響
- 事実確認: upgrade コマンドが対象とするファイル（skills / AGENTS.md SDD section）に本 spec は変更を加えない
- A: consumer の追加対応は不要。npm update のみで反映される

### Q16. prompt 変更の AI agent への影響
- 事実確認: 既存 agent test は plan 系 prompt を参照していない
- A: 既存 agent test は壊れない。本 spec 内では prompt への追加指示の存在を静的に検証する unit test のみ行い、実効性検証は `3f91` の forest dogfood で行う

### Q17. 並列 task 実行のスタンス
- A: 現 task id は単数を維持する（spec 196 の既定方針を踏襲）。並列化は将来の独立 spec で破壊的拡張として扱う

### Q18. 撤去済み skill 名の dead reference
- A: 本 spec の scope 外（board draft `fd80` で追跡）

### Q19. task-level 仕様書と spec.json のタスク定義の構造化
- 発端: cac6 原設計ではタスクごとに markdown 仕様書を生成する想定だったが、実装では生成されていなかった
- A: spec.json のタスク定義を構造化し（単一フィールドから 目的 / 受入条件 / 実装ノート / テスト戦略 / 親タスク参照 への分解）、spec render が各タスク個別の markdown を自動生成する（生成物、SSOT は spec.json 側）

### Q20. task-scope step の再設計
- 論点: 現行の task-scope step 構成には、SSOT 原則と衝突する task-spec gate や、親 spec の approve と semantics が重複する task 単位の再承認など、冗長な step が含まれている
- A: task-scope step を 5 step に再編する。内訳は、テストを書く / 実装する / テストを実行する / レビューする / task 単位の客観 gate で評価する。承認済み spec を信頼し、タスク単位での承認再取得は行わない。task 完了の契機は客観 gate の PASS とする。parent spec への貢献追記（既存 spec 207 機能）は実装 step の中に内包する

## Open Questions

実装詳細（spec phase で確定。基礎資料は reference.md を参照）:
- 新 CLI の具体的な引数・出力形式
- タスク個別 markdown の構造（見出し構成、metadata の表現）
- 遷移ロジックのアルゴリズム（探索順、兄弟順）
- prompt の文言・セクション構成

## Migration Plan

本 spec は以下の破壊的変更を含むが、既存データと consumer への影響は限定的である。

**対応範囲と手順**:

- **spec.json のタスク定義スキーマ変更**: 既存 326 spec.json は全件タスク定義を持たない状態のため、スキーマ変更の現存データ影響はゼロ。マイグレーション script は不要。新規 spec のみが新スキーマを使う。
- **task-scope step 構成の 7→5 再編**: 現プロジェクト内に task-scope step に到達している active flow は存在しない（全件 tasks[] 空で flat 経路で実行中）。よって現存 flow への影響はゼロ。spec gate の新規 reject 条件は新規 spec のみを対象とし、既存 active flow の flat 経路は本 spec では維持する。
- **consumer project への反映**: consumer は `npm update sdd-forge` を実行することで本 spec の全変更が反映される。追加の `sdd-forge upgrade` 実行は不要である（本 spec は skill テンプレートを変更しない）。
- **consumer の既存 active flow**: tasks[] 空のまま flat 経路で動作継続する。本 spec では flat fallback 経路を維持するため、update 直後に既存 flow が壊れることはない。
- **既存 flow の完全な新形式移行**: 別 Issue（board draft `3f91`）で一度きりの migration script と strict 化を扱う。本 spec 単体では「新規 spec のみ新形式」「既存 flow は flat のまま」の段階的移行となる。

**確認手順**:

- npm update 後、consumer project で `sdd-forge flow get status` が既存 flow に対して従前通り動作すること
- 新規 spec を作成して `sdd-forge flow prepare` を実行した場合、spec.json のタスク定義が空のまま approval に進むと spec gate が FAIL する旨
- 後続 Issue（`3f91`）merge 後に、consumer は migration script を実行して既存 flow を新形式へ移行する

**ロールバック方針**:

- alpha 版ポリシーに従い、後方互換 shim や段階的 rollout 機構は提供しない
- 問題が発生した場合は sdd-forge のバージョンを本 spec merge 前に戻すことで元に戻せる

## 関連 Board Drafts

- `212f` [ENHANCE] gate-impl REQ-SPEC 甘判定の厳格化
- `3f91` [ENHANCE] spec 226 完了後の consumer 作業（既存 flow migration + 古い acceptance test 削除 + forest dogfood E2E test）
- `fd80` [BUG] phaseToSkill が撤去済み skill 名を返す dead reference の解消

## User Approval

- [x] User approved this draft
- Confirmed at: 2026-04-24
- Notes: Q1-Q20 の議論を経て承認。タスクライフサイクル / spec.json のタスク定義の構造化 / forest 配線 / 2 spec 分割 / task-scope step 再編を含む。spin-off 3 件（board drafts `212f` / `3f91` / `fd80`）を登録。
