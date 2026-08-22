# Unit tests

Test isolated classes/functions with fakes only. Forbidden: `node:child_process`,
Git fixture helpers, and Flow scenario helpers. Run `npm run test:unit`. Put a
cross-module or filesystem/Git/Flow scenario in `../integration` instead.
