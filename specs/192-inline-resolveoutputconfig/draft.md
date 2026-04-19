---
issue: 174
runId: 81418987-bb3e-4595-91bb-b2f90ed99bb6
mode: decision
---

# Draft: resolveOutputConfig の削除・インライン化

**開発種別:** refactor / ENHANCE（抽象レイヤーの削除）

**目的:** `src/lib/types.js` の `resolveOutputConfig()` は `cfg.docs` の値を僅かに整形するだけの薄いラッパーであり、呼び出し元 4 箇所からの直接参照に置き換え、関数自体を削除する。抽象の段数を下げ、設定値の出所の見通しを改善する。

**議論段階:** Decision（Issue #174 の方針合意済み）。ブレスト段階ではない。

## Impact on Existing Features

- 挙動変更: なし。すべての呼び出し元で同じ値を参照する形に書き換えるのみ。
- ランタイム動作: 同一。`mode` 未指定時の既定値（translate）など、既存 helper が持っていた分岐は呼び出し元が引き継ぐ。
- 呼び出し元: `src/docs/commands/build.js`, `translate.js`, `review.js`, `forge.js`（計 4 箇所）。
- 公開 API: `resolveOutputConfig` は `src/api.js` から export されていない内部関数。外部利用者への影響なし（要確認: R2 で検証）。
- 後方互換性: alpha 版ポリシーに従い、廃止予定関数の保持・再 export は行わない。

## Requirements（優先順）

優先度 P1（必須）> P2（必須だが影響小）> P3（nice-to-have）。本 draft では実装詳細（具体的な式・行）は示さず、観測可能な最終状態のみを記述する。

### P1 — 抽象の削除

- **When** リファクタ完了後に当該関数の定義箇所を確認した時、**shall** `resolveOutputConfig` 関数定義が存在していてはならない。
- **When** ソースツリー全体を検索した時、**shall** `resolveOutputConfig` の識別子はどこにも出現していてはならない（import 文・呼び出し・コメントを含む）。
- **When** 本リファクタ後に `sdd-forge docs build` / `translate` / `review` / `forge` を実行した時、**shall** リファクタ前と同一の出力・挙動が得られなければならない（ランタイム挙動の同値性）。

### P2 — 公開 API 非露出の事前確認（実施済み）

- **When** spec 作成時点で `src/api.js` の export を確認した時、**shall** `resolveOutputConfig` が含まれていないことを確認済みとする（2026-04-18 時点、grep で 0 hit 確認済）。したがって本変更は外部利用者へ影響しない。

### P3 — 同一ファイル内の一貫性

- **When** 呼び出し元ファイルの差分を機械的に検査した時、**shall** 同一ファイル内において言語一覧・既定言語・モードそれぞれの参照式が 2 通り以上併存していないこと（各値につき記述形式が 1 種類に統一されていること）。

## Constraints

- プロジェクトルール（CLAUDE.md）:
  - alpha 版ポリシー：後方互換コード禁止。関数を残した deprecation コメントは書かない。
  - 過剰な防御コード禁止：`cfg.docs` の存在チェックは追加しない（上流で保証済み）。
  - 「シンプルなインターフェースに十分な実装を隠す」方針に反しない範囲での抽象削除（本件の抽象はロジックが薄く、隠す価値が低い）。
- 本 spec のスコープ内で `cfg.docs.mode` のスキーマ自体には手を入れない（別 spec の対象）。

## Edge Cases / Out of Scope

- `cfg.docs.mode` が `"generate"` 等 `"translate"` 以外の場合の挙動は既存コードの分岐に従う（本 spec で振る舞いは変更しない）。
- `isMultiLang` に相当する `languages.length >= 2` 判定が今後複数箇所で使われるようになった場合の再抽出は本 spec のスコープ外。
- `resolveOutputConfig` を参照していた過去の spec ドキュメント（`specs/180-*`）は記録目的のため修正しない。

## Alternatives Considered

- 案A：関数を保持したまま `cfg.docs` 直接参照のパスを呼び出し元に追加。  
  却下：関数が残ることで二系統の参照経路が共存し、「薄いラッパーを削除する」という Issue の動機に反する。
- 案B：さらに厚い「OutputConfig クラス」へ昇格し、責務を集約する。  
  却下：呼び出し元は現在 4 箇所のみで、共通ロジックの厚みが不足。抽象を増やしても実益がない（`CLAUDE.md` の「3 回目の出現を待つ必要はない」原則は 2 箇所以上の重複が対象。本件は重複ではなく集約の薄さの問題）。
- 採用案：関数削除 + 4 箇所インライン化（Issue #174 の提案どおり）。

## Q&A

### Q1 多言語判定ヘルパーはヘルパーとして残すべきか？
回答：残さない。判定ロジックを各呼び出し元に置き直す。  
根拠：Issue の主旨は薄いラッパーの削除であり、別名の薄いヘルパーを新設するのは回帰。今後呼び出し箇所が増えて DRY の必要が明確になった段階で再抽出する。

### Q2 mode 未指定時の既定値はどこで表現するか？
回答：各呼び出し元で既定値 fallback を引き継ぐ。  
根拠：既存関数と同じ既定値挙動を保持。スキーマ側での既定値化は別 spec（config スキーマ検証）の対象。

### Q3 `src/api.js` で public 露出していないか？
回答：確認済み。grep で `resolveOutputConfig` は `src/api.js` に出現せず、公開 API ではない。したがって外部利用者への影響は発生しない。  
根拠：draft 作成前に実地確認を完了している（2026-04-18）。Issue の前提「内部関数の削除」と一致。

### Q4 テスト戦略は？
回答：spec 検証レベルでは「識別子がソースツリーから完全に消えたこと」を静的検証する。挙動同値性は既存の回帰テスト（`npm test` の docs build 系）で担保する。新規の挙動テストは追加しない（挙動変更なしのため）。

### Q5 将来拡張性は？
回答：`cfg.docs` のアクセスパターンが増えた際は、`src/lib/config.js` 側にヘルパーを追加する選択肢を残す。本 spec は関数の削除と直参照化だけを扱う。

### Q6 呼び出し元の範囲は？
回答：docs コマンド配下の 4 つのコマンドファイル（build / translate / review / forge）が対象。具体的な行の書換は spec / impl フェーズで扱う。

### Q7 影響範囲再確認
回答：docs パイプライン（build）、翻訳（translate）、レビュー（review）、対話型 forge の各コマンドが対象。ランタイム挙動は完全に同値。

## 確認

- [x] User approved this draft (autoApprove)
- 承認日: 2026-04-18
