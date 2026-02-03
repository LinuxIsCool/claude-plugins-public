---
event: SessionStart
description: Check YouTube queue status on session start. Process pending videos if not rate limited.
---

# YouTube Queue Status Check

On session start, check the YouTube ingestion queue status and optionally process pending videos.

## What to do

1. **Check queue status** using `transcripts_queue_status` MCP tool
2. **Report status** to the conversation (if there are pending videos)
3. **Optionally process** a small batch if:
   - There are pending videos
   - We are not rate limited
   - Processing is enabled

## Status Check Only (Default)

Check and report the queue status without processing:

```
Use the transcripts_queue_status tool to check:
- Number of pending videos
- Rate limit status
- Last successful ingest time
```

If there are pending videos and no rate limit, mention:
"YouTube queue has N pending videos. Use `transcripts_queue_process` to ingest a batch."

## Processing Guidelines

- Process in small batches (3-5 videos) to minimize rate limit risk
- If rate limited, report when processing can resume
- Track progress in conversation for user awareness

## Rate Limit Recovery

If rate limited:
- Report the backoff time remaining
- Suggest checking back later
- Never clear rate limits automatically (let them expire naturally)
