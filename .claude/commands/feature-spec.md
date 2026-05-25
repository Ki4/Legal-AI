# Feature Spec

Start a new feature planning session using Spec-Driven Development.

## Steps

1. Read the project constitution:
   - `specs/mission.md`
   - `specs/tech-stack.md`
   - `specs/roadmap.md`

2. Read the session context:
   - `apps/client/.claude/session-summary.md`
   - `apps/client/.claude/changelog.md`

3. Ask the user which feature from the roadmap to plan (or accept it as $ARGUMENTS).

4. Create a feature branch: `git checkout -b feature/<slug>`

5. Interview the user about the feature. Ask questions relevant to our stack:
   - What form fields are needed? What are their types and validation rules?
   - What conditional logic (show_if) is needed?
   - What happens in n8n after submit? What are the workflow steps?
   - What does success look like? (document generated, Telegram message sent?)
   - Any Supabase schema changes needed? (new columns, migrations)
   - Any constraints or things NOT to change?

6. Create three files in `specs/features/<slug>/`:
   - `plan.md` — approach, task groups, sequence
   - `requirements.md` — form fields, n8n steps, Supabase changes, constraints
   - `validation.md` — scorecard: how to verify success

7. Ask the user to review all three files. Make corrections via agent (not manually).

8. Commit the feature spec: `git add specs/features/<slug>/ && git commit -m "spec: <feature-name> feature spec"`

## Notes
- Do NOT start implementation — planning only
- Keep requirements at the right level: no variable names, no CSS details
- Always include a validation scorecard with checkboxes
- If the feature touches PII — add encryption requirement explicitly
