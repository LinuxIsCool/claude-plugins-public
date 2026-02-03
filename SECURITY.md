# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in this repository, please report it responsibly:

1. **Do not** open a public issue
2. Email security concerns to the repository maintainer
3. Include a description of the vulnerability and steps to reproduce

## Sensitive Data

This repository is designed to contain **no credentials, API keys, or personal data**.

### What Should Never Be Committed

- `.env` files (use `.env.example` as a template)
- API keys, tokens, or passwords
- Database files (`.db`, `.sqlite`, `.sqlite3`)
- Session logs containing credentials (`.jsonl` with auth data)
- Private keys (`.pem`, `.key`)
- Personal calendar data or contact information
- Conversation transcripts or session logs

### Protections in Place

- `.gitignore` excludes common sensitive file patterns
- `.env.example` provides a template without real values
- Plugin data storage uses `lib/paths.ts` to anchor paths correctly

## If You Find Leaked Credentials

If you discover any credentials or personal data that should not be in this repository:

1. Report it immediately
2. Do not use or share the credentials
3. The maintainer will rotate affected credentials and clean the history

## Dependencies

- Review plugin dependencies before installing
- MCP servers run as local processes — audit their code before enabling
- Plugins have access to tools defined in their `plugin.json` — review tool permissions
