---
spec: 196-flow-tasks-extension
issue: 183
---

# Draft: flow 状態の task 分解基盤 (cac6/T2)

**開発種別:** 機能追加（基盤リファクタ）

**目的:** cac6「親 spec + task 分解モデル」を実現するためのデータ層基盤を導入する。flow 状態に task 構造を持たせ、状態管理レイヤが task スコープを扱えるようにする。cac6 全 11 タスクのうち 2 番目（T2）。T1（spec.json 化）と依存関係なし・並列可能。

（事前調査: issue 本文 / cac6 本文 / 既存の状態管理レイヤ関連ソースを確認した上で Q&A を実施）

## Requirements（優先度順）

### P1（必須・基盤）

- **R1** When 新しい flow を作成した時、shall その flow 状態は task 群を保持する構造と現在の task 指示を持つ初期値で保存される。
- **R2** When 新規 task を追加した時、shall cac6 本文で定義された属性（識別子・spec 参照・origin・親参照・進行状態・step 列・要件一覧・summary）を全て持つ。
- **R3** When task スコープの操作が実行された時、shall 「現在進行中の task」は flow 状態そのものから一意に決まる。
- **R4** When task 構造を持たない旧形式の flow 状態を読み込んだ時、shall 読み込みは失敗して終了する（alpha ポリシー「旧フォーマットを保持しない」に従う）。

### P2（必須・API）

- **R5** When 新規 task の追加が要求された時、shall 新しい task が flow 状態に記録され、現在の task 指示はその新規 task を指す。When task の完了が要求された時、shall 当該 task は完了状態となり、現在の task 指示は空になる。
- **R6** When 現在の task の参照または task 内 step の参照・更新が要求された時、shall 状態管理レイヤを通じてそれらが実行可能である。
- **R7** When 現在の task が存在する状態で既存の状態更新操作（メモ追加／要件設定／step 状態更新／メトリック加算／test summary 設定）を呼んだ時、shall 更新は task スコープに書き込まれる。When 現在の task が存在しない状態で同操作を呼んだ時、shall 更新は親スコープに書き込まれる。
- **R8** When 呼び出し側が scope を明示した場合、shall 既存操作は明示された scope に従って更新を書き込み、推論は行わない。

### P3（必須・派生）

- **R9** When 新規 task の初期化が起こった時、shall task の origin に応じた step 列が cac6 本文記載のパターンそのままに初期化される。
- **R10** When 現在の task が存在しかつ task 内 step が進行中の時、shall フェーズ判定はその task 内 step を基準に解決される。When 現在の task が存在しない時、shall フェーズ判定は flow レベル step を基準に解決される。
- **R11** When `npm test` を実行した時、shall 本変更前から存在する全テストが PASS し、かつ task API の新規ユニットテスト（公開 API 契約として配置）が PASS する。

### P4（優先度低・運用）

- **R12** When 本 spec の実装中に本 spec 自身の active flow 状態へ状態更新操作を適用した時、shall その操作は成功し、flow 状態は新形式として保存される。
- **R13** When 本変更がマージされる時、shall 他の active flow 所有者向けの移行通知と手順が spec または PR 説明に含まれる。

## Scope

- 状態管理レイヤ全体を task スコープ対応に拡張する（flow 状態の I/O・状態操作 API・フェーズ判定ヘルパ）。
- 新規 flow 作成時に task 用フィールドの初期値が書かれるようにする。
- 既存 `flow set *` 系 CLI は外部挙動不変のまま scope 推論が効く範囲で更新する。
- 公開 API 契約の正式テストとして状態管理レイヤのユニットテストを追加する。

## Out of Scope

- 旧形式 flow 状態の一括マイグレーションスクリプト — **T11（053d）担当**。
- CLI / gate / review / finalize / run コマンド群の広範な書き換え — **T3〜T7** で段階対応。
- skill 統合（3 skill → 1 skill）— **T7（a7b4）担当**。
- next-action CLI 新設 — **T5（49df）担当**。
- guardrail 3 層化 — **T3（8377）担当**。
- spec.md → spec.json プライマリ化 — **T1（4b8e）/ T8（865c）担当**。
- 並列 task 実行 — **9c3c（外部エージェント委譲）**別案件。

## Impact on Existing Features

- **破壊的変更**: flow 状態のスキーマが変わる。旧形式の読み込みは失敗する。
- 完了済み（非 active）の旧形式状態は通常読み込まれないため運用影響はない（スキャン系 API は単純な JSON 読み取りのみで形式検証を行わない）。
- 他 active flow がある場合、所有者が手動で新形式へ合わせる必要がある。本 spec は単独で active である前提で進める（作業開始前に active 一覧の確認が必要）。
- `flow set *` コマンド群の外部挙動（CLI からの使い方）は変わらない。scope 推論は内部で透過的に行われる。alpha 方針に従い後方互換分岐は持たない。
- 既存の flow レベル step 列挙は維持しつつ、task レベル step 列挙を別系統として追加する。

## Alternatives Considered

1. **旧形式の flow 状態を読み込み時に暗黙正規化** — 却下。alpha 方針「旧フォーマット・非推奨パスは保持しない」と緊張。明示的失敗のほうが未移行の active flow を早期検出できる。**基盤**: CLAUDE.md「alpha 版ポリシー」。
2. **current task を `status === "in_progress"` から毎回推論（永続化なし）** — 却下。状態解決が実装分散し、並列化時のリネームコストも大差ない。**基盤**: 単一責任で状態管理レイヤに集約する設計原則。
3. **最初から複数 task を同時に保持できる設計にする** — 却下。cac6 本文「並列化用の拡張点を事前に作らない」に抵触。将来 alpha 内で破壊的に拡張可能なため、単一 task 前提で開始が整合する。**基盤**: cac6 本文 + CLAUDE.md「仮想の将来要件のために設計しない」。
4. **T2 内で CLI / gate / run を全部書き換える** — 却下。T3〜T11 とコンフリクトし、段階実装の恩恵が消える。**基盤**: cac6 本文「task 単位で gate → impl → test → review を回す」方針に従う分解。

## Future Extensibility

- **並列実行**: 単一 task 保持から複数 task 保持へ拡張。scope 推論を「呼び出し側が指定必須」に厳格化。alpha 方針で破壊的変更が許容されるため低コスト。
- **test-first 分解**（write-tests / run-tests）: T4 で task step 初期化の分岐を拡張するだけで対応可能。
- **guardrail 3 層化**: T3 で gate 側に導入する際、状態管理レイヤが既に scope 対応済みなので基盤側の追加改修不要。
- **next-action CLI**: T5 で状態管理レイヤの task 取得系 API を直接利用できる。

## Q&A

### Q1: 解釈確認
- **AI 推奨**: issue 本文どおり（flow 状態への task 構造導入・状態管理レイヤの task API 追加・既存操作の scope 対応・alpha 破壊的変更）。**基盤**: [docs/] issue #183 本文 + cac6 本文の構造変更セクション。
- **User（決定）**: [1] はい。

### Q2: T2 スコープ境界（データ層のみ vs 最小 CLI 配線 vs 広範書き換え）
- **AI 推奨**: データ層＋最小 CLI 配線。**基盤**: [docs/] cac6 本文「並列性: T1 と並列可能（基盤）」／[guardrail 原則] CLAUDE.md「仮想の将来要件のために設計しない」。
- **User（決定）**: T2 に issue 本文記載の全範囲（既存メソッドの scope 対応まで）を含める。gate / run / skill 等の広範再配線は含めない。
- 事前に「ブレインストーミング or 決定」を確認: User から明確な決定指示あり、AI はトレードオフを提示後に決定を待機した。

### Q3: 旧形式 flow 状態の扱い（暗黙正規化 vs 明示失敗）
- **AI 初期推奨**: 正規化（新規フィールドの初期値補完として）。**基盤**: [既存コードパターン] 他の load 系ヘルパで欠損フィールドを初期化する事例。
- **User**: [2] strict に決めたいが完走可能か？
- **AI 補足**: 本 spec 自身の active flow 状態を先に新形式へ整え、その上で strict 化を導入する段取りで完走可能。他 active flow が並行していないことの確認が前提。**基盤**: [guardrail 原則] CLAUDE.md「alpha 版ポリシー: 後方互換コードを書かない」。
- **User（決定）**: [2] strict throw 採用。

### Q4: current task の保持（永続 vs 推論、および並列余地）
- **AI 初期推奨**: status 推論（永続化なし）。**基盤**: [既存コードパターン] 現状の derivePhase が step の in_progress を見て推論している実例。
- **User 提案**: ファイル永続の可能性は？
- **AI 修正案**: 案 A（flow 状態の中に現在 task 指示子を持たせる）／案 B（状態ファイルとは別に指示子用ファイルを置く）。**基盤**: [既存コードパターン] flow 状態を単一ファイルで一元管理している既存方針。
- **User 指摘**: 単数だと並列不可。
- **AI 応答**: [docs/] cac6 本文「並列化用の拡張点を事前に作らない」。
- **User 指摘**: 実装せずとも考察は禁止ではない。
- **AI 拡張考察**: 将来並列時は単数→複数への拡張で対応可能、alpha で破壊的許容。**基盤**: [guardrail 原則] CLAUDE.md「alpha 版ポリシー」。
- **User（決定）**: [1] 単一の現在 task 指示子を flow 状態内に保持（将来の並列化時に破壊的拡張する前提）。

### Q5: task の初期 step 構成（cac6 記載 vs test-first 分解先取り）
- **AI 推奨**: cac6 記載どおり 2 パターン。**基盤**: [docs/] cac6 本文記載の step 列。test-first 分解は T4（164a）担当の範囲。
- **User（決定）**: [1] 採用。

### Q6: テスト配置（正式テスト vs spec 検証テスト）
- **AI 推奨**: 正式テストとして配置。**基盤**: [guardrail 原則] SDD ガイド「公開 API 契約 / 破壊が常に bug なら正式テスト」判定基準。状態管理レイヤは公開 API 契約に該当。
- **User（決定）**: 採用。

## Open Questions

なし。実装詳細は spec 作成フェーズで確定する。

## Approval

- [x] User approved this draft

承認日: 2026-04-19
