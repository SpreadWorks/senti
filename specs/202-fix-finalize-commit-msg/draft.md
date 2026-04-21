---
issue: 197
---

# Draft: fix-finalize-commit-msg

**開発種別:** Bug fix

**目的:** `sdd-forge flow run finalize` の retro/report 用 post-commit が、実装変更やテスト・ドキュメント変更まで巻き込んで誤ったコミットメッセージで記録する問題を解消する。

## Mode

**Decision mode.** 本 draft は issue #197 のバグ修正に関する方針決定を目的とする。Q1〜Q5 の推奨・評価は全て「決定前提のレビュー対象」であり、brainstorming ではない。各 Q でユーザー承認を取得済み。

## 背景

`flow run finalize` は内部的に複数の git commit を発行する。そのうち retro/report 生成後の後処理コミットは、実装変更も含む全ての未コミット変更を取り込んでしまうため、`"chore: add retro and report"` というメッセージで実装コードがコミットされる事例が発生している（issue #197）。

結果として、git log / git blame による変更追跡が困難になり、PR レビュー時に差分の意図が読み取れない。

## 要件

優先度順（上から高）:

1. **finalize の retro/report 用 post-commit のスコープ限定**
   - When: `sdd-forge flow run finalize` が retro/report 生成後にコミットを発行する時
   - Shall: その post-commit は当該 spec ディレクトリ配下の変更のみをステージし、それ以外のファイルは取り込まないこと

2. **main commit 側の挙動保持**
   - When: finalize の主たるコミット（実装変更のコミット）が発行される時
   - Shall: 既存通り feature branch 全変更をステージし、`feat:` 系メッセージで記録すること（既存挙動を変えない）

3. **spec ディレクトリ配下の metadata ファイル全てを包含**
   - When: post-commit が spec ディレクトリをステージする時
   - Shall: retro / report / issue-log など spec ディレクトリ内に生成される全ての metadata ファイルを含められること

4. **未コミット残余の扱い**
   - When: post-commit 完了後に spec ディレクトリ外に未コミット変更が残っている場合
   - Shall: これらのファイルを post-commit にステージ／コミットせず、ワーキングツリー上で未コミットのまま保持すること（`git status` で可視化され、警告メッセージは追加しない）

5. **回帰防止**
   - When: 本修正が将来のリファクタで再び壊れた時
   - Shall: 自動テストで検知できること

## Q&A

### Q1: 問題の本質をどう捉えるか

**推奨: コミットスコープの汚染と捉える。** 根拠: ソースコード調査で post-commit が `git add -A` 相当の挙動を取っていることを確認。コミットメッセージ自体は retro/report 専用として意味が通るため、message 側を動的生成するより scope 側を固定する方が回帰リスクが小さい（guardrail: Single Responsibility）。

User 承認: [1] 採用

### Q2: ステージ対象の指定方法

**推奨: spec ディレクトリ単位で指定する。** 根拠: retro / report / issue-log など spec 関連 metadata は全て単一ディレクトリ配下に集約されている既存コード構造。ディレクトリ単位にすれば将来 metadata ファイルが追加されても拡張不要（guardrail: 既存コードパターンへの追従、Open/Closed 原則）。

User 承認: [1] 採用

### Q3: 残余の未コミット変更の扱い

**推奨: 警告ロジックを追加せず放置。** 根拠: 警告は新たな分岐・表示仕様・テストを増やす。そもそも main commit が正常終了すれば残余は発生しない想定。発生時は `git status` で可視化されるため、追加のガードは不要（CLAUDE.md: 過剰な防御コードを書かない）。

User 承認: [1] 採用

### Q4: テスト戦略

**推奨: ソース検査型の回帰テスト。** 根拠: 既存の finalize 関連テスト（issue #179 対策のテスト）と同じ方式。一時 git repo を使った実動作テストは setup コストが高く、bug の本質（add 範囲の指定）はソース検査で十分捉えられる。

User 承認: [1] 採用

### Q5: draft 承認

**推奨: このまま spec 作成フェーズへ進行する。** 根拠: Q1〜Q4 で方針と根拠が整理され、要件 1〜5 が When/Shall で明示済み、既存コードパターン（`run-finalize-retro-invocation.test.js`）に沿うテスト方式も選定済み。追加の未決事項は Open Questions に残っていない。

User 承認: [1] 採用（auto mode に切替）

## Alternatives Considered

- **Alt A: commit メッセージを変更内容に応じて動的生成** — 棄却。AI 判断に依存し新たなバグを生む。
- **Alt B: 個別ファイル列挙で add** — 棄却。拡張時のメンテナンスコストが高い。
- **Alt C: 未コミット残余の検知・warning** — 棄却。Q3 で議論済み。

## Impact

- `git log` / `git blame` 追跡性の回復
- PR レビュー可読性の向上
- 既存コマンドインターフェース・オプション・設定ファイル構造には変更なし

## Future Extensibility

- spec ディレクトリ配下に新しい metadata file を追加する場合、自動的に post-commit 対象に含まれる
- 将来 post-commit を複数段階に分ける変更が必要になっても、本修正の方針と独立に拡張可能

## User Confirmation

- [x] User approved this draft
