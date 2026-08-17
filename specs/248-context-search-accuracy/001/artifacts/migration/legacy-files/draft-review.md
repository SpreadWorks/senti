# Draft Review Results

6 issue(s) detected.

### 1. Issue #301 の本文が draft 内に含まれていないので、まず worktree 内の issue 記録や関連 spec を探して、QA が実際の要求を拾えているか確認します。ローカル検索では issue 番号や spec ファイルが見つかりませんでした。次に作業ディレクトリの構造を確認して、与えられた context 以外に参照できる材料があるか見ます。`.tmp` は一時サブディレクトリで、実体の worktree は親ディレクトリです。worktree 境界内の spec ディレクトリに Issue #301 関連の draft がありそうなので、そこを確認します。Issue 本文が `../specs/248-context-search-accuracy/issue.md` にありました。要求が 9 項目に分かれているので、QA がその意思決定ポイントを十分に覆っているかを照合します。### 1. keywords フィールド追加が未カバー
**QA:** NEW  
**Issue:** Issue #301 の項目1と5で、`spec.json` schema への `keywords: string[]` 追加、spec生成プロンプト、`extractGoalAndScope` の `spec.keywords` 利用が重要な変更点だが、QA が触れていない。  
**Suggestion:** `keywords` を optional にするか必須にするか、英語 5-15 個の生成指示をどのプロンプトに入れるか、既存 spec で keywords がない場合の fallback 条件を QA に追加する。

### 2. 2. 検索アルゴリズム本体の仕様確認が不足
**QA:** NEW  
**Issue:** per-word bigram、類似度 `>= 0.6`、`matchCount + totalScore`、imports/methods boost、dynamic N の min/max など、Issue の中心である検索精度改善が QA で扱われていない。  
**Suggestion:** スコア式、正規化方法、同点順序、`matchCount >= 2` の全採用、`matchCount = 1` の補填、最大30件 cap を具体化する QA を追加する。

### 3. 3. scope.in パスマッチの仕様が未カバー
**QA:** NEW  
**Issue:** Issue #301 は backtick で囲まれた `scope.in` のパス抽出と analysis entry への追加を明記しているが、QA にない。これは検索結果の coverage に直接影響する。  
**Suggestion:** backtick 抽出 regex、相対パスの照合方法、keyword 結果との dedupe、スコア順への混ぜ方を QA で確認する。

### 4. 4. Q1 は detail 除去と関連度順ソートを混同している
**QA:** Q1  
**Issue:** evidence は `buildDraftReviewPrompt` が `detail` を出していることしか支えていない。一方、関連度順ソートは prompt builder ではなく `contextSearch` の返却順や imports 展開後の merge 順の責務。  
**Suggestion:** Q1 を「review-draft でも detail 除去と relevance-order 説明文を入れるか」に絞り、別 QA で「sort は `contextSearch` 側で保証するか、prompt 側で並べ替えるか」を確認する。

### 5. 5. Q2 の「統合テスト不要」が強すぎる
**QA:** Q2  
**Issue:** 変更は純粋関数だけでなく、`contextSearch` の fallback chain、scope.in 追加、imports 展開、review prompt の contextEntries 表示、spec schema/prompt にまたがる。ユニットテストのみで十分という答えは根拠が弱い。  
**Suggestion:** ユニットテストに加えて、`contextSearch` の合成結果、`buildSpecReviewPrompt` / `buildDraftReviewPrompt` から `detail` が消えること、keywords fallback の小さな統合テストを含める方針に修正する。

### 6. 6. Q3 の hub 除外ルールが曖昧
**QA:** Q3  
**Issue:** 「接続数閾値のみ」では、閾値が Issue 指定の `>= 20` なのか、接続数を `imports + importedBy` で数えるのか、hub を直接検索結果からも除外するのか expansion path だけから除外するのかが不明。  
**Suggestion:** `connectionCount = imports.length + importedBy.length`、閾値 `>= 20`、除外対象は imports expansion の経路のみ、直接 keyword/scope.in match は保持、のように実装意味を明文化する。
