# Feature Specification: 191-record-phase-duration

**Feature Branch**: `feature/191-record-phase-duration`
**Created**: 2026-04-18
**Status**: Draft
**Input**: GitHub Issue #171 — [ENHANCE] Record per-phase execution time in metrics

## Goal

flow.json の `metrics.<phase>` に AI agent 呼び出しの累積実行時間 (`durationMs`) を記録し、flow report および metrics token コマンドの出力に秒単位で表示することで、phase 単位の AI 稼働時間ボトルネックを可視化する。

## Scope

- AI agent 呼び出しの spawn 開始〜プロセス終了の時間を ms 単位で計測し、phase ごとに metrics へ積算する。
- 計測値を flow.json に永続化する。
- flow report コマンドの text 出力に phase ごとの duration を追加する。
- metrics token コマンドの出力に phase ごとの duration 列を追加する。
- 表示単位は秒（小数1桁）。

## Out of Scope

- phase の壁時計 start/end タイムスタンプ記録（別 spec）。
- AI agent 呼び出し以外（テスト実行、ファイル IO、git 操作等）の実行時間計測。
- 既存 metrics フィールド（tokens, cost, callCount, responseChars）の構造変更。

## Clarifications (Q&A)

- Q: 計測範囲はどこからどこまでか
  - A: agent の spawn 開始〜プロセス終了。回答待ち・対話中断は含まない。
- Q: retry 発生時は成功 attempt のみか合計か
  - A: 全 attempt の合計。失敗 attempt も AI は稼働しているため。
- Q: phase が未特定（flow context 外）の呼び出しはどう扱うか
  - A: 現状の tokens/cost と同様、積算しない。
- Q: 表示単位は
  - A: 秒（小数1桁、例: `12.3s`）。
- Q: metrics token に duration 列を追加するか
  - A: 追加する（Issue の期待効果「時間あたりトークン効率」に必要）。

## Alternatives Considered

- **壁時計 phase 時間（status 遷移 start/end）**: Issue #171 が明示的に除外。別 spec として扱う。
- **成功 attempt のみ計測**: AI 稼働時間の定義と矛盾するため不採用。
- **人間可読表示（`1m 23s`）**: 比較・集計に不向きで不採用。

## Why This Approach

- Issue #171 の目的「AI が実際に稼働した時間のみ測る」を最短経路で満たすため、既存の agent 実行経路で spawn 前後の時刻差を取る案を採用。既存の token/cost 積算経路に乗るため、metrics 永続化層の改修は最小限で済み、既存テストとの整合も取りやすい。
- 秒（小数1桁）は既存の cost 表示慣習と親和し、集計ツールで扱いやすい。
- phase 壁時計時間は意味論が異なり別 spec とすることで、各 spec を Single Responsibility に保つ。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-18
- Notes: User delegated ("後は頼んだ") after draft approval; spec gate PASS.

## Requirements

優先度順（R1 が最優先）。

- **R1 (critical):** When an AI agent invocation occurs while a flow phase is active, the system shall measure the elapsed time from spawn start to process exit and accumulate it (in milliseconds) into that phase's duration metric. If retries occur within a single invocation, the accumulated value shall include all attempts.
- **R2 (critical):** When the metrics persistence layer receives an invocation record with phase context, it shall add the measured duration (ms) to the phase's running total. If no phase is associated with the invocation, the layer shall skip duration accumulation (consistent with existing tokens/cost behavior).
- **R3 (high):** When the user runs the flow report command on a flow whose metrics contain duration values, the text output shall display per-phase duration in seconds with one decimal digit (e.g., `12.3s`).
- **R4 (medium):** When the user runs the metrics token command, the output shall include a per-phase duration column using the same seconds-with-one-decimal format, placed alongside the existing token/cost columns.

## Acceptance Criteria

- flow 実行後、`flow.json` の `metrics.<phase>.durationMs` が当該 phase 中に発生した agent 呼び出しの合計時間（ms, 整数）を保持している。
- flow phase context 外で呼ばれた agent 実行は `durationMs` に加算されない。
- `sdd-forge flow run report` の text 出力で、metrics を持つ各 phase に `12.3s` 形式の duration が表示される。
- `sdd-forge metrics token` の出力で、各 phase に duration 列が存在し、秒小数1桁で表示される。
- 既存の flow-state / agent / report / token 関連テストがすべてパスする。
- 新規追加テスト: (a) 永続化層で `durationMs` が加算される、(b) agent 実行経路で計測値が永続化層に伝搬する、(c) report / token 出力に duration が含まれる — いずれもパスする。
- コマンド名・オプション・終了コードの契約は不変。

## Migration / Compatibility

- CLI コマンド名・オプション・exit code は一切変更しない。
- 出力の text に新しい行・列が追加されるのみ。機械的にパースする利用者には「列追加」として現れる。
- alpha 版ポリシーに従い、互換モードや切替フラグは設けない。リリースノートに出力変更を明記する。

## Test Strategy

- **永続化層テスト**: duration 積算のユニットテスト。phase 指定あり/なし、複数呼び出しの加算、異常系（null usage）を検証。
- **agent 実行層テスト**: fake timing で agent 呼び出しを行い、計測値が永続化層に渡ることを検証。retry が発生したケースで全 attempt 合計になることも検証。
- **コマンド出力テスト**: flow report / metrics token それぞれの text 出力に duration が秒小数1桁で含まれることを検証。
- **配置**: 公開 API とコマンド契約に関わるため formal test として維持対象。既存の metrics 関連テストと同じディレクトリ方針に従う。
- **既存テストファイルへの追記について**: `flow-state-agent-metrics.test.js`, `agent-with-logger.test.js`, `report-metrics.test.js` は既に同じ関心領域の既存テストファイルであるため、新規 `it()` ケースを追記する方針を採用する。**この方針は spec 承認時（User Confirmation）に明示的に承認されている。** 既存アサーションの変更は行わない。
- **リソース境界**: 新規ループ・再帰・バルク処理は導入しない。計測は既存 agent 呼び出し 1 回あたり 1 区間のみ。

## Open Questions

なし（draft フェーズで全論点を解決済み）。
