# Draft: fix-flow-test-phase-quality

**開発種別:** バグ修正
**目的:** flow テストフェーズの品質を改善する。plan.test-mode 設問の不適切な選択肢、CRITICAL STOP の欠如、gate-impl のテスト実行要件の誤検証という3つのバグを修正する。

## 背景

Issue #146 で報告された3点の問題。

---

## 要件優先順位

- P1: plan.test-mode 設問の変更（既存テスト実行の選択肢が欠如しているため即影響あり）
- P2: flow-plan test フェーズの CRITICAL STOP 追加（AI の自動判断を防ぐ安全装置）
- P3: gate-impl のテスト実行要件検証改善（新コマンド作成を伴う最も影響範囲が広い変更）

---

## Q&A

**Q1: plan.test-mode の設問と選択肢をどう変えるか？**

推奨: description を「テストを実行するか選択してください。」に変更し、選択肢を実行／スキップの二択に統一する。
根拠: 既存コードパターン（他の plan.* プロンプト定義）に合わせ、実行を問うシンプルな二択を採用。

決定（When/shall）:
- When `sdd-forge flow get prompt plan.test-mode` が呼ばれたとき、description は「テストを実行するか選択してください。」を返すものとする
- When ユーザーがテストフェーズで選択するとき、選択肢は [1] 実行する [2] 実行しない [3] その他 を含むものとする
- When EN 版の `plan.test-mode` が呼ばれたとき、description は "Run tests?" を返し、選択肢は [1] Run [2] Skip [3] Other を含むものとする

**Q2: CRITICAL STOP はどこに追加するか？**

推奨: flow-plan SKILL.md テンプレートのテストフェーズ冒頭に CRITICAL STOP マーカーを追加する。
根拠: flow-finalize SKILL.md に同じパターンが実装済みであり、それに倣う。

決定（When/shall）:
- When AI が flow-plan のテストフェーズに入ったとき、ユーザーへの選択肢提示の前にテスト方針を自動決定してはならない
- When flow-plan SKILL.md テンプレートを更新するとき、テストフェーズ冒頭に CRITICAL STOP マーカーを追加するものとする

**Q3: gate-impl のテスト実行要件検証をどう改善するか？**

推奨: テスト実行証跡を返す新コマンド `sdd-forge flow get test-result` を追加し、gate-impl がそれを参照して判定する。
根拠: テスト実行結果は diff に現れないため AI への依存を排除する。既存の `flow get check` / `flow get status` と同じコマンド体系に従う。

決定（When/shall）:
- When gate-impl がテスト実行要件を検証するとき、diff だけでなくテスト実行証跡を参照して判定するものとする
- If テスト実行証跡が存在しないとき、gate-impl はテスト実行要件を SKIP（未検証）として扱い、diff のみで検証可能な要件だけを PASS/FAIL 判定するものとする
- When `sdd-forge flow get test-result` が呼ばれたとき、flow.json のテスト summary とテスト実行ログの内容を他の flow get コマンドと同じ形式で返すものとする
- When テストフェーズでテストを実行するとき、SKILL.md の指示に従ってテスト出力をログファイルに保存するものとする

**Q4: テストログはどこに保存するか？**

推奨: 設定の `agent.workDir` 配下に保存する。
根拠: 既存のログ出力先（エージェントログ等）と同じ作業ディレクトリ配下に統一する。

決定（When/shall）:
- When テストフェーズでテストを実行するとき、出力ログを設定の `agent.workDir` 配下に保存するものとする
- When `sdd-forge flow get test-result` が呼ばれたとき、このログと flow.json のテスト summary を合わせて返すものとする（Q3 の決定と同様）

**Q5: 既存機能への影響は？**

推奨: 既存の flow get/set/run コマンドの挙動は変更せず、影響範囲を新規追加と定義ファイルの修正に限定する。
根拠: alpha 版ポリシー（CLAUDE.md）に基づき、後方互換コードは書かない方針。新規コマンド追加は既存 CLI に影響しない。

決定（When/shall）:
- When plan.test-mode 設問を変更するとき、`sdd-forge upgrade` を実行してプロジェクトのスキルに反映するものとする。未実行の場合、既存プロジェクトのスキルには新しい設問が反映されない
- If `sdd-forge flow get test-result` を呼ぶとき、flow の外部（既存コマンド）には影響しないものとする
- When gate-impl がテスト実行証跡なしで動作するとき、テスト実行要件を SKIP として扱うため、従来の PASS/FAIL 判定数は減少しうるが誤判定は発生しないものとする

---

- [x] User approved this draft
