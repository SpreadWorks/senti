# Test: 130-post-report-to-issue

## What was tested and why
- isGhAvailable function exists and returns boolean (condition check)
- generateReport function is exported (prerequisite for report.text)
- Full integration test (gh issue comment) is not feasible without a real GitHub repo

## Test location
`specs/130-post-report-to-issue/tests/post-report.test.js`

## How to run
```bash
node --test specs/130-post-report-to-issue/tests/post-report.test.js
```

## Expected results
- All tests pass (both before and after implementation, as they verify prerequisites)
