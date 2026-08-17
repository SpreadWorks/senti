# Draft: 197-test-first-determinism

**GitHub Issue**: #185 (cac6/T4)
**Feature Branch**: `feature/197-test-first-determinism`
**Created**: 2026-04-20
**Discussion Mode**: Decision（ブレスト段階ではなく、承認済みの設計判断を記録）

**開発種別:** enhancement（既存 flow/task ステップアーキテクチャ拡張）

**目的:** cac6 分解タスク T4。test-first 原則を機械化するため、task 内のテスト/実装 step を「テスト先行 → 実装 → テスト実行」の 3 段階に分解し、テスト実行を CLI 駆動とすることで AI による結果偽装を構造的に不可能にする。併せて integration 段階を親 flow に導入し、task 粒度と親 spec 粒度のテスト結果を scope 推論で自動分離・合算する。

## Requirements（優先度付き）

優先度は P1 = 必須コア、P2 = 必須派生、P3 = 必須整合、P4 = テスト/運用。全要件は When/If トリガー + shall 期待動作で記述する。

### P1 — コア

- **REQ-1** When 新規に task が作成される時、shall task の step 列はテスト作成段階・実装段階・テスト実行段階の 3 つを含み、この順序で並ぶ。plan/addition 両 origin で同じ順序を適用する。
- **REQ-2** When テスト実行段階が進行する時、shall 実テストコマンドの起動・結果記録はツール側で実行され、AI は結果値を書き込めない。記録される情報は終了コード、log 参照先、件数サマリ（unit / integration / acceptance の各整数）の 3 種である。
- **REQ-3** When テスト作成段階で AI が参照する情報集合が構成される時、shall 実装対象ファイルの差分と内容は構造的に除外され、AI からは到達できない。併せて対応 skill のドキュメントは「実装差分を参照しない」方針を明示する。

### P2 — 派生機能

- **REQ-4** When task の完了処理が実行される時、shall 当該 task の test summary に格納された件数（unit/integration/acceptance）を親 state の対応フィールドに整数加算する。task の summary が null の場合は加算を行わず親 summary は変化しない。
- **REQ-5** When integration 段階のテスト実行が行われる時、shall 結果は親スコープに直接記録され、task スコープへの記録は行われない。
- **REQ-6** When 親 flow の全 task が完了状態になった時、shall 親 flow の step 列には review 段階の前に integration 段階 4 段階（統合テスト作成・統合テスト実行・全 task テスト横断実行・評価）が順序通り挿入されている。ただし task を持たない flow では integration 段階は初期状態で skip として扱われる。

### P3 — 整合

- **REQ-7** When 実装段階中に addition origin の新規 task が追加される時、shall draft 内容は AI が親 spec・既存 task・issue 本文の context から自動生成し、gate が pass した場合のみ task 実行が継続される。gate FAIL のリトライ回数が既存 retry policy の上限に達した時にのみ user escalate する。

### P4 — テスト

- **REQ-8** When 本 spec の実装を成果物に含める時、shall 以下の観点を網羅する自動テストが存在する:
  - task step 列の構成と phase 割当
  - テスト作成段階の情報フィルタ
  - テスト実行の結果記録（起動・summary・終了コード）
  - integration 段階の step 構成と task 不在時の skip 挙動
  - task から親への summary 合算（加算と null 耐性）
  - task を 1 個完走させる end-to-end の順序検証と合算検証
- **REQ-9** When プロジェクト標準のテスト実行コマンドが実行された時、shall 追加・既存テストは全て PASS する。既存テストの期待値は変更せず、schema 整合のための fixture 追加のみを許容する。

## Out of Scope

- 実装中発生 task を plan phase への差分追記として扱う「replan 機構」— 別タスクで検討
- task step の命名整理（例: `gate` の文脈明示リネーム）— 別タスク
- guardrail 3-tier 化（T3）
- spec.json プライマリ化（T8）
- skill 統合（T7）
- 旧 flow.json の一括マイグレーション（T11）

## Impact on Existing Features

- **破壊的**: task step 列の内容変更。現時点で task 機能を使用中の active flow は 1 本のみのため実害は最小。
- **破壊的**: 親 flow step 列に integration 段階を追加。単一 spec フローはスキップ扱いで挙動変化なし。既存 flow.json の step 列 migrate は T11 で一括対応。
- **追加**: テスト実行 CLI を新設。既存 CLI の引数・終了コードは変更しない。
- **追加**: context 取得に phase 別 filter。filter ルール未定義時の既存挙動は変化なし。
- **追加**: task 完了に合算副作用。既存単体呼び出しの戻り値は変化しない。

## Constraints

- 外部依存追加禁止（Node.js built-in のみ）
- alpha 方針: 後方互換コードを残さない
- `src/` に project-specific 情報を埋め込まない
- コミットメッセージは英語
- 設定や path が不在の場合は silent default を避け、明示的エラーで知らせる

## Edge Cases

- テスト実行コマンドが設定にも package scripts にも存在しない → 明示エラー（silent success 禁止）
- テスト runner が SIGKILL 等で異常終了 → exit code を summary に正直に記録し、AI には failed として提示
- 単一 task フロー → integration 段階は skip せず実行（regression 検出の価値あり）
- write-tests で AI が非テストファイルを編集しようとした場合 → 本 spec では検出不要（review/gate 層で拾う）
- task の summary が null → 合算は no-op（親 summary 変化なし）
- addition の auto-draft が gate FAIL ループに陥った → 規定リトライ後 user escalate
- 旧 flow.json（integration 段階未挿入）の load → 明示的 Error（alpha 方針、T11 で migrate）

## Test Strategy

### 配置方針
task step 列・CLI 契約・phase 遷移・合算は公開 API 契約のため、プロジェクト標準の **formal tests**（unit と e2e の階層）に配置する。spec verification tests は作らない。

### 検証対象
1. 新 task step 列と phase 割当（unit）
2. write-tests 段階での context フィルタ（unit）
3. テスト実行 CLI の起動・結果記録・exit 反映（unit）
4. integration 段階 4 step の遷移と skip 条件（unit）
5. task→親の summary 合算（unit）
6. task を 1 個完走させる end-to-end 遷移検証（e2e）

### 既存テスト更新方針
state モックに新 step 列を反映する。**テスト期待値の変更は行わない**。期待値変更が必要になる場合は、当該 Requirement の誤りとして spec を修正する。

## Alternatives Considered

1. **既存の impl step に test 機能を混載（内部フラグ切替）**
   却下。step の単一責務原則に反し、context 制御と CLI 実行の線引きが曖昧化する。`Single Responsibility` guardrail に違反する。
2. **既存の実装確認コマンドを拡張してテスト実行も担わせる**
   却下。既存コマンドは requirement カウント用に設計されており、テスト実行と結果永続化は責務が異なる。過剰結合になる。
3. **write-tests の context 制御を skill の self-restraint のみに任せる（B 案）**
   却下。AI が意図せず diff を取得する経路（例: 別 tool 経由）を塞げず、機械的強制力が無い。
4. **context 制御を CLI filter のみで強制（A 案）**
   却下。CLI が全経路を把握しているわけではなく、skill 明文化による補強が必要。C 案（併用）を採用。
5. **Addition origin 廃止（厳格 A 案: 発生時は plan phase に戻す）**
   却下。軽微な helper 抽出まで plan 戻りは過剰。addition を安全弁として残し、gate 厳格で品質担保する方が運用コストが低い。実データは未収集だが、想定発生頻度が 10-20% と見込まれ、完全封鎖は spec 詳細化への過剰圧力になる。
6. **integration 段階を別タスク（cac6/T12）に切る**
   却下。Issue #185 本文に明記され、cac6 全 11 タスクの他枠でも扱われないため、T4 の責務と一体で扱う。切り出すと cac6 計画の 12 タスク化になり計画変更を伴う。

## Future Extensibility

- **replan 機構**: addition 自律化が gate 通過率で不十分と判明した場合、別タスクで differential re-plan CLI を導入可能。本 spec の step 構造はそのまま活用できる。
- **Parallel task 実行**: 並列化 spec（9c3c）検討時に、テスト実行 CLI が複数 task の runner を並行 spawn しやすいよう、task 配列受け取りへ拡張可能な関数分解とする。
- **Integration 段階の拡張**: 将来 performance/smoke-tests を追加する際、step 挿入方式（parent flow 列追加＋skip 条件）を踏襲できる。
- **context-rules の phase 拡張**: 他 phase（review 等）にも filter を追加可能。設定 schema を phase 別オブジェクトとして設計しておく。

## Q&A

**判断基準の記載方針**: 各回答の末尾に **基準** を明示する（(1) project docs/, (2) guardrail 原則, (3) 既存コードパターン のいずれか）。

### Q1: 意図解釈は正しいか
- A: [1] はい。
- 基準: Issue #185 本文と完全一致（docs 参照: GitHub Issue #185）。

### Q2: step 置換方針（plan/addition 両系統 or 片方先行）
- A: [1] 両系統で同じ規則で置換。
- 基準: Issue 本文「task 内 steps に write-tests → impl → run-tests を導入」は origin 非依存。guardrail 原則「Single Responsibility」により段階分離は全 origin 共通。

### Q3: 命名整理と addition の扱い
- 議論の結果: **命名リネームはスコープ外**（本 spec の責務は機械化であって命名整理ではない、guardrail「Single Responsibility」）。**Addition origin は残す**（B 案）。
- 基準: 既存コードパターン（T2 の task origin 定義は 3 値前提で配線済み）＋ guardrail 「Backward-Compatible CLI Interface」（廃止は破壊的影響が大きい）。

### Q4: テスト実行 CLI の実装方式
- A: [1] 新規 CLI コマンドを新設（既存コマンドを拡張しない）。
- 基準: 既存コードパターン（既存 run コマンド群は責務ごとに 1 ファイル構成）＋ guardrail「Single Responsibility」。

### Q5: context-rules の実装レイヤ
- A: [3] C 案（CLI filter + skill 明文化）。
- 基準: guardrail「Complete Context」（強制力の担保）＋ 既存コードパターン（skill と CLI の二層で規約を表現）。

### Q6: test-summary の集計方法
- A: [1] 合算方式（task 完了時に親へ自動合算、integration 段階は親直接記録）。
- 基準: 既存コードパターン（T2 の scope 推論に合算副作用を 1 箇所追加）＋ guardrail「Unambiguous Requirements」（件数は集計可能な明確値）。

### Q7: integration 段階のスコープ（T4 で扱うか別タスクか）
- A: [1] T4 で扱う。
- 基準: docs（Issue #185 本文に明記）＋ 既存計画 cac6 分解表（他 10 タスクに枠なし）。

### Q8: テスト戦略と配置
- A: [1] formal tests（unit + e2e）。
- 基準: project docs（`src/CLAUDE.md` のテスト配置ルール: 公開 API 契約は formal tests）。

## User Confirmation
- [x] User approved this draft
- Confirmed at: 2026-04-20
- Notes: auto mode 下で 8 問の対話を経て合意。addition 残存 + gate 厳格、integration 段階含む方針で確定。

## Open Questions

実装中に判明した追加論点は `issue-log.json` に記録する。
