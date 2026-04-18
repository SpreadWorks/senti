---
issue: 171
title: record-phase-duration
---

# Draft: record-phase-duration

**開発種別:** ENHANCE

**目的:** flow.json の `metrics.<phase>` に AI agent 呼び出しの実行時間を積算し、phase ごとの AI 稼働時間を可視化する。

## Background

- 現状 `metrics.<phase>` には tokens / cost / callCount / responseChars しか記録されておらず、phase ごとの所要時間が分からない。
- 壁時計時間は回答待ち・中断を含むためノイズが大きく分析に使えない。
- AI agent が実際に稼働した時間のみを取ることで、phase 単位のボトルネック（plan vs impl 等）を可視化できる。

## Scope

- AI agent 呼び出しの spawn 開始〜プロセス終了の実行時間を phase 単位で積算し、metrics に保存する。
- flow report コマンドと metrics token コマンドの出力に duration を表示する。
- 表示形式は秒（小数1桁、例: `12.3s`）。

## Out of Scope

- phase の壁時計 start/end タイムスタンプ記録（別 spec で検討）。
- AI agent 呼び出し以外（テスト実行、ファイル IO 等）の実行時間計測。

## Impact on Existing

- `metrics.<phase>` に新フィールド `durationMs` が増える。既存 reader は無視可能。
- flow report / metrics token の出力テキストが変わる（duration の行・列が追加）。

## Migration / Compatibility

- flow report / metrics token のコマンド名・オプション・終了コードに変更はない。
- 出力に新しい行・列が追加されるのみ（既存項目の削除・改名なし）。機械的にパースしている利用者には列追加として現れる。
- alpha 版ポリシーに従い互換モード・切替フラグは設けない。リリースノートで出力変更を告知する。

## Requirements (priority order)

優先度は上位ほど高い（R1 が最優先）。各要件は「When / If ... shall ...」形式で trigger と期待動作を記述する。

- **R1 (critical):** When an AI agent is invoked while a flow phase is active, the system shall measure the execution time from spawn start to process exit and accumulate it into the phase's duration metric. If retries occur within a single invocation, the accumulated value shall include all attempts.
- **R2 (critical):** When the metrics persistence layer receives an invocation record with phase context, it shall add the measured duration (ms) to the phase's total. If no phase is associated with the invocation, the system shall skip duration accumulation.
- **R3 (high):** When the user runs the flow report command on a flow containing duration metrics, the output shall display per-phase duration in seconds with one decimal digit (e.g., `12.3s`).
- **R4 (medium):** When the user runs the metrics token command, the output shall include a per-phase duration column alongside the existing token columns.

## Acceptance Criteria

- flow 実行後、`flow.json` の `metrics.<phase>.durationMs` が agent 実行時間の合計（ms）を保持している。
- flow report の text 出力に phase ごとの duration が `12.3s` 形式で表示される。
- metrics token の出力に duration 列が含まれる。
- 既存のテストがすべてパスし、新規テストも追加されてパスする。

## Alternatives Considered

- **phase 全体の壁時計時間を測る案**: Issue #171 の前提（壁時計時間はノイズ）と矛盾するため不採用。phase start/end タイムスタンプは別 spec で扱う。
- **成功 attempt のみ計測**: 失敗 attempt も「AI が稼働した時間」であり除外は不自然。全 attempt 合計を採用。
- **表示を人間可読形式（`1m 23s`）**: 比較・集計しにくいため不採用。秒小数1桁に統一。

## Future Extensibility

- phase 壁時計 start/end を別フィールド（例: `startedAt` / `endedAt`）として追加可能。本 spec の `durationMs` と直交。
- metrics 日付軸リファクタ（別ボード e99e）で metrics 構造が変わっても、`durationMs` は phase 単位の accumulator として素直に移行できる。

## Test Strategy

- duration 積算が metrics に正しく反映されることを単体テストで検証する。
- agent 実行経路で計測値が永続化側に伝搬することを単体テストで検証する。
- flow report / metrics token の出力に duration が表示されることを検証する。
- 配置方針: 公開 API・コマンド契約に関わるため formal test として維持する。

## Q&A

### Q1: Issue #171 の理解は正しいか

**AI 推奨:** [1] はい（基は Issue #171 本文: 「agent 呼び出しごとの実行時間を phase 単位で積算し、`metrics.<phase>.durationMs` として保存」。回答待ち時間は除外する旨も Issue に明記）。

**User 回答:** [1] はい。

### Q2: 計測スコープ（phase 壁時計時間を含めるか）

**User 相談:** 各 phase の start/end も取りたい。これは別 spec にすべきか（brainstorm）。

**AI は brainstorm モードと確認した上で推奨提示:**

**AI 推奨:** 別 spec にする。**基の根拠 (1) Issue 本文:** #171 は壁時計時間を明示的にノイズとして除外している。**(2) guardrail: Single Responsibility:** 1 spec 1 関心事。**(3) 計測点・データ意味が異なる:** active time は agent 層、wall clock は status 遷移層。

**User 回答:** 了承（#171 は AI active time スコープで進める）。

### Q3: retry 時の計測範囲

**AI 推奨:** [1] 全 attempt の合計時間。**基の根拠 (1) Issue 本文:** 「AI が稼働した時間」が目的。失敗 attempt も AI は稼働している。**(2) 既存のログ計測タイミング:** 既存実装は retry ループ全体を内包する位置で時刻を取っており、自然に合計になる。

**User 回答:** [1]。

### Q4: 表示単位

**AI 推奨:** [1] 秒（小数1桁）。**基の根拠 (3) 既存出力慣習:** token / cost も固定小数で出している。人間可読形式は長短で表記が変わり集計・比較に不向き。

**User 回答:** [1]。

### Q5: metrics token コマンドへの duration 列追加

**AI 推奨:** [1] 追加する。**基の根拠 (1) Issue 本文:** 「時間あたりトークン効率の評価」が期待効果に挙げられており、token コマンドに duration がないとこの目的を達成できない。

**User 回答:** [1]。

### Q6: テスト戦略

**AI 推奨:** 永続化・agent・コマンド出力の3層で単体テストを追加し、公開 API・コマンド契約として formal test に置く。**基の根拠 (3) 既存テスト配置:** 既存 metrics 関連テストは formal test として維持されており、同じ方針を継承するのが自然。

**User 回答:** [1]。

## User Confirmation

- [x] User approved this draft
- Approved: 2026-04-18
