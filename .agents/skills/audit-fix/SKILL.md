---
name: audit-fix
description: >
  Chains caveman → systematic-debugging → security-review →
  supabase-audit-rls → prompt-engineering-patterns → code-review →
  verification-loop to fix bugs and audit a project area.
  Use for any bug report, audit request, or "fix this" command.
  Also triggers when user says "audit", "bug", "fix", "broken", "review
  project", or "full fix round".
trigger: /audit-fix [area]
---

# Audit & Fix

Chains seven skills: compress → diagnose → fix → audit → engineer → review → verify.

## Initialization

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

### The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

### Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills carry it out.

- "Let's build X" → brainstorming first, then implementation skills.
- "Fix this bug" → systematic-debugging first, then domain skills.

### Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

### Tool Mapping (OpenCode)

When skills request actions, substitute OpenCode equivalents:
- Create or update todos → `todowrite`
- Subagent (general-purpose): → `task` with `subagent_type: "general"`
- Invoke a skill → OpenCode's native `skill` tool
- Read files → `read`
- Create, edit, or delete files → `edit` / `write`
- Run shell commands → `bash`
- Search files → `grep`, `glob`
- Fetch a URL → `webfetch`

### Phase Setup

Before any response:
1. Invoke `/ponytail full` (keep fixes minimal)
2. Invoke **caveman** (compress output—lite|full|ultra, see phase 0)
3. Invoke **prompt-engineering-patterns** if fix involves prompts/LLM
4. Set up todo list tracking each phase

## Phases

### 0. Caveman — compress output
- Invoke caveman skill at default **full** intensity.
- Keeps every response terse — no filler, no narration, no pleasantries.
- Drop to **lite** if collaboration needs more clarity; switch off entirely for destructive ops or security warnings.

### 1. Ponytail — keep it lazy
- Climb the ladder: YAGNI → reuse → stdlib → native → existing dep → one line → minimal.
- Mark deliberate simplifications with `ponytail:` comment.

### 2. Systematic Debugging — trace root cause
- Read ALL callers of every function the bug touches.
- Trace the full flow end-to-end before proposing any fix.
- Root cause fix, not symptom patch.

### 3. Fix — apply the minimal change
- Shortest working diff.
- Fewest files possible.
- Leave ONE check behind (assert self-test or one small `test_*.py`) for non-trivial logic.

### 4. Security Review — audit changed files
- Injection flaws (SQLi, XSS, command injection)
- Access control / auth bypass
- Hardcoded secrets / exposed credentials
- Business logic vulnerabilities
- Insecure cryptography

### 5. Supabase Audit RLS — if DB schema or queries changed
- Test RLS policies for common bypass vulnerabilities
- Verify row-level security on affected tables

### 6. Prompt Engineering Patterns — if fix involves prompts/LLM
- Apply structured output schemas (JSON mode, Pydantic)
- Implement few-shot examples for consistency
- Add chain-of-thought reasoning steps
- Design reusable prompt templates
- Review prompt security (injection, jailbreak)

### 7. Code Review — correctness check
- Edge cases and error handling
- No regressions in sibling callers
- Type safety

### 8. Verification Loop — evidence before claim
- Build: `npm run build` (or equivalent)
- Lint: targeted lint on changed files
- Typecheck
- Run nearest tests for touched modules

## Output

```
[code diff]

Phases:
- 0 caveman: [intensity level]
- 1 ponytail: [lazy choices]
- 2 root cause: [summary]
- 3 fix: [what changed]
- 4 security: [findings]
- 5 RLS: [findings]
- 6 prompts: [prompt engineering notes]
- 7 review: [notes]
- 8 verify: [build/lint/test results]
```

No prose beyond the summary. Ponytail applies.
