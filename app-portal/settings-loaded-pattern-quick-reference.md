# Settings `/loaded` Pattern - Quick Reference Guide

## 📋 Implementation Checklist

Use this checklist when adding the `/loaded` pattern to a new page.

---

## Step 1: Routes (`routes/settings.php`)

```php
// Add these two routes:

// Loading route (fast, no data)
Route::get('settings/{page}', function () {
    return Inertia::render('settings/{page}/Loading');
})->name('settings.{page}')
  ->middleware(['require-tenant', 'permission:view-{resource}']);

// Loaded route (heavy data)
Route::get('settings/{page}/loaded', [SettingsController::class, '{page}Loaded'])
    ->name('settings.{page}.loaded')
    ->middleware(['require-tenant', 'permission:view-{resource}']);
```

**Replace:**
- `{page}` with your page name (e.g., `organization`, `locations`)
- `{resource}` with permission name (e.g., `organization`, `location`)

---

## Step 2: Controller Method (`SettingsController.php`)

```php
/**
 * Display the {page} settings page
 */
public function {page}Loaded(Request $request)
{
    // CRITICAL: Security check - prevents direct URL access
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.{page}');
    }

    // Load your heavy data here
    $data = [
        '{dataKey}' => $this->get{Data}($request),
        'filters' => [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ],
    ];

    return Inertia::render('settings/{page}', $data);
}
```

**Replace:**
- `{page}` with your page name
- `{dataKey}` with your data prop name
- `{Data}` with your helper method name

---

## Step 3: Loading Component (`resources/js/pages/settings/{page}/Loading.tsx`)

```tsx
import { useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { route } from 'ziggy-js';

export default function Settings{Page}Loading() {
    useEffect(() => {
        const timer = setTimeout(() => {
            // Preserve query parameters
            const searchParams = new URLSearchParams(window.location.search);
            const queryString = searchParams.toString();
            const targetUrl = queryString 
                ? route('settings.{page}.loaded') + '?' + queryString
                : route('settings.{page}.loaded');

            router.visit(targetUrl, {
                preserveState: false,
                preserveScroll: false,
            });
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Settings', href: '/settings' },
                { title: '{Page}', href: '#' },
            ]}
        >
            <Head title="Loading {Page}" />
            
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <div className="text-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Loading {Page}
                    </h2>
                    <p className="text-gray-600">
                        Please wait while we load the {page}...
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
```

**Replace:**
- `{Page}` with capitalized page name (e.g., `Organization`, `Locations`)
- `{page}` with lowercase page name (e.g., `organization`, `locations`)

---

## Step 4: Data Component (Update existing or create new)

Your existing page component at `resources/js/pages/settings/{page}.tsx` should:

1. **Accept props from controller:**
```tsx
interface Props {
    {dataKey}: YourDataType;
    filters?: {
        search?: string;
        perPage?: number;
    };
}

export default function Settings{Page}({ {dataKey}, filters }: Props) {
    // Your component logic
}
```

2. **Use the props to render data:**
```tsx
return (
    <SettingsLayout activeSection="{page}">
        {/* Render your data here */}
        {/* Example: */}
        {items.data.map(item => (
            <div key={item.id}>{item.name}</div>
        ))}
    </SettingsLayout>
);
```

---

## Testing Checklist

### ✅ Test Cases

1. **Normal Flow:**
   - [ ] Navigate to `/settings/{page}`
   - [ ] Loading spinner appears within 100ms
   - [ ] After 500ms, data page loads automatically
   - [ ] Data displays correctly

2. **Direct URL Access:**
   - [ ] Type `/settings/{page}/loaded` in browser
   - [ ] Should redirect to `/settings/{page}`
   - [ ] Then follow normal flow

3. **Query Parameters:**
   - [ ] Navigate to `/settings/{page}?search=test&perPage=25`
   - [ ] Loading page should maintain query params
   - [ ] Data page should receive and use params
   - [ ] Filters should be applied correctly

4. **Security:**
   - [ ] Without tenant context: Should show error
   - [ ] Without permission: Should show 403
   - [ ] X-Inertia header missing: Should redirect

5. **Performance:**
   - [ ] Loading page renders in < 100ms
   - [ ] Total time reasonable (< 2 seconds)
   - [ ] No console errors
   - [ ] Network tab shows 2 requests

---

## Common Mistakes to Avoid

### ❌ Don't Do This:

1. **Forgetting X-Inertia check:**
```php
public function pageLoaded(Request $request)
{
    // ❌ Missing security check!
    $data = [...];
    return Inertia::render('settings/page', $data);
}
```

2. **Not preserving query parameters:**
```tsx
useEffect(() => {
    setTimeout(() => {
        // ❌ Lost query parameters!
        router.visit(route('settings.page.loaded'));
    }, 500);
}, []);
```

3. **Wrong timeout cleanup:**
```tsx
useEffect(() => {
    setTimeout(() => {
        router.visit(...);
    }, 500);
    // ❌ Not cleaning up!
}, []);
```

4. **Loading data in loading route:**
```php
Route::get('settings/page', function () {
    // ❌ Don't query database here!
    $data = HeavyModel::with('relations')->get();
    return Inertia::render('settings/page/Loading', ['data' => $data]);
});
```

### ✅ Do This:

1. **Always check X-Inertia:**
```php
public function pageLoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.page');
    }
    // ... rest of code
}
```

2. **Preserve query parameters:**
```tsx
const searchParams = new URLSearchParams(window.location.search);
const queryString = searchParams.toString();
const targetUrl = queryString 
    ? route('settings.page.loaded') + '?' + queryString
    : route('settings.page.loaded');
```

3. **Cleanup timeout:**
```tsx
useEffect(() => {
    const timer = setTimeout(() => {
        router.visit(...);
    }, 500);
    return () => clearTimeout(timer); // ✅ Cleanup!
}, []);
```

4. **Keep loading route lightweight:**
```php
Route::get('settings/page', function () {
    // ✅ Just render loading component, no queries!
    return Inertia::render('settings/page/Loading');
});
```

---

## Quick Copy-Paste Template

### Complete Implementation Template

**1. Routes (`routes/settings.php`):**
```php
// Loading page
Route::get('settings/PAGENAME', function () {
    return Inertia::render('settings/PAGENAME/Loading');
})->name('settings.PAGENAME')
  ->middleware(['require-tenant', 'permission:view-RESOURCE']);

// Data page
Route::get('settings/PAGENAME/loaded', [SettingsController::class, 'PAGENAMELoaded'])
    ->name('settings.PAGENAME.loaded')
    ->middleware(['require-tenant', 'permission:view-RESOURCE']);
```

**2. Controller (`SettingsController.php`):**
```php
public function PAGENAMELoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.PAGENAME');
    }

    $data = [
        'items' => $this->getDATA($request),
        'filters' => [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ],
    ];

    return Inertia::render('settings/PAGENAME', $data);
}
```

**3. Loading Component (`resources/js/pages/settings/PAGENAME/Loading.tsx`):**
```tsx
import { useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { route } from 'ziggy-js';

export default function SettingsPAGENAMELoading() {
    useEffect(() => {
        const timer = setTimeout(() => {
            const searchParams = new URLSearchParams(window.location.search);
            const queryString = searchParams.toString();
            const targetUrl = queryString 
                ? route('settings.PAGENAME.loaded') + '?' + queryString
                : route('settings.PAGENAME.loaded');

            router.visit(targetUrl, {
                preserveState: false,
                preserveScroll: false,
            });
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Settings', href: '/settings' },
                { title: 'PAGETITLE', href: '#' },
            ]}
        >
            <Head title="Loading PAGETITLE" />
            
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <div className="text-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Loading PAGETITLE
                    </h2>
                    <p className="text-gray-600">
                        Please wait while we load the PAGENAME...
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
```

**Find & Replace:**
- `PAGENAME` → Your page name (lowercase, e.g., `locations`)
- `PAGETITLE` → Your page title (capitalized, e.g., `Locations`)
- `RESOURCE` → Your permission resource (e.g., `location`)
- `DATA` → Your data method name (e.g., `Locations`)

---

## Debugging Tips

### Issue: Loading page never navigates to data page

**Check:**
1. Is the route name correct in `route()`?
2. Is the timer being cleared too early?
3. Are there JavaScript errors in console?
4. Is the component unmounting before timeout?

**Debug:**
```tsx
useEffect(() => {
    console.log('Loading component mounted');
    const timer = setTimeout(() => {
        console.log('Navigating to loaded page');
        router.visit(route('settings.page.loaded'));
    }, 500);
    return () => {
        console.log('Cleaning up timer');
        clearTimeout(timer);
    };
}, []);
```

### Issue: Direct URL access doesn't redirect

**Check:**
1. Is X-Inertia header check present?
2. Is the redirect route name correct?
3. Are you testing with Inertia (which adds header)?

**Debug:**
```php
public function pageLoaded(Request $request)
{
    \Log::info('X-Inertia header:', [
        'present' => request()->header('X-Inertia') ? 'yes' : 'no',
        'value' => request()->header('X-Inertia')
    ]);
    
    if (! request()->header('X-Inertia')) {
        \Log::info('Redirecting to loading page');
        return redirect()->route('settings.page');
    }
    // ...
}
```

### Issue: Query parameters not preserved

**Check:**
1. Is `URLSearchParams` logic correct?
2. Are you using the right variable for the URL?
3. Is the route helper working correctly?

**Debug:**
```tsx
useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    console.log('Current search params:', searchParams.toString());
    
    const queryString = searchParams.toString();
    const targetUrl = queryString 
        ? route('settings.page.loaded') + '?' + queryString
        : route('settings.page.loaded');
    
    console.log('Target URL:', targetUrl);
    
    const timer = setTimeout(() => {
        router.visit(targetUrl, {
            preserveState: false,
            preserveScroll: false,
        });
    }, 500);
    
    return () => clearTimeout(timer);
}, []);
```

---

## Performance Targets

### Loading Page
- **Target:** < 100ms to render
- **Maximum:** 200ms
- **Measure:** Time from navigation to spinner visible

### Data Page
- **Target:** 300-500ms query time
- **Maximum:** 1000ms
- **Measure:** Time from /loaded request to response

### Total Experience
- **Target:** 800-1200ms (loading page + wait + data page)
- **Maximum:** 2000ms
- **User sees feedback:** < 100ms

---

## File Naming Conventions

```
routes/
└── settings.php                          # Route definitions

app/Http/Controllers/Settings/
└── SettingsController.php                # {page}Loaded() methods

resources/js/pages/settings/
├── {page}/
│   └── Loading.tsx                       # Loading component
└── {page}.tsx                            # Data component
```

**Examples:**
- `organization/Loading.tsx` + `organization.tsx`
- `locations/Loading.tsx` + `locations.tsx`
- `services/Loading.tsx` + `services.tsx`

---

## Current Pages Using This Pattern

1. ✅ Organization (`/settings/organization`)
2. ✅ Locations (`/settings/locations`)
3. ✅ Practitioners List (`/settings/practitioners/list`)
4. ✅ Practitioners Invitations (`/settings/practitioners/invitations`)
5. ✅ Services (`/settings/services`)
6. ✅ Integrations (`/settings/integrations`)
7. ✅ Website (`/settings/website`)

**Total: 7 pages fully implemented**

---

## When to Use This Pattern

### ✅ Use /loaded Pattern When:
- Page has heavy database queries (> 200ms)
- Page loads relationships or aggregations
- Page processes large datasets
- Page generates signed URLs or external API calls
- User would notice delay in page load

### ❌ Don't Use /loaded Pattern When:
- Page has minimal or no database queries
- Page renders in < 100ms consistently
- Page is very simple (e.g., static content)
- Overhead of two requests outweighs benefits

---

## Summary

**Three Components:**
1. **Loading Route** → Fast, no data
2. **Loaded Route** → Heavy data with validation
3. **Auto-navigation** → Connects them after 500ms

**Key Features:**
- Immediate user feedback
- Security via X-Inertia check
- Query parameter preservation
- Consistent UX across all pages

**Time to Implement:** ~35-40 minutes per page

**Benefit:** Significantly better perceived performance and professional user experience.

