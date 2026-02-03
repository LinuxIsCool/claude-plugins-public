---
name: neo-neo-bblessed
description: Terminal UI library documentation for AgentNet (blessed/neo-blessed/bbblessed)
---

# neo-neo-bblessed / Blessed TUI Library

## Overview

The blessed family of libraries (blessed, neo-blessed, bbblessed, neo-neo-bblessed) provides a high-level terminal interface library for Node.js and Bun. These are curses-like libraries with a high-level terminal interface API, completely implemented in JavaScript.

**Library Variants:**
- **blessed** - Original library by chjj (16,000+ lines of terminal code)
- **neo-blessed** - Maintained fork with bug fixes (drop-in replacement)
- **bbblessed** - Port for Bun.js, readjusted for Node.js
- **neo-neo-bblessed** - Further fork/variant (less documented)

The library reimplements ncurses entirely by parsing and compiling terminfo and termcap, exposing a Program object which can output escape sequences compatible with any terminal.

**Key Features:**
- CSR (change-scroll-region) optimization
- BCE (back-color-erase) support
- Painter's algorithm rendering
- Smart cursor movements
- Screen damage buffer (only draws changes)
- DOM-like widget API
- Mouse and keyboard event handling

## Key Concepts

### Screen
The screen is the root object on which every other node renders. It has a `render()` method that efficiently draws only the changes (damage) to the screen.

```javascript
const blessed = require('blessed');
const screen = blessed.screen({
  smartCSR: true,  // Optimize CSR on all elements
  sendFocus: true  // Send focus events after mouse enabled
});

screen.render();
```

### Elements and Widgets
All widgets inherit from Element or Box. Key widget categories:
- **Boxes**: Box, Text, Line, BigText
- **Lists**: List, FileManager, ListTable, ListBar
- **Forms**: Form, Input, Textarea, Textbox, Button, Checkbox, RadioSet
- **Prompts**: Prompt, Question, Message, Loading
- **Data Display**: ProgressBar, Log, Table

### Focus Management
Elements can be marked as focusable using the `input` or `keyable` options. The screen maintains a focus stack:

```javascript
element.focus();                    // Focus an element
screen.focusPush(element);         // Push to focus stack
screen.focusPop();                 // Pop from focus stack
screen.saveFocus();                // Save current focus
screen.restoreFocus();             // Restore saved focus
screen.rewindFocus();              // Rewind to last visible element
```

### Key Binding
Keys can be bound at screen level or element level:

```javascript
// Screen-level binding
screen.key(['escape', 'q', 'C-c'], (ch, key) => {
  return process.exit(0);
});

// Element-level binding
element.key('enter', (ch, key) => {
  // Handle enter key
});
```

## List Component

The List widget is a scrollable list that can display selectable items. It inherits from Box.

### Configuration Options

```javascript
const list = blessed.list({
  parent: screen,
  top: 0,
  left: 0,
  width: '50%',
  height: '50%',

  // Critical options for navigation
  keys: true,              // Enable predefined keyboard shortcuts
  vi: true,                // Enable vi-style keybindings (j/k/h/l)
  mouse: true,             // Enable mouse clicking to select items

  // Behavior options
  interactive: true,       // Allow item selection (default: true)
  invertSelected: true,    // Auto-invert fg color when selected (default: true)

  // Content
  items: ['Item 1', 'Item 2', 'Item 3'],

  // Styling
  label: ' My List ',
  border: 'line',
  style: {
    selected: {
      bg: 'blue',
      fg: 'white'
    },
    item: {
      fg: 'white'
    },
    border: {
      fg: 'cyan'
    }
  },

  // Vi mode search function
  search: function(callback) {
    // Called when '/' is pressed in vi mode
    // callback should be called with search string
  }
});
```

### Navigation Keys

When `keys: true` is enabled:
- **Up/Down arrows** - Navigate items
- **Enter** - Select item
- **Escape** - Cancel (fires 'cancel' event)

When `vi: true` is enabled (requires `keys: true`):
- **j** - Move down
- **k** - Move up
- **h** - Move left (in multi-column lists)
- **l** - Move right (in multi-column lists)
- **g** - Jump to first item
- **G** - Jump to last item
- **/** - Trigger search (if search function provided)
- **Ctrl-b, Ctrl-u** - Page up
- **Ctrl-f, Ctrl-d** - Page down

### Methods

**Item Management:**
```javascript
list.add(text)              // Add item (alias: addItem)
list.removeItem(child)      // Remove item (by element, index, or string)
list.pushItem(text)         // Add to end
list.popItem()              // Remove from end
list.unshiftItem(text)      // Add to beginning
list.shiftItem()            // Remove from beginning
list.insertItem(i, text)    // Insert at index
list.getItem(index)         // Get item at index
list.setItem(index, text)   // Set item at index
list.spliceItem(i, n, ...)  // Splice items
list.clearItems()           // Remove all items
list.setItems(items)        // Replace all items
list.getItemIndex(child)    // Get index of item
```

**Navigation:**
```javascript
list.select(index)          // Select item at index
list.move(offset)           // Move selection by offset
list.up(amount)             // Move up by amount
list.down(amount)           // Move down by amount
list.pick(callback)         // Interactive item picker
list.fuzzyFind(search)      // Find item by fuzzy search
```

**Selection:**
```javascript
list.getSelected()          // Get currently selected item
list.selected               // Index of selected item
```

### Events

```javascript
// Fired when item is selected (enter or click)
list.on('select', (item, index) => {
  console.log('Selected:', item.content);
  screen.render();
});

// Fired when escape is pressed (with keys option)
list.on('cancel', () => {
  console.log('Cancelled');
});

// Fired for either select or cancel
list.on('action', () => {
  console.log('Action occurred');
});

// Item manipulation events
list.on('create item', () => {});
list.on('add item', () => {});
list.on('remove item', () => {});
list.on('insert item', () => {});
list.on('set items', () => {});
```

## Keyboard Event Handling

### Element-Level Key Handling

Elements need to be focusable to receive keyboard events:

```javascript
const element = blessed.box({
  input: true,     // Make element focusable and receive input
  keyable: true,   // Mark as keyable (for focus navigation)
  keys: true,      // Enable predefined keys (for lists, textareas, etc.)
  vi: true         // Enable vi keys (for lists, textareas, etc.)
});

element.key('j', (ch, key) => {
  // Handle 'j' key
});

element.onceKey('enter', (ch, key) => {
  // Handle enter once
});

element.unkey('j', listener);  // Remove key listener
```

### Screen-Level Properties

```javascript
screen.grabKeys = true;   // Focused element grabs all keypresses
screen.lockKeys = true;   // Prevent keypresses from reaching any element
```

### Focus and Keyable Array

The screen maintains a `keyable` array that tracks focusable elements. Elements must be:
1. Not detached
2. Visible
3. Have `keyable: true` property

**Important:** When removing and re-adding elements, the keyable array may not update properly. Workaround:

```javascript
screen._listenKeys(element);  // Re-register element for key events
```

### Key Binding Patterns

```javascript
// Single key
element.key('j', handler);

// Multiple keys
element.key(['j', 'down'], handler);

// Control/meta combinations
element.key('C-c', handler);      // Ctrl+C
element.key('M-j', handler);      // Alt+J

// Special keys
element.key('enter', handler);
element.key('escape', handler);
element.key('space', handler);
```

## Common Pitfalls

### 1. j/k Navigation Not Working

**Problem:** Vi keys (j/k) don't work for list navigation.

**Causes:**
- `keys: true` not set on the list
- `vi: true` not set on the list
- Element doesn't have focus
- Screen-level key binding is capturing the keys
- `grabKeys` on another element is preventing key events
- Element is not in the keyable array

**Solution:**
```javascript
const list = blessed.list({
  keys: true,      // MUST enable keys
  vi: true,        // MUST enable vi mode
  // ... other options
});

list.focus();      // MUST focus the element
screen.render();   // MUST render after focus
```

### 2. Focus Issues After Dynamic Updates

**Problem:** Focus doesn't work after removing and re-adding elements.

**Cause:** Keyable array not updated when elements are manipulated.

**Solution:**
```javascript
// When swapping pages/boxes
oldBox.detach();
screen.append(newBox);
newBox.focus();

// If focus still doesn't work:
setTimeout(() => {
  newBox.focus();
  screen.render();
}, 0);

// Or manually re-register:
screen._listenKeys(newBox);
```

### 3. Input Not Received

**Problem:** Element is focused but doesn't receive keyboard input.

**Causes:**
- `input: true` not set on element
- Another element has `grabKeys: true` and is focused
- Screen-level key binding is consuming the event
- Element is not properly in the keyable array

**Solution:**
```javascript
const element = blessed.textbox({
  input: true,     // Enable input
  keys: true,      // Enable key handling
  grabKeys: true   // Grab all keys when focused (for inputs)
});

element.focus();
screen.render();
```

### 4. Select Event Fires Twice

**Known Issue:** The 'select' event fires twice when hitting enter on a List item.

**Workaround:**
```javascript
let lastSelect = 0;
list.on('select', (item, index) => {
  const now = Date.now();
  if (now - lastSelect < 100) return;  // Debounce
  lastSelect = now;

  // Handle selection
});
```

### 5. Screen Not Rendering

**Problem:** Changes don't appear on screen.

**Cause:** Forgetting to call `screen.render()` after updates.

**Solution:**
```javascript
list.select(0);
screen.render();  // MUST call render to update display
```

### 6. Mouse Focus vs Keyboard Focus

**Problem:** Can't focus multiple textboxes with mouse.

**Solution:**
```javascript
element.on('click', () => {
  element.focus();
  screen.render();
});
```

### 7. Search Function in Vi Mode

**Problem:** Pressing '/' in vi mode doesn't work.

**Solution:** Provide a search function:
```javascript
const list = blessed.list({
  keys: true,
  vi: true,
  search: function(callback) {
    // Prompt user for search string
    prompt.input('Search:', '', (err, value) => {
      callback(null, value);
    });
  }
});
```

## Code Examples

### Basic List with Vi Navigation

```javascript
const blessed = require('blessed');

const screen = blessed.screen({
  smartCSR: true
});

const list = blessed.list({
  parent: screen,
  top: 'center',
  left: 'center',
  width: '50%',
  height: '50%',
  label: ' Items ',
  border: 'line',
  keys: true,
  vi: true,
  mouse: true,
  style: {
    selected: {
      bg: 'blue'
    },
    border: {
      fg: 'cyan'
    }
  }
});

list.setItems([
  'Apple',
  'Banana',
  'Cherry',
  'Date',
  'Elderberry'
]);

list.on('select', (item, index) => {
  console.log(`Selected: ${item.content} at index ${index}`);
});

list.focus();
screen.render();

screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});
```

### List with Search Function

```javascript
const prompt = blessed.prompt({
  parent: screen,
  top: 'center',
  left: 'center',
  height: 'shrink',
  width: 'shrink',
  border: 'line',
  hidden: true
});

const list = blessed.list({
  parent: screen,
  keys: true,
  vi: true,
  items: ['Item 1', 'Item 2', 'Item 3'],
  search: function(callback) {
    prompt.input('Search:', '', (err, value) => {
      if (err) return callback(err);
      callback(null, value);
    });
  }
});
```

### Dynamic List Updates

```javascript
// Add items
list.add('New Item');
list.setItems(['A', 'B', 'C']);

// Remove items
list.removeItem(0);           // By index
list.removeItem('Item 1');    // By content

// Navigate programmatically
list.select(2);               // Select index 2
list.up(1);                   // Move up one
list.down(1);                 // Move down one

// Always render after updates
screen.render();
```

### Multiple Lists with Focus Management

```javascript
const list1 = blessed.list({
  parent: screen,
  top: 0,
  left: 0,
  width: '50%',
  height: '100%',
  keys: true,
  vi: true,
  items: ['List 1 Item 1', 'List 1 Item 2']
});

const list2 = blessed.list({
  parent: screen,
  top: 0,
  left: '50%',
  width: '50%',
  height: '100%',
  keys: true,
  vi: true,
  items: ['List 2 Item 1', 'List 2 Item 2']
});

// Tab to switch focus
screen.key('tab', () => {
  if (screen.focused === list1) {
    list2.focus();
  } else {
    list1.focus();
  }
  screen.render();
});

list1.focus();
screen.render();
```

### Form with Input Focus

```javascript
const form = blessed.form({
  parent: screen,
  keys: true,
  width: '50%',
  height: '50%'
});

const input = blessed.textbox({
  parent: form,
  name: 'username',
  input: true,
  keys: true,
  top: 0,
  left: 0,
  width: '100%',
  height: 1
});

// Ensure form grabs keys when focused
form.on('focus', () => {
  form.screen.grabKeys = true;
});

input.focus();
screen.render();
```

## Performance Tips

1. **Use smartCSR:** Enables CSR optimization for better rendering performance
2. **Batch updates:** Make multiple changes, then call `screen.render()` once
3. **Optimize rendering:** blessed only draws damaged (changed) areas of the screen
4. **Use hidden:** Set `hidden: true` on elements not currently visible
5. **Detach unused elements:** Use `element.detach()` to remove from render tree

## Debugging Tips

1. **Check focus:** Use `screen.focused` to see which element has focus
2. **Inspect keyable array:** Use `screen.keyable` to see focusable elements
3. **Listen for element focus:** `screen.on('element focus', (curr, old) => {})`
4. **Enable debug mode:** Set environment variable `DEBUG=blessed` for verbose logging
5. **Check element visibility:** Ensure element is `!detached && visible`

## Sources

- [GitHub - chjj/blessed](https://github.com/chjj/blessed)
- [blessed - npm](https://www.npmjs.com/package/blessed)
- [GitHub - node-opcua/bbblessed](https://github.com/node-opcua/bbblessed)
- [GitHub - embarklabs/neo-blessed](https://github.com/embarklabs/neo-blessed)
- [GitHub - blessedjs/neo-blessed](https://github.com/blessedjs/neo-blessed)
- [List Widget - Blessed Docs](https://lightyears1998.github.io/blessed-docs/widgets/lists/List/)
- [blessed cheatsheet](https://devhints.io/blessed)
- [Screen - Blessed Docs](https://lightyears1998.github.io/blessed-docs/widgets/base-nodes/Screen%20(from%20Node)/)
- [How do you make inputs work? · Issue #122 · chjj/blessed](https://github.com/chjj/blessed/issues/122)
- [Problem with list.focus, setTimeout required · Issue #314 · chjj/blessed](https://github.com/chjj/blessed/issues/314)
- [List 'select' event fires twice using enter key · Issue #90 · chjj/blessed](https://github.com/chjj/blessed/issues/90)
- [text area navigation not supported? · Issue #121 · chjj/blessed](https://github.com/chjj/blessed/issues/121)
- [blessed/README.md at master · chjj/blessed](https://github.com/chjj/blessed/blob/master/README.md)
