# Test Design

### Test Design

---

#### Scope & Context

These tests validate that the `flow-plan` skill template (1) mandates Choice Format for **every** user-facing question with zero exceptions, (2) extends that mandate to post-change confirmation questions, and (3) is guarded by tests that break when the strict intent is softened or removed.

---

- **TC-1: Template contains an unconditional Choice Format mandate**
  - Type: unit
  - Input: Raw text content of the `flow-plan` skill template file
  - Expected: The template contains a phrase requiring Choice Format for **every** question (e.g. keywords like "必ず" / "always" / "no exceptions" / "without exception" co-located with the choice-format instruction)

- **TC-2: Template contains no softening language**
  - Type: unit
  - Input: Raw text content of the `flow-plan` skill template file
  - Expected: The template does NOT contain hedging phrases such as "if appropriate", "where possible", "when applicable", "必要に応じて", "可能であれば" adjacent to or modifying the Choice Format instruction

- **TC-3: Confirmation-after-change question also carries the Choice Format mandate**
  - Type: unit
  - Input: The section of the template that handles post-change confirmations (the paragraph describing behavior after a user-requested change is applied)
  - Expected: That section explicitly reiterates or references the Choice Format requirement — it does not carve out a free-form exception for confirmations

- **TC-4: Removing "no exceptions" clause causes test failure**
  - Type: unit (negative / mutation)
  - Input: A mutated copy of the template with "no exceptions" (or equivalent unconditional keyword) deleted or replaced with "when possible"
  - Expected: The assertion that checks for the unconditional mandate **fails** (test suite goes red)

- **TC-5: Removing the Choice Format instruction entirely causes test failure**
  - Type: unit (negative / mutation)
  - Input: A mutated copy of the template with the entire Choice Format instruction paragraph removed
  - Expected: Every TC-1, TC-2, TC-3 assertion that depends on that paragraph **fails**

- **TC-6: Softening confirmation-section wording causes test failure**
  - Type: unit (negative / mutation)
  - Input: A mutated copy of the template where the confirmation-section mandate is weakened (e.g. "try to use Choice Format")
  - Expected: TC-3's assertion **fails**

- **TC-7: Flow-plan execution — first draft question uses Choice Format**
  - Type: integration
  - Input: Invoke the `flow-plan` skill against a minimal valid request; intercept the first question emitted to the user during the draft phase
  - Expected: The emitted question presents a numbered or lettered option list (Choice Format); no open-ended free-text question is issued

- **TC-8: Flow-plan execution — all draft-phase questions use Choice Format**
  - Type: integration
  - Input: Drive a full flow-plan session through multiple draft-phase turns (scope clarification, priority ordering, constraint confirmation)
  - Expected: Every question turn produces a Choice Format block; no turn issues a free-form question

- **TC-9: Post-change confirmation uses Choice Format**
  - Type: integration
  - Input: During a flow-plan session, request a change to a drafted item; observe the confirmation question that follows
  - Expected: The confirmation is presented as a Choice Format question (e.g. "1. Confirm as-is / 2. Revise further / 3. Discard") — not a plain "Does this look correct?"

- **TC-10: Single-option (binary) confirmation still uses Choice Format**
  - Type: integration
  - Input: A post-change confirmation where semantically only yes/no applies
  - Expected: The skill renders it as "1. Yes – proceed / 2. No – revise" (Choice Format) rather than a bare "OK?" or "Proceed?"

- **TC-11: Multi-language output preserves Choice Format structure**
  - Type: integration
  - Input: A flow-plan session configured for a non-default language (e.g. English output when template is Japanese)
  - Expected: Choice Format structure (numbered/lettered list) is present regardless of output language

- **TC-12: End-to-end acceptance — user receives no free-form question throughout a complete flow-plan run**
  - Type: acceptance
  - Input: A realistic feature request fed into `flow-plan`; a human (or simulated reviewer) inspects every question the skill asks across the entire session
  - Expected: Zero free-form questions observed; every interaction point presents discrete selectable options

- **TC-13: End-to-end acceptance — post-change confirmation is unambiguous and selectable**
  - Type: acceptance
  - Input: A flow-plan session where the tester deliberately requests a scope change mid-draft
  - Expected: The resulting confirmation question is immediately actionable (tester can select an option without typing a free-form response); the session proceeds correctly after selection

- **TC-14: Template snapshot regression — wording diff breaks the test**
  - Type: unit (snapshot/regression)
  - Input: A stored approved snapshot of the template's Choice Format section; current template content
  - Expected: If the current content diverges from the snapshot in a way that weakens the mandate (removed unconditional keyword, removed confirmation coverage), the snapshot assertion **fails**; purely additive/stylistic diffs do not cause failure
