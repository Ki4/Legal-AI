# Update Changelog

Update the project changelog after completing a feature or significant change.

## Steps

1. Run `git log --oneline origin/main..HEAD` to see all commits on current branch.

2. Run `git diff origin/main...HEAD --stat` to see changed files.

3. Read `apps/client/.claude/changelog.md` to understand the current format.

4. Add a new entry under "Pending commits" (or update existing entry) with:
   - **Date:** today's date
   - **Branch / feature:** current branch name
   - **What changed:** bullet list of user-facing changes
   - **Why:** 1-2 sentences on the business reason
   - **Files touched:** key files with one-line description
   - **Next step:** merge? waiting for review? blocked on something?

5. Write the entry in Ukrainian (user-facing language of the project).

6. Commit: `git add apps/client/.claude/changelog.md && git commit -m "docs: update changelog"`

## Format example

```
### [2026-05-25] feature/alimony-form
**Що зроблено:** Додано форму стягнення аліментів
- Нова послуга: аліменти на дитину (4 таби, 30+ полів)
- n8n workflow: валідація → Groq → Google Docs → Telegram
- Supabase: міграція 010_alimony_fields.sql

**Чому:** Друга ключова послуга після розлучення, найбільш запитувана

**Файли:** apps/client/src/data/alimonyConfig.ts, supabase/migrations/010_...

**Далі:** злити в main після тестування на реальному пристрої
```
