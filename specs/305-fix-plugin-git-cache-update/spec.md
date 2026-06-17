# Feature Specification: 305-fix-plugin-git-cache-update

**Feature Branch**: `feature/305-fix-plugin-git-cache-update`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #397

## Goal
senti plugin update-all が Git URL source cache を更新するとき、fetch 後の stale HEAD ではなく決定論的に解決した target commit を採用する。

## Background
既存の Git URL source cache 更新では、既存 cache に対して git fetch --all --tags を実行しても、source.ref 未指定時に checkout / reset を行わず git rev-parse HEAD を読む。そのため cache の local branch が origin/<branch> より behind の場合、古い HEAD が update 後 commit として扱われ、plugin update-all の JSON result が previousCommit と同じ commit、updated:false になる。Git URL cache は .senti/plugin-sources/ 配下の managed area であり、dirty state も stale HEAD 採用の原因になり得る。修正は fetch 後の target revision 解決、managed cache self-heal、public behavior parity を同時に満たす必要がある。

## Scope
- src/lib/plugin-registry.js の Git URL source cache update path を修正する。
- src/plugin.js の plugin update-all contract を維持し、resolved commit に基づく updated 判定を保証する。
- Git URL source.ref 未指定時の remote default branch 解決を定義する。
- Git URL source.ref 指定時の branch / tag / SHA 相当解決を定義する。
- .senti/plugin-sources/ 配下の dirty managed cache self-heal を実装する。
- behind-remote cache、dirty managed cache、source.ref 解決、public behavior parity の spec-local regression coverage を追加する。

## Out of Scope
- local path plugin source の dirty rejection behavior は変更しない。
- npm source support は追加しない。
- npm publish / dist-tag 操作は行わない。
- plugin command help 文言は必要がなければ変更しない。

## Constraints
- src/ 以下に特定ユーザーの plugin id、repository URL、local path を固定値として埋め込まない。
- 外部依存を追加せず、Node.js built-in module と既存 process / plugin-registry helper の範囲で実装する。
- dirty cache self-heal は Git URL source cache under .senti/plugin-sources/ に限定し、local path source の dirty rejection は維持する。
- Git URL managed cache の reset / clean / delete / reclone は、resolved cache path が current root の .senti/plugin-sources/ 配下であることを検証できる場合だけ実行する。unsafe source id または path traversal は拒否する。
- migration-parity: plugin update-all、plugin source add/update/find/install、setup official preset resolution、.senti/plugin-sources、.senti/plugins、.senti/config.json、.senti/config.local.json の public behavior を inventoried surface として扱う。
- bounded-resource-usage: cache reset / clean / reclone の retry や fallback は単発または明示的な上限付き処理にする。

## Design Principles
- Git URL source resolution は stale checkout state に依存せず、fetch 後に target revision を解決してから commit を採用する。
- Managed cache は user workspace ではなく再生成可能な runtime area として扱い、dirty state を保存対象にしない。
- Public command result shape は保持し、commit value と updated value だけを正しい resolved commit に合わせる。

## Overview
### Modules
- src/plugin.js: plugin update-all entrypoint。syncInstalledPlugins(root, { update: true }) の結果から upgrade skip/run decision と JSON/text output を作る。
- src/lib/plugin-registry.js: plugin source resolution、managed Git URL source cache、install/materialize、config persistence の owner。
- tests and specs/305-fix-plugin-git-cache-update/tests: shared regression and spec-local behavior coverage for Git URL plugin source updates。

### Data Flow
- plugin update-all -> syncInstalledPlugins(update:true) -> resolveSource() -> syncGitUrlSource() -> resolved commit -> installFromSource() -> result commit/previousCommit/updated。
- Git URL source cache -> fetch remote refs -> resolve target revision -> force checkout/reset managed cache or materialize resolved commit -> copy allowlisted files into installed plugin package。
- Dirty managed cache -> reset/clean attempt -> verify clean target state -> if not recoverable, delete cache and reclone -> resolve target commit again。

### Decisions
- [VERIFY] Draft policy matches source: plugin update-all already delegates update behavior to syncInstalledPlugins(update:true).
- [VERIFY] Draft policy matches source: syncGitUrlSource currently fetches existing cache but only checks out source.ref, then reads HEAD.
- [VERIFY] Migration parity inventory covers affected public surfaces and artifacts.
- source.ref 未指定時は current tracking branch や cache HEAD ではなく remote default branch を採用する。
- source.ref 指定時は branch / tag / SHA 相当の ref を fetch 後に決定論的に解決し、その commit を採用する。
- dirty Git URL cache は managed area として self-heal し、local path source の dirty rejection policy は変えない。
- destructive cache repair は path confinement を必須とし、unsafe source id は拒否する。
- resolveSource consumers must inspect files that correspond to the resolved commit.

## Clarifications (Q&A)
- Q: source.ref 未指定時の target は何か。
  - A: remote default branch。current branch、tracking branch、既存 cache HEAD には依存しない。
- Q: dirty managed cache の未コミット変更は保存するか。
  - A: 保存しない。.senti/plugin-sources/ は managed area であり、reset / clean または reclone により再生成可能な状態へ戻す。
- Q: local path source の dirty state も self-heal するか。
  - A: しない。local path source はユーザー管理の source tree であり、既存の dirty rejection behavior を保持する。

## Alternatives Considered
- 既存 cache の HEAD を fetch 後もそのまま採用する。 — Issue #397 の root cause であり、behind-remote cache で updated:false を返すため不採用。
- dirty managed cache で fail-fast する。 — Issue #397 は managed cache の self-heal を要求しており、stale HEAD を防ぐだけでなく cache state による非決定性を減らす必要があるため不採用。
- local path source も reset / clean する。 — local path source はユーザー管理領域で、既存 localRepoHead() の dirty rejection contract がある。managed cache policy を広げると public behavior を壊すため不採用。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T14:46:01.946Z
- Notes: User selected [1] approve gate-passed spec for Issue #397.

## Requirements
- R1 [must]: Git URL source.ref が未指定の source は、fetch 後に remote default branch の commit を解決し、その commit を package commit として採用する。
- R2 [must]: Git URL source.ref が指定された source は、fetch 後に branch / tag / SHA 相当の ref を決定論的に解決し、その resolved commit を採用する。
- R3 [must]: .senti/plugin-sources/ 配下の Git URL managed cache が dirty の場合、resolved cache path が current root の plugin-sources directory 配下であることを検証してから reset / clean で target state へ戻し、戻せない場合は cache を削除して reclone する。unsafe source id または path traversal は拒否する。
- R4 [must]: plugin update-all は installed package commit が変わる場合、JSON result の commit に新しい resolved commit を返し、previousCommit との差分に基づいて updated:true を返す。
- R5 [must]: plugin source add/update/find/install、setup official preset resolution、config persistence、installed package materialization、local path source dirty rejection の existing public behavior を保持する。
- R6 [must]: implementation は project-specific source values を hardcode せず、外部 npm dependency を追加しない。
- R7 [must]: Git URL resolveSource/syncGitUrlSource は、PluginManifest、validateSourceTree、find、add、install path が files を読む前に、resolved target commit と一致する source root または materialized package tree を提供する。

## Acceptance Criteria
- R1: local branch が remote default branch より behind の既存 Git URL source cache で plugin update-all を実行すると、fetch 後の remote default branch commit が package commit として採用される。
- R2: source.ref が branch の場合は fetched branch commit、tag の場合は fetched tag target commit、40 桁 SHA の場合はその commit が採用されることを tests で固定する。
- R3: dirty managed Git URL cache は reset / clean または reclone 後に target commit を採用し、file mode difference だけの dirty state も stale HEAD を返さない。
- R3: reset / clean / delete / reclone は resolved cache path が current root の .senti/plugin-sources/ 配下である場合だけ実行され、unsafe source id または path traversal は rejected error になる。
- R4: installed package commit が変わる update-all result は commit=<new commit>、previousCommit=<old commit>、updated=true を返す。
- R5: plugin source add/update/find/install と setup official preset resolution は既存 result shape と config persistence behavior を保持し、Git URL resolved commit だけが新 contract に従う。
- R5: local path plugin source が dirty の場合は既存どおり rejection され、managed cache self-heal policy の対象にならない。
- R6: diff に project-specific repository URL / plugin id / local path の fixed value と package dependency 追加が含まれない。
- R7: add/find/install/update consumers inspect plugin.json and package files from a tree that matches the resolved target commit, so old-tree/new-commit mixed behavior cannot occur.
- Test: specs/305-fix-plugin-git-cache-update/tests/ 配下に R1-R7 を参照する spec-local tests を追加し、targeted project regression で通す。

## Implementation Targets
- src/lib/plugin-registry.js
- src/plugin.js
- specs/305-fix-plugin-git-cache-update/tests/
- tests/unit/lib/plugin-registry-local-overlay.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Resolve Git source target
  - Define and implement deterministic target commit resolution for Git URL sources after fetch.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Repair managed Git cache
  - Return dirty .senti/plugin-sources Git URL caches to a managed target state before adopting a commit.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve plugin behavior
  - Keep existing public plugin command result shapes, config persistence, and materialization behavior while changing only Git URL resolved commits.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add regression coverage
  - Create spec-local tests with requirement headers and targeted project regression coverage for the Git URL cache update bug.
  - see `tasks/T-4.md` for full spec
