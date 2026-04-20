# Draft: scope-review-to-spec-diff

**開発種別:** BUG

**目的:** `sdd-forge flow run review` が生成する改善提案を、今回の変更が実際に touch したファイルだけに拘束する。それにより、スコープ外ファイルへの提案が review サイクルに混入しないようにする。

## 関連

- Issue: #193 (ee86)
- 関連 issue: #180（gate-impl の pre-existing 過検出 / 別タスク）
- 記録のある spec: 200-investigate-test-failures, 188-unify-command-architecture, 191-preset-di-container

## 背景

`flow run review` の draft フェーズが、今回の diff に含まれないファイル・関数に対して改善提案を生成している。結果として、ユーザーは毎回スコープ外提案を reject する必要があり、review iteration のトークン・注意力が浪費されている。issue #193 に複数 spec で再発した旨が記録されている。

issue には 3 つの対応候補（プロンプト制約 / post-filter / tool-level guard）が提示されている。

## 決定方針（どの軸で拘束するか）

- **スコープ判定の基準**: 「今回の diff が実際に touch したファイル集合」を唯一の真実とする。spec.md の `## Scope` 宣言の有無に依存しない。
- **拘束の粒度**: ファイル単位（行単位ではない）。理由: 行単位だと、追加コードに連動する同一ファイル内の一貫性修正ができなくなり、プロジェクト規約（spec スコープ外でも同一ファイル内の一貫性修正は許容）と衝突する。
- **拘束の多層化**: プロンプト段階の制約（LLM へ明示）と、review 出力後の post-filter（確定的なフィルタ）を両方置く。複数 spec で再発している事実から、プロンプトのみでは信頼できないと判断。
- **抽出失敗時の扱い**: 提案のファイル情報が抽出できない場合は保守的に除外する（ユーザー判断コストが高く、プロンプトでフォーマット必須指定もしているため）。抽出率をログに出して可観測性を確保する。

## 代替案と却下理由

- **プロンプト制約のみ**: 実装は軽いが、LLM は確率的にしか指示に従わない。複数 spec で再発している時点で「指示のみ」では不足と判断。
- **post-filter のみ**: 確定的だが、LLM は scope 外でも提案を出し続けるため入力・出力トークンの浪費は止まらない。
- **tool-level guard**: review を write-tool 駆動アーキテクチャに書き換える必要があり過剰。
- **spec.md の Scope を必須化**: ユーザー側への強い制約。既存 spec の非準拠と相性が悪い。

## 要件（優先順位付き）

本 spec の要件は以下の優先順位で扱う（上位を必須、下位を補助）。

1. **P1 — scope 拘束の確定性**: review が出力する提案は、今回の変更が touch したファイルに関するものだけに限定される。スコープ外のファイルに言及する提案は最終 review.md に残らない。
2. **P2 — プロンプト段階の明示化**: review のシステムプロンプトに「提案は diff 対象ファイルのみ」の指示が明記される。これにより P1 の前段で削減が効く。
3. **P3 — 抽出失敗の保守的扱い**: 提案がファイル情報を欠いている場合は除外される。除外件数は観測可能（ログ出力）。
4. **P4 — Scope 宣言なし spec での動作**: spec.md の `## Scope` が未記入・抽出 0 件でも、P1 の振る舞いが成立する（今回 touch したファイル集合にフォールバックする）。
5. **P5 — 既存 review テストとの整合**: 既存の review 関連テスト（`tests/unit/flow/commands/review.test.js`, `tests/unit/flow/phases-review.test.js`, `tests/unit/docs/lib/review-parser.test.js`, `tests/e2e/docs/commands/review.test.js`）が引き続きパスする。期待値の更新が必要な場合はそれも本 spec 内で実施する。

## 既存への影響

- 影響を受ける振る舞い: `sdd-forge flow run review` の draft フェーズ出力（提案集合が縮小する方向）。final（検証）フェーズの verdict ロジックは据え置き。
- 影響を受けない領域: `flow run impl-confirm`, `flow run gate` (impl), `flow run sync`, `flow run finalize`。review.md を参照する他コマンドはないため下流影響なし。
- 既存テスト: 上記 P5 の 4 テストファイルに対して、期待値の更新または scope 拘束の検証テスト追加を行う。新規テストは本 spec 専用なら `specs/201-*/tests/` に、review の恒常仕様として維持する価値があるなら `tests/unit/flow/commands/review.test.js` に追加する（spec phase で決定）。
- docs / README: 生成物への影響なし。

## 受け入れ基準

1. review draft の出力で、今回 touch したファイル集合に含まれないファイルを指す提案が review.md に残らない（P1）。
2. review のシステムプロンプトに「提案は diff 対象ファイルのみを対象とする」旨が含まれる（P2）。
3. 提案のファイル情報が抽出できない場合、その提案は除外され、除外が起きた件数は観測できる（P3）。
4. spec.md に `## Scope` の記述がなくても、review は今回の変更の touch ファイル集合に対してのみ提案を返す（P4）。
5. 既存 review 関連ユニット・E2E テストがパスする。scope 拘束の振る舞いを検証する追加テストが少なくとも 1 件含まれる（P5）。

## User Confirmation

- [x] User approved this draft (autoApprove)
- Confirmed: 2026-04-20

## Q&A

### Q1 (auto-approved): intent 確認

- AI 要約: issue #193 の review スコープ逸脱を修正する。
- 回答: [1] はい（auto モード）

### Q2: どの軸で拘束するか

- プロンプト制約のみ / post-filter のみ / 両方 の 3 案を比較し、**両方** を採択（再発実績のため）。詳細は「決定方針」参照。

### Q3: スコープ判定のソース・オブ・トゥルース

- spec.md の Scope 宣言ではなく、**今回の diff が touch したファイル集合** を唯一の真実とする。理由は「決定方針」参照。

### Q4: 抽出失敗時の扱い

- 保守的に除外。件数はログに残す。理由は「決定方針」参照。

### Q5: 粒度（ファイル単位 / 行単位）

- ファイル単位。行単位はプロジェクト規約（同一ファイル内の一貫性修正は許容）と衝突するため採らない。
