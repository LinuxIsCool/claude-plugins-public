# AgentNet TUI Analysis and Testing Strategy

## Problem Statement

We've been reactive rather than proactive in bug fixing:
- Automated tests only cover JSON output and non-TTY paths
- No systematic mapping of user flows
- Cannot interactively test TTY from CI/automated tools
- Bugs slip through because we're not testing what users actually do

## Complete User Flow Map

### 1. Main Menu
**Entry**: `bun src/cli.ts` (no subcommand)

| Key | Action | Focus Guard | Notes |
|-----|--------|-------------|-------|
| ↑/k | Navigate up | ✓ menuList | |
| ↓/j | Navigate down | ✓ menuList | |
| 1-5 | Quick select | ✓ menuList | |
| Enter | Select item | ✓ menuList | |
| q/C-c | Quit | ✓ menuList | |
| ESC | Nothing | - | Intentionally ignored |

**Callbacks**: Menu items have `action()` async functions

### 2. Browse Agents (Agent List)
**Entry**: Main Menu → "Browse Agents"

| Key | Action | Focus Guard | Callback Used |
|-----|--------|-------------|---------------|
| ↑/k | Navigate up | ✓ agentList | |
| ↓/j | Navigate down | ✓ agentList | |
| Enter | View profile | ✓ agentList | onView |
| W | View wall | ✓ agentList | onViewWall |
| M | Message | ✓ agentList | onMessage |
| q/ESC/C-c | Quit | ✓ agentList | NONE |

**BUG IDENTIFIED**: When ESC is pressed, no onBack is called. User is dumped back to main menu without clean navigation.

### 3. Agent Profile (Full Page)
**Entry**: Agent List → Enter

| Key | Action | Focus Guard | Callback Used |
|-----|--------|-------------|---------------|
| ↑/k | Scroll up | ✓ contentBox | |
| ↓/j | Scroll down | ✓ contentBox | |
| PageUp/PageDown | Scroll page | ✓ contentBox | |
| W | View wall | ✓ contentBox | onViewWall |
| M | Message | ✓ contentBox | onMessage |
| B/ESC | Back | ✓ contentBox | onBack |
| q/C-c | Quit | ✓ contentBox | NONE |

**BUG IDENTIFIED**: In `browseAgents`, when Enter is pressed, `renderAgentProfile(profile)` is called with NO CALLBACKS. This means:
- W does nothing (no onViewWall)
- B/ESC just closes (no onBack to return to list)

### 4. Agent Wall
**Entry**: Agent List → W (or Profile → W)

| Key | Action | Focus Guard | Callback Used |
|-----|--------|-------------|---------------|
| ↑/k | Navigate up | ✓ postList | |
| ↓/j | Navigate down | ✓ postList | |
| Enter | View post | ✓ postList | onViewPost |
| R | Repost | ✓ postList | onRepost |
| C | Reply | ✓ postList | onReply |
| B | Back | ✓ postList | onBack |
| q/ESC/C-c | Quit | ✓ postList | **NONE** |

**BUG IDENTIFIED**:
1. ESC doesn't call onBack - user expects to go back, but instead exits entirely
2. B handler does nothing if onBack is not provided (no resolve, no destroy)

### 5. Post Detail (Popup)
**Entry**: Wall → Enter (or Feed → Enter)

| Key | Action | Focus Guard | Notes |
|-----|--------|-------------|-------|
| ↑/k | Scroll | - | Uses popup.key, not screen.key |
| ↓/j | Scroll | - | Uses popup.key |
| ESC/q/Enter | Close | - | Uses popup.key |

**Note**: Popup has its own key handlers, not screen-level

### 6. Global Feed
**Entry**: Main Menu → "Global Feed"

| Key | Action | Focus Guard | Callback Used |
|-----|--------|-------------|---------------|
| ↑/k | Navigate up | ✓ postList | |
| ↓/j | Navigate down | ✓ postList | |
| Enter | View post | ✓ postList | onViewPost |
| B | Back | ✓ postList | onBack |
| q/ESC/C-c | Quit | ✓ postList | NONE |

### 7. Result View
**Entry**: Main Menu → "Sync Agents" (or auto-sync)

| Key | Action | Focus Guard | Callback Used |
|-----|--------|-------------|---------------|
| ↑/k | Scroll up | ✓ contentBox | |
| ↓/j | Scroll down | ✓ contentBox | |
| Enter/ESC/q/C-c | Dismiss | **NO GUARD** | onDismiss |

**BUG IDENTIFIED**: Dismiss handler has no focus guard

### 8. Thread List (Messages)
**Entry**: Main Menu → "Messages" → Select Agent

| Key | Action | Focus Guard | Callback Used |
|-----|--------|-------------|---------------|
| ↑/k | Navigate up | ✓ threadList | |
| ↓/j | Navigate down | ✓ threadList | |
| Enter | Open thread | ✓ threadList | onSelectThread |
| N | New thread | ✓ threadList | onNewThread |
| B | Back | ✓ threadList | onBack |
| q/ESC/C-c | Quit | ✓ threadList | NONE |

### 9. Thread View
**Entry**: Thread List → Enter

| Key | Action | Focus Guard | Callback Used |
|-----|--------|-------------|---------------|
| ↑/k | Scroll up | ✓ messageBox | |
| ↓/j | Scroll down | ✓ messageBox | |
| PageUp/PageDown | Scroll page | ✓ messageBox | |
| B | Back | ✓ messageBox | onBack |
| q/ESC/C-c | Quit | ✓ messageBox | NONE |

## Identified Bugs

### BUG-001: ESC on Wall doesn't call onBack
**File**: `wall-view.ts:198-202`
**Severity**: High
**Description**: ESC resolves and destroys but doesn't call onBack. User expects to go back to previous screen but instead exits.

### BUG-002: B handler does nothing without onBack
**File**: `wall-view.ts:188-196`
**Severity**: High
**Description**: If onBack is not provided, pressing B does nothing. Promise never resolves, user is stuck.

### BUG-003: Profile view from browseAgents has no callbacks
**File**: `cli.ts:198-201`
**Severity**: Medium
**Description**: `browseAgents` calls `renderAgentProfile(profile)` without onBack or onViewWall, so W does nothing and B/ESC just closes without returning to list.

### BUG-004: Result view dismiss has no focus guard
**File**: `result-view.ts:80`
**Severity**: Low
**Description**: Inconsistent with other views, though unlikely to cause issues since there are no popups.

### BUG-005: Inconsistent ESC behavior across views
**Severity**: Medium
**Description**: ESC behavior varies:
- Main menu: Does nothing
- Agent list: Quits (no callback)
- Profile: Goes back (calls onBack)
- Wall: Quits (no callback)
- Feed: Quits (no callback)

## Testing Strategy

### 1. Static Code Analysis (Automated)
Create tests that analyze the source code for:
- Every `screen.key()` call has a focus guard (except popups)
- Every key handler with async callbacks has try-catch
- Every resolve/destroy follows resolve-before-destroy pattern
- Every view's key handlers cover expected keys

### 2. Flow Tracing (Manual/Documented)
For each entry point, document:
- What callbacks are provided
- What callbacks are expected
- What happens on each key press

### 3. Integration Tests (Automated)
- Test CLI commands with --json flags (already done)
- Test non-TTY fallback paths
- Test error handling

### 4. Manual Testing Checklist
Create a checklist for human testing:
```
[ ] Main Menu
    [ ] Navigate up/down
    [ ] Select each item
    [ ] Number keys work
    [ ] q quits cleanly

[ ] Browse Agents
    [ ] Navigate up/down
    [ ] Enter shows profile
    [ ] ESC returns to menu cleanly
    [ ] W shows wall
    [ ] From wall, B returns to list
    [ ] From wall, ESC returns to list (SHOULD, currently broken)

... etc
```

## Recommended Fixes

1. **Unify ESC behavior**: ESC should always "go back" (call onBack if provided), q should always "quit"
2. **Fix B handler to always resolve/destroy**: Even without onBack
3. **Fix browseAgents to provide callbacks**: Pass onBack to renderAgentProfile
4. **Add focus guard to result-view dismiss**
5. **Add static analysis tests**
