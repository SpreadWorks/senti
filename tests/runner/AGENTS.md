# Runner

Owns test discovery and suite invariants only. Every test path is classified once;
reject duplicate, unknown top-level, and missing-suite paths. Run `node tests/run.js
--list --json --all --jobs 1`. Do not add fixtures or provider fakes here.
