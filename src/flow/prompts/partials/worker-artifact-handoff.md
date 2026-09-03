**Dispatcher worker artifact handoff:**

- Use the parent dispatcher's worker artifact handoff contract as the complete authority for Flow artifact inputs, Flow artifact outputs, and completion.
- Read Flow artifact inputs only from the contract's immutable `inputs[].document` snapshots. Write each declared Flow artifact output only to its exact `payloads[].payloadPath`.
- When `contextSnapshot` is present, use its digest-verified `entries[].document` values as the complete Flow context. Respect `inputAuthority.kind`, and treat omitted entries by their explicit `reason`; do not run nested Flow context, Issue, or guardrail commands.
- Do not write canonical Flow artifacts or mark the step done. Run no Flow state-transition command unless the step instructions explicitly name a non-completion recovery command.
- Project source and formal project tests are outside the handoff authority and remain in the execution checkout; edit them only when the step instructions explicitly require it.
- When the contract includes `sourceMutationCommand`, run it after the source edits. It returns the current Attempt's immutable mutation manifest. In the structured final response, declare only `{ requirementId, mutationIds }` using those returned IDs; never declare raw source paths. Do not write `effects.json` or a handoff submission, and do not run a seal command: the parent materializes and seals the response. If source changes after that command, regenerate the manifest before returning the response.
- When the contract has no `sourceMutationCommand`, write every declared payload, run its exact seal command once, and return the successful seal command's `data` object as the worker report matching the action output schema. Only the parent dispatcher may validate, publish, record revisions, and complete the step.
- A missing handoff contract for this action is invalid. Do not write artifacts or mutate Flow state; report the missing contract to the caller.
