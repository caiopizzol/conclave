# Consultation Request

I'm working on a problem and would like your perspective.

## Conversation History

The full conversation history is available at: `{{history_file}}`

This is a JSONL file (one JSON object per line). To understand the context:
1. Read the file
2. Look for entries with `"type": "user"` - these are user messages (check `message.content`)
3. Look for entries with `"type": "assistant"` - these are Claude's responses
4. Recent entries are at the end of the file - focus on those for current context

## Current Working Directory

`{{cwd}}`

## Specific Question

{{question}}

## What I Need

- Alternative approaches I haven't considered
- Potential root causes I might be missing
- Suggestions for how to move forward
- Any red flags in my current approach

Please be direct and specific. If you see an obvious issue, call it out.

**Important**: Read the conversation history file to understand what's already been tried. Don't suggest things that have already failed.
