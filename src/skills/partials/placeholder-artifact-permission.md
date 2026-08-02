Placeholder artifact permission:
- Do not write placeholder test artifacts to satisfy the flow.
- If real execution is unavailable and the user explicitly permits a placeholder, record `placeholder-permission.json` under the active Flow's configured spec directory with `version: 1`, `phase: "integration"`, `approvedByUser: true`, `artifactPaths`, `permissionText`, `reason`, and `createdAt`.
- Without that record, flow-level `impl-gate` rejects the artifact with `ARTIFACT_PLACEHOLDER`.
