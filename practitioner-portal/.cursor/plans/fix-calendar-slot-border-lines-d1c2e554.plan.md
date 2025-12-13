<!-- d1c2e554-8f64-42f7-b9bc-df6a9cc7ab2a ca470b40-da83-4a42-b100-66cbbc2b6f85 -->
# Fix Multiple Plus Signs and Scrollbars

## Root Cause Analysis

### Issue 1: Multiple Plus Signs in One Slot

- **Problem**: With 1-minute slots (60px height), hovering near slot borders triggers hover states on multiple adjacent slots, causing multiple plus signs to appear
- **Root Cause**: The plus sign uses `group-hover:opacity-100` and `absolute inset-0`, which means when hovering near borders, multiple slots can trigger simultaneously
- **Location**: Line 415-418 in `resources/js/pages/Calendar/IndexV2.tsx`

### Issue 2: Multiple Scrollbars

- **Problem**: Both horizontal and vertical scrollbars appear, creating visual clutter
- **Root Cause**: Nested overflow containers:
- Line 341: Outer container has `overflow-x-auto` (creates horizontal scrollbar)
- Line 362: Inner container has `overflow-y-auto overflow-x-hidden` (creates vertical scrollbar)
- **Solution**: Remove outer `overflow-x-auto` and let inner container handle all scrolling with proper overflow settings

## Changes Required

### File: `resources/js/pages/Calendar/IndexV2.tsx`

1. **Fix Plus Sign Duplication** (Line 415-418):

- Add `pointer-events-none` to the plus sign container to prevent it from interfering with hover detection
- Ensure only one slot's hover state triggers at a time by improving the hover area isolation

2. **Fix Multiple Scrollbars** (Line 341-362):

- Remove `overflow-x-auto` from outer container (line 341)
- Update inner container to handle both horizontal and vertical scrolling: change `overflow-x-hidden` to `overflow-x-auto` on line 362
- Ensure the scroll container properly handles both directions without nesting conflicts

### To-dos

- [ ] Change border-y to border-b in practitioner column slot rendering (line 385) and remove negative margin to fix multiple lines between slots
- [ ] Change border-y to border-b in practitioner column slot rendering (line 385) and remove negative margin to fix multiple lines between slots