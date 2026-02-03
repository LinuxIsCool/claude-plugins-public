---
name: tui-patterns
description: Terminal UI design patterns and best practices for building robust, efficient TUI applications
---

# Terminal UI Patterns

## Overview

Terminal User Interfaces (TUIs) are interactive, screen-based applications that run in terminal emulators. Unlike simple Command-Line Interfaces (CLIs) that process input line-by-line, TUIs leverage the full screen area for persistent, interactive displays with cursor movement, scrolling, multi-region layouts, and both keyboard and mouse controls.

TUIs occupy a unique space between CLIs and GUIs, providing structured interfaces with panels, menus, and dialog boxes while maintaining the efficiency and lightweight nature of text-based environments. They excel in scenarios like remote SSH access, resource-constrained systems, and workflows where keyboard-driven efficiency is paramount.

## Core Architecture Patterns

### The Painter's Algorithm
Modern TUI libraries use the "painter's algorithm" approach:
1. Build the desired UI state in an off-screen buffer
2. Calculate the diff between the current screen and desired state
3. Render only the changes (damage regions) to minimize terminal I/O
4. Maintain a screen damage buffer to track what needs updating

This approach ensures extremely efficient rendering - only drawing changes rather than full-screen refreshes.

### Model-View-Update Pattern
The Elm architecture has proven effective for TUIs:
- **Model**: Application state (data, UI component states, channels)
- **Update**: Pure functions that transform state based on messages/events
- **View**: Renders the current model to screen buffers

Messages flow unidirectionally: User Input → Update → Model → View → Display

This separation creates clean state management and predictable behavior.

### Component-Based Architecture
Break complex UIs into reusable components:
- Each component manages its own state and rendering
- Components implement standard interfaces (Widget trait, Element class, etc.)
- Use composition to build complex layouts from simple primitives
- Leverage built-in widgets (lists, tables, forms, progress bars, text areas)

## Navigation Conventions

### Standard Keyboard Shortcuts

**Universal Primary Navigation:**
- `Tab` / `Shift+Tab`: Move focus between UI components
- Arrow keys: Navigate within focused components (lists, menus, scrollable areas)
- `Enter`: Activate/select the focused item
- `Escape`: Cancel operation, close dialog, or go back
- `Ctrl+C` / `q`: Exit application (check both patterns)

**Vim-Style hjkl Navigation:**
Many TUIs support vim-like keybindings for power users:
- `h`: Move left
- `j`: Move down
- `k`: Move up
- `l`: Move right
- `gg` / `G`: Jump to top/bottom
- `Ctrl+d` / `Ctrl+u`: Page down/up
- `/`: Search
- `n` / `N`: Next/previous search result

This pattern dates to 1976 with Bill Joy's vi editor, optimized for keyboard-only terminal access and ergonomics.

**Application-Specific Patterns:**
- Number keys for quick item selection
- Letters for filtering/search
- Function keys (F1-F12) for major actions
- `Ctrl+` combinations for power operations
- Space for selection/toggle in lists

### Focus Management

**Focus Chain**: The order in which focus moves between UI components when pressing Tab. Design logical, predictable focus chains that follow visual layout (left-to-right, top-to-bottom in most cultures).

**Focus Indicators**: Clearly indicate which component has focus using:
- Border color/style changes
- Background color highlighting
- Cursor positioning
- Status bar indicators

**Focus Events**: Listen for focus gained/lost events to:
- Refresh component state
- Update status displays
- Enable/disable keyboard shortcuts
- Manage input modes

## Screen Management

### Screen Lifecycle

**Initialization:**
```javascript
// Blessed/neo-blessed pattern
const screen = blessed.screen({
  smartCSR: false,      // Avoid flickering with partial-width elements
  fastCSR: false,       // May cause flickering near screen edges
  useBCE: true,         // Back-color-erase optimization
  fullUnicode: true,
  dockBorders: true
});
```

**Cleanup - Critical for Memory Safety:**
```javascript
// ALWAYS call screen.destroy() when done
screen.key(['C-c', 'q'], function(ch, key) {
  screen.destroy();
});

// For networked TUIs (SSH sessions, etc.)
client.on('close', function() {
  if (!screen.destroyed) {
    screen.destroy();
  }
});

screen.on('destroy', function() {
  if (client.writable) {
    client.destroy();
  }
});
```

**Why Cleanup Matters:**
- `screen.destroy()` unbinds ALL event listeners attached to the screen
- Prevents the screen from continuing to listen on the event loop
- Failure to cleanup causes memory leaks in long-running applications
- Critical for servers hosting multiple TUI sessions

### Preventing Screen Artifacts and Flicker

**Double Buffering:**
- Stage all changes to an off-screen buffer
- Flush changes atomically in a single operation
- For ncurses: use `wnoutrefresh()` to update buffers, then single `doupdate()` to commit
- For blessed: use `render()` which handles buffering automatically

**Minimize Redraws:**
- Only redraw changed regions (dirty rectangles)
- Use diff algorithms to calculate minimal update commands
- Target specific updates with functions like `move()` and `addstr()`
- Avoid full-screen clears unless necessary

**Rendering Techniques:**
```javascript
// Blessed: Stage changes, then render
element.setContent('New content');
box.setLine(3, 'Updated line');
screen.render();  // Single atomic update

// Ncurses: Group updates, flush together
wnoutrefresh(win1);
wnoutrefresh(win2);
wnoutrefresh(win3);
doupdate();  // Single screen update
```

**Performance Options (Blessed):**
- Disable `smartCSR` if experiencing flicker
- Use `useBCE` for terminals supporting back-color-erase
- Call `render()` sparingly - once per frame, not per widget change

### Layout Management

**Responsive Layouts:**
- Use percentage-based sizing for terminal resize support
- Implement constraint-based positioning systems
- Support both fixed and flexible layouts
- Handle minimum size requirements gracefully

**Common Layout Patterns:**
- **Split panes**: Horizontal/vertical divisions with adjustable splits
- **Sidebar + main**: Navigation sidebar with content area
- **Modal overlays**: Centered dialogs over dimmed background
- **Status bars**: Fixed header/footer with scrollable content

## Focus and Event Flow

### Event Tree and Bubbling

Events in TUI frameworks follow a tree structure with bubbling:
1. Event fires on the focused element
2. Bubbles up through parent elements
3. Each handler can process or cancel propagation
4. Return `false` to stop bubbling

```javascript
// Blessed event bubbling
listItem.on('keypress', function(ch, key) {
  // Handle at item level
  if (key.name === 'enter') {
    // Process enter
    return false;  // Stop propagation
  }
  // Allow parent to handle
});
```

### Event Types

**Keyboard Events:**
- `keypress`: Raw key events with character and key object
- `key [name]`: Specific key shortcuts (e.g., 'C-c', 'enter', 'up')
- Modal vs modeless handling (vim-like modes)

**Mouse Events:**
- `click`, `mousedown`, `mouseup`
- `mousemove`, `mouseout`, `mouseover`
- `wheeldown`, `wheelup`
- Check terminal capabilities for mouse support

**Focus Events:**
- `focus`, `blur`: Component-level focus changes
- `FocusGained`, `FocusLost`: Terminal window focus (requires terminal support)
- Not all terminals support focus reporting (needs `\e[?1004h` sequence)

**Screen Events:**
- `resize`: Terminal dimensions changed
- `destroy`: Screen being torn down
- `render`: After screen.render() completes

### Input State Management

Prevent conflicts with multiple input handlers:
- **Check for active inputs**: Before processing global shortcuts, verify no input field has focus
- **Input priority**: Modal dialogs > focused inputs > widget shortcuts > global shortcuts
- **Event interception**: Use `PreTranslateMessage()` or similar to handle editing operations
- **Focus recovery**: Ensure focus returns to appropriate control after temporary operations

## Async Event Handling

### The Double-Resolution Problem

**Issue**: Async operations in event handlers can cause race conditions:
```javascript
// PROBLEMATIC PATTERN
button.on('press', async function() {
  const result = await fetchData();  // Screen may be destroyed during await
  screen.render();  // DANGER: screen might not exist
});
```

**Symptoms:**
- Double events triggering duplicate operations
- Operations continuing after screen destruction
- State updates to unmounted components
- Memory leaks from unresolved promises

### Safe Async Patterns

**Pattern 1: Guard Checks**
```javascript
button.on('press', async function() {
  if (this.destroyed || screen.destroyed) return;

  const result = await fetchData();

  // Check again after await
  if (this.destroyed || screen.destroyed) return;

  updateUI(result);
  screen.render();
});
```

**Pattern 2: Cancellation Tokens**
```javascript
let currentOperation = null;

button.on('press', function() {
  // Cancel previous operation
  if (currentOperation) {
    currentOperation.cancelled = true;
  }

  const operation = { cancelled: false };
  currentOperation = operation;

  fetchData().then(result => {
    if (operation.cancelled || screen.destroyed) return;
    updateUI(result);
    screen.render();
  });
});
```

**Pattern 3: Event Queue with Single Handler**
```javascript
const eventQueue = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (eventQueue.length > 0 && !screen.destroyed) {
    const event = eventQueue.shift();
    await handleEvent(event);
  }

  processing = false;
}

button.on('press', function() {
  eventQueue.push({ type: 'button_press', data: {...} });
  processQueue();
});
```

**Pattern 4: Debouncing**
```javascript
let debounceTimer = null;

input.on('keypress', function() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!screen.destroyed) {
      performSearch(input.getValue());
    }
  }, 300);
});

// Cleanup on destroy
screen.on('destroy', () => {
  clearTimeout(debounceTimer);
});
```

### Async State Updates

**Message-Based Updates (Bubble Tea pattern):**
```go
type fetchCompleteMsg struct { data Data }

func fetchDataCmd() tea.Cmd {
    return func() tea.Msg {
        data := fetchData()
        return fetchCompleteMsg{data}
    }
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case fetchCompleteMsg:
        m.data = msg.data
        return m, nil
    }
}
```

This pattern ensures state updates only occur through the Update function, preventing race conditions.

## Common Pitfalls

### 1. Memory Leaks from Event Listeners

**Problem**: Event handlers create strong references that prevent garbage collection.

**Causes:**
- Registering event listeners without cleanup
- Screen destroyed but listeners still attached
- Component subscriptions to global events not removed

**Solutions:**
```javascript
// Blessed: Use cleanup methods
element.onScreenEvent('resize', handler);  // Tracks listener
element.free();  // Auto-removes tracked listeners

element.destroy();  // Calls detach() + free()

// Manual cleanup
screen.on('destroy', () => {
  // Clean up all custom listeners
  clearInterval(refreshTimer);
  database.removeListener('update', dbHandler);
});
```

**Prevention:**
- Every event registration must have corresponding deregistration
- Use lifecycle hooks for cleanup (React useEffect cleanup, destroy events)
- Consider weak references for optional observers
- Use `free()` method in blessed to auto-unbind screen events

### 2. Double Event Firing

**Problem**: User action triggers handler twice, causing duplicate operations.

**Causes:**
- Event bubbling to multiple handlers
- Handler registered multiple times
- Both mouse and keyboard events for same action
- Form designer auto-generating duplicate handlers

**Solutions:**
```javascript
// Debounce rapid events
let lastEventTime = 0;
element.on('press', function() {
  const now = Date.now();
  if (now - lastEventTime < 200) return;  // 200ms threshold
  lastEventTime = now;
  // Handle event
});

// Use event.stopPropagation() to prevent bubbling
item.on('click', function() {
  handleClick();
  return false;  // Stop propagation in blessed
});

// Guard against re-registration
if (!element._handlerRegistered) {
  element.on('event', handler);
  element._handlerRegistered = true;
}
```

### 3. Screen Cleanup Failures

**Problem**: Screen state persists after application exit, leaving terminal corrupted.

**Symptoms:**
- Cursor invisible after exit
- Raw mode still enabled
- Alternate screen buffer not cleared
- Terminal settings not restored

**Solutions:**
```javascript
// Comprehensive cleanup
function cleanup() {
  if (screen && !screen.destroyed) {
    screen.destroy();  // Restores terminal state
  }
  process.exit(0);
}

// Handle all exit paths
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
  cleanup();
  console.error(err);
});

// Blessed handles most cleanup in destroy(), but ensure:
screen.on('destroy', () => {
  // Disable raw mode
  // Clear alternate screen buffer
  // Restore cursor
  // Reset terminal settings
});
```

### 4. Focus Management Issues

**Problem**: Focus state becomes inconsistent, multiple components appear focused, or no component has focus.

**Causes:**
- Manual focus manipulation without coordination
- Modal dialogs not capturing focus
- Focus not restored after modal close
- Async operations changing focus unexpectedly

**Solutions:**
- Use framework focus management APIs rather than manual manipulation
- Modal dialogs should capture and restore focus
- Track focus stack for nested modals
- Validate focus state after async operations

### 5. Rendering Race Conditions

**Problem**: Rendering called during ongoing render, causing visual artifacts or crashes.

**Causes:**
- Event handler calls render() during render cycle
- Async updates rendering without coordination
- Multiple components independently calling render()

**Solutions:**
```javascript
// Blessed: Smart render scheduling
let renderScheduled = false;

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;

  process.nextTick(() => {
    renderScheduled = false;
    if (!screen.destroyed) {
      screen.render();
    }
  });
}

// Use throughout app instead of direct screen.render()
```

### 6. Terminal Capability Assumptions

**Problem**: Application assumes features not supported by all terminals.

**Issues:**
- Mouse support not universal
- 256 colors may not be available
- Unicode rendering varies
- Focus reporting requires terminal support

**Solutions:**
- Detect terminal capabilities using terminfo/termcap
- Provide keyboard alternatives for mouse actions
- Test with multiple terminal emulators
- Graceful degradation for unsupported features
- Check `screen.terminal` in blessed for capabilities

## Blessed-Style Patterns

### Element Hierarchy and Composition

```javascript
const screen = blessed.screen({ ... });

const container = blessed.box({
  parent: screen,
  top: 'center',
  left: 'center',
  width: '80%',
  height: '80%',
  border: { type: 'line' },
  style: {
    border: { fg: 'blue' }
  }
});

const list = blessed.list({
  parent: container,  // Nested composition
  top: 0,
  left: 0,
  width: '30%',
  height: '100%-3',
  keys: true,
  vi: true,  // Enable vim-style navigation
  mouse: true,
  style: {
    selected: { bg: 'blue' }
  }
});
```

### Widget Configuration Patterns

**Common Options:**
- `parent`: Parent element (required for auto-attachment)
- `top`, `left`, `width`, `height`: Positioning (numbers, percentages, or expressions)
- `keys`, `vi`, `mouse`: Input handling modes
- `scrollable`, `scrollbar`: Scrolling support
- `border`, `style`: Visual appearance
- `tags`: Enable blessed markup in content (`{blue-fg}text{/}`)

### Safe Content Updates

```javascript
// Setting content
element.setContent('New content');
element.setText('Plain text');  // Strips tags
element.setLine(lineNumber, 'Line content');

// Always render after updates
screen.render();

// Batch updates
element.setContent('Line 1');
otherElement.setContent('Line 2');
screen.render();  // Single render for both
```

### Memory Management

```javascript
// Element lifecycle
const element = blessed.box({ ... });

// Temporary removal (can re-attach)
element.detach();

// Complete cleanup
element.destroy();  // Calls detach() + free()

// Manual listener tracking
element.onScreenEvent('resize', handler);  // Tracked
element.removeScreenEvent('resize', handler);
element.free();  // Removes all tracked listeners
```

### Modal Dialog Pattern

```javascript
function showModal(title, message, callback) {
  const modal = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '50%',
    height: 'shrink',
    border: { type: 'line' },
    content: message,
    tags: true,
    keys: true,
    vi: true
  });

  // Focus modal
  modal.focus();

  // Handle dismissal
  modal.key(['enter', 'escape'], function() {
    modal.destroy();
    screen.render();
    if (callback) callback();
  });

  screen.render();
}
```

### Form Handling

```javascript
const form = blessed.form({
  parent: screen,
  keys: true,
  vi: true
});

const input = blessed.textbox({
  parent: form,
  name: 'username',
  inputOnFocus: true
});

const submit = blessed.button({
  parent: form,
  content: 'Submit',
  name: 'submit'
});

submit.on('press', function() {
  form.submit();
});

form.on('submit', function(data) {
  // data.username contains input value
  processForm(data);
});
```

### Independent Scrolling Regions

```javascript
// Sidebar with independent scrolling
const sidebar = blessed.list({
  parent: screen,
  left: 0,
  width: '30%',
  height: '100%',
  keys: true,
  vi: true,
  scrollable: true,
  scrollbar: {
    ch: ' ',
    track: { bg: 'cyan' },
    style: { inverse: true }
  }
});

// Main content with independent scrolling
const content = blessed.box({
  parent: screen,
  left: '30%',
  width: '70%',
  height: '100%',
  keys: true,
  vi: true,
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { ... }
});

// Focus system: Tab toggles, arrow keys scroll focused region
let sidebarFocused = true;

screen.key('tab', function() {
  sidebarFocused = !sidebarFocused;
  if (sidebarFocused) {
    sidebar.focus();
  } else {
    content.focus();
  }
  screen.render();
});
```

### Viewport Management

```javascript
const viewport = blessed.box({
  scrollable: true,
  scrollbar: true,
  keys: true,
  vi: true,
  alwaysScroll: true,
  mouse: true
});

// Scroll control
viewport.setScrollPerc(50);  // Scroll to 50%
viewport.scroll(10);  // Relative scroll
viewport.scrollTo(lineNumber);  // Absolute position

// React to scroll events
viewport.on('scroll', function() {
  updateScrollIndicator();
});
```

## Testing and Debugging

### Terminal Emulator Testing

Test your TUI with multiple emulators to ensure compatibility:
- **xterm**: Reference implementation
- **iTerm2**: macOS popular choice
- **Alacritty**: Modern, GPU-accelerated
- **Windows Terminal**: Windows 10/11
- **tmux/screen**: Multiplexers (test nested sessions)
- **VS Code integrated terminal**: Common development environment

### Debug Patterns

```javascript
// Log to file instead of stdout (which is the screen)
const fs = require('fs');
const debugLog = fs.createWriteStream('debug.log');

function debug(message) {
  debugLog.write(`${new Date().toISOString()} ${message}\n`);
}

// State inspection without screen corruption
screen.key('C-d', function() {
  debug(`Focus: ${screen.focused?.name}`);
  debug(`Elements: ${screen.children.length}`);
});
```

### Performance Monitoring

```javascript
let frameCount = 0;
let lastFPS = 0;

setInterval(() => {
  lastFPS = frameCount;
  frameCount = 0;
}, 1000);

// Count renders
const originalRender = screen.render.bind(screen);
screen.render = function() {
  frameCount++;
  if (frameCount > 60) {
    debug(`Warning: High frame rate - ${frameCount} FPS`);
  }
  return originalRender();
};
```

## Sources

### TUI Design and Frameworks
- [Python Textual: Build Beautiful UIs in the Terminal – Real Python](https://realpython.com/python-textual/)
- [GitHub - rothgar/awesome-tuis: List of projects that provide terminal user interfaces](https://github.com/rothgar/awesome-tuis)
- [Ratatui: Building Rich Terminal User Interfaces in Rust](https://www.blog.brightcoding.dev/2025/09/13/ratatui-building-rich-terminal-user-interfaces-in-rust/)
- [7 TUI libraries for creating interactive terminal apps - LogRocket Blog](https://blog.logrocket.com/7-tui-libraries-interactive-terminal-apps/)
- [8 TUI Patterns to Turn Python Scripts Into Apps | by Nexumo | Medium](https://medium.com/@Nexumo_/8-tui-patterns-to-turn-python-scripts-into-apps-ce6f964d3b6f)
- [Beyond the GUI: The Ultimate Guide to Modern Terminal User Interface Applications and Development Libraries](https://www.blog.brightcoding.dev/2025/09/07/beyond-the-gui-the-ultimate-guide-to-modern-terminal-user-interface-applications-and-development-libraries/)

### Navigation and Keyboard Conventions
- [Developing a Keyboard Interface | APG | WAI | W3C](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [Text-based user interface - Wikipedia](https://en.wikipedia.org/wiki/Text-based_user_interface)
- [TUI Keys (Debugging with GDB)](https://sourceware.org/gdb/current/onlinedocs/gdb.html/TUI-Keys.html)
- [Mastering Scroll Keys in Vim: Boosting Productivity with hjkl Navigation – TheLinuxCode](https://thelinuxcode.com/use-arrow-keys-vim/)

### Focus and Event Handling
- [Input and Event Handling | gui-cs/Terminal.Gui | DeepWiki](https://deepwiki.com/gui-cs/Terminal.Gui/5-input-and-event-handling)
- [Terminal UI System | neovim/neovim | DeepWiki](https://deepwiki.com/neovim/neovim/3.1-terminal-ui-system)
- [Building a Terminal IRC Client with Bubble Tea: A Deep Dive into Go's TUI Framework · Sid Ngeth's Blog](https://sngeth.com/go/terminal/ui/bubble-tea/2025/08/17/building-terminal-ui-with-bubble-tea/)
- [Focus (computing) - Wikipedia](https://en.wikipedia.org/wiki/Focus_(computing))

### Blessed/Neo-Blessed Patterns
- [GitHub - chjj/blessed: A high-level terminal interface library for node.js.](https://github.com/chjj/blessed)
- [GitHub - embarklabs/neo-blessed: A drop-in replacement for for Blessed.](https://github.com/embarklabs/neo-blessed)
- [Building Terminal Interfaces with Node.js](https://blog.openreplay.com/building-terminal-interfaces-nodejs/)
- [Multiple Screens - Blessed Docs](https://lightyears1998.github.io/blessed-docs/mechanics/multiple-screens/)
- [Building a visual form in your terminal emulator with Blessed](https://badacadabra.github.io/Building-a-visual-form-in-your-terminal-emulator-with-Blessed/)

### Rendering and Performance
- [Screen (from Node) - Blessed Docs](https://lightyears1998.github.io/blessed-docs/widgets/base-nodes/Screen%20(from%20Node)/)
- [The Ncurses Feedback Loop](https://hoop.dev/blog/the-ncurses-feedback-loop/)
- [Ncurses Processing Transparency Without Hacks](https://hoop.dev/blog/ncurses-processing-transparency-without-hacks/)

### Common Problems and Memory Management
- [Events: Demystifying Common Memory Leaks](https://www.devleader.ca/2013/08/19/events-demystifying-common-memory-leaks/)
- [Why Developers Fear Memory Leaks? And How You Can Beat.](https://middleware.io/blog/memory-leaks/)
- [How to Prevent Memory Leaks in State Management Systems](https://blog.pixelfreestudio.com/how-to-prevent-memory-leaks-in-state-management-systems/)
- [Understanding and Avoiding Memory Leaks with Event Handlers and Event Aggregators](https://www.markheath.net/post/understanding-and-avoiding-memory-leaks)
