# Draft: 212-gate-impl-repeat-escalate

**開発種別:** feature
**目的:** gate-impl で同一 guardrail × 同一理由の FAIL が繰り返された場合、AI 呼び出しを打ち切って人間にエスカレーションする。無意味な retry 枠消費を防ぎ、「この REQ は現 spec では検証不能」の状態を早期可視化する。

## 背景

Issue #211 (cc61) は gate-impl の「AI 判定ブレ」を多数決で吸収する案だったが、実データ分析で前提が崩れた:

- 観測された繰り返し FAIL は「ブレ」ではなく、AI が一貫して同じ REQ を同じ理由で FAIL させているケース（specs/203-next-action-cli の REQ-11）や、段階的に異なる legitimate な問題を発見しているケース（specs/207-*）だった。
- 多数決は前者に無力（3 回とも同じ FAIL）、後者には不適（各 FAIL が legitimate）。

## 要件（優先順）

P0（必須・本 spec の主目的）:
1. **When** gate-impl が FAIL を返し、かつその FAIL が含む (guardrail, 理由) ペアのいずれかが直近の同 phase FAIL entry の同種ペア列にも存在する場合、**the system shall** AI 呼び出しループを打ち切り、人間エスカレーション用の例外を発生させる。
2. **When** 要件 1 のエスカレーションが発生した場合、**the system shall** その試行については retry 枠を消費しない（残り retry 数を増減させない）。

P1（主目的を成立させるための付帯要件）:
3. **When** 要件 1 のエスカレーションが発生した場合、**the system shall** 既存の ESCALATE_* 系と同じ envelope 形式（エラーコード + 人間可読 message + 機械可読 data）で結果を返す。
4. **When** gate-impl が FAIL 判定を issue-log に記録するとき、**the system shall** 後続比較に足る構造情報（FAIL した各 (guardrail, 理由) ペア）を entry に含める。既存の人間向け flat 理由表示は従来どおり維持する。

P2（スコープ限定）:
5. **When** 要件 1 の繰り返し検出ロジックを呼び出す対象を決めるとき、**the system shall** gate-impl のみを対象とし、gate-draft / gate-spec / gate-task-spec は対象としない。
6. **When** 要件 1 のペア同一性を判定するとき、**the system shall** 外部依存を使わず、正規化後の文字列一致のみで判定する（意味的類似や編集距離は使わない）。

## Scope Verification
- In scope:
  - gate-impl の FAIL 経路に「同一 guardrail × 同一理由の繰り返し」検出を追加
  - issue-log の FAIL entry に後続比較用の構造情報を追加（既存の人間向け表示は変更しない）
  - エスカレーション envelope の定義・メッセージ
- Out of scope:
  - AI に同一性判定を委ねる方式
  - embedding / 編集距離による類似判定
  - draft b833（spec-phase diff-verifiability ガード）との統合
  - AI 判定ブレの吸収（本件の対象外）
  - report 出力や既存 consumer の見た目変更

## Impact on Existing Features
- 影響ありの既存機能:
  - gate-impl の FAIL 経路: 従来は常に FAIL を return していたが、条件一致時はエスカレーション例外に分岐する
  - issue-log.json スキーマ: FAIL entry にフィールドが追加される（既存フィールドは維持）
- 影響なし:
  - spec 210 の NO_PROGRESS_SINCE_LAST_FAIL による PRE-hook 打ち切り（相補的に独立動作）
  - gate-draft / gate-spec / gate-task-spec
  - retry.max の既定値および ESCALATE_RETRY_EXHAUSTED の発動条件
  - report.js など既存 consumer（flat reason を維持するため）

## Q&A

- Q1 (同一性判定方式): 正規化後の文字列一致（外部依存なし）
  - A: 採択。sdd-forge の外部依存禁止方針と spec 210 の先行事例（完全一致）に整合。文言揺れで検出漏れしたケースは従来の retry-exhausted で二段目の救済が効く。
- Q2 (閾値): 直近 FAIL と新 FAIL が一致した時点で escalate（N=1）
  - A: 採択。retry.max=3 の運用で、初回 FAIL の後の再試行で即検出できる。
- Q3 (発動タイミング): 新 FAIL の評価結果と前回 FAIL entry を比較する方式
  - A: 採択。AI 評価結果が揃ってからでないと比較できないため post 配置。retry 枠は消費しない設計とする。
- Q4 (entry 拡張): 既存 flat 理由表示は維持し、比較用フィールドを追加
  - A: 採択。report 系 consumer を壊さずに新機能を付加できる。
- Q5 (テスト戦略): 単体テストで、同一性判定・entry 書き出し・エスカレーション発動条件・retry 非消費を網羅
  - A: 採択。E2E は既存 gate-impl 経路が間接的に通すため追加不要。

## Open Questions
- なし（draft 段階で必要な判定点はすべて Q&A で確定済み）

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-22
- Notes: Issue #215 を 5 問の Q&A で詳細化。spec 210 の NO_PROGRESS_SINCE_LAST_FAIL と相補的に動作する。
