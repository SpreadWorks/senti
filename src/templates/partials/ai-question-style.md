<!-- ai-question-style.md — shared style rules for AI-generated questions and choices -->

## AI Question / Choice Style Rules

These rules apply to every question and option block that the AI presents to the user.
The goal is to produce output that is consistent in granularity, tone, and structure
regardless of which model renders it.

### 1. 文体 (Prose Style)

- 結論先出し。前置き・総括文を省く。
- 一文を短く。修飾の入れ子を避ける。
- 体言止め・箇条書きで密度を上げる。
- 二重譲歩を畳む。
- 曖昧な修飾語を避ける: `strict`, `autonomous`, `low impact`, `backward-compatible`,
  `appropriate`, `fast`, `easy` など検証不能な語。検証可能な条件に書き換える。

**悪い例:**
> 既存機能への影響はおそらく低く、互換性を保てるような形で統合される可能性があります。

**良い例:**
> 既存機能への影響なし。R1 / R2 のみ追加。既存本文は変更しない。

### 2. 前提知識 (Assumed Knowledge)

- 専門用語を出したら 1-2 行で定義を添える。
- 読者が該当コードを開いていない前提で書く。
- 関数名・ファイル名・CLI だけ挙げず、何をするものか短く記す。

**悪い例:**
> buildGuardrailPrompt を差し替えて agent.call のコストを下げます。

**良い例:**
> `buildGuardrailPrompt` (= gate 評価 prompt を組み立てる関数) を置換。
> agent.call は Claude / codex CLI を外部 spawn する関数で、呼び出し 1 回が数秒コスト。

### 3. 選択肢提示 (Choice Presentation)

- 選択肢ブロック内は「ラベル」＋「1 行注釈」のみ。複数行の説明を詰めない。
- 比較・評価・pros/cons の詳細は、選択肢ブロックの外（上側の本文）に独立配置する。
- 推奨案があれば明示し、根拠を 1-2 行で添える。
- 推奨案がある場合、推奨案を `[1]` に配置する。同率トップ（僅差）が複数ある場合は 1 件を `[1]` に置き、残り候補は本文側で補足する。推奨案が無い場合は配置ルールを発動させない（並び順は自由）。
- 選択肢内に新規 API / ファイル / コマンドを挙げるときは、本文側で以下を 3-5 行示す:
  - 関数: シグネチャ例（引数型・戻り値型・呼び出し例）
  - CLI: 呼び出し例と出力 JSON 例
  - ファイル: 想定される中身のスケッチ

**悪い例（選択肢内に詳細を詰め込む）:**

```
  [1] 共通パーシャル化
      pros: DRY。編集が 1 箇所で済む。既存の include 基盤を流用できる。
            upgrade でユーザーに反映される。
      cons: get-step-instructions.js の改修が必要。既存パーサーを流用するので
            コスト小。
  [2] コピー埋め込み
      ...
```

**良い例（本文で比較、選択肢はラベル + 短注釈）:**

> 共通パーシャル化 vs コピー埋め込みの比較:
>
> | 方式 | 編集コスト | 同期リスク | 実装差分 |
> |---|---|---|---|
> | パーシャル | 1 箇所 | なし | ローダ改修あり |
> | コピー | 2 箇所 | あり | なし |

```
  [1] 共通パーシャル化（推奨）
  [2] コピー埋め込み
```
