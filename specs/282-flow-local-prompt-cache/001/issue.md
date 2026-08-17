## Target
AI agent call boundary. Main target files are src/lib/agent.js, src/lib/flow-store.js, src/lib/agent-metrics.js, and, if needed, .sdd-forge/flow state or spec-local artifacts.

## Problem
Exact duplicate prompts exist across multiple phases in the saved prompt logs. When the same prompt is resent, CLI invocation, latency, retries, and log volume still occur even if the provider-side prompt cache is effective. In configurations where the provider cache is not effective, input cost is also incurred again.

## Cause
The current Agent.call invokes the provider every time, even when commandId, systemPrompt, userPrompt, jsonSchema, and fmtFallback are identical. There is no mechanism to save and reference a flow-local prompt hash and successful response.

## Investigation / Verification Results
After re-aggregating .tmp/logs/prompts/**/*.json, duplicate surplus for the same hash including entryCommand and system/user prompts was 572 calls and 12,703,553 chars. By phase, gate-impl had 46 duplicate groups and 6,944,508 chars, review had 125 groups and 1,765,232 chars, review-draft had 863,363 chars, and review-spec had 749,214 chars. The duplicates are not limited to a single phase, so handling them at the agent call boundary makes reuse easier.

## Simple Simulation
Even if a flow-local cache only returns successful responses, it could avoid resending up to 572 provider calls and the equivalent of 12.7M chars for exact duplicates in the saved logs. gate-impl alone has the equivalent of 6.9M chars of duplication, and even after priority 1 prompt reduction, this remains effective for suppressing retries and re-execution with identical inputs.

## Improvement Direction
Compute the cache key immediately before the provider call in Agent.call. The key should be the sha256 of commandId, provider, profileKey, systemPrompt, userPrompt, jsonSchema, and fmtFallback. Only successful responses should be saved; empty responses, failures before schema parsing, and provider errors should not be cached. Initially, limit this to the active flow or spec-local artifact, and do not create a global cache. Record cacheHit/cachedResponse or similar in metrics so provider calls and cache hits can be distinguished.

## Proposed Acceptance Criteria
- On the second call with the same commandId/provider/profileKey/system/user/schema/fallback, the provider is not called and the saved response is returned.
- Cache hit does not occur when provider/profileKey or systemPrompt/userPrompt differ.
- Failed responses and empty responses are not cached.
- Cache hits can be confirmed in metrics or runtime logs.
- The cache is scoped to the active flow or spec-local scope and does not leak to another project or another flow.

## Reason to Put This on the Board
Separate from prompt structure optimization, there is an observed waste caused by resending identical inputs. The amount of duplication has already been quantified from saved logs, and because this improvement is contained at the agent boundary and benefits multiple phases, it is worth tracking as an independent improvement task.

<details>
<summary>ja</summary>

[ENHANCE] flow-local prompt hash cache で同一 prompt 再送を抑止

## 対象
AI agent 呼び出し境界。主な対象ファイルは src/lib/agent.js、src/lib/flow-store.js、src/lib/agent-metrics.js、必要に応じて .sdd-forge/flow state または spec-local artifact。

## 問題
保存済み prompt log に exact duplicate prompt が複数 phase で存在する。同じ prompt を再送すると、provider 側の prompt cache が効く場合でも CLI 呼び出し、待ち時間、retry、ログ量は発生し、provider cache が効かない構成では入力コストも再発生する。

## 原因
現行の Agent.call は commandId、systemPrompt、userPrompt、jsonSchema、fmtFallback が同一でも毎回 provider を呼び出す。flow-local な prompt hash と成功応答を保存・参照する仕組みがない。

## 調査・検証結果
.tmp/logs/prompts/**/*.json を再集計した結果、entryCommand と system/user prompt を含めた同一 hash で duplicate 余剰は 572 calls、12,703,553 chars。phase 別では gate-impl が 46 duplicate groups、6,944,508 chars、review が 125 groups、1,765,232 chars、review-draft が 863,363 chars、review-spec が 749,214 chars。重複は単一 phase に限定されず、agent 呼び出し境界で扱う方が再利用しやすい。

## 簡易シミュレーション
flow-local cache が成功応答を返すだけでも、保存ログ上の exact duplicate に対して最大 572 provider calls、12.7M chars 相当の再送を避けられる。gate-impl だけでも 6.9M chars 相当の重複があり、優先度 1 の prompt 縮小後も retry や同一入力再実行の抑止として効果が残る。

## 改善方向
Agent.call の provider 呼び出し直前で cache key を計算する。key は commandId、provider、profileKey、systemPrompt、userPrompt、jsonSchema、fmtFallback の sha256 とする。保存対象は成功応答のみとし、空応答、schema parse 前の失敗、provider error は cache しない。最初は active flow 内または spec-local artifact に限定し、グローバル cache は作らない。metric には cacheHit/cachedResponse などを記録し、provider call と cache hit を区別できるようにする。

## 受け入れ条件案
- 同一 commandId/provider/profileKey/system/user/schema/fallback の 2 回目呼び出しで provider が呼ばれず、保存済み応答が返る。
- 異なる provider/profileKey または systemPrompt/userPrompt では cache hit しない。
- 失敗応答や空応答は cache されない。
- metrics または runtime log で cache hit が確認できる。
- cache は active flow または spec-local scope に閉じ、別プロジェクト・別 flow に漏れない。

## ボードに置く理由
prompt 構造の最適化とは別に、同一入力の再送という観測済みの無駄がある。重複量は保存ログから定量化済みで、agent 境界に閉じた改善として複数 phase に効くため、独立した改善タスクとして扱う価値がある。

</details>