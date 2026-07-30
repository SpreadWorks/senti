---
name: senti.flow-direct
description: Apply a validator-owned recovery record through the normal Spec-Driven Development Flow. Use only when the user explicitly requests recovery of an interrupted Flow.
---

# Normal Flow Recovery

This is a thin entrypoint into normal Flow recovery. It does not create a
separate session, repair plan, verification result, completion path, or
finalize state.

1. Read guarded `senti flow get status` and `senti flow get next-action` for
   the exact active target.
2. Run guarded `senti flow run direct`. Supply `--record-id <id>` only when
   the returned recovery result says that multiple validator records are
   available; never guess an ID.
3. When the result is `transition-applied`, immediately continue through the
   ordinary `senti flow get next-action` and normal dispatcher route. The
   replacement proof obligation remains required; do not describe the
   transition as a pass or a skipped quality check.
4. When the result is `unavailable`, report its plain-language message and
   next action. Do not retry with a stale record, policy, target, Git state,
   lock, CAS revision, merge state, cleanup authority, or persistence
   authority.
5. Do not use this skill to approve a requirement, product behavior, finding
   disposition, scope change, deletion, or other semantic decision. Present
   the product-level decision to the user and return to the normal repair and
   revalidation route after the user decides.

Matching durable finalize journals are replayed only by the normal
`finalize-cleanup` authority. Do not create retry, suspend, abort, or cleanup
state in this skill.
