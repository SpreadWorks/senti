# Draft: raw mode post hook failure → exit code 反映

**Development Type:** bug fix

**開発種別:** バグ修正

**Goal:** post hook の失敗が出力モード（envelope / raw）に関わらずプロセス終了コードに反映されるよう振る舞いを統一する。

**目的:** post hook 失敗時に呼び出し側（スクリプト・CI）がコマンドを「成功」と誤認しないようにする。envelope mode と raw mode の扱いを揃える。

関連 Issue: #177

モード: **Decision** — Issue とコード調査で方針は確定している。以下の Q&A は確定方針の提示であり、ブレインストーミング段階ではない。

## 背景

コマンド実行のディスパッチ層には、Command 成功後に走る post hook がある。post hook 失敗時の扱いが出力モードごとに異なる。

- **envelope mode:** 失敗を envelope の warning として記録するが、コマンド全体としては成功扱い（exit code 0）。
- **raw mode:** stderr に失敗メッセージを書くが、exit code は 0 のまま。

いずれの場合も、post hook の失敗が呼び出し側に exit code で伝わらない。

## 要件（優先度順）

優先度は「呼び出し側が正しく失敗を検知できるか」を最上位に、内部セマンティクスの保全を次点に置く。

1. **[P0] post hook が失敗したら exit code は非 0（1）になる。** モードに依存しない。
2. **[P0] Command 本体が成功していた事実は失われない。** envelope mode では「Command 結果は ok、ただし post hook で warning」という情報を引き続き保持する。
3. **[P1] 既存の成功パス（post hook なし、または post hook 成功）の exit code は現状を維持する。**
4. **[P2] 失敗検知のための観測性を保つ。** envelope mode では envelope 内の warning エントリとして POST_HOOK_FAILED を保持する。raw mode では stderr に post hook 失敗を示すメッセージを 1 行以上出力する。

## 受け入れ基準

- post hook が例外で失敗したとき、envelope mode でも raw mode でも exit code が 1 になる。
- envelope mode では envelope に POST_HOOK_FAILED 相当の warning が残り、envelope 自体は「成功（ok=true）+ warning」として表現される。
- raw mode では stderr に post hook 失敗のメッセージが出力される。
- post hook が成功した場合、および post hook が未定義の場合の exit code は変更されない。
- pre hook / Command 本体の失敗時の挙動は変更されない（すでに exit 1）。

## Q&A

### Q1: ユーザーの意図は何か？

raw mode で post hook 失敗時に exit code が 0 のままとなる問題を修正したい。envelope mode と扱いを統一する。

**推奨:** そのまま修正を進める。

**根拠（Issue #177 本文）:** 「呼び出し側は JSON/終了コードを『成功』と判断するが、実は post hook が失敗している可能性がある」と明記されており、呼び出し側の失敗検知が不可能な点がバグであると示されている。 → [1] はい (autoApprove)

### Q2: 修正方針は？

**推奨:** 両モードで post hook 失敗時に exit code を 1 にする。envelope では warning を残しつつ exit を 1 に変更、raw では stderr 出力に加えて exit を 1 に変更。

**根拠:**
- **Issue #177 提案:** raw mode の exit code を修正する案と envelope/raw で方針を統一する案の両方を同時に満たすため。
- **既存の振る舞いとの一貫性:** pre hook 失敗・Command 本体失敗はすでに exit 1 で呼び出し側に伝わる。post hook 失敗だけが exit 0 になる非対称性を解消する方向。
- **guardrail「Unambiguous Requirements」:** 「成功とは何か」を出力モードに依存させない。exit code を単一の真実の源とする。

### Q3: 既存テストへの影響は？

**推奨:** 現状を誤って固定化しているテスト（post hook 失敗で exit 0 を期待するもの）があれば、「正しい振る舞い」を表現するよう更新する。テストを合わせるためにプロダクトコードを緩めない。

**根拠（プロジェクトルール CLAUDE.md「テスト」節）:** 「テストを通すためにテストコードを修正してはならない。テスト失敗時はまずシナリオの妥当性を確認し、妥当であればプロダクトコードを修正する」。本件ではシナリオ（= exit 0 期待）自体がバグを固定化しているため、シナリオを仕様に合わせて書き直す側に該当する。

### Q4: スコープ外の事項

**推奨:** 以下を本スコープ外とする。

- envelope の ok セマンティクスの変更。
- post hook が output 書き込み後に走る設計の再検討（Issue 関連欄で言及されている 1877 残存課題）。
- pre hook・onError hook の exit code 扱い。

**根拠（Issue #177 本文）:** Issue は「exit code への反映」「envelope/raw の統一」を提案しており、他の設計論点は「Related」欄で別課題として切り出されている。プロジェクトルール「spec のスコープ外であっても、変更したファイル内の明らかな一貫性の問題は修正してよい」に照らしても、ok セマンティクスの変更は一貫性欠如ではなく設計判断の変更であり、別 spec が妥当。

### Q5: エッジケース

**推奨対応:** 以下のエッジケースに対して明示的な振る舞いを仕様化する。

- post hook と Command 本体の両方が成功した場合 → exit code は現状維持。
- Command 本体が失敗した場合 → post hook は呼ばれない（現状維持）。失敗経路は変更しない。
- post hook が成功した場合 → exit code は現状維持。
- post hook が同期的または非同期的に throw する場合 → どちらも exit code 1。

**根拠（guardrail「Complete Context」）:** condition/outcome の対を網羅することで「想定外」を減らすため、成功・失敗・未定義・同期/非同期の各分岐を明示した。

### Q6: 代替案と却下理由

**推奨:** Q2 の推奨案（両モードで setExit(1)、envelope の ok は保持）を採用する。以下は検討済み却下案。

- **A. envelope の ok フラグを反転する。** 却下。
  - **根拠:** warning は warning、error は error というセマンティクスの区別を既存 envelope 仕様が明示している。これを崩すと envelope 仕様全体の整合が損なわれる。
- **B. raw mode だけ修正する。** 却下。
  - **根拠（Issue #177）:** envelope/raw の扱いを「明示的に統一する」ことが Issue の提案であり、片側だけの修正は要件を満たさない。
- **C. post hook 失敗を完全な失敗扱いとして failure 経路に合流させる。** 却下。
  - **根拠（要件 P0-2）:** Command 本体成功 + post 失敗と Command 失敗を区別できなくなる。

### Q7: 将来の拡張

**推奨:** 今回はスコープ外とする。将来、post hook を warning ではなく error として envelope に積みたい要求が出た場合、warning / error の選択を post hook 側で宣言制御する設計を別 spec で検討する。

**根拠（プロジェクトルール CLAUDE.md「過剰な防御コードを書かない / 薄いラッパーより深いモジュール」）:** 現時点で具体的ユースケースが無い拡張ポイントを先行実装すると、無駄な抽象層が発生する。需要が顕在化してから設計する方針が妥当。

## 互換性と移行計画

本変更は CLI コマンド名・オプション・envelope JSON スキーマには影響しない。影響するのは post hook が失敗したケースの exit code のみ（従来 0 → 変更後 1）。

- **影響するユーザ:** post hook の失敗を exit code で検知せず 0 を前提に後続処理を繋いでいる自動化スクリプト。
- **移行指針:** 本件はバグ修正であり、「post hook 失敗 = exit 0」は仕様ではなくバグである旨を CHANGELOG に明記する。sdd-forge は alpha 期間中のため、破壊的変更としてのアナウンスより「バグ修正」として記載する。
- **観測手段:**
  - envelope mode では従来どおり envelope の warnings 配列に POST_HOOK_FAILED が残るため、ok + warnings で「Command 本体は成功、post hook のみ失敗」を判別可能。
  - raw mode では従来どおり stderr に失敗メッセージが出る。
- **ユーザ対応手順:** 呼び出し側が post hook 失敗を許容したい場合は、warnings を見て独自に exit code を握り潰す or envelope mode を使って warning を解釈する。

## Test Strategy

- 観点: dispatcher の出力モードごとに post hook 失敗時の exit code と副次出力（warning / stderr）を検証する。
- 種別: unit テスト。dispatcher の公開契約（破綻したら常にバグ）であるため、長期メンテされる formal テストとして配置する。
- 検証項目:
  - envelope mode × post hook 失敗 → exit code 1、warning が含まれる、envelope の ok は true。
  - raw mode × post hook 失敗 → exit code 1、stderr に失敗メッセージ。
  - 両モード × post hook 成功 → exit code は現状維持。
  - 両モード × post hook 未定義 → exit code は現状維持。

## Open Questions

なし（autoApprove 自己 Q&A で全項目に推奨と理由を提示済）。

## User Confirmation

- [x] User approved this draft (autoApprove)
- 承認日時: 2026-04-19
