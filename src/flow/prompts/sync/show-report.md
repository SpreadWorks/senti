Display the finalize Report to the user.

1. Run `sdd-forge flow report show`.
2. Place the command's stdout verbatim inside a fenced code block.
3. If the command exits non-zero, surface stderr to the user instead of fabricating report contents.
4. Mark step done: `sdd-forge flow set step show-report done`.
