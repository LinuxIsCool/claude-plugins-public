---
name: web-scraper
description: Use Playwright browser automation to fetch and extract content from dynamic websites that load via JavaScript. Use this skill when WebFetch fails to get content from sites like Wix, React apps, or any JavaScript-heavy website.
allowed-tools: Read, Write, Glob
---

# Web Scraper Skill (Playwright)

Extract content from dynamic websites using Playwright MCP browser automation.

## When to Use This Skill

Use Playwright when:
- WebFetch returns only HTML shell/framework code
- Site uses Wix, Squarespace, React, Vue, or similar JS frameworks
- Content loads after page render via API calls
- You need to interact with the page (click, scroll, wait)

## Available Playwright MCP Tools

### Navigation
- `browser_navigate` - Go to a URL
- `browser_navigate_back` - Go back in history
- `browser_wait_for` - Wait for content/time

### Content Extraction
- `browser_snapshot` - Get accessibility tree (structured text content)
- `browser_take_screenshot` - Capture visual image
- `browser_evaluate` - Run JavaScript to extract data

### Interaction
- `browser_click` - Click an element
- `browser_type` - Type text
- `browser_fill_form` - Fill multiple form fields
- `browser_select_option` - Select from dropdowns
- `browser_hover` - Hover over element
- `browser_press_key` - Press keyboard key

### Session Management
- `browser_close` - Close the browser
- `browser_tabs` - Manage tabs

## Standard Workflow for Content Extraction

### Step 1: Navigate to the Page

```
Use browser_navigate with url: "https://example.com/page"
```

### Step 2: Wait for Dynamic Content

Most JS sites need time to load. Use `browser_wait_for`:

```
Wait for specific text to appear:
browser_wait_for with text: "Schedule" and state: "visible"

Or wait a fixed time for API calls to complete:
browser_wait_for with time: 3000  (3 seconds)
```

### Step 3: Get Page Content

**Option A: Accessibility Snapshot (preferred for text)**
```
browser_snapshot
```
Returns structured text content from the accessibility tree. Best for:
- Reading text content
- Finding elements by their accessible names
- Getting a structured view of the page

**Option B: Screenshot (for visual/layout)**
```
browser_take_screenshot
```
Returns an image. Best for:
- Seeing visual layout
- Debugging when snapshot is unclear
- Pages with complex visual formatting

**Option C: JavaScript Evaluation (for specific data)**
```
browser_evaluate with expression: "document.querySelector('.schedule').innerText"
```
Best for:
- Extracting specific elements
- Getting structured data
- Running custom extraction logic

### Step 4: Close Browser (when done)

```
browser_close
```

## Example: Fetching a Yoga Studio Schedule (Wix Site)

```
1. browser_navigate
   url: "https://example.com/schedule"

2. browser_wait_for
   time: 3000  # Wait for Wix to load dynamic content

3. browser_snapshot
   # Returns the schedule content as accessible text

4. Parse the returned text to extract:
   - Class names
   - Times
   - Instructors
   - Days

5. browser_close
```

## Example: Extracting Specific Data with JavaScript

```
1. browser_navigate
   url: "https://example.com/classes"

2. browser_wait_for
   text: "Monday"
   state: "visible"

3. browser_evaluate
   expression: |
     Array.from(document.querySelectorAll('.class-item')).map(el => ({
       name: el.querySelector('.class-name')?.textContent,
       time: el.querySelector('.class-time')?.textContent,
       instructor: el.querySelector('.instructor')?.textContent
     }))

4. browser_close
```

## Handling Common Scenarios

### Cookie/Privacy Banners
```
browser_click with element: "Accept" or ref: <button ref>
```

### Login Required
```
1. browser_navigate to login page
2. browser_fill_form with fields for username/password
3. browser_click on submit button
4. browser_wait_for redirect/content
```

### Infinite Scroll
```
1. browser_evaluate: "window.scrollTo(0, document.body.scrollHeight)"
2. browser_wait_for time: 1000
3. Repeat until all content loaded
```

### Tabs/Accordions
```
1. browser_click on tab/accordion header
2. browser_wait_for content to appear
3. browser_snapshot to get expanded content
```

## Tips for Reliable Extraction

1. **Always wait after navigation** - Dynamic sites need 2-5 seconds to load
2. **Use snapshot over screenshot** - Snapshot gives parseable text
3. **Close browser when done** - Frees resources
4. **Handle errors gracefully** - Sites may be down or changed
5. **Respect rate limits** - Don't hammer sites repeatedly

## Wix-Specific Notes

Wix sites (like Ember Studios) typically:
- Load a shell HTML first
- Fetch content via API after page load
- Use dynamic class names (hard to target)
- Have accessibility labels for booking widgets

Best approach for Wix:
```
1. Navigate to URL
2. Wait 3-5 seconds for full load
3. Use browser_snapshot (accessibility tree works well with Wix)
4. Parse the text output
```

## Integration with Other Skills

This skill provides the browser automation layer. Other skills use it:

- **yoga-scheduler**: Uses Playwright to fetch studio schedules
- **Future skills**: Google Calendar sync, event scraping, etc.

When another skill needs dynamic web content:
1. That skill invokes this workflow
2. Gets structured content back
3. Processes it for its specific use case
