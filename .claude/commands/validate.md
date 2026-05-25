# Validate

Run validation for the current feature branch.

## Steps

1. Identify the current feature from branch name or $ARGUMENTS.

2. Read `specs/features/<slug>/validation.md` — the scorecard.

3. Check each scorecard item:
   - Run the app and verify golden path manually
   - Run tests: `cd apps/client && npm run test` (if tests exist)
   - Check that form submits correctly to n8n webhook
   - Check conditional fields show/hide correctly
   - Check mobile responsiveness (375px viewport)

4. Spawn subagents for deep review:
   - Subagent 1: check code matches specs/features/<slug>/requirements.md
   - Subagent 2: check for TypeScript errors and no `any` types
   - Subagent 3: check no PII is stored unencrypted

5. Report findings grouped by:
   - ✅ Passing
   - ❌ Failing (must fix before merge)
   - ⚠️ Warnings (nice to fix)

6. For each failing item — fix both the code AND the relevant spec file to keep them in sync.

7. After all fixes — run `npm run build:admin` and `npm run build` to confirm clean build.

8. Update `specs/roadmap.md` — check off the completed feature item.

9. Update changelog: run `/update-changelog`

## Notes
- Never merge with a failing build
- Fix spec drift: if you had to change something not in the spec, update the spec too
