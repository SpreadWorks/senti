# Feature Specification: 253-repeated-fail-jaccard

**Feature Branch**: `feature/253-repeated-fail-jaccard`
**Created**: 2026-05-08
**Status**: Draft
**Input**: GitHub Issue #313

## Goal
重複 FAIL 検出 (`assertNoRepeatedFail`) の比較方式を、現行の (guardrail_id, normalize された reason) の byte-equal 比較から、word set ベースの Jaccard 類似度比較に置き換える。同 guardrail_id の過去すべての同 phase FAIL に対する最大類似度が JACCARD_THRESHOLD (= 0.5) 以上のとき escalate する。これにより AI 生成 reason の wording 揺れに対しても escalation が機能する。閾値は内部定数で後から調整できる。

## Background
現行の重複 FAIL 検出 (run-gate.js:1158 周辺の assertNoRepeatedFail) は (guardrail_id, normalize された reason) の byte-equal 比較を行っている。AI 生成 reason は iter ごとに wording が微妙に揺れるため、人間には同じ指摘でも escalate せず retry budget を最大 5 iter まで浪費する。これによりもぐら叩きループ対策シリーズ (dbf7 / b808 / 44e2) の主目的が満たされない。issue #313 は本問題に対し、word set ベースの Jaccard 類似度で比較するよう変更することを要求する。issue 本文は閾値 0.4 を提案するが、本実装の normalize 規則で実測した結果、issue 本文の 11 ケース中 2 件 (215 complete-context / 236 draft-scope-boundary) で誤 escalate (false positive) が発生する。このため本 spec では閾値を 0.5 に引き上げて運用開始する。閾値は内部定数のため後から調整できる。

## Scope
- src/flow/lib/run-gate.js の重複 FAIL 検出ロジック (buildFailPairKey / assertNoRepeatedFail / findPreviousFailedEvaluations) の変更
- 新規 helper の追加: normalize(text), jaccard(a, b)、内部定数 JACCARD_THRESHOLD = 0.5 (調整可能、ソース定数), STOPWORDS
- obsolete になる normalizeReason / buildFailPairKey の削除
- tests/unit/flow/gate-repeat-escalate.test.js の更新 (既存ファイル、内容を新方式に対応)
- specs/253-repeated-fail-jaccard/tests/253-jaccard.test.js の新規作成 (spec ヘッダー `// spec: R1 R2 R3 ...` 付きで R1-R10 をカバー)
- specs/228-stabilize-plan-phase-gate/tests/plan-phase-gate-guards.test.js の REQ-3 ブロック fixture 更新
- synthetic 高/低/境界類似度 fixture を tests/unit/flow/gate-repeat-escalate.test.js に追加し、閾値 0.5 が正しく機能することを検証する (issue #313 本文の 11 ケースは spec の参考情報として残すが、自動テスト fixture には組み込まない)
- escalation error の付帯情報拡張 (err.data.matched[] のスキーマを {guardrail_id, currentReason, priorReason, similarity} に置換)

## Out of Scope
- もぐら叩き型ループ対策 (dbf7 / b808 / 44e2 系) の追加・改修
- acknowledged exception 機構の改修
- Levenshtein / embedding 等の高度な意味類似度
- 閾値 0.5 の動的設定 (環境変数 / config 経由)
- 重複 FAIL 検出対象の phase 範囲変更 (RETRY_TRACKED_PHASES の編集)
- issue-log.json の永続スキーマ変更 (failedEvaluations の {guardrail_id, reason} 形は維持)
- 外部依存の追加 (kuromoji 等の Unicode tokenizer 含む)
- assertNoRepeatedFail / findPreviousFailedEvaluations / buildFailedEvaluations の関数シグネチャ変更
- specs/228-stabilize-plan-phase-gate/spec.md / spec.json / その他過去 spec のドキュメント本文の文言更新 (履歴的記述で実行可能 test ではないため、本タスクで触らない。実 test である plan-phase-gate-guards.test.js のみ更新する)
- specs/212-gate-impl-repeat-escalate/tests/README.md の更新 (履歴的なテストドキュメントで現在 test 実行に影響しないため、stale 状態を許容する)
- appendIssueLogFromGateError が ESCALATE_REPEATED_FAIL 例外を issue-log に記録する際の永続データ拡張 (現状どおり err.message のみを永続化、structured match data は persistent log には乗せない。retry counter 動作も既存どおり)

## Constraints
- Node.js 組み込みモジュールのみで実装する (外部依存追加禁止、プロジェクト alpha 政策)
- 閾値 0.5 は固定値、source code の定数 JACCARD_THRESHOLD として持つ (動的設定不可、運用観察を経て将来ソース修正で調整)
- normalize は ASCII ベース (`\w` = `[A-Za-z0-9_]` を採用)。CJK 等の非 ASCII 文字は記号同様に空白置換される。本格的な多言語 tokenization は外部依存が必要なため対応しない
- alpha 政策により旧 API (normalizeReason, buildFailPairKey) は削除し後方互換コードは書かない
- assertNoRepeatedFail のシグネチャ ({issueLog, phase, currentEvaluations}) と err.code = 'ESCALATE_REPEATED_FAIL' / err.data.phase は外部互換のため維持する
- issue-log.json の永続データ形式 (failedEvaluations[] の {guardrail_id, reason} オブジェクト) は変更しない
- 走査範囲の bounded resource: prior FAIL の走査は issue-log.entries (固定 phase の retry 回数で実質上限される) を 1 回スキャンするのみで、O(N×M) の N=同 phase entry 数、M=各 entry の failedEvaluations サイズ。N の上限は phase ごとの retry 上限 (RETRY_TRACKED_PHASES の各 phase で gateRetry max=10 程度) で、M は guardrail 評価対象数 (12-15 件程度) で固定。assertNoRepeatedFail 1 回の判定は最大でも N×M ≈ 150 ペアの jaccard 計算で完了し、別途 explicit cap は不要。

## Design Principles
- 比較ロジックの真実源は spec の閾値 0.5。テストは 0.5 リテラルを直接 assert することで「実装定数値」ではなく「契約値」を検証する (consumer asserts contract パターン)
- 閾値選定の根拠は実測 (本 spec の normalize 規則で 11 ケースを計算した結果): 0.5 で false positive (B 群誤 escalate) ゼロ、false negative (A 群取りこぼし) は境界ケース 1〜2 件。issue 本文の 0.4 は issue 著者の元データに基づく値で、本実装の normalize 下では再現しないため採用しない
- 閾値は調整可能 (内部定数)。運用で false positive / negative の偏りが見えたら spec 修正 → constant 修正 → test 修正 を 1 セットで実施
- issue 著者が明示した方針 (AND 条件 / 全 prior 走査 / max-similarity / Jaccard 採用) は優先採用、spec の意図的逸脱 (空集合扱い、閾値値) は QA / decisions で明示的に記録する
- test fixture は issue 本文の 11 ケースを実測値ベースで採用し、各 case の期待値 (escalate / no escalate) は本実装の normalize 規則で計算した last-vs-prior 値に基づく。issue 本文の post-hoc A/B 分類とは一部乖離するが、これは issue 著者と本実装の normalize 規則の差異によるもの
- max-match per current FAIL: 各 current FAIL に対して 1 件の最類似 prior を報告 (重複情報を避け、AI が修正方針を立てやすい)

## Overview
### Modules
- src/flow/lib/run-gate.js: 重複 FAIL 検出の比較ロジックを Jaccard 類似度ベースに置換。helper (normalize, jaccard) と STOPWORDS / JACCARD_THRESHOLD 定数を本ファイル内に同居させる。
- tests/unit/flow/gate-repeat-escalate.test.js: 新方式の挙動 (normalize / jaccard / 閾値境界 / 空集合 / max-match / RETRY_TRACKED_PHASES 外 skip / legacy entry skip / 別 guardrail 同 wording 不 escalate) を網羅検証し、issue #313 の 11 fixture cases を組み込み A/B 群分離を回帰検知する。
- specs/228-stabilize-plan-phase-gate/tests/plan-phase-gate-guards.test.js: REQ-3 ブロック fixture を新 normalize に整合する形に更新する ('reason A' / 'reason B' は単一文字差で新 normalize 下 jaccard=1.0 escalate になり既存テスト意図と矛盾するため変更)。

### Data Flow
- (1) gate AI 評価で FAIL evaluation 配列が生成 → (2) assertNoRepeatedFail({issueLog, phase, currentEvaluations}) 呼び出し → (3) findPreviousFailedEvaluations が issue-log entries[] を古い順に走査し、phase 一致 + failedEvaluations 非空エントリの failedEvaluations を flatten。
- (4) 各 current FAIL に対し、guardrail_id 一致の prior それぞれと jaccard(normalize(currReason), normalize(priorReason)) を計算 → (5) 最大値 maxSim を取得、maxSim >= 0.5 なら matched[] に追加 → (6) matched[] が非空なら ESCALATE_REPEATED_FAIL を throw。

### Decisions
- 比較対象を過去すべての同 phase FAIL に拡張する。直近 1 件のみだと wording drift で漏れる可能性があるため。
- guardrail_id 完全一致を escalate の必要条件とする。別 guardrail で類似 wording の汎用フレーズが異なる根本原因に対して出されることがあり、識別子一致を必須にしないと関係ない別問題で escalate して正常な retry を阻害する。
- 閾値は 0.5 (>= で escalate、境界含む)。issue 本文の 0.4 は採用しない: 実測で 11 ケース中 2 ケース (215 complete-context 0.667 / 236 draft-scope-boundary 0.636) が B 群相当だが 0.4 を超え、誤 escalate になるため。0.5 では実測 B 群 0/6 誤検知、A 群 1/6 取りこぼし (228 exit-code-contract last-vs-prior=0.462) のみ。false positive を 0 にする最小値として 0.5 を選択。
- 空集合 (normalize 後に word set が空) の Jaccard は 0 として扱い escalate しない。issue 擬似コードの `union==0 ? 1` からの意図的逸脱。空 reason 連続は wording 揺れではなく AI 異常応答シグナルで、本タスクの主目的の対象外。
- STOPWORDS は Tier 1 最小セット (30 語: 冠詞・等位接続詞・代表前置詞・be 動詞・代名詞)。意味方向を持つ must / shall / without / not / no 等は除外しない。NLTK-style 広範セットでも実測値はほぼ変わらない (本実装の normalize 規則の特性)。
- max-match per current FAIL: 各 current FAIL に対して同 guardrail_id の prior 全件と類似度を計算し、最大値が >= 0.5 なら最類似 prior 1 件のみを matched[] に追加。同点は走査順 (古い順) で最初を採用。
- err.data.matched[] のスキーマを {guardrail_id, currentReason, priorReason, similarity} に置換 (拡張ではなく breaking change)。alpha 政策。similarity は raw float で保持。err.code と err.data.phase は外部互換のため維持。
- 公開 API は normalize / jaccard を named export として追加。JACCARD_THRESHOLD は内部定数のまま非 export。テストは spec の契約値 0.5 をリテラルで assert する (consumer asserts contract)。
- 非 ASCII 文字 (CJK 等) は記号同様に空白置換し、英語キーワードのみで比較する。完全な Unicode tokenization は外部依存が必要なため out of scope、限界は spec で明記する。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- 重複 FAIL 比較範囲を直近 1 件の同 phase FAIL のみに留める (既存スコープ) — 実装範囲は最小だが、wording drift で 5 iter にわたって徐々に類似度が下がるパターンで漏れる。
- guardrail_id 不一致でも高類似度 (>=0.5) で escalate — 別 guardrail で類似 wording の汎用フレーズが異なる根本原因に対して出されることがあり、誤検知リスクが高い。
- 閾値 > 0.5 (境界除外) — 実測で 0.5 ちょうどはほぼ起きないため挙動差は小さいが、`>=` を採用して境界 test 挙動を明確にする。
- 閾値 0.4 (issue 著者値) — 本実装の normalize 規則で実測すると、B 群相当 2 件 (215 complete-context maxPair=0.667 / 236 draft-scope-boundary maxPair=0.636) が 0.4 を超え誤 escalate する。issue 著者は別の前処理で計算しており、本実装下では 0.4 の妥当性が再現しないため採用しない。
- 空集合の Jaccard を issue 擬似コードどおり union==0 ? 1 で escalate — 空 reason 連続は AI 異常応答シグナルで、誤 escalate を起こすより不発の方が損失小。draft Q3 でユーザーが [1] (escalate しない) を明示選択。
- STOPWORDS を NLTK-style 広範セット (150-200 語) — 本実装の normalize 規則で Tier1 と NLTK-150 を比較した実測で、12 cases の値差が最大 0.03 程度、A/B 分類は変わらない。Tier1 の方が STOPWORDS リストが短くメンテしやすい。
- Levenshtein 距離 / embedding ベースの類似度 — 外部依存または高度な実装が必要で、issue の Node.js 組み込みのみ制約に違反。Jaccard で issue 例の 11 ケースで明確な分離が確認されており、十分な精度。
- Unicode-aware tokenizer (\p{L}\p{N}_ with /u flag) — CJK は word 境界が空白で区切られないため tokenize が phrase レベルになり、別問題 (jaccard が異常に低くなる) を生む。日本語の正しい tokenization には外部依存 (kuromoji 等) が必要で禁止。
- JACCARD_THRESHOLD を export してテストから参照 — test が「実装の定数値」を assert する形になり、契約値の真実源が曖昧になる。spec の契約値 0.5 をリテラルで assert する方が consumer asserts contract パターンとして明確。
- err.data.matched[] のスキーマを {guardrail_id, reason} に保ったまま拡張 — 意味が曖昧 (current か prior か) で後の読み手が誤解する。alpha 政策で breaking change を許容しているため置換が望ましい。
- normalizeReason / buildFailPairKey を後方互換のため残す — alpha 政策「旧フォーマット・非推奨パスは保持せず削除」に違反。利用箇所が全て本タスクで置き換え対象であり orphan になる。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: src/flow/lib/run-gate.js に normalize(text) 関数を追加する。手順は (1) String(text).toLowerCase()、(2) replace(/[^\w\s-]/g, ' ')、(3) split(/\s+/)、(4) token フィルタとして「length >= 2」かつ「token が word 文字を 1 つ以上含む (regex /[\w]/.test(token) === true)」の両方を満たすもののみ採用 (これにより '---' のような punctuation-only / hyphen-only token を除外)、(5) STOPWORDS に含まれる token を除外、(6) Set<string> を返す。hyphen は token 内に保持する設計 (例: 'foo-bar' は単一 token、'REQ-7' は単一 token)。STOPWORDS は { a, an, the, and, or, but, of, in, on, at, to, for, by, with, from, is, are, was, were, be, been, being, it, this, that, these, those, as, if, than } の 30 語。normalize は named export する。
- R2 [must]: src/flow/lib/run-gate.js に jaccard(a, b) 関数を追加する。a, b はいずれも Set<string>。a.size === 0 && b.size === 0 のときは 0 を返す (issue 擬似コードからの意図的逸脱)、それ以外は |A∩B| / |A∪B| を返す。raw float を返し丸めない。jaccard は named export する。
- R3 [must]: src/flow/lib/run-gate.js に内部定数 JACCARD_THRESHOLD = 0.5 を定義する (export しない、内部のみ参照)。
- R4 [must]: src/flow/lib/run-gate.js の findPreviousFailedEvaluations({issueLog, phase}) を以下の挙動に変更する: issueLog.entries を登場順 (古い順) に走査、phase 一致かつ failedEvaluations が非空のエントリすべての failedEvaluations をその順で flatten した配列を返す (現行は最初に見つけた 1 件のみ)。failedEvaluations が無い/空の entry は対象外、phase 不一致は対象外。マッチが 1 件もないとき (issueLog なし / 同 phase entry なし / すべて legacy・空 entry) は空配列 [] を返す (null は返さない)。
- R5 [must]: src/flow/lib/run-gate.js の assertNoRepeatedFail({issueLog, phase, currentEvaluations}) を以下の挙動に変更する: (1) RETRY_TRACKED_PHASES 外なら no-op、(2) findPreviousFailedEvaluations から priorFails を取得、(3) 各 current FAIL に対し、priorFails のうち guardrail_id 一致のもの全件と jaccard(normalize(curr.reason), normalize(prior.reason)) を計算、(4) 最大類似度 maxSim を取得、同点は走査順で最初の prior を採用、(5) maxSim >= JACCARD_THRESHOLD なら {guardrail_id, currentReason, priorReason, similarity: maxSim} を matched[] に追加、(6) matched[] が非空なら Error を throw (err.code = 'ESCALATE_REPEATED_FAIL', err.data = {phase, matched})。matched[] の順序は current FAIL の登場順。
- R6 [must]: src/flow/lib/run-gate.js の assertNoRepeatedFail の error message を 'repeated similar FAIL' 系の文言に書き換え、各 match の guardrail_id / similarity (表示時 .toFixed(2)) / currentReason / priorReason を含める。message 文言の exact 一致は要求せず key substring (phase 値、'similar' / 'jaccard' 等のキーワード、guardrail_id) の存在で test する。
- R7 [must]: src/flow/lib/run-gate.js から obsolete 関数 normalizeReason / buildFailPairKey を削除する (alpha 政策、利用箇所が全て本タスクで置き換え対象)。
- R8 [must]: tests/unit/flow/gate-repeat-escalate.test.js を新方式に対応する形に書き換える。describe ブロック構成: normalize / jaccard / buildFailedEvaluations (既存の FAIL-only 抽出テストを保持) / findPreviousFailedEvaluations / assertNoRepeatedFail。assertNoRepeatedFail のテストには (a) 高類似度同 guardrail で escalate、(b) 別 guardrail 同 wording で escalate しない、(c) 閾値境界 (~0.5) テスト、(d) 空集合 reason テスト、(e) max-match per current FAIL の決定論性 (同点 prior 走査順)、(f) RETRY_TRACKED_PHASES 外で no-op、(g) failedEvaluations 不在 entry の skip、を含める。findPreviousFailedEvaluations のテストには空配列返却 (no match) のケースも含める。既存ファイル内の buildFailedEvaluations や appendIssueLogFromGateResult (issue-log 永続) の検証ブロックは削除せず保持し、新方式が永続スキーマを変えていないことを担保する。
- R9 [must]: specs/228-stabilize-plan-phase-gate/tests/plan-phase-gate-guards.test.js の REQ-3 ブロック fixture を更新する。'reason A' / 'reason B' は単一文字差のため新 normalize 下では共に {'reason'} となり jaccard=1.0 escalate になり、既存テスト意図 (異なる reason は escalate しない) と矛盾するため、別語を含む reason ('critical infra blocker' vs 'unrelated coverage gap' 等) に変更する。
- R10 [should]: tests/unit/flow/gate-repeat-escalate.test.js に synthetic fixture によるシナリオテストを追加する: (i) 高類似度ペア (例: 'Spec mandates deleting tests without user approval' 系を 3-5 件、いずれも jaccard >= 0.5 になるように設計) → assertNoRepeatedFail で escalate、(ii) 低類似度ペア (例: 異なる主題・語彙の reason 3-5 件、いずれも jaccard < 0.5) → escalate しない、(iii) 境界ペア (jaccard ちょうど 0.5 になる組) → escalate する。閾値 0.5 が正しく機能することを確認する目的。issue 本文の 11 ケースは閾値根拠の参考情報として spec 内に残すが、自動テスト fixture には組み込まない (issue 本文の数値は本実装の normalize 規則と乖離するため、機械的な回帰検知に使えない)。

## Acceptance Criteria
- AC-1: normalize('Hello, World!') が Set(['hello', 'world']) を返す (記号は空白に置換、'!' は除去、length>=2 で 'a' 'I' 等は除外、stopwords は本例では非該当)
- AC-2: normalize('REQ-7/REQ-8') が Set(['req-7', 'req-8']) を返す (slash で 2 token、hyphen は保持)
- AC-2b: normalize('---') が空 Set を返す (punctuation-only token は除外)、normalize('foo-bar baz') が Set(['foo-bar', 'baz']) を返す (hyphen は token 内に保持)
- AC-3: normalize('') / normalize(null) / normalize(undefined) が空 Set を返す
- AC-4: jaccard(new Set(['a','b']), new Set(['a','c'])) が 1/3 ≈ 0.333 を返す (raw float)
- AC-5: jaccard(new Set(), new Set()) が 0 を返す (空集合は escalate しない設計)
- AC-6: jaccard(new Set(['a','b']), new Set(['a','b'])) が 1 を返す
- AC-7: assertNoRepeatedFail で issueLog.entries が古い順に走査され、phase 一致 + failedEvaluations 非空の entry すべての failedEvaluations が flatten 順序で対象になる
- AC-8: assertNoRepeatedFail で current FAIL と同 guardrail_id の prior FAIL の最大類似度が >= 0.5 のとき throw、< 0.5 なら return
- AC-9: assertNoRepeatedFail で別 guardrail_id の prior は同 wording でも比較対象外 (escalate しない)
- AC-10: throw された err.code === 'ESCALATE_REPEATED_FAIL'、err.data.phase === <呼び出し時 phase>、err.data.matched[*] が { guardrail_id: string, currentReason: string, priorReason: string, similarity: number } 形
- AC-11: phase が RETRY_TRACKED_PHASES 外なら assertNoRepeatedFail は throw せず undefined を返す (no-op)
- AC-12: failedEvaluations フィールドを持たない / 空配列の prior entry は flatten 対象外 (legacy skip)
- AC-12b: findPreviousFailedEvaluations({issueLog: null/undefined, phase})、issueLog.entries が空、同 phase entry が無い、すべて legacy/空 entry のいずれの場合も空配列 [] を返す (null は返さない)
- AC-13: 同 guardrail_id の prior が複数あり同点 maxSim の場合、走査順で最初 (最古) の prior が priorReason に採用される (決定論)
- AC-14: synthetic 高類似度 fixture で escalate、低類似度 fixture で no escalate、境界 (jaccard=0.5) fixture で escalate する
- AC-15: src/flow/lib/run-gate.js に normalizeReason / buildFailPairKey の export / 定義が存在しない (削除確認)
- AC-16: specs/228-stabilize-plan-phase-gate/tests/plan-phase-gate-guards.test.js の REQ-3 ブロックが新 fixture でパスする (`node --test specs/228-stabilize-plan-phase-gate/tests/plan-phase-gate-guards.test.js` で実行可能)
- AC-17: dispatcher 経由の CLI envelope で escalation エラー時、ok=false / errors[0].code === 'ESCALATE_REPEATED_FAIL' / data.matched[*] === { guardrail_id, currentReason, priorReason, similarity } の形になる
- AC-18: assertNoRepeatedFail throw 経由の issue-log エントリは err.message のみを記録し、failedEvaluations / matched 等の structured データを含まない (既存挙動の維持)。retry counter は加算されない (既存挙動の維持)
- AC-19: src/flow/lib/run-gate.js の関連 JSDoc / セクションコメント (buildFailPairKey 周辺、assertNoRepeatedFail 周辺、`Repeated-identical-FAIL escalation guard` 等) が新方式 (Jaccard / 全 prior 走査 / max-match) を反映する形に更新されている。'identical' / 'most recent' / 'byte-equal' 等の旧記述が残っていない

## Impact on Existing Features

- run-gate.js: buildFailPairKey 関数を削除し Jaccard ベースの内部判定に置換
- run-gate.js: normalizeReason 関数を削除（呼び出し元は buildFailPairKey のみで、それ自体が消えるため orphan）
- run-gate.js: findPreviousFailedEvaluations の戻り値を「直近 1 件」から「同 phase の全 FAIL エントリの flatten」に変更（呼び出し元は本ファイル内 + tests/unit/flow/gate-repeat-escalate.test.js のみ、production consumer なし）
- run-gate.js: assertNoRepeatedFail の error message 文言と err.data.matched[] のスキーマ置換（err.code / err.data.phase は維持）。production consumer は run-gate.js 内のみ
- tests/unit/flow/gate-repeat-escalate.test.js: 古い normalizeReason describe ブロック削除、新方式の test 追加 (詳細網羅は specs/253-*/tests/253-jaccard.test.js に分離)
- specs/253-repeated-fail-jaccard/tests/253-jaccard.test.js: 新規作成、spec ヘッダー付きで R1-R10 を網羅
- specs/228-stabilize-plan-phase-gate/tests/plan-phase-gate-guards.test.js: REQ-3 ブロックの fixture を新 normalize で意図どおり動くものに更新
- issue-log.json の永続データには影響なし（failedEvaluations の {guardrail_id, reason} 形は変わらない）
- assertNoRepeatedFail の呼び出し元（run-gate.js:1460/1845/1872）は引数・例外コード（ESCALATE_REPEATED_FAIL）が変わらないため改修不要
- dispatcher 経由の CLI envelope は err.data 置換に伴い、ESCALATE_REPEATED_FAIL 例外時の data.matched[*] が新スキーマで露出する (AC-17)
- appendIssueLogFromGateError による issue-log 永続は err.message のみで既存挙動維持 (AC-18)

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add normalize/jaccard helpers and STOPWORDS constant
  - src/flow/lib/run-gate.js に新規 helper (normalize(text), jaccard(a, b)) と STOPWORDS / JACCARD_THRESHOLD 定数を追加し、normalize / jaccard を named export する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Expand findPreviousFailedEvaluations to flatten all prior same-phase FAILs
  - src/flow/lib/run-gate.js の findPreviousFailedEvaluations の戻り値を、直近 1 件から「issueLog.entries を古い順に走査し、phase 一致 + failedEvaluations 非空のエントリすべての failedEvaluations を flatten した配列」に変更する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Replace assertNoRepeatedFail comparison with Jaccard-based max-match
  - assertNoRepeatedFail の判定ロジックを byte-equal 比較から Jaccard 類似度ベースの max-match per current FAIL に置き換え、err.data.matched[] スキーマを {guardrail_id, currentReason, priorReason, similarity} に置換する。error message も 'repeated similar FAIL' 系に変更する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Delete obsolete normalizeReason and buildFailPairKey
  - src/flow/lib/run-gate.js から旧関数 normalizeReason と buildFailPairKey を削除する。alpha 政策に従い後方互換コードは残さない。
  - see `tasks/T-4.md` for full spec
- **T-4b** [pending]: Update JSDoc and comments to reflect Jaccard semantics
  - src/flow/lib/run-gate.js の JSDoc / セクションコメントを新方式 (Jaccard 類似度、全 prior 走査、max-match) を反映する形に更新する。'identical' / 'most recent' / 'byte-equal' 等の旧記述を残さない。
  - see `tasks/T-4b.md` for full spec
- **T-5** [pending]: Update tests/unit/flow/gate-repeat-escalate.test.js for new comparison
  - 既存の tests/unit/flow/gate-repeat-escalate.test.js を新方式 (normalize / jaccard / 新 assertNoRepeatedFail) に対応する形に更新する。古い normalizeReason describe ブロックを削除、新 normalize / jaccard / 新 assertNoRepeatedFail ブロックを追加。spec 固有の網羅検証は specs/253-*/tests/ に分離する (T-5b)。
  - see `tasks/T-5.md` for full spec
- **T-5b** [pending]: Create specs/253-*/tests/253-jaccard.test.js with spec headers
  - specs/253-repeated-fail-jaccard/tests/253-jaccard.test.js を新規作成し、各 test ファイルの先頭に `// spec: R1 R2 R3 ...` 形式のヘッダーを付ける。R1-R10 の AC を spec-local テストとしてカバーする。
  - see `tasks/T-5b.md` for full spec
- **T-6** [pending]: Update spec 228 local test fixture for new normalization
  - specs/228-stabilize-plan-phase-gate/tests/plan-phase-gate-guards.test.js の REQ-3 ブロック fixture を、新 normalize で意図どおり動くように 'reason A' / 'reason B' を別語を含む reason に変更する。
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Add synthetic high/low/boundary similarity fixture tests in spec-local test file
  - specs/253-repeated-fail-jaccard/tests/253-jaccard.test.js (T-5b で作成) に閾値 0.5 が正しく機能することを確認する synthetic fixture テストを含める。issue 本文の 11 ケース fixture は採用しない (本実装の normalize 規則と乖離するため)。
  - see `tasks/T-7.md` for full spec
