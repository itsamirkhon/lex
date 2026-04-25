---
name: session-search
description: Search past Lex session transcripts to recover prior work, conversations, and research context. Use when the user references something from a previous session or asks what was done before.
---

Use the `/search` command to search prior Lex sessions interactively, or search session JSONL files directly via bash.

Session transcripts are stored as JSONL files in `~/.lex/sessions/`. Each line is a JSON record with `type` and message content fields.

```sh
grep -ril "scaling laws" ~/.lex/sessions/
```
