# Draft: ボードの status (Ideas/Todo) 自動作成

**開発種別:** バグ修正

**目的:** `experimental/workflow` の `add`/`update`/`publish` コマンドが、GitHub Projects ボードに必要な status (`Ideas`/`Todo`) が事前に存在しない場合に `status not found` で失敗する問題を解消する。新規ボードでも追加セットアップなしで動作するようにする。

## 背景

- Issue: #147 「[BUG] Auto-creation of Ideas status is not implemented when it does not exist in advance」
- 現状: ボード操作系コマンドは status option が事前に存在しないと失敗する。option を作成する手段が無い。

## スコープ

### In Scope

- `add` / `update` 実行時、参照される status (デフォルト `Ideas`、`--status` で任意指定可) が存在しなければ自動作成する
- `publish` 実行時、`Todo` status が存在しなければ自動作成する

### Out of Scope

- Status フィールド自体（"Status" という SingleSelectField）が存在しない場合の自動作成。フィールド構造の変更は影響範囲が大きいため。
- 別途 `init` サブコマンドの提供。

## 要件と優先度

優先度の高い順:

1. **(高) `add`/`update`/`publish` の status not-found エラーが解消される**: 新規ボードに対する初回 `add` / `publish` が失敗せず正常終了する
2. **(高) Status フィールド自体が無いケースは non-zero exit code で停止する**: Status フィールドの作成や変更を一切試みず、エラー出力のみ行って終了する
3. **(中) 既存ボードでは追加処理が行われない**: status が事前に揃っているボードでは、option 作成のための API 呼び出しが 0 回に保たれる
4. **(低) 失敗時のユーザー案内**: Status フィールドが無い場合のエラー出力に、フィールド名 (`Status`) と SingleSelectField である必要がある旨を含める

## 既存機能への影響

- 既存ボード（status が揃っている）では挙動は変わらない
- 新規ボードでの初回 `add`/`publish` 実行時、option 作成のための API 呼び出しが追加で発生する

## 制約・前提

- 外部依存追加禁止（Node.js 組み込みのみ）
- alpha 期間ポリシー: 後方互換コードは書かない
- Status フィールド自体は存在することを前提とする

## エッジケース

- Status フィールド自体が存在しない → 要件 4 に従い停止
- option 作成が GitHub 側で失敗（権限不足等）→ エラーをそのまま伝搬
- 並行実行で 2 プロセスが同時に option 作成を試みた場合 → 後発が GitHub 側エラーで失敗。リトライは行わない

## テスト戦略

- 既存 `experimental/` テストのスタイル（構造的チェック中心）に合わせる
- 実 GitHub API への自動テストは行わない
- 動作検証は手動で実ボードに対して行う

## 検討した代替案

- **別途 `init` サブコマンドを追加**: ユーザーが明示的に初期化する必要がありフリクションが増える。Issue の第一の期待動作はオンデマンド自動作成だったため不採用。
- **Status フィールドごと自動作成**: ボード構造を意図せず変更してしまうリスク。スコープ外として案内に留める。
- **依存注入と mock テスト**: 既存テストは構造的チェック中心で軽量。スタイルを揃える方を優先。

## 将来の拡張性

- 必要になった場合に `init` サブコマンドを後から追加可能（既存の自動作成と二重化しても害は無い）
- 他の SingleSelect フィールドが必要になれば、同じ option 作成手段を再利用できる

## Q&A

### Q1: 対応アプローチ
**A: オンデマンド自動作成**
**根拠:** Issue #147 の "Expected Behavior" で第一に挙げられた期待動作。新規ボードでも追加コマンドなしで動作するためユーザーの摩擦が最小。

### Q2: 自動作成の対象範囲
**A: 参照される status を全て自動作成（`--status` で指定された任意の値も対象）**
**根拠:** 既存コードは任意の status 値を受け取れる構造になっており、「無ければ作る」原則を一貫して適用するほうが特殊ケースが増えない。

### Q3: Status フィールド自体が存在しない場合
**A: エラーで停止**
**根拠:** ガードレール「Backward-Compatible CLI Interface」「Impact on Existing Features」の精神に従い、ボード構造を意図せず変更するリスクを避ける。

### Q4: テスト戦略
**A: 構造的テストのみ**
**根拠:** 既存 `experimental/` テストは構造的チェック中心であり、スタイルを揃えるのが望ましい（既存コードパターン）。

## Open Questions

なし

## User Confirmation

- [x] User approved this draft (2026-04-14)
