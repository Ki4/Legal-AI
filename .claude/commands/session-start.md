# Session Start

Load project context at the beginning of a new session.

## Steps

1. Read constitution:
   - `specs/mission.md`
   - `specs/tech-stack.md`
   - `specs/roadmap.md`

2. Read session files:
   - `apps/client/.claude/session-summary.md`
   - `apps/client/.claude/changelog.md`

3. Check git status:
   - Current branch: `git branch --show-current`
   - Uncommitted changes: `git status --short`
   - Unmerged branches: `git branch --no-merged main 2>/dev/null | head -5`

4. Report a concise briefing:

```
## Session Briefing

**Current branch:** <branch>
**Last session:** <date and summary from session-summary.md>

**Pending commits:**
<list from changelog.md Pending section>

**Uncommitted changes:**
<git status output if any>

**Next roadmap item:** <next unchecked item from roadmap.md>

**Ready to:** <suggest what to do — continue current feature / start new feature / merge>

**Recommended model:** <model for the suggested next task + one-line why>
```

5. Recommend a model for the suggested next task (routing by tier, see root CLAUDE.md):
   - Tier 0/1 implementation from a ready issue/spec, tests, routine porting → **Sonnet**
   - Tier 2 specs, architecture decisions, research synthesis, debugging the unknown, legally-critical logic design → **Opus or higher**
   - If the recommendation differs from the current model, tell Sergey to switch via `/model` now — a mid-session switch keeps the full conversation context.

6. Ask: "З чого починаємо?" (What are we starting with?)

## Notes
- Always run this at the start of every session
- If there are uncommitted changes — flag them first before anything else
- If a feature branch is not merged — ask if we should continue or start fresh
