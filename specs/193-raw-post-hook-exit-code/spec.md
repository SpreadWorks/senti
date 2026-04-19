# Feature Specification: 193-raw-post-hook-exit-code

**Feature Branch**: `feature/193-raw-post-hook-exit-code`
**Created**: 2026-04-19
**Status**: Ready for approval
**Input**: Issue #177 — [BUG] post hook failure in raw mode not reflected in exit code

## Goal

コマンドディスパッチ層の post hook 失敗が、出力モード（envelope / raw）に依存せずプロセス終了コード（exit code 1）として呼び出し側に伝わるようにする。

## Scope

- post hook が失敗した場合の exit code を envelope mode / raw mode の両方で 1 に統一する。
- envelope mode では既存の warning（POST_HOOK_FAILED）記録を維持しつつ、exit code を 1 にする。
- raw mode では既存の stderr 出力を維持しつつ、exit code を 1 にする。

## Out of Scope

- envelope の ok フラグ（Command 本体の成功/失敗を表す）の意味変更。
- post hook が output 書き出しの後に実行される設計の再検討（Issue Related 欄の 1877 残存課題）。
- pre hook / onError hook の exit code 挙動変更。
- post hook 失敗を warning ではなく error として envelope に積む拡張。

## Clarifications (Q&A)

- Q: post hook 成功時の挙動は変わるか？
  - A: 変わらない。exit code は現状維持。
- Q: envelope の ok フラグを反転するのか？
  - A: しない。Command 本体の成否を示す既存セマンティクスを保つ。
- Q: raw mode で stderr 出力は残すのか？
  - A: 残す。観測性を落とさない。
- Q: 出力モード判定の基準は何か？
  - A: 各 Command クラスの出力モード宣言。既存のディスパッチロジックから変更しない。
- Q: post hook の非同期例外も対象か？
  - A: 対象。同期・非同期いずれの throw も exit code 1 に反映する。

## Alternatives Considered

- **envelope の ok を反転する案:** warning と error のセマンティクス区別が崩れ、Command 本体成功の事実が失われるため却下。
- **raw mode のみ修正する案:** Issue が「envelope/raw の扱いを明示的に統一する」ことを求めているため却下。envelope mode の exit 0 もバグとして扱う。
- **post hook 失敗を failure 経路に合流させる案:** Command 本体成功と本体失敗が区別不能になるため却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19 (autoApprove)
- Notes: Issue #177 の提案に従い、両モードで post hook 失敗を exit code 1 に統一する方針を承認。

## Requirements

優先度順に記載。

1. **[P0] post hook が失敗した場合、exit code は 1 となる。** envelope mode / raw mode の両方で成立する。
2. **[P0] envelope mode では、post hook 失敗時に envelope の warnings に POST_HOOK_FAILED エントリが記録される。** envelope の ok フラグは true を維持する（Command 本体は成功している事実を保全する）。
3. **[P1] post hook 成功時、および post hook が定義されていない場合、exit code は現状の挙動を維持する。**
4. **[P1] Command 本体が失敗した場合、および pre hook が失敗した場合の exit code 挙動は変更されない（従来どおり 1）。**
5. **[P2] raw mode では、post hook 失敗時に stderr に失敗内容を示すメッセージが 1 行以上出力される。**
6. **[P2] post hook が同期例外または非同期例外（Promise reject）で失敗した場合、どちらも同じく exit code 1 となる。**

## Acceptance Criteria

- envelope mode で post hook が失敗する状況を再現したとき、プロセスの exit code が 1 である。envelope JSON には ok=true と warnings 配列内の POST_HOOK_FAILED エントリが含まれる。
- raw mode で post hook が失敗する状況を再現したとき、プロセスの exit code が 1 である。stderr に失敗メッセージが出力されている。
- envelope mode で post hook が成功する（または post hook が未定義）とき、exit code は従来と同じである。
- raw mode で post hook が成功する（または post hook が未定義）とき、exit code は従来と同じである。
- pre hook 失敗時、Command 本体失敗時の exit code は従来と同じ 1 である。

## Migration / Backward Compatibility

- CLI コマンド名・オプション・envelope の JSON スキーマは変更しない。
- 変更されるのは「post hook 失敗時の exit code 0 → 1」のみ。従来の 0 はバグ固定化された挙動であり、本変更はバグ修正として位置付ける。
- CHANGELOG に「post hook 失敗が exit code 1 として反映されるようになった」旨を明記する。
- 呼び出し側が post hook 失敗を許容する必要がある場合は、envelope mode の warnings を参照して独自に exit code を評価する。

## Open Questions

なし（autoApprove 自己 Q&A で全項目解消済）
