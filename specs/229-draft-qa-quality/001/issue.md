## Overview

Improve the issue where discussion content from the Draft stage Q&A is lost without being reflected in spec/impl, and improve the quality of AI-generated questions.

## Changes

1. Q&A format expansion — Add Evidence / Why / Considered fields to each Q&A entry. Make Evidence mandatory for Q&As involving decisions.
2. Mandatory research → self-verification → question generation procedure — Incorporate a flow into the draft prompt requiring AI to investigate code and verify assumptions before generating questions.
3. Communication rule additions — Define in the draft prompt: consistent language usage, prohibition of undefined terms, and question self-containment.
4. Spec prompt revision — Add rules to transcribe Evidence/Why/Considered from the extended Q&A into spec's `overview.decisions[]`, `alternatives_considered[]`, and task `implementation_notes`.

## Background

- Discussion details from Draft Q&A are compressed into concise bullets in draft.md and fail to propagate to spec/impl
- AI asks questions based on assumptions, then checks the code after user correction, leading to "the premise was wrong" situations
- Depending on the model (especially Opus 4.7), question text quality degrades — undefined terms and mixed English/Japanese make questions hard to read

<details>
<summary>ja</summary>

[ENHANCE] Draft Q&Aの品質改善: エビデンスベースの質問生成とフォーマット拡張

## 概要

Draft段階のQ&Aにおいて、議論内容がspec/implに反映されず失われる問題、およびAIの質問品質の問題を改善する。

## 変更点

1. Q&Aフォーマット拡張 — 各Q&Aエントリに Evidence / Why / Considered フィールドを追加。判断を伴うQ&Aでは Evidence 必須とする。
2. リサーチ→自己検証→質問生成の手順義務化 — AIが質問する前にコードを調査し、前提を検証してから質問を生成するフローをdraftプロンプトに組み込む。
3. コミュニケーションルール追加 — 一貫した言語使用、未定義語禁止、質問の自己完結性をdraftプロンプトに規定。
4. specプロンプト改修 — 拡張Q&Aの Evidence/Why/Considered を spec の overview.decisions[], alternatives_considered[], task implementation_notes へ転記するルールを追加。

## 背景

- Draft Q&Aで詳細に議論した内容がdraft.mdの簡潔なbulletに圧縮され、spec/implに伝搬しない
- AIが仮定ベースで質問し、ユーザー指摘後にコード確認して「前提が間違っていた」となるケースがある
- モデル（特にOpus 4.7）によって質問の文章品質が低下し、未定義語の使用や英日混合文で読みづらい

</details>