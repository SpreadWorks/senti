# Tests for spec #104: Remove chapter classification from enrich

## What was tested and why
- `mergeChapters()`: Merge preset and config chapters with desc override, exclude, and append logic (R1, R2)
- `extractDataCategories()`: Extract {{data}} directive categories from template content (R5)
- `buildCategoryToChapterMap()`: Build category-to-chapter mapping for static assignment (R4)
- `validateConfig` chapters validation: Validate new object array format, reject old string format (R3)

## Where tests are located
- `tests/unit/docs/lib/chapter-resolver.test.js` — mergeChapters, extractDataCategories, buildCategoryToChapterMap
- `tests/unit/lib/types-chapters.test.js` — validateConfig chapters validation

## How to run
```bash
node --test tests/unit/docs/lib/chapter-resolver.test.js tests/unit/lib/types-chapters.test.js
```

## Expected results
- All tests should fail initially (chapter-resolver.js does not exist yet, types.js validation not updated)
- After implementation, all tests should pass
