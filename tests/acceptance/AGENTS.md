# Acceptance tests

Verify deterministic user-visible outcomes using injected fakes only. Fixtures are
immutable seeds copied to a unique temporary root and cleaned in teardown. No host
agent config, credential, CLI, or provider may be reached. Run `npm run test:acceptance`.
