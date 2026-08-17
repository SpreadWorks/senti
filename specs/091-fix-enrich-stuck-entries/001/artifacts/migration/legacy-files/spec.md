# Feature Specification: 091-fix-enrich-stuck-entries

**Feature Branch**: `feature/091-fix-enrich-stuck-entries`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User request

## Goal
- `docs enrich` の resume 判定を `summary` の有無から切り離し、AI 応答の欠落や空レスポンスがあっても同じ entry が不適切に再送され続ける挙動を解消する。

## Scope
- `src/docs/commands/enrich.js` の entry 完了判定の見直し
- 各 analysis entry に `enrich.processedAt` と `enrich.attempts` を保存する仕様追加
- 空レスポンスおよび一時的な AI 呼び出し失敗に対する再試行処理の追加
- `agent.retryCount` 設定の追加と `docs enrich` での利用
- 設定例と設定ドキュメントの更新

## Out of Scope
- `docs text`、`docs translate`、`docs forge` など他の agent 利用コマンドへの `agent.retryCount` 適用
- agent 共通のリトライ基盤化
- AI 応答に entry 自体が含まれない不具合の根本原因調査
- `summary`、`detail`、`chapter`、`role` の生成品質改善

## Clarifications (Q&A)
- Q: 空レスポンス時のリトライはどこまでを対象にするか
  - A: 空レスポンスに加えて、一時的な AI 呼び出し失敗も対象にする。待機時間は 3 秒固定で、回数は `agent.retryCount` で設定する。
- Q: `agent.retryCount` はどこで使うか
  - A: 今回は `docs enrich` のみで参照する。他の agent 利用コマンドには適用しない。
- Q: entry ごとの完了状態はどの形で保存するか
  - A: `enrich.processedAt` と `enrich.attempts` を持つ。`status` は導入しない。
- Q: `enrich.attempts` は何を表すか
  - A: その entry を AI 処理対象にした回数を表す。初回呼び出しを含む。
- Q: `summary` が空だった場合はどう扱うか
  - A: entry 自体が AI 応答に含まれていれば `enrich` メタデータを保存し、再送しない。entry 単位で `file`、`category`、`index` を含む `WARN` を出す。
- Q: AI 応答に entry 自体が含まれなかった場合はどう扱うか
  - A: 未処理のまま残し、次回も再実行する。
- Q: リトライ上限後も失敗したバッチはどうするか
  - A: それまでの進捗を保存してエラー終了する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-26
- Notes: issue #21 の修正方針として承認

## Requirements
1. R1 [P0]: `docs enrich` は entry の完了判定を `summary` の有無ではなく entry ごとの enrich メタデータで行わなければならない。
   Why this approach: `summary` 欠落は AI 応答の揺らぎであり、resume 判定に使うと同じ entry の無限再送を引き起こすため。
2. R2 [P0]: `docs enrich` は AI 応答に含まれた各 entry に対して `enrich.processedAt` と `enrich.attempts` を保存しなければならない。
   Why this approach: `processedAt` は処理時刻を示し、`attempts` はその entry を AI 処理対象にした回数を示すため、resume と将来の調査に使える。
3. R3 [P0]: `docs enrich` は `summary` が空でも entry 自体が AI 応答に含まれていれば、その entry を処理済みとして保存しなければならない。
   Why this approach: `summary` 欠落だけで未処理扱いに戻すと、issue #21 と同じ再送ループが再発するため。
4. R4 [P1]: `docs enrich` は `summary` が空の entry を保存する際、`file`、`category`、`index` を含む `WARN` ログを出さなければならない。
   Why this approach: 処理済みと可観測性を両立し、後続の調査対象を特定しやすくするため。
5. R5 [P0]: `docs enrich` は AI 応答に含まれなかった entry を処理済みにしてはならず、次回実行時も pending 対象として扱わなければならない。
   Why this approach: entry データは独立しており、batch 成功を理由に未返却 entry を完了扱いにするとデータ意味が崩れるため。
6. R6 [P0]: `docs enrich` は空レスポンスおよび一時的な AI 呼び出し失敗に対して 3 秒固定で再試行しなければならない。
   Why this approach: 既知の一時障害で全体停止しにくくしつつ、待機戦略を単純に保つため。
7. R7 [P0]: `docs enrich` は再試行回数を `agent.retryCount` から読み取り、未設定時は `1` を使わなければならない。
   Why this approach: リトライ回数だけをプロジェクトごとに調整可能にし、待機時間や他コマンドの挙動は今回のスコープ外に保つため。
8. R8 [P0]: `docs enrich` はリトライ上限後も失敗した場合、それまでに保存可能な進捗を保持した上でエラー終了しなければならない。
   Why this approach: 既存の resume フローを維持し、成功済み entry の再処理を避けるため。
9. R9 [P1]: 設定例と設定ドキュメントは `agent.retryCount` が `docs enrich` でのみ利用され、他コマンドでは未実装であることを示さなければならない。
   Why this approach: 共有設定名と実際の適用範囲の差異を仕様として明示し、誤解を防ぐため。

## Acceptance Criteria
1. When `analysis.json` 内の entry に `summary` がなくても `enrich.processedAt` が存在する Then 次回の `docs enrich` 実行でその entry は再送されない。
2. When AI 応答に `summary` を持たない entry が含まれる Then `docs enrich` はその entry に `enrich.processedAt` と `enrich.attempts` を保存し、`file`、`category`、`index` を含む `WARN` を出す。
3. When AI 応答に特定 entry 自体が含まれない Then その entry には `enrich` メタデータが保存されず、次回の `docs enrich` 実行で再送対象になる。
4. When `callAgentAsync()` が空レスポンスまたは一時的失敗を返す Then `docs enrich` は 3 秒待機して `agent.retryCount` 回まで再試行する。
5. When `.sdd-forge/config.json` に `agent.retryCount` がない Then `docs enrich` は再試行回数として `1` を使う。
6. When `agent.retryCount` を超えても batch が成功しない Then それ以前に成功した entry の進捗は保持され、コマンドはエラー終了する。
7. When 設定例または設定ドキュメントを参照する Then `agent.retryCount` の説明には `docs enrich` のみ利用し他コマンドは未実装であることが含まれる。

## Open Questions
- なし
