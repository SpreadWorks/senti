# Draft: Audit unused flow subcommands/options

**開発種別:** Enhancement
**目的:** flow の未使用サブコマンド/オプションを棚卸しし、keep / remove / integrate into skill に分類する。alpha ポリシーに従い後方互換コードを最小化しつつ、有用な機能はスキルに組み込んで活用する。

## 背景

flow にはスキル運用で参照されていないサブコマンド/オプションが残っており、CLI 表面積と保守コストを増やしている（Issue #140）。調査の結果、「未使用 = 不要」ではなく「スキルへの組み込みが未完了」なものが多いことが判明した。

## 分類表

### サブコマンド

| コマンド | 分類 | 判定根拠 |
|---|---|---|
| `flow set test-summary` | **integrate** | 完全実装済み。テスト件数をレポートに記録する機能。flow-plan の test ステップ完了時にスキルから呼ぶべき |
| `flow run lint` | **integrate** | 完全実装済み。guardrail lint パターンで変更ファイルをチェックする機能。flow-impl のチェック時にスキルから呼ぶべき |
| `flow run retro` | **integrate** | 完全実装済み（AI呼び出し）。spec vs 実装の一致度を事後評価する機能。flow-finalize のレポート生成時にスキルから呼ぶべき |

### オプション

| オプション | 所属コマンド | 分類 | 判定根拠 |
|---|---|---|---|
| `--skip-guardrail` | `flow run gate` | **keep** | デバッグ/開発時に AI guardrail チェックをスキップする用途で有用 |
| `--confirm-skip-guardrail` | `flow run gate` | **remove** | `--skip-guardrail` の二重確認安全装置だが、CLI 直接実行でも冗長。AI が呼ぶ場合は無意味 |
| `--message` | `flow run finalize` | **keep** | コミットメッセージの上書き。CLI 直接実行で有用 |
| `--dry-run` | `flow run sync` | **keep** | build+review のプレビュー。CLI 直接実行で有用 |

### その他

| 対象 | 分類 | 判定根拠 |
|---|---|---|
| `redo` メトリクスカウンター (constants.js) | **remove** | 書き込みパス (`metrics[phase].redo`) と読み取りパス (`flowState.redoCount`) が不一致。設計未完成。別 issue 81d4 で再設計 |
| `redoCount` 参照 (token.js) | **remove** | 上記と同じ。常に null/0 で difficulty 計算に寄与していない |
| AGENTS.md の `set/ ... redo` 記載 | **remove** | 対応するコマンド実装 (set-redo.js) が存在しない |
| `flow resume` | **スコープ外** | スキルの説明テキストに参照があるが、AIが呼ぶコードパスはない。スキル自体はコンパクション復帰で有用 |

## 実装スコープ

### In scope

1. **remove 対象の削除:**
   - `--confirm-skip-guardrail` のフラグ定義 (registry.js) と安全装置ロジック (run-gate.js) を削除
   - `redo` カウンター定義 (constants.js)、token.js の redoCount 参照、AGENTS.md の記載を削除

2. **integrate 対象のスキル組み込み:**
   - `flow set test-summary` → flow-plan スキル (SKILL.md) の test ステップ完了時に呼び出し手順を追加
   - `flow run lint` → flow-impl スキル (SKILL.md) の実装チェック時に呼び出し手順を追加
   - `flow run retro` → flow-finalize スキル (SKILL.md) のレポート生成時に呼び出し手順を追加

3. **分類表を spec に残す** — 判定根拠の永続化（受け入れ条件4）

### Out of scope

- `flow resume` の扱い
- redo ログ登録ロジックの再設計（別 issue 81d4）
- keep 対象（`--skip-guardrail`, `--message`, `--dry-run`）の変更

## CLI インターフェースの変更

- `--confirm-skip-guardrail` を削除する。`--skip-guardrail` 単独で guardrail スキップが有効になる（二重確認が不要になる）
- redo 関連は CLI 表面に露出していないため（カウンター定義と内部参照のみ）、ユーザー影響なし
- alpha 版のため正式な deprecation notice は不要。CHANGELOG への記載で周知する

## 制約

- alpha ポリシーに従い、migration plan は不要
- `src/templates/` のスキルテンプレートを変更した場合は `sdd-forge upgrade` を実行

## Q&A

1. **未使用コマンド/オプションは一括削除か？** → 一括削除ではなく、個別に keep/remove/integrate を判断する
2. **flow resume の扱いは？** → スコープ外。スキル自体は有用
3. **redo カウンターの扱いは？** → remove。設計未完成（パス不一致）。活用は別 issue 81d4
4. **migration plan は必要か？** → 不要（alpha ポリシー）
5. **オプション (--skip-guardrail, --message, --dry-run) の扱いは？** → keep。--confirm-skip-guardrail のみ remove
6. **サブコマンド (test-summary, lint, retro) の扱いは？** → integrate into skill
7. **スコープは？** → remove + integrate + 分類表。keep 対象は変更なし

- [x] User approved this draft

