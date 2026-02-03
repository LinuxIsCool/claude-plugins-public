---
version: 1
name: ecosystem_aware
created: 2025-12-18
author: claude
rationale: |
  Initial versioned prompt. Migrated from name.txt.
  Emphasizes ecosystem context (which plugin is being worked on) to generate
  domain-appropriate symbolic names. Includes overused-name avoidance and
  creative alternatives guidance.
test_results: |
  - Generally produces evocative 1-2 word names
  - Sometimes still produces overused names despite guidance
  - Domain detection works well when plugin names are explicit
  - Occasionally too literal (e.g., "Statusline" as a name)
notes: |
  This prompt was developed iteratively during December 2025.
  Key insight: Names should capture work DOMAIN essence, not circumstantial words.
---

You are generating a creative name for a Claude Code session in the claude-plugins ecosystem.

YOUR TASK:
Generate a 1-2 word symbolic name that captures the SESSION'S WORK DOMAIN.
Think of it as a callsign - evocative, unique, hints at the work's nature.

CRITICAL: IDENTIFY THE WORK DOMAIN FIRST
Before generating a name, identify WHAT PLUGIN/DOMAIN the user is working on:
- statusline: Instance identity, naming, summaries → themes: mirrors, oracles, heralds, sigils
- journal: Reflection, daily notes, synthesis → themes: scribes, chronicles, memories, echoes
- logging: Conversation history, archives → themes: archivists, keepers, vaults, traces
- awareness: Self-improvement, learning → themes: sages, guides, mentors, luminaries
- exploration: Environment discovery → themes: scouts, cartographers, pioneers, seekers
- messages: Communication, email bridges → themes: couriers, envoys, bridges, signals
- schedule/backlog: Time management, tasks → themes: stewards, wardens, planners, anchors

Focus on the DOMAIN being worked on, not circumstantial words like "froze", "bug", "help".

NAME PHILOSOPHY:
- Capture the ESSENCE of the work domain
- Be evocative and memorable
- AVOID overused names - be creative and unique
- Don't just pick from the examples - invent new ones in the spirit of the theme

OVERUSED NAMES (avoid these - too common):
- Phoenix, Catalyst, Architect, Navigator, Sentinel
- These are fine concepts but have been used many times

CREATIVE ALTERNATIVES (inspire uniqueness):
- Instead of "Phoenix" → "Ember", "Crucible", "Kindling"
- Instead of "Architect" → "Mason", "Keystone", "Spire"
- Instead of "Navigator" → "Wayfinder", "Compass", "Meridian"
- Instead of "Sentinel" → "Warden", "Vigil", "Bastion"

DOMAIN-SPECIFIC INSPIRATIONS:
- Identity/naming work → "Oracle", "Mirror", "Herald", "Sigil", "Glyph", "Cipher"
- Writing/documentation → "Quill", "Ink", "Parchment", "Chronicle", "Tome"
- Transformation work → "Crucible", "Forge", "Prism", "Lens"
- Connection/integration → "Loom", "Thread", "Nexus", "Conduit"
- Discovery/exploration → "Compass", "Horizon", "Pathfinder", "Trailhead"

BAD NAMES:
- "Claude" or "Assistant" (never use these)
- "Statusline Craftsman" (too literal - plugin names go in Description)
- "Bug Fixer", "Code Helper" (too mundane)
- Anything that sounds like a job title rather than a codename

User's first message:
{user_prompt}

Output ONLY the name (1-2 words, no explanation, no quotes, no formatting):
