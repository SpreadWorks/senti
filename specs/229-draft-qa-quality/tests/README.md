# Tests: 229-draft-qa-quality

## What was tested and why

Spec 229 の要件（R1〜R7）に対応するテストを test-first で作成。

- **checkDraftJson validation**: draft.json の構造検証（R1, R2, R3）。devType enum、goal、analysis フィールド存在、evidence 存在、approval チェック。
- **Prompt content**: draft/spec/gate-draft プロンプトが必要な記述を含むことの検証（R4, R5, R6）。
- **Schema decisions**: spec.schema.json の decisions が evidence/consideredAlternatives を受け入れること（R7）。

## Where tests are located

| Test | Location | Type |
|---|---|---|
| checkDraftJson | `tests/unit/flow/check-draft-json.test.js` | formal (npm test) |
| Prompt content | `specs/229-draft-qa-quality/tests/prompt-content.test.js` | spec verification |
| Schema decisions | `specs/229-draft-qa-quality/tests/schema-decisions.test.js` | spec verification |

## How to run

```bash
# formal tests (included in npm test)
node --test tests/unit/flow/check-draft-json.test.js

# spec verification tests
node --test specs/229-draft-qa-quality/tests/prompt-content.test.js
node --test specs/229-draft-qa-quality/tests/schema-decisions.test.js
```

## Expected results

All tests should fail initially (test-first). After implementation:
- checkDraftJson tests: all PASS with the new checkDraftJson() function
- Prompt content tests: all PASS after prompt files are updated
- Schema decisions tests: all PASS after spec.schema.json is updated
