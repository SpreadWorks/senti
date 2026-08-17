# Draft: 225-auto-check-omnibus-fix

**開発種別:** bugfix
**目的:** auto-check の false positive（static gate G のキーワード過剰 hit）と入力の薄さ（Issue 本文未参照）を解消し、軽微修正が妥当な範囲で通るようにする。

## Scope Verification
- In scope:
  - #1 `auto-check-static.js` G_KEYWORDS の縮減（false positive 削減）
  - #4 Issue 本文の auto-check 入力取り込み。`specs/<spec>/issue.md` にキャッシュ、gh fetch は 1 回
  - Issue 本文の minify（新 md handler、`<details>` 除去以外全て）
- Out of scope:
  - #2 hard-gate zero-tolerance 段階化 → board draft `df3f` に分離
  - #3 THRESHOLD 再調整 → board draft `05cc` に分離
  - #5 failed verdict 非キャッシュ + 再評価・昇格通知機能 → board draft `6a1d`（新機能）に統合
  - #6 reason 表示改善 → ドロップ（ユーザーは reason を読まない UX のため不要）

## Impact on Existing Features
- 影響ありの既存機能:
  - **`flow run auto-check` / `flow set auto on`** — 入力に Issue 本文が含まれるため、同一 request でも score が変動する可能性あり。本来 eligible になるべきケースが通るようになる（改善）
  - **`flow set init --issue N`** — gh fetch を実行し preparing state に `issueBody` を保存する挙動を追加。gh 失敗時は silent fallback（従来通り進行）
  - **`flow prepare`** — preparing state の `issueBody` を `specs/<spec>/issue.md` に書き出す
  - **`flow set issue <n>`**（active mode での issue 紐付け/変更）— `specs/<spec>/issue.md` を更新
  - **`src/flow/lib/get-issue.js`** — 既存。gh fetch ロジックを共通ヘルパーに抽出し、新コードと共有（CLAUDE.md の DRY ルール）
  - **`src/docs/lib/lang-factory.js`** — md handler を追加。既存の他言語 minify には影響なし
  - **auto-check 系の既存テスト** — G_KEYWORDS 縮減・issue.md 参照の挙動に合わせて更新
- 影響なし:
  - docs パイプライン（scan/enrich/init/data/text/readme/agents/translate）— md handler を新設するが既存 pipeline は .md を minify していないため無影響
  - spec gate / task gate / finalize / review — auto-check の入出力契約は変わらない（eligible 判定の内部ロジックのみ改善）
  - プリセット群

## Q&A
- Q1: Issue #255 は 6 項目の洗い出しを 1 spec で扱うか、分割するか
  - A: 最終的に本 spec は #1 と #4 + Issue 本文 minify に絞る。#2/#3/#5/新機能は別 board draft に切り出し、#6 はドロップ
- Q2: #5 failed verdict 非キャッシュの責務範囲（当初の論点）
  - A: 新機能 6a1d（フェーズ進行に伴う昇格提案）の前提として統合。本 spec からは除外
- Q3: #6 reason 表示改善は必要か
  - A: 不要。auto-check NG 時にユーザーは request を書き直して再挑戦しない。本 spec および将来 spec からドロップ
- Q4: #1 の具体手法（word-boundary / 縮減 / ペア）
  - A: キーワード縮減案を採用。残す: `password`, `credential`, `secret`, `token`, `authentication`, `npm publish`, `破壊的`, `パスワード`, `認証情報`。削る: `security`, `auth`, `migration`, `migrate`, `delete`, `drop`, `destructive`, `release`, `認証`, `トークン`, `資格情報`, `マイグレーション`, `削除`, `リリース`。H_KEYWORDS は現状維持
- Q5: #4 Issue 本文の取得・保存タイミング
  - A: `flow set init --issue N` で gh fetch → preparing state の `issueBody` に保存。`flow prepare` で `specs/<spec>/issue.md` に書き出し。`flow set issue <n>` でも再 fetch・更新。auto-check は preparing 時は state、active 時は issue.md を読む。取得・書き出し失敗は silent fallback で従来挙動
- Q6: Issue 本文の minify 方針
  - A: `src/docs/lib/lang/md.js` を新設し lang-factory に `.md` 登録。操作は HTML コメント除去 / 画像参照 → alt / 水平線除去 / 連続空行を 1 行に / 末尾空白除去。`<details>` ブロックは**除去しない**（中身に有用情報がある可能性のため）。既存 `minify.js` の generic pipeline は全空行削除するため、md handler は blank 保持をシグナル（`preserveBlankLines` 等）して pipeline を分岐する

## Open Questions
- minify.js pipeline の分岐シグナル名（`preserveBlankLines` / `skipGenericBlankRemoval` 等）は spec / 実装で決定
- `src/flow/lib/fetch-issue.js`（共通ヘルパー）の strict/lenient モードの API 形状は spec で確定

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: Q&A 6 ラウンドで scope を #1 + #4 + issue.md minify に絞り込み。#2/#3/#5/新機能は別 board（df3f, 05cc, 6a1d）に切り出し、#6 はドロップ
