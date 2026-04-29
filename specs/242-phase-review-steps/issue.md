## Background

A proposal to introduce review steps — currently only present in the impl phase — to the draft, spec, and test phases as well. A previous attempt showed clear quality improvements, but was abandoned due to token cost concerns. Issue #0003 (token reduction) is a prerequisite.

## Role separation: gate vs. review

- gate = static; determines whether existing rules are followed
- review = AI-based judgment; determines whether goals are being met; reduces implementation gaps and blind spots through objectivity from an external agent

65% of review findings cannot be detected by gate (based on analysis of 87 findings).

## Design per phase

### draft review

- Goal: clarify requirements
- Target: draft content (questions + answers)
- Criteria: request / issue
- Context: lightweight index of analysis.json (push full path + keywords + summary)
- Placement: after gate-draft

Background: draft questions tend to be shallow, leading to repeated follow-up questions when instructed to "dig deeper." An external review can identify gaps in a single pass. Context is pushed broadly rather than narrowed down (narrowing reduces the review's ability to detect blind spots).

### spec review

- Goal: verify that the spec correctly and completely translates requirements into design
- Target: spec.json
- Criteria: draft content + request / issue
- Context: keyword search of analysis.json (keyword diff between draft ⊕ spec)
- Guardrails are excluded as they are gate's responsibility

Keyword XOR signals:
- Present in draft but not in spec → missed requirement
- Present in spec but not in draft → scope creep

### test review

- Goal: verify that tests are designed for each item in the spec's requirements list
- Target: test design / test code
- Criteria: spec.json (requirements list)
- Context: none (focus on matching requirements against tests)

### impl review (existing — no changes)

- Quality is satisfactory as-is. Token optimization is handled separately in #332c

## Prerequisites

- #0003 token reduction architecture key items (diff compaction, system prompt separation, phase summary reuse)

<details>
<summary>ja</summary>

[ENHANCE] 各フェーズに review ステップを導入（draft / spec / test）

## 背景

impl フェーズにのみ存在する review を draft / spec / test にも導入する構想。過去に試行した際、品質は明らかに向上したがトークンコストで断念した経緯がある。#0003（トークン削減）が前提条件。

## gate と review の役割分担

- gate = 静的。既存ルールに則っているかの判断
- review = AI による判断。目的を達成するための判断。外部エージェントによる客観性で実装漏れ・考慮漏れを削減

review の指摘の 65% は gate では検出不可能（87件の指摘を分析済み）。

## 各フェーズの設計

### draft review

- ゴール: 要求を明確にすること
- 対象物: draft 内容（設問 + 回答）
- 基準: request / issue
- 文脈: analysis.json 軽量インデックス（パス + keywords + summary を丸ごと push）
- 配置: gate-draft の後

背景: draft の設問が甘く、「深く調べて」と指示すると何度も追加質問が出る問題。外部 review で1回で穴を指摘できる。文脈は絞り込まず広く push する（絞ると review の盲点検出力が落ちる）。

### spec review

- ゴール: 仕様が要求を正しく・漏れなく設計に落とせているか
- 対象物: spec.json
- 基準: draft 内容 + request / issue
- 文脈: analysis.json キーワード検索（draft ⊕ spec キーワード差分）
- guardrail は gate の仕事なので除外

キーワード XOR シグナル:
- draft にあって spec にない → 要求の取りこぼし
- spec にあって draft にない → スコープクリープ

### test review

- ゴール: spec の要件リスト各項目に対してテストが設計されているか
- 対象物: テスト設計 / テストコード
- 基準: spec.json（要件リスト）
- 文脈: なし（要件×テストの突合に集中）

### impl review（既存・変更なし）

- 品質は現状で問題なし。トークン最適化は別タスク（#332c）で対応

## 前提条件

- #0003 トークン削減アーキテクチャの主要項目（diff compaction, system prompt 分離, phase summary 再利用）

</details>