# Draft: 050 - CLI コマンド体系の再構築

**Status**: Draft
**Created**: 2026-03-14

## 背景

- 20以上のコマンドがフラットに並んでおり、体系が見えにくい
- `sdd-forge` の印象がドキュメントジェネレーターに偏っている
- docs はプロダクトの一部であり、spec / flow と並列の関心事として整理すべき

## 合意事項

### 3つの名前空間

```
sdd-forge docs <sub>    ← ドキュメント生成
sdd-forge spec <sub>    ← 仕様管理
sdd-forge flow <sub>    ← ワークフロー自動化
```

### 独立コマンド

```
sdd-forge setup          ← プロジェクト初期設定
sdd-forge upgrade        ← テンプレート更新
sdd-forge help           ← ヘルプ
sdd-forge presets        ← プリセット一覧
```

### コマンドマッピング（旧 → 新）

| 旧 | 新 |
|---|---|
| `sdd-forge build` | `sdd-forge docs build` |
| `sdd-forge scan` | `sdd-forge docs scan` |
| `sdd-forge enrich` | `sdd-forge docs enrich` |
| `sdd-forge init` | `sdd-forge docs init` |
| `sdd-forge data` | `sdd-forge docs data` |
| `sdd-forge text` | `sdd-forge docs text` |
| `sdd-forge readme` | `sdd-forge docs readme` |
| `sdd-forge forge` | `sdd-forge docs forge` |
| `sdd-forge review` | `sdd-forge docs review` |
| `sdd-forge translate` | `sdd-forge docs translate` |
| `sdd-forge changelog` | `sdd-forge docs changelog` |
| `sdd-forge agents` | `sdd-forge docs agents` |
| `sdd-forge snapshot` | `sdd-forge docs snapshot` |
| `sdd-forge spec` | `sdd-forge spec init` |
| `sdd-forge gate` | `sdd-forge spec gate` |
| `sdd-forge guardrail` | `sdd-forge spec guardrail` |
| `sdd-forge flow` | `sdd-forge flow <sub>`（変更なし） |
| `sdd-forge setup` | `sdd-forge setup`（独立化、docs/commands/ から移動） |
| `sdd-forge upgrade` | `sdd-forge upgrade`（独立化、docs/commands/ から移動） |

### ファイル配置

- `src/docs/commands/setup.js` → `src/setup.js`
- `src/docs/commands/upgrade.js` → `src/upgrade.js`
- `src/specs/` → `src/spec/`（ディレクトリ名を単数形に統一）
- `src/` 直下のファイル数は 8 で、追加のディレクトリ作成は不要

### 設計原則

- `build` はショートカットにせず `docs build` に統一（ドキュメントジェネレーター的印象を避ける）
- alpha 版ポリシーにより後方互換は不要

## Resolved Questions

- `sdd-forge docs` 引数なし → docs のサブコマンド一覧を表示
- `sdd-forge spec` 引数なし → spec のサブコマンド一覧を表示（flow と同様）
- `sdd-forge help` → 名前空間ごとのグループ表示

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-03-14
