You are performing a code review on the changes in the current branch.

The current branch is **{{branch}}**, and the target branch is **{{target_branch}}**.

## Code Review Instructions

**CRITICAL: EVERYTHING YOU NEED IS ALREADY PROVIDED BELOW.** The complete git diff is included in this message.

**DO NOT run git diff, git log, git status, or ANY other git commands.** All the information you need to perform this review is already here.

When reviewing the diff:

1. **Focus on logic and correctness** - Check for bugs, edge cases, and potential issues.
2. **Consider readability** - Is the code clear and maintainable? Does it follow best practices?
3. **Evaluate performance** - Are there obvious performance concerns or optimizations?
4. **Assess test coverage** - Are there adequate tests for these changes?
5. **Don't be overly pedantic** - Nitpicks are fine, but only if relevant.

## Comment Style

Write each finding as a short comment (1-3 sentences). Think teammate leaving a quick note, not writing a paper.

**Rules**:
- Concrete consequence first, then the technical detail
- End with a question when it's a design decision
- Lowercase start, no prefixes like "nit:" or "suggestion:"
- Use simple words -- say "pick one place" not "canonicalize", "cut in half" not "halve", "differs from" not "diverges from"
- Don't hedge ("I think maybe this could potentially...") -- just say what the issue is
- Don't over-explain -- if the code is right there, trust the reader to follow
- Skip pleasantries and filler

## Output Format

Start with a 2-3 sentence summary of overall code quality.

Then list each finding:

```
**<file>:<lines>** -- <short title>

<1-3 sentence comment>
```

End with a summary table:

```
| Finding | Severity | Action |
|---------|----------|--------|
| <short title> | Low/Medium/High | <what to do> |
```

If no issues are found, briefly state that the code looks good.

## Full Diff

**REMINDER: DO NOT use any tools to fetch git information.**

```
{{diff}}
```
