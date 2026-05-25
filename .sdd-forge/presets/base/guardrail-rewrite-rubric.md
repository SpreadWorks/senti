# Guardrail Rewrite Rubric

Use this rubric when turning broad guardrail prose into gate-ready checks.

- Start each check with a named violation so gate output can cite the exact rule.
- Add diff-verification condition bullets that can be confirmed from the changed files or artifacts.
- Define a severity-policy for every named violation, including blocking and advisory criteria.
- Keep the rule scoped to observable evidence. Do not require unstated architecture knowledge.
