<!-- 06de10f4-ba8e-4c15-b06a-190b1a3596f8 f1bfbbea-e3d5-412b-a1dd-599a4e4641f9 -->
# Fix Complete Sidebar Navigation Failure

## Problems Identified

### Issue 1: Page Not Found Errors

Folder name casing mismatch causing Vite to fail loading components:

- Routes expect: `settings/organization/Loading`
- File system has: `Organization/Loading.tsx` (capital O)
- Routes expect: `settings/integrations/Loading`
- File system has: `Integrations/Loading.tsx` (capital I)

### Issue 2: Sidebar Clicks Don't Navigate (Critical)

**Symptom:** Clicking ANY sidebar link doesn't change pages, but manually changing URLs works fine.

**Root Cause Analysis:**

This suggests either:

1. Loading components creating redirect loops that confuse Inertia
2. JavaScript errors breaking navigation
3. The `X-Inertia` header check combined with Loading components causing navigation conflicts
4. `preserveScroll` or other Inertia options interfering

**Evidence pointing to Loading pattern issue:**

- The problem started after implementing the Loading page pattern
- Manual URL navigation works (bypasses client-side Inertia navigation)
- ALL sidebar links affected (not just settings)
- Loading components automatically redirect after 500ms, which might conflict with Inertia's navigation stack

## Root Cause Hypothesis

When clicking a sidebar link:

1. Inertia tries to navigate to `/appointments` (for example)
2. Server returns the Loading component
3. Loading component mounts and starts 500ms timer
4. Loading component tries to navigate to `/appointments/loaded`
5. BUT the original Inertia navigation might still be "in flight"
6. This creates a navigation conflict/race condition
7. Inertia gets confused and does nothing

Additionally, checking browser console would likely show errors.

## Solution Strategy

### Part 1: Fix Folder Casing (Required)

Move files from capital case to lowercase:

**Organization folder → organization:**

- `Organization/Loading.tsx` → `organization/Loading.tsx`
- `Organization/AccountingSettings.tsx` → `organization/AccountingSettings.tsx`
- `Organization/Appearance.tsx` → `organization/Appearance.tsx`
- `Organization/BusinessCompliance.tsx` → `organization/BusinessCompliance.tsx`
- `Organization/PracticeDetails.tsx` → `organization/PracticeDetails.tsx`
- `Organization/TimeLocale.tsx` → `organization/TimeLocale.tsx`

**Integrations folder → integrations:**

- `Integrations/Loading.tsx` → `integrations/Loading.tsx`
- `Integrations/IntegrationsTab.tsx` → `integrations/IntegrationsTab.tsx`

**Update imports in:**

- `resources/js/pages/settings/organization.tsx` (lines 8-13) - change `./Organization/` to `./organization/`
- `resources/js/pages/settings/integrations.tsx` - change `./Integrations/` to `./integrations/`

### Part 2: Fix Navigation Issue

**Option A: Remove `preserveScroll` from settings-layout**

In `resources/js/layouts/settings-layout.tsx` line 95, the Link has `preserveScroll` which might interfere:

```typescript
// Current:
<Link href={item.href} preserveScroll ...>

// Change to:
<Link href={item.href}>
```

**Option B: Add proper Inertia options to Loading components**

Update all Loading components to use proper Inertia navigation options:

```typescript
router.visit(targetUrl, {
    preserveState: false,
    preserveScroll: false,
    replace: false,  // Add this
    only: [],  // Add this to ensure full page reload
});
```

**Option C: Check for pending navigation before redirect**

In Loading components, check if there's already a navigation in progress:

```typescript
useEffect(() => {
    const timer = setTimeout(() => {
        // Check if still mounted and no other navigation in progress
        if (!router.page.props.errors) {
            router.visit(targetUrl, {
                preserveState: false,
                preserveScroll: false,
            });
        }
    }, 500);

    return () => clearTimeout(timer);
}, []);
```

**Recommended: Start with Option A** (simplest fix)

### Part 3: Verification Steps

1. Fix folder casing first
2. Clear browser cache and reload
3. Try clicking sidebar links
4. Check browser console for errors
5. If still broken, implement Option B
6. If still broken, implement Option C

## Files to Modify

### Must Fix (Casing):

1. Create `resources/js/pages/settings/organization/` (lowercase)
2. Create `resources/js/pages/settings/integrations/` (lowercase)
3. Move all files from capital folders to lowercase
4. Update imports in `organization.tsx` and `integrations.tsx`
5. Delete empty capital folders

### Optional Fix (Navigation):

1. `resources/js/layouts/settings-layout.tsx` - remove `preserveScroll`
2. All Loading components (if needed) - update router.visit options
3. Check browser console for JavaScript errors

## Expected Outcome

- All pages load without "Page not found" errors
- Sidebar navigation works by clicking links
- No redirect loops or navigation conflicts
- Manual URL changes still work
- Page refreshes work correctly

GO WITH OPTION A

### To-dos

- [ ] Create loading and loaded routes for appointments/create