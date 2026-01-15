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
5. **Ask clarifying questions** - Ask for clarification if unsure about the changes.
6. **Don't be overly pedantic** - Nitpicks are fine, but only if relevant.

In your output:

- Provide a summary overview of the general code quality.
- Present issues in a table with columns: index, line number(s), code, issue, and potential solution(s).
- If no issues are found, briefly state that the code meets best practices.

## Full Diff

**REMINDER: DO NOT use any tools to fetch git information.**

```
{{diff}}
```
