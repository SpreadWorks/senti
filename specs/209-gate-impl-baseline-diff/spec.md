# Feature Specification: 209-gate-impl-baseline-diff

**Feature Branch**: `feature/209-gate-impl-baseline-diff`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #207

## Goal

gate-impl の AI 評価器が、base branch に既存の test failure を「新規に壊れたテスト」と誤 FAIL 判定する問題を解消する。flow 開始直後に baseline を取得し、gate-impl では baseline と head の structured summary を比較することで、spec 起因の test 変化のみを評価対象にする。

## Background

- gate-impl の `buildImplCheckPrompt` は head の `test-output.log` + `test.summary` のみを AI に渡す
- baseline に既に存在する failure は区別されず、guardrail `impl-test-conflict-escalation`（"Escalate When New Tests Break Existing Tests"）が誤発火する
- spec 199 で実害が確認された
- 本 spec は併せて test result ハンドリングを構造化 JSON 化し、gate-impl に生ログを投入する設計を廃止する

## Scope

1. `sdd-forge flow run tests --baseline` フラグの追加（baseline snapshot 取得）
2. `flow run tests` の要約パイプライン化: tool 実測 → 外部 agent 要約 → structured JSON を flow.json に保存
3. agent 要約失敗時の skill fallback 機構
4. `buildImplCheckPrompt` を生ログ投入から structured summary（baseline + head）投入に切り替え
5. `test.summary` / `test.baseline` のスキーマに `failed[]` 追加
6. skill `/sdd-forge.flow` の prepare 後に `--baseline` を自動実行する手順追加

## Out of Scope

- `flow run tests` のテストコマンド動的発見（AI による推論） — 別 spec、board hash `01be`
- `config.commands.test` の task/parent 2 粒度見直し・unit/e2e 個別指定 — 別 spec、board hash `58ff`
- ログ圧縮・失敗行抽出の汎用化（structured summary 採用で必要性が消滅）
- `MAX_LOG_BYTES` 等 prompt size 上限の根拠付け・config 化（structured summary により問題自体が縮小）

## Constraints

- **MUST NOT**: base branch で実際にテストを走らせる（並列実行 / detached worktree 実行）
- **MUST**: `config.commands.test.parent` 設定済みを前提とする（未設定プロジェクトの動的発見は別 spec）
- **MUST**: exitCode と tool 測定 counts は `flow run tests` subprocess 実測値を使用する（spec 198 tool monopoly を exitCode レベルで維持）
- **MUST**: structured summary の `failed[]` は agent 要約 or skill fallback 経由でのみ書き込まれる
- **MUST**: alpha 版ポリシーに従い、旧フォーマット（生ログのみの `buildImplCheckPrompt`）は削除し、互換コードを残さない

## Design Principles

- tool は実測、agent は要約、skill は調停: 責務を 3 層に分離
- 外部 agent に要約を任せることで実装中の skill AI のバイアス（「この失敗は既知だから OK」等の合理化）を遮断する
- baseline と head は対称的に扱う（同一スキーマ、同一コマンド、違いは保存先キーのみ）
- baseline 未取得 flow は gate を破壊せず、警告付きフォールバックで現行挙動に戻す

## Overview

### Modules

- `src/flow/lib/run-tests.js` — テスト実行後に agent 要約ステップを呼ぶよう拡張。`--baseline` フラグで保存先キーを切り替え
- `src/flow/lib/summarize-test-log.js` — **新規**。log テキスト + exitCode + counts を入力に agent.call() で JSON 要約を取得。スキーマ検証を行う
- `src/flow/lib/set-test-summary.js` — スキーマに `failed[]` を追加。fallback モード（skill 書き込み）を許可
- `src/flow/lib/run-gate.js` — `buildImplCheckPrompt` を structured summary 受け取りに書き換え。baseline 未取得時は警告 + head のみで旧来評価にフォールバック
- `src/flow/lib/get-test-result.js` — **削除**。gate-impl からは使われなくなる
- `src/flow/lib/test-log-parser.js` / `test-parser-loader.js` — **削除**。agent 要約が代替
- `src/presets/<*>/test-parser.js` — **削除**（存在すれば）
- `src/flow/registry.js` — `run tests` の args に `--baseline` 追加
- `src/templates/skills/sdd-forge.flow/SKILL.md` — prepare 後に `--baseline` 自動実行する指示を追記

### Data Flow

```
flow prepare --worktree
    │
    ├─ (skill が) flow run tests --baseline
    │      ├─ 1. CLI subprocess: npm test 実行 → logs/baseline-test-output.log + exitCode + counts
    │      ├─ 2. agent.call() で log 要約 → { failed[], validated JSON }
    │      │     失敗時: envelope.summarized = "failed"
    │      └─ 3. test.baseline = { exitCode, counts, failed[], summarized } を flow.json に保存
    │
    ├─ (skill fallback: summarized == "failed" の場合)
    │      Bash で logs/baseline-test-output.log を読み → JSON 組立
    │      → flow set test-summary --baseline --json @-
    │
    ├─ (implement 完了後)
    ├─ flow run tests  （同じ処理、保存先 test.summary）
    │
    └─ flow run gate --phase task-impl
           └─ buildImplCheckPrompt(spec, diff, test.baseline, test.summary)
                  ├─ baseline あり: 両 JSON を prompt に挿入、"escalate only when head.failed contains id absent in baseline.failed" を指示
                  └─ baseline なし: head のみで旧来評価 + warnings に "baseline not captured"
```

### Decisions

- agent 要約の prompt は固定テンプレート（hardcoded in `summarize-test-log.js`）。presetごとに差し替える必要はない
- skill fallback は `flow set test-summary --mode fallback --baseline --json @-` の形で実現（tool monopoly を exitCode に限定するフラグ）
- `logs/baseline-test-output.log` と `logs/test-output.log` は別ファイル。古い baseline log は `--baseline` 再実行で上書き

## Clarifications

- Q: baseline は base branch で取るか feature branch で取るか
  - A: feature branch prepare 直後（= base branch と同一コミット状態）で取る。制約「base branch で実行しない」に反しない
- Q: agent 要約失敗時はどうするか
  - A: skill が Bash で log を読み、JSON を組み立てて `flow set test-summary --mode fallback` で書き込む
- Q: gate-impl は baseline 未取得時にどう動くか
  - A: warnings[] に "baseline not captured" を付けて head のみで従来通り評価（機能無効を可視化しつつ既存 flow を破壊しない）

## Alternatives Considered

- **A: 現状 + baseline 生ログ（log 2 本投入）** — 最小改修だが prompt 最大 1MB に肥大し、preset-specific parser の将来的必要性も残る。却下
- **B: tool 実行 + skill AI が要約** — skill AI は実装中の文脈を持つため要約にバイアスが載る（「この失敗は spec と無関係」等の合理化）。却下
- **C（E-2a）: 外部 agent がテスト実行まで担う** — agent.call() 経由の shell 実行サポートが必要で下層インフラ改修が本 spec の範囲を超える。却下
- **採用（E-2b）: tool 実行 + 外部 agent 要約 + skill fallback** — 既存の `agent.call()` パターンを再利用、tool monopoly を exitCode レベルで維持、AI のバイアス経路を遮断

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: E-2b (tool 実測 + 外部 agent 要約 + skill fallback) で合意

## Requirements

優先度ラベル: **must** = 本 spec の中核機能、**should** = 安全性・既存挙動保護、**nice-to-have** = 品質向上。

### must（中核機能）

- **REQ-1** (must): When `sdd-forge flow run tests` が呼ばれたとき、CLI は subprocess でテストを実測し、stdout + stderr を `<workDir>/logs/test-output.log`（`--baseline` 指定時は `baseline-test-output.log`）に保存する。exitCode と builtin parser の counts を記録する。
- **REQ-2** (must): When `sdd-forge flow run tests` のログ保存後、CLI は `summarizeTestLog()` を呼び、agent.call() にログ + exitCode + counts を渡して `{ failed: [{id, reason}, ...] }` の JSON 要約を取得する。JSON Schema 検証に成功したら `test.summary.failed[]`（`--baseline` 指定時は `test.baseline.failed[]`）に保存する。入力ログは agent.call() に渡す前に末尾 256KB に切り詰める（既存 `MAX_LOG_BYTES` より小さい値で固定）。reason フィールドは最大 500 文字に切り詰める。failed[] の要素数は最大 100 件に制限する（超過時は先頭 100 件のみ保存）。
- **REQ-5** (must): When `sdd-forge flow run tests --baseline` フラグが指定されたとき、保存先キーは `test.baseline` になる。既存の `test.baseline` があれば上書きする。exitCode の tool monopoly lock は `test.summary` と `test.baseline` の両方に独立に適用する。
- **REQ-6** (must): When skill `/sdd-forge.flow` が `flow prepare` を完了したとき、続いて `sdd-forge flow run tests --baseline` を自動実行する。
- **REQ-7** (must): When `buildImplCheckPrompt` が呼ばれたとき、従来の生ログセクションは削除され、`## Baseline Test Results` と `## Head Test Results` の 2 セクションに structured JSON（`{exitCode, counts, failed[]}`）を挿入する。prompt には「escalate only when head.failed contains an id not present in baseline.failed」という差集合ルールの説明を含める。

### should（安全性・既存挙動保護）

- **REQ-3** (should): When agent.call() が失敗する（非 0 exit / タイムアウト / 不正 JSON）とき、CLI は envelope に `summarized: "failed"` + 失敗理由を設定する。この場合の CLI 終了コードは本来のテスト実行結果に従う（テスト PASS かつ要約失敗 → exit 0、テスト FAIL → exit = test exitCode）。要約失敗自体は致命エラーではなく skill fallback に委譲するため、非 0 終了にはしない。保存は exitCode + counts のみで止める。
- **REQ-4** (should): When `flow run tests` の envelope に `summarized: "failed"` が含まれるとき、skill `/sdd-forge.flow` は log ファイルを読み、JSON 要約を組み立てて `sdd-forge flow set test-summary --mode fallback [--baseline] --json @-` で保存する。fallback モードは exitCode / counts の既存値を変更せず、`failed[]` のみ書き込む。
- **REQ-8** (should): When `test.baseline` が未記録のまま gate-impl が呼ばれたとき、evaluations は head のみで従来通り行い、artifacts.warnings に `"baseline not captured"` を追加する。gate 結果自体は変更しない（PASS/FAIL の判定ロジックは baseline 有無で変えない）。
- **REQ-9** (should): When `set-test-summary.js` のスキーマ検証が行われるとき、`failed[]` 各要素は `{ id: string (1〜200 文字), reason: string (最大 500 文字) }` を満たすこと。validation 失敗時は CLI は非 0 終了コード（`TEST_SUMMARY_INVALID`）で停止する。
- **REQ-11** (should): When baseline 取得処理で致命エラー（NO_TEST_COMMAND / agent 初期化失敗 / ディスク書き込み失敗等）が発生したとき、CLI は envelope で error を返し、skill は警告メッセージを表示した上で flow を継続する。テスト実行失敗（exitCode != 0）は致命エラーではなく正常な baseline として記録される。

### nice-to-have（互換コード整理）

- **REQ-10** (nice-to-have): When 本 spec を実装するとき、alpha 版ポリシーに従い旧 `get-test-result.js` / `test-log-parser.js` / `test-parser-loader.js` および preset 配下の `test-parser.js` を削除する（後方互換コードを残さない）。

## Acceptance Criteria

- **AC1**: `sdd-forge flow run tests --baseline` を実行すると `<workDir>/logs/baseline-test-output.log` が作成され、flow.json の `test.baseline` に `exitCode`, `counts`, `failed[]`, `summarized` が記録される
- **AC2**: `sdd-forge flow run tests`（フラグなし）を実行すると `test.summary` に同様の構造で記録される
- **AC3**: agent が不在の状況（`agent.default` を無効な値に設定）で `flow run tests` を実行すると envelope の `summarized` が `"failed"` となり、例外にならず終了する
- **AC4**: `summarized: "failed"` 状態で skill fallback 経路（`flow set test-summary --mode fallback --json @-`）で failed[] を書き込むと、exitCode / counts は変更されず failed[] だけ更新される
- **AC5**: `flow set test-summary` で `failed` を含む不正な JSON（id 空文字列 等）を渡すとエラーで停止する
- **AC6**: `test.baseline` と `test.summary` が両方記録された状態で gate-impl を実行すると、prompt に 2 セクションの JSON が挿入され、差集合ルールが示される
- **AC7**: `test.baseline` 未記録の状態で gate-impl を実行すると、warnings に `"baseline not captured"` が含まれ、gate 結果自体は head のみで評価される
- **AC8**: 旧ファイル（`get-test-result.js`, `test-log-parser.js`, `test-parser-loader.js`, preset の `test-parser.js`）が削除されている
- **AC9**: skill SKILL.md の prepare ステップに `--baseline` 自動実行の指示が含まれる

## Implementation Targets

- `src/flow/lib/run-tests.js`
- `src/flow/lib/summarize-test-log.js` (new)
- `src/flow/lib/set-test-summary.js`
- `src/flow/lib/run-gate.js`
- `src/flow/lib/get-test-result.js` (delete)
- `src/flow/lib/test-log-parser.js` (delete)
- `src/flow/lib/test-parser-loader.js` (delete)
- `src/presets/*/test-parser.js` (delete if exists)
- `src/flow/registry.js`
- `src/templates/skills/sdd-forge.flow/SKILL.md`
- `tests/unit/flow/run-tests.test.js`
- `tests/unit/flow/summarize-test-log.test.js` (new)
- `tests/unit/flow/set-test-summary.test.js`
- `tests/unit/flow/run-gate.test.js`

## Open Questions

実装時に決定する詳細（本 spec の承認を阻害しない）:
- agent 要約の prompt で failed test の reason をどの程度切り詰めるか（例: 200 文字）
- skill fallback の JSON 組立プロンプトを SKILL.md に inline するか、partial ファイル化するか
