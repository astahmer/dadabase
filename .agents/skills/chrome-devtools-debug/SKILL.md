---
name: chrome-devtools-debug
description: Debug frontend code using Chrome DevTools MCP. Use when needing to verify rendered output, inspect DOM/CSS, check console logs/errors/warnings, debug network requests, or compare implementation against a design. Triggers on "devtools", "devtool", "debug this error", "check the browser", "compare with the design", "verify the output", "inspect the page", "check console", "check network requests", "why doesn't this look right", "is this pixel perfect".
---

# Chrome DevTools Debug

Debug frontend code by inspecting the actual browser state. Use snapshots for DOM/layout, screenshots for visual comparison, console for errors, and network panel for request debugging.

## Available Tools

| Tool | Purpose |
|------|---------|
| `take_snapshot` | Get DOM tree with element uids for inspection |
| `take_screenshot` | Capture visual output for comparison |
| `list_console_messages` | Get all console logs/errors/warnings |
| `get_console_message` | Get details of specific console message |
| `list_network_requests` | List all network requests |
| `get_network_request` | Get request/response details (headers, body, timing) |
| `click`, `hover` | Interact with elements (trigger states) |
| `evaluate_script` | Run JS to get computed styles, dimensions, etc. |

## Workflows

### 1. Console Debugging

When debugging errors, warnings, or unexpected behavior:

```
1. list_console_messages (filter by types: ["error", "warn"] if needed)
2. get_console_message(msgid) for stack traces and details
3. Cross-reference with source code
```

Example - check for errors:
```
list_console_messages with types: ["error", "warn"]
→ Found error msgid 42
get_console_message(42)
→ "TypeError: Cannot read property 'map' of undefined at ProductList.tsx:45"
```

### 2. Network Request Debugging

When debugging API calls, failed fetches, or data issues:

```
1. list_network_requests (filter by resourceTypes: ["fetch", "xhr"] for API calls)
2. get_network_request(reqid) for headers, payload, response body
3. Check status codes, CORS headers, response data
```

Example - debug failed API call:
```
list_network_requests with resourceTypes: ["fetch", "xhr"]
→ Found reqid 15: POST /api/users 422
get_network_request(15)
→ Request body: { "email": "invalid" }
→ Response: { "error": "Invalid email format" }
```

Key details to check:
- **Status code**: 4xx client error, 5xx server error
- **Request headers**: Authorization, Content-Type
- **Response headers**: CORS (Access-Control-*), Set-Cookie
- **Request body**: Payload sent
- **Response body**: Error messages, data shape

### 3. Visual Comparison & Layout Inspection

When verifying implementation matches design or debugging layout issues:

#### Quick Visual Check
```
take_screenshot
→ Compare visually with design/mockup
→ Note discrepancies: spacing, colors, alignment, sizing
```

#### DOM/CSS Inspection
```
1. take_snapshot (get element tree with uids)
2. evaluate_script to get computed styles/dimensions
```

Example - check element dimensions:
```javascript
// Get element size and position
evaluate_script({
  function: `(el) => {
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      padding: styles.padding,
      margin: styles.margin,
      overflow: styles.overflow
    };
  }`,
  args: [{ uid: "element-uid" }]
})
```

Example - check for overflow issues:
```javascript
// Detect overflow
evaluate_script({
  function: `(el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    hasHorizontalOverflow: el.scrollWidth > el.clientWidth,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    hasVerticalOverflow: el.scrollHeight > el.clientHeight
  })`,
  args: [{ uid: "container-uid" }]
})
```

Example - get all CSS properties:
```javascript
// Full computed styles
evaluate_script({
  function: `(el) => {
    const styles = window.getComputedStyle(el);
    return {
      display: styles.display,
      flexDirection: styles.flexDirection,
      gap: styles.gap,
      fontSize: styles.fontSize,
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      border: styles.border,
      borderRadius: styles.borderRadius
    };
  }`,
  args: [{ uid: "element-uid" }]
})
```

#### Hover/Active State Inspection
```
1. hover(uid) to trigger hover state
2. take_screenshot or evaluate_script to check styles
```

### 4. Full Debug Cycle (Recommended)

When implementing a design or fixing UI bugs, use this feedback loop:

```
1. take_snapshot → understand current DOM structure
2. take_screenshot → see current visual state
3. list_console_messages → check for errors
4. list_network_requests → verify data loading
5. evaluate_script → inspect specific element styles/dimensions
6. Make code changes
7. Repeat from step 2 until matching design
```

## Common Patterns

### Check if element exists
```javascript
evaluate_script({
  function: `() => document.querySelector('.my-class') !== null`
})
```

### Get all elements matching selector
```javascript
evaluate_script({
  function: `() => [...document.querySelectorAll('.item')].map(el => ({
    text: el.textContent,
    className: el.className
  }))`
})
```

### Compare two elements' alignment
```javascript
evaluate_script({
  function: `() => {
    const a = document.querySelector('.element-a').getBoundingClientRect();
    const b = document.querySelector('.element-b').getBoundingClientRect();
    return {
      sameTop: Math.abs(a.top - b.top) < 1,
      sameLeft: Math.abs(a.left - b.left) < 1,
      gap: b.left - a.right
    };
  }`
})
```

### Check responsive breakpoint
```javascript
evaluate_script({
  function: `() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  })`
})
```
