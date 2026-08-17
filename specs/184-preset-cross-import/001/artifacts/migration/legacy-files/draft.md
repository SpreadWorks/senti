## Draft: 外部プリセット間のクロスimport

**開発種別:** ENHANCE

**目的:** 外部プリセット（`.sdd-forge/presets/` および `~/.sdd-forge/presets/`）が、他のプリセット（ビルトインを含む）のクラスを `import 'sdd-forge/presets/<name>/<subpath>'` の形式で参照できるよう、sdd-forge の module 解決を拡張する。これにより、ユーザー定義プリセットの継承（例: `my-webapp` を継承した `my-specific-app`）が、配置場所に依存せず動作する。

## モード

本 draft はブレインストーミングではなく **決定事項** として記録する。代替案は Q&A で検討済みで、記載の要件は実装対象として確定。

## 背景

Issue #129（`sdd-forge/api` 公開エントリポイントと module loader hook）で、外部ファイルが sdd-forge の基底クラスを `import 'sdd-forge/api'` で参照できるようになった。しかし、外部プリセット**同士**のクロスimport（例: プロジェクトローカル `.sdd-forge/presets/my-specific-app` がユーザーグローバル `~/.sdd-forge/presets/my-webapp` の DataSource を継承する）は未解決のまま残っている。

## スコープ

### In Scope

- 3 層（プロジェクト / ユーザー / ビルトイン）にまたがるプリセット参照を `sdd-forge/presets/<name>/...` の単一ネームスペースで解決できるようにする
- 既存の `sdd-forge/api` 等の参照形式は変更しない

### Out of Scope

- プリセット継承（`preset.json` の `parent` チェーン）の動作変更
- ディレクトリ index 形式の import 解決
- 永続化キャッシュ
- JavaScript 以外のファイル解決

## 要件（優先度順）

**P1（必須 — これがなければ目的を達成できない）**

- **REQ-1:** `sdd-forge/presets/<name>/<subpath>` 形式の import を受けた場合、システムはプロジェクト層 → ユーザー層 → ビルトイン層の順で該当ファイルの存在を確認し、最初に見つかった層のファイルとして解決しなければならない（shall）。
- **REQ-2:** 3 層いずれにも該当ファイルが存在しない場合、システムは Node 標準の module 解決エラー処理に委ねなければならない（shall）。

**P2（重要 — 既存機能への回帰防止）**

- **REQ-3:** `sdd-forge/presets/` プレフィクスに一致しない既存の `sdd-forge/<subpath>` 形式 import（例: `sdd-forge/api`）を受けた場合、システムは従来と同じ解決結果を返さなければならない（shall）。

**P3（非機能 — 性能）**

- **REQ-4:** 同一 specifier の 2 回目以降の解決時、システムはファイルシステムへの探索アクセスを行わず、初回解決結果を再利用しなければならない（shall）。キャッシュはプロセス寿命内で有効であればよい。

## 既存機能への影響

- **外部プリセットのローダー挙動**: 新プレフィクス処理が追加されるが、既存の `sdd-forge/api` など他の specifier の解決結果は変更されない。
- **ビルトインプリセット**: 内部相対 import を使用しているため影響なし。
- **既存テスト**: 新規ロジックは既存経路と独立に動作するため影響なし。

## 代替案の検討

- **単数形ネームスペース `sdd-forge/preset/<name>/...`**（Issue 本文の原案）: 新規ネームスペースとして明確だが、既存の `sdd-forge/presets/` (複数形) との対称性が崩れる。**不採用**。
- **fs 永続キャッシュ**: 探索コストを削減できるが、ファイル追加時の無効化ロジックが必要でコード複雑度が増す。CLI プロセスは短命のため in-memory で十分。**不採用**。

## Q&A

### Q1: Issue の解釈
**A:** 外部プリセットが `import 'sdd-forge/presets/<name>/...'` の形で他プリセットのクラスを参照できるよう、loader hook を 3 層探索に拡張する。ユーザー承認済み。

### Q2: ネームスペース形式（単数 vs 複数）
**A:** 既存の `sdd-forge/presets/` (複数形) ネームスペースを 3 層探索に拡張する。Issue 本文の単数形案は不採用。

### Q3: 3 層探索の優先順位
**A:** プロジェクト → ユーザー → ビルトイン。Issue 記載の順序に従い、既存の「近い層が優先」パターンと整合。

### Q4: キャッシュ方式
**A:** プロセス内 in-memory のみ。CLI プロセスは短命のため fs 永続キャッシュは過剰設計。

### Q5: スコープ境界
**A:** 拡張子は `.js` 前提、ディレクトリ index はサポート外、`preset.json` の有無は解決ロジック非関与、見つからない specifier は Node 標準エラーに委ねる。

## User Confirmation

- [x] User approved this draft
- 確認日: 2026-04-17
