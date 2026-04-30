### Fix Strategy

#### 1. Add English keyword field to spec.json
- Add `keywords: string[]` to the spec.json schema
- Instruct AI to generate 5–15 English keywords from the full spec content during the draft → spec phase
- Include "keywords must be in English" in the prompt, similar to enrich

#### 2. Replace ngramSearch with per-word comparison
- Current: bigramizes the entire query as one string (structural flaw)
- Fix: split the query into words and compute individual bigram similarity for each query word × each entry keyword
- Include a candidate if any pair has similarity >= 0.6
- Rank entries by matched keyword count + total score

#### 3. Incorporate imports / methods into scoring
- Add `(imports / maxImports) * 0.5 + (methods / maxMethods) * 0.3`
- Exclude usedBy (adds noise)

#### 4. Control result count with dynamic N (multi-match strategy)
- Include all entries where matchCount >= 2
- Fill in entries with matchCount = 1 from the top scorers
- Total: minimum 5, maximum 30 (hard cap)
- Determined dynamically based on match quality, not static thresholds or fixed counts

#### 5. Switch extractGoalAndScope to spec.keywords
- Change `extractGoalAndScope(spec)` → `spec.keywords.join(" ")`
- Fallback: if keywords are absent, extract English words from the traditional goal+scope

#### 6. Path matching from scope.in (E)
- Extract file paths enclosed in backticks from spec.json's scope.in using regex
- Match against analysis entries and add matching files to keyword search results
- Average +1.3 entries, +13pp coverage improvement, near-zero noise

#### 7. imports expansion (A: depth=1, exclude hubs)
- Expand imports of files found via keyword search + scope.in matching by one level
- Exclude hub files (connection count >= 20: container.js, base-command.js) from expansion paths
- importedBy (reverse direction) is ineffective and not used
- Averages +16 entries but stays at ~21.7, below the current ~27

#### 8. Remove detail from contextEntries
- Remove the detail field from contextEntries format passed to the review-spec prompt
- file + summary alone is sufficient for spec omission detection (review checks spec coverage, not implementation correctness)
- detail averages 479 chars/entry; ~2,700 token reduction across 21.7 entries (73% reduction per entry)

#### 9. Sort contextEntries by relevance and state this in the prompt
- Return contextSearch results in descending score order (already score-ordered, but imports-expanded entries are currently appended at the end)
- Add one line to the prompt: "The following files are listed in order of relevance to the spec"
- Guides AI attention allocation to focus analysis on top-ranked files
- Near-zero additional token cost (one line only)
- Use "relevance order" not "importance order" (scores reflect keyword match strength, not file importance)

### Expected Impact
- Current: ~27 entries / ~4,590 tokens (worst case 77 entries / ~13K tokens)
- After improvement: ~21.7 entries / ~977 tokens (20% fewer entries, 79% fewer tokens)
- Additional reduction from removing detail: ~3,689 → ~977 tokens
- Significant reduction in review-spec cacheCreate → expected daily cost savings

### Simulation Results (Reference)

#### Keyword Search Improvement Validation
| Method | Coverage | Avg N |
|--------|----------|-------|
| Current (Japanese → fallback/ngram mixed) | Baseline | ~27 |
| Per-word bigram + imports/methods boost + top-20 | 72% | ~15 |
| Per-word bigram + multi-match strategy (dynamic N) | 72% | 10 |

#### Expansion Strategy Validation
| Strategy | Coverage | Avg Count |
|----------|----------|-----------|
| Base only | 32% | 5.0 |
| Base + E (scope.in) | 45% | 5.7 |
| Base + A (imports d=1) | 48% | 21.2 |
| **Base + A + E** | **55%** | **21.7** |

#### Prompt Information Density Validation
| Information passed | Per entry | 21.7 entries total |
|--------------------|-----------|--------------------|
| file + summary + detail | ~170 tokens | ~3,689 |
| **file + summary** | **~45 tokens** | **~977** |
| file only | ~12 tokens | ~260 |

#### Rejected Approaches
- B (summary/detail search): average 81 entries, noisier than current
- C (chapter expansion): average 125 entries, chapter granularity too coarse
- importedBy expansion: no coverage contribution, only increases noise
- depth=2 expansion: balloons to average 50 entries even with hub exclusion

### Affected Scope
- `src/flow/lib/get-context.js`: rewrite ngramSearch, add dynamic N logic, add imports expansion and scope.in matching, sort results by score
- `src/flow/commands/review.js`: fix extractGoalAndScope, remove detail from buildSpecReviewPrompt, add relevance-order description
- spec.json schema / spec generation prompt: add keywords field
- No other impact (contextSearch callers are only the 2 locations in review.js)

<details>
<summary>ja</summary>

[ENHANCE] contextSearch 検索精度改善とトークンコスト削減

### 修正方針

#### 1. spec.json に英語キーワードフィールドを追加
- spec.json スキーマに `keywords: string[]` を追加
- spec 生成時（draft → spec フェーズ）に AI が spec 全体の内容から英語キーワード 5-15個を生成するよう指示
- enrich と同様に "keywords must be in English" をプロンプトに含める

#### 2. ngramSearch を単語別比較に置き換え
- 現状: クエリ全体を1文字列として bigram 化（構造的欠陥）
- 修正: クエリを単語分割し、各クエリ単語 × 各 entry keyword で個別に bigram 類似度を計算
- 1つでも類似度 >= 0.6 のペアがあれば候補に含める
- entry ごとにマッチしたキーワード数 + スコア合計で順位付け

#### 3. スコアリングに imports / methods を加味
- `(imports / maxImports) * 0.5 + (methods / maxMethods) * 0.3` を加算
- usedBy は加えない（ノイズになるため）

#### 4. 動的 N（multi-match 戦略）で結果件数を制御
- matchCount >= 2 のエントリは全て採用
- matchCount = 1 のエントリはスコア上位から補填
- 合計で最低 5件、最大 30件（ハードキャップ）
- 静的な閾値や固定件数ではなく、マッチの質に基づいて動的に決定

#### 5. extractGoalAndScope を spec.keywords に切り替え
- `extractGoalAndScope(spec)` → `spec.keywords.join(" ")` に変更
- fallback: keywords がない場合は従来の goal+scope から英語単語を抽出

#### 6. scope.in からのパスマッチ（E）
- spec.json の scope.in に含まれるファイルパス（バッククォートで囲まれたもの）を正規表現で抽出
- analysis entry と突き合わせ、一致するファイルをキーワード検索結果に追加
- 平均 +1.3件の追加で +13pp のカバー率向上。ノイズほぼゼロ

#### 7. imports 展開（A: depth=1, hub除外）
- キーワード検索 + scope.in マッチで見つかったファイルの import 先を1段階展開
- hub ファイル（接続数 >= 20: container.js, base-command.js）は展開経路から除外
- importedBy（逆方向）は効果がないため使わない
- 平均 +16件だが、現状の ~27件より少ない ~21.7件に収まる

#### 8. contextEntries から detail を除去
- review-spec プロンプトに渡す contextEntries のフォーマットから detail フィールドを除去
- file + summary のみで spec 見落とし検出には十分（review は実装の正しさではなく spec の網羅性を見る）
- detail は平均 479文字 / entry。21.7件で ~2,700 tokens の削減（entry あたり 73%減）

#### 9. contextEntries を関連度順にソートし、その旨をプロンプトに明示
- contextSearch の結果をスコア降順で返す（現状もスコア順だが、imports 展開分は末尾に付加）
- プロンプトに「以下のファイルは spec との関連度順に並んでいます」の1行を追加
- AI の注意配分を誘導し、上位ファイルに重点的な分析を促す
- 追加トークンコストはほぼゼロ（1行のみ）
- 「重要度順」ではなく「関連度順」とする（スコアはキーワードマッチの強さであり、ファイルの重要度とは異なるため）

### 期待効果
- 現状: ~27件 / ~4,590 tokens（最悪 77件 / ~13K tokens）
- 改善後: ~21.7件 / ~977 tokens（件数 20%減、トークン 79%減）
- detail 除去による追加削減: ~3,689 → ~977 tokens
- review-spec の cacheCreate 大幅削減 → 日次コスト削減見込み

### シミュレーション結果（参考）

#### キーワード検索改善の検証
| 方式 | カバー率 | 平均N |
|------|---------|------|
| 現状（日本語→fallback/ngram混在） | ベースライン | ~27 |
| 単語別bigram + imports/methods boost + top-20 | 72% | ~15 |
| 単語別bigram + multi-match戦略（動的N） | 72% | 10 |

#### 展開戦略の検証
| 戦略 | カバー率 | 平均件数 |
|------|---------|---------|
| Base のみ | 32% | 5.0 |
| Base + E（scope.in） | 45% | 5.7 |
| Base + A（imports d=1） | 48% | 21.2 |
| **Base + A + E** | **55%** | **21.7** |

#### プロンプト情報量の検証
| 渡す情報 | entry あたり | 21.7件合計 |
|---------|------------|----------|
| file + summary + detail | ~170 tokens | ~3,689 |
| **file + summary** | **~45 tokens** | **~977** |
| file のみ | ~12 tokens | ~260 |

#### 不採用とした案
- B（summary/detail検索）: 81件平均、ノイズが現状より悪化
- C（chapter展開）: 125件平均、chapter粒度が粗すぎる
- importedBy展開: カバー率に寄与せずノイズのみ増加
- depth=2 展開: hub除外でも50件平均に膨張

### 影響範囲
- `src/flow/lib/get-context.js`: ngramSearch の書き換え、動的N ロジック追加、imports展開・scope.inマッチ追加、結果をスコア順にソート
- `src/flow/commands/review.js`: extractGoalAndScope の修正、buildSpecReviewPrompt から detail 除去、関連度順の説明文追加
- spec.json スキーマ / spec 生成プロンプト: keywords フィールド追加
- 他への影響なし（contextSearch の呼び出し元は review.js の2箇所のみ）

</details>