# Feature Specification: 183-prefix-comments

**Feature Branch**: `feature/183-prefix-comments`
**Created**: 2026-04-17
**Status**: Draft
**Input**: Issue #157 — プリフィックスコメントによる構造化コメントシステム

## Goal

コード中のコメントに `WHY:` / `HACK:` / `SECURITY:` プリフィックスを付与して構造化し、minify 処理で保持することで、text 生成 AI が明示された意図に基づいた高品質なドキュメントを書けるようにする。

## Scope

1. `document` プリセットの guardrail に、プリフィックス付きコメント記述ルールを MUST 表現で追加する。
2. JS / PHP / Python / YAML の各言語ハンドラの minify がプリフィックス付き単一行コメントを保持するように変更する。
3. 各言語ハンドラの minify に対するユニットテストを追加する。

## Impact on Existing Features

- **minify の削除挙動**: プリフィックス付き単一行コメントのみ保持に変わる。プリフィックスなし・書式違いコメントの削除は現行どおり継続（R2）。
- **ブロックコメント処理**: 影響なし（R7 で現行挙動の維持を明示）。
- **末尾コメント処理**: 影響なし。従来どおり削除される（R3）。
- **document プリセットの guardrail 記事 `comment-intent-not-logic`**: body を MUST 表現に書き換え、プリフィックス仕様を明示（R5）。他の既存記事は変更しない。
- **scan / DataSource / テンプレート / `analysis.json`**: 影響なし（スコープ外）。
- **既存コードベース**: 遡及的な書き換えは行わない。今後 SDD フロー経由で実装されるコードから段階的にプリフィックスコメントが付与される。
- **CLI コマンド・オプション**: 追加・削除・意味変更なし。

## Out of Scope

- scan / DataSource / テンプレートの変更
- ファイル役割タグ（`@role:` 等）の導入
- `analysis.json` への格納
- 既存コードへのプリフィックスコメントの一括追加（段階的改善として、今後 SDD フロー経由で実装されたコードに対して AI が自然に付与する）
- 初期 3 種以外のプリフィックス（開発者向けマーカーや将来検討対象のカテゴリ）

## Clarifications (Q&A)

- Q: サポートするプリフィックスは何か。
  - A: `WHY:` / `HACK:` / `SECURITY:` の 3 種。ドキュメント生成への入力価値を重視し、開発者メモ色の強いマーカーや乱用リスクの高い汎用マーカーは初期セットから除外した。
- Q: 書式の判定ルールは。
  - A: 大文字+コロン厳格一致。小文字や混在（`Why:` `why:` 等）は対象外。
- Q: 対象とするコメント構文は。
  - A: 単一行コメントのみ（JS: `//`、PHP: `//` および `#`、Python: `#`、YAML: `#`）。行頭コメント（前方に空白のみ）のみ対象とし、末尾コメントは対象外。ブロックコメント（`/** */` 等）は本変更のスコープ外で現行挙動を維持する。
- Q: コメント本文の自然言語は何か。
  - A: `config.docs.defaultLanguage` で指定された言語（ドキュメント出力先と一致）。guardrail で AI に指示する。
- Q: guardrail 記事は新設するか既存を拡張するか。
  - A: 既存 `comment-intent-not-logic` 記事を MUST 表現で拡張する。同一関心事を 2 記事に分けると AI が冗長に読むため。

## Alternatives Considered

- **最小 2 種 (`WHY:` / `SECURITY:`)**: ドキュメント本目的に絞れるが、既知の制約を示す `HACK:` の価値が高く却下。
- **Issue 原案の 5 種（3 種に加え開発者向けマーカー 2 種）**: 追加の 2 種は開発者向け色が強くドキュメント価値が低い、あるいは乱用リスクがあるため却下。
- **末尾コメント対応**: AI に「独立行で理由を書く」習慣を促すため採用しない。
- **新規 guardrail 記事として追加**: 関心事が同一のため既存記事統合が適切と判断し却下。
- **大文字小文字混在書式の許容**: 曖昧なコメント誤保持を避けるため厳格形式を採用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-17
- Notes: autoApprove モードで承認。gate PASS 後の最終仕様を承認。

## Requirements

優先順位は P1（必須）> P2（望ましい）。

- **R1 (P1):** When minify が単一行コメントを処理する際、If そのコメントが `WHY:` / `HACK:` / `SECURITY:` のいずれかで始まる（大文字・コロン直後）ならば、minify は shall そのコメント行を保持する。
- **R2 (P1):** When minify が単一行コメントを処理する際、If プリフィックスが R1 の 3 種のいずれにも完全一致しない（小文字、書式違い、未定義プリフィックスを含む）ならば、minify は shall そのコメント行を削除する。
- **R3 (P1):** When コメントがコード末尾に付与されている場合（例: `foo(); // WHY: ...`）、minify は shall プリフィックスの有無に関わらず当該コメント部分を削除する。
- **R4 (P1):** When minify がプリフィックス判定を行う際、対象言語ハンドラは shall JS / PHP / Python / YAML の 4 つとし、それぞれの単一行コメント構文（JS: `//`、PHP: `//` および `#`、Python: `#`、YAML: `#`）に対して同一のプリフィックス集合を適用する。
- **R5 (P1):** When AI が SDD フロー経由で実装を行う際、`document` プリセットの guardrail は shall プリフィックス付きコメントの記述を MUST 表現で指示する。
- **R6 (P2):** When AI がプリフィックス付きコメントを記述する際、コメント本文は shall `config.docs.defaultLanguage` で指定された自然言語で書かれる（guardrail にて指示）。
- **R7 (P2):** When minify がブロックコメント（`/** */` などの複数行コメント構文）を処理する際、minify は shall 現行の挙動を維持する。

## Acceptance Criteria

- プリフィックス付き単一行コメントを含むサンプル入力を各言語ハンドラの minify に通したとき、当該コメント行が保持される（ユニットテストで検証）。
- プリフィックスなし・書式違い（小文字・混在・未定義プリフィックス）のコメントが削除される（ユニットテストで検証）。
- コード末尾に付与されたプリフィックス付きコメントが削除される（ユニットテストで検証）。
- guardrail 記事 `comment-intent-not-logic` の body に `WHY:` `HACK:` `SECURITY:` の 3 プリフィックスが MUST 表現で明記されている。
- guardrail 記事に、コメント本文を `config.docs.defaultLanguage` で書く旨が MUST 表現で明記されている。

## Open Questions

なし
