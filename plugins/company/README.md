# Company Plugin

Personal board of advisors for institutional design, business strategy, legal, and finance.

## Overview

The Company plugin provides a sophisticated advisory system combining:
- **Naval Ravikant's** leverage thinking and long-term orientation
- **Elon Musk's** first principles reasoning and ambitious goal-setting
- **Dragons Den** practical business judgment and unit economics focus
- **Vitalik Buterin's** decentralized governance and coordination expertise
- **Canadian CPA/CFA** financial analysis and tax optimization
- **Canadian Legal** corporate law and securities expertise

**Primary Jurisdiction**: Canadian (BC-focused) with international comparative knowledge.

## Agents

Invoke via Task tool:

| Agent | Command | Purpose |
|-------|---------|---------|
| Board Mentor | `company:board-mentor` | Primary advisor - multi-perspective synthesis for complex decisions |
| CEO | `company:ceo` | Strategy, vision, market positioning, competitive dynamics |
| CFO | `company:cfo` | Financial analysis, tax optimization, fundraising, cash flow |
| CTO | `company:cto` | Technology leverage, build vs buy, systems architecture |
| Chief of Staff | `company:chief-of-staff` | Task coordination, execution tracking, operational support |

## Skills

Access via Skill tool (`company` master skill):

### Entity Types
- **corporations** - BC/Federal incorporation, CCPC, shareholder agreements
- **non-profits** - BC Societies Act, charitable registration
- **trusts** - Family trusts, estate planning, 21-year rule
- **daos-dunas** - DAOs, DUNAs, legal wrappers, token governance
- **cooperatives** - Worker/consumer/housing co-ops

### Cross-Cutting Expertise
- **taxation-personal** - RRSP, TFSA, income splitting, dividend planning
- **taxation-corporate** - CCPC deductions, integration, GRIP/ERDTOH
- **taxation-international** - FAPI, transfer pricing, tax treaties
- **governance** - Board structures, voting classes, fiduciary duties
- **compliance** - Annual filings, registrations, minute books
- **exit-strategies** - M&A, IPO, succession, LCGE planning
- **fundraising** - Angel/seed/Series A, SAFE, private placements
- **intellectual-property** - Patents, trademarks, trade secrets
- **employment-law** - Contracts, stock options, termination
- **securities-law** - Accredited investors, prospectus exemptions

### Jurisdictions
- **bc-specific** - BC Business Corporations Act, Societies Act
- **canadian-federal** - Income Tax Act, CBCA, CRA positions
- **comparative-us** - Delaware C-Corp, LLC, S-Corp
- **comparative-uk** - UK Ltd, plc, EIS/SEIS
- **comparative-estonia** - e-Residency, EU structures

### Thinking Frameworks
- **first-principles** - Elon's reasoning from fundamentals
- **leverage-analysis** - Naval's 4 types of leverage
- **dao-governance** - Vitalik's coordination mechanisms
- **business-judgment** - Dragons Den practical filters
- **cfa-analysis** - CFA financial modeling frameworks

## Output Style: Board Mentor (Always-On Advisory)

The plugin includes a `board-mentor` output_style that makes the mentor persona always-active throughout your session.

### Installation

**Auto-install (default):** The SessionStart hook automatically installs the output style via symlink on first run. No manual action needed.

**Manual install (if needed):**
```bash
# Symlink (recommended - stays updated with plugin)
ln -s /path/to/plugins/company/output-styles/board-mentor.md ~/.claude/output-styles/board-mentor.md
```

**How auto-install works:**
1. On each session start, the hook checks if `~/.claude/output-styles/board-mentor.md` exists
2. If missing, creates a symlink to the plugin's source file
3. If a regular file exists, replaces it with a symlink (for auto-updates)
4. Symlink ensures edits to the plugin source propagate automatically

### Activation

```bash
# Activate board mentor mode
/output-style board-mentor

# Return to default mode
/output-style default
```

### What Changes

When activated:
- **Communication Style**: Recommendations first, rationale second (Direct Executive)
- **Proactive Behavior**: Watches for business signals (revenue, hiring, fundraising)
- **Cross-Plugin Awareness**: Reads from journal, exploration, backlog for context
- **AgentNet Integration**: Posts strategic insights (>$5k impact) automatically
- **Domain Focus**: Business/finance (defers technical learning to awareness:mentor)

### SessionStart Context

The plugin's SessionStart hook automatically injects:
- Recent journal entries mentioning business keywords
- Exploration discoveries in business domains
- Outstanding company-domain tasks
- AgentNet activity summary

This context helps the mentor provide informed, continuous counsel.

## Usage Examples

### Incorporate a Business
```bash
# Invoke skill
/skill company
# Or invoke board mentor for guidance
/task company:board-mentor "Should I incorporate federally or in BC for my software business?"
```

### Tax Optimization
```bash
/task company:cfo "Optimize my $150k business income between salary and dividends"
```

### Strategic Decision
```bash
/task company:board-mentor "Should I raise VC funding or bootstrap my SaaS startup?"
```

### Entity Comparison
```bash
/task company:board-mentor "Compare CCPC vs BC Society vs Family Trust for my consulting business"
```

## Disclaimer

This plugin provides advisory guidance only and does not constitute legal, tax, or financial advice. Always consult qualified professionals (lawyers, CPAs, CFAs) for specific situations.

Tax laws and regulations change frequently. The information here is based on 2025 Canadian tax law. Always verify current rates and rules with authoritative sources.

## Version

- **Version**: 0.2.0
- **Last Updated**: 2025-12-17
- **Tax Data**: 2025 CRA rates

## Changelog

### 0.2.0 (2025-12-17)
- Added `board-mentor` output_style for always-on advisory mode
- Added SessionStart hook for business context injection
- Added AgentNet client for posting strategic insights
- Enhanced cross-plugin awareness (journal, exploration, backlog)
- Auto-install output style via symlink (SessionStart hook)

### 0.1.0 (2025-12-17)
- Initial release with 5 agents and 25 sub-skills
- Full Canadian tax data for 2025
- Comprehensive entity type coverage
