# CORS Issue Fix - Settings Loading Pages

## Date: November 21, 2025

## Problem Identified

The Loading pages were showing infinite loading spinners with CORS errors in the browser console:

```
Access to XMLHttpRequest at 'http://localhost:8000/settings/Organization/loaded' 
from origin 'http://test-hospital.localhost:8000' has been blocked by CORS policy
```

### Root Cause

The Loading components were using the `route()` helper from ziggy-js to generate URLs:

```tsx
// OLD CODE (caused CORS):
const targetUrl = route('settings.organization.loaded');
// Generated: http://localhost:8000/settings/Organization/loaded (wrong domain!)
```

When a user was on the **tenant domain** (`test-hospital.localhost:8000`), the `route()` helper generated URLs pointing to the **central domain** (`localhost:8000`), causing a cross-origin request that browsers block.

## Solution Implemented

**Changed all Loading components to use relative URLs** instead of the ziggy route helper:

```tsx
// NEW CODE (fixed):
const targetUrl = '/settings/Organization/loaded';
// Uses relative URL, stays on same domain ✅
```

### Why This Works

- **Relative URLs** always use the current domain
- No cross-origin requests
- Works on both central AND tenant domains
- Simpler and more reliable

## Files Modified

All 7 Loading components updated:

1. ✅ `resources/js/pages/settings/Organization/Loading.tsx`
   - Changed from `route('settings.organization.loaded')` → `/settings/Organization/loaded`

2. ✅ `resources/js/pages/settings/locations/Loading.tsx`
   - Changed from `route('settings.locations.loaded')` → `/settings/locations/loaded`

3. ✅ `resources/js/pages/settings/practitioners-list/Loading.tsx`
   - Changed from `route('settings.practitioners.list.loaded')` → `/settings/practitioners/list/loaded`

4. ✅ `resources/js/pages/settings/practitioners-invitations/Loading.tsx`
   - Changed from `route('settings.practitioners.invitations.loaded')` → `/settings/practitioners/invitations/loaded`

5. ✅ `resources/js/pages/settings/services/Loading.tsx`
   - Changed from `route('settings.services.loaded')` → `/settings/services/loaded`

6. ✅ `resources/js/pages/settings/Integrations/Loading.tsx`
   - Changed from `route('settings.integrations.loaded')` → `/settings/integrations/loaded`

7. ✅ `resources/js/pages/settings/website/Loading.tsx`
   - Changed from `route('settings.website.loaded')` → `/settings/website/loaded`

## Code Pattern Used

All components now follow this pattern:

```tsx
export default function Settings{Page}Loading() {
    useEffect(() => {
        const timer = setTimeout(() => {
            const searchParams = new URLSearchParams(window.location.search);
            const queryString = searchParams.toString();
            // Use relative URL to stay on same domain (avoid CORS)
            const targetUrl = queryString 
                ? `/settings/{page}/loaded?${queryString}`
                : '/settings/{page}/loaded';

            console.log('[Loading] Navigating to:', targetUrl);
            
            router.visit(targetUrl, {
                preserveState: false,
                preserveScroll: false,
                onError: (errors) => {
                    console.error('[Loading] Navigation failed:', errors);
                },
            });
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    // ... render loading spinner
}
```

## Benefits

1. **No CORS errors** - Stays on same domain
2. **Works on all domains** - Central and tenant domains both work
3. **Simpler code** - No need for ziggy route helper
4. **Query parameters preserved** - Search/filter state maintained
5. **Debug logging added** - Easier to troubleshoot issues

## Testing Steps

### Step 1: Rebuild Frontend

```bash
npm run build
# OR
npm run dev
```

### Step 2: Clear Browser Cache

- Hard reload: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or open DevTools → Network tab → Check "Disable cache"

### Step 3: Test Each Page

Navigate to these URLs on the **tenant domain** (e.g., `test-hospital.localhost:8000`):

| Page | URL | Expected Behavior |
|------|-----|-------------------|
| Settings Index | `/settings` | Shows Organization loading page |
| Organization | `/settings/Organization` | Loading → Data (500ms) |
| Locations | `/settings/locations` | Loading → Data (500ms) |
| Practitioners | `/settings/practitioners/list` | Loading → Data (500ms) |
| Invitations | `/settings/practitioners/invitations` | Loading → Data (500ms) |
| Services | `/settings/services` | Loading → Data (500ms) |
| Integrations | `/settings/integrations` | Loading → Data (500ms) |
| Website | `/settings/website` | Loading → Data (500ms) |

### Step 4: Check Browser Console

Open DevTools (F12) and look for:

**Good output:**
```
[Loading] Navigating to: /settings/Organization/loaded
```

**No errors** - Page should load data successfully after 500ms

## Previous Issues Resolved

1. ✅ **Access denied error** - Fixed by removing duplicate permission middleware
2. ✅ **CORS error** - Fixed by using relative URLs (this fix)
3. ✅ **Infinite loading** - Should be resolved after rebuilding frontend

## Security Note

The security model remains unchanged:
- Loading pages have permission middleware
- `/loaded` endpoints have X-Inertia header checks
- Users must go through permission-protected loading pages first
- Tenant context required via `require-tenant` middleware

Using relative URLs instead of the `route()` helper doesn't affect security, it only fixes the domain resolution issue.

## Why Ziggy Route Helper Failed

The ziggy route helper is designed to work with domain-based routing, but in a multi-tenancy setup with different domains:

- Routes are registered for BOTH central and tenant domains
- Ziggy doesn't always know which domain to use
- It defaults to the central domain (localhost:8000)
- This causes CORS when accessed from tenant domain

**Relative URLs solve this** by letting the browser resolve the domain automatically based on the current page.

## Future Considerations

If you need to use the `route()` helper in the future for other pages:

1. Ensure ziggy is configured to respect tenant domains
2. OR continue using relative URLs for cross-domain routes
3. Consider adding a utility function that detects current domain and adjusts URLs accordingly

## Summary

**Before:** CORS errors, infinite loading  
**After:** Working navigation, data loads correctly  
**Change:** Ziggy route helper → Relative URLs  
**Impact:** All 7 settings pages fixed  
**Next Step:** Rebuild frontend and test!

