# Settings Pages `/loaded` Pattern - Complete Analysis

## Overview
The `/loaded` pattern is a performance optimization technique that improves perceived performance by:
1. Showing a lightweight loading page immediately
2. Asynchronously loading heavy data after a short delay (500ms)
3. Preventing direct URL access to the data endpoints

---

## Current Implementation Status

### ✅ Fully Implemented Pages (7 pages)

1. **Organization Settings**
2. **Locations**
3. **Practitioners List**
4. **Practitioners Invitations**
5. **Services**
6. **Integrations**
7. **Website**

---

## Complete Flow Analysis

### 1. **Organization Settings** (`/settings/organization`)

#### Route Flow (`routes/settings.php`)

**Step 1: Main Route (Loading Page)**
```php
// Line 17-19
Route::get('settings/Organization', function () {
    return Inertia::render('settings/Organization/Loading');
})->name('settings.organization')
  ->middleware(['require-tenant', 'permission:view-organization']);
```

**Step 2: Loaded Route (Heavy Data)**
```php
// Line 22
Route::get('settings/Organization/loaded', [SettingsController::class, 'organizationLoaded'])
    ->name('settings.organization.loaded')
    ->middleware(['require-tenant', 'permission:view-organization']);
```

#### Controller Method (`SettingsController.php`)

**Method: `organizationLoaded()`** (Line 105-123)
```php
public function organizationLoaded(Request $request)
{
    // CRITICAL: X-Inertia header check prevents direct URL access
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.organization');
    }

    $data = [
        'organizationSettings' => [
            'practiceDetails' => OrganizationSetting::getByPrefix('practice_details_'),
            'appearance' => $this->getAppearanceSettingsWithSignedUrl(),
            'timeLocale' => OrganizationSetting::getByPrefix('time_locale_'),
            'businessCompliance' => OrganizationSetting::getByPrefix('business_compliance_'),
        ],
        'appointmentSettings' => OrganizationSetting::getByPrefix('appointment_'),
    ];

    return Inertia::render('settings/organization', $data);
}
```

#### Frontend Component

**Loading Component:** `resources/js/pages/settings/Organization/Loading.tsx`
```tsx
export default function SettingsOrganizationLoading() {
    useEffect(() => {
        const timer = setTimeout(() => {
            // Preserve query parameters
            const searchParams = new URLSearchParams(window.location.search);
            const queryString = searchParams.toString();
            const targetUrl = queryString 
                ? route('settings.organization.loaded') + '?' + queryString
                : route('settings.organization.loaded');

            router.visit(targetUrl, {
                preserveState: false,
                preserveScroll: false,
            });
        }, 500); // 500ms delay

        return () => clearTimeout(timer);
    }, []);

    return (
        <AppLayout breadcrumbs={[...]}>
            <Head title="Loading Organization Settings" />
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
                <h2>Loading Organization Settings</h2>
                <p>Please wait while we load the organization settings...</p>
            </div>
        </AppLayout>
    );
}
```

**Data Component:** `resources/js/pages/settings/organization.tsx`
- Receives full data props
- Renders actual settings interface

---

### 2. **Locations** (`/settings/locations`)

#### Route Flow
```php
// Loading page
Route::get('settings/locations', function () {
    return Inertia::render('settings/locations/Loading');
})->name('settings.locations')
  ->middleware(['require-tenant', 'permission:view-location']);

// Heavy data page
Route::get('settings/locations/loaded', [SettingsController::class, 'locationsLoaded'])
    ->name('settings.locations.loaded')
    ->middleware(['require-tenant', 'permission:view-location']);
```

#### Controller Method
```php
public function locationsLoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.locations');
    }

    $data = [
        'locations' => $this->getLocations($request),
    ];

    return Inertia::render('settings/locations', $data);
}
```

#### Frontend
- **Loading:** `resources/js/pages/settings/locations/Loading.tsx`
- **Data Page:** `resources/js/pages/settings/locations.tsx`

---

### 3. **Practitioners List** (`/settings/practitioners/list`)

#### Route Flow
```php
// Redirect wrapper
Route::get('settings/practitioners', function () {
    return redirect()->route('settings.practitioners.list');
})->name('settings.practitioners')
  ->middleware(['require-tenant', 'permission:view-practitioner']);

// Loading page
Route::get('settings/practitioners/list', function () {
    return Inertia::render('settings/practitioners-list/Loading');
})->name('settings.practitioners.list')
  ->middleware(['require-tenant', 'permission:view-practitioner']);

// Heavy data page
Route::get('settings/practitioners/list/loaded', [SettingsController::class, 'practitionersListLoaded'])
    ->name('settings.practitioners.list.loaded')
    ->middleware(['require-tenant', 'permission:view-practitioner']);
```

#### Controller Method
```php
public function practitionersListLoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.practitioners.list');
    }

    $currentTenantId = tenant('id');
    $perPage = $request->get('perPage', 10);
    $search = $request->search;

    // Complex practitioner query logic
    $centralPractitionersQuery = Practitioner::query();
    // ... search filtering, transformation, pagination ...

    return Inertia::render('settings/practitioners-list-working', [
        'items' => $practitioners,
        'filters' => [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ],
    ]);
}
```

#### Frontend
- **Loading:** `resources/js/pages/settings/practitioners-list/Loading.tsx`
- **Data Page:** `resources/js/pages/settings/practitioners-list-working.tsx`

---

### 4. **Practitioners Invitations** (`/settings/practitioners/invitations`)

#### Route Flow
```php
// Loading page
Route::get('settings/practitioners/invitations', function () {
    return Inertia::render('settings/practitioners-invitations/Loading');
})->name('settings.practitioners.invitations')
  ->middleware(['require-tenant', 'permission:view-practitioner']);

// Heavy data page
Route::get('settings/practitioners/invitations/loaded', [SettingsController::class, 'practitionersInvitationsLoaded'])
    ->name('settings.practitioners.invitations.loaded')
    ->middleware(['require-tenant', 'permission:view-practitioner']);
```

#### Controller Method
```php
public function practitionersInvitationsLoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.practitioners.invitations');
    }

    $data = [
        'invitations' => $this->getInvitations($request),
        'filters' => [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ],
        'activeTab' => 'invitations',
    ];

    return Inertia::render('settings/practitioners-invitations', $data);
}
```

#### Frontend
- **Loading:** `resources/js/pages/settings/practitioners-invitations/Loading.tsx`
- **Data Page:** `resources/js/pages/settings/practitioners-invitations.tsx`

---

### 5. **Services** (`/settings/services`)

#### Route Flow
```php
// Loading page
Route::get('settings/services', function () {
    return Inertia::render('settings/services/Loading');
})->name('settings.services')
  ->middleware(['require-tenant', 'permission:view-services']);

// Heavy data page
Route::get('settings/services/loaded', [SettingsController::class, 'servicesLoaded'])
    ->name('settings.services.loaded')
    ->middleware(['require-tenant', 'permission:view-services']);
```

#### Controller Method
```php
public function servicesLoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.services');
    }

    $data = [
        'services' => $this->getServices($request),
        'filters' => [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ],
    ];

    return Inertia::render('settings/services', $data);
}
```

#### Frontend
- **Loading:** `resources/js/pages/settings/services/Loading.tsx`
- **Data Page:** `resources/js/pages/settings/services.tsx`

---

### 6. **Integrations** (`/settings/integrations`)

#### Route Flow
```php
// Loading page
Route::get('settings/integrations', function () {
    return Inertia::render('settings/integrations/Loading');
})->name('settings.integrations')
  ->middleware(['require-tenant', 'permission:view-integration']);

// Heavy data page
Route::get('settings/integrations/loaded', [SettingsController::class, 'integrationsLoaded'])
    ->name('settings.integrations.loaded')
    ->middleware(['require-tenant', 'permission:view-integration']);
```

#### Controller Method
```php
public function integrationsLoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.integrations');
    }

    $data = [
        'integrations' => $this->getIntegrations(),
    ];

    return Inertia::render('settings/integrations', $data);
}
```

#### Frontend
- **Loading:** `resources/js/pages/settings/Integrations/Loading.tsx`
- **Data Page:** `resources/js/pages/settings/integrations.tsx`

---

### 7. **Website** (`/settings/website`)

#### Route Flow
```php
// Loading page
Route::get('settings/website', function () {
    return Inertia::render('settings/website/Loading');
})->name('settings.website')
  ->middleware(['require-tenant', 'permission:view-website']);

// Heavy data page
Route::get('settings/website/loaded', [SettingsController::class, 'websiteLoaded'])
    ->name('settings.website.loaded')
    ->middleware(['require-tenant', 'permission:view-website']);
```

#### Controller Method
```php
public function websiteLoaded(Request $request)
{
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.website');
    }

    $data = [
        // Website settings data can be added here as needed
    ];

    return Inertia::render('settings/website', $data);
}
```

#### Frontend
- **Loading:** `resources/js/pages/settings/website/Loading.tsx`
- **Data Page:** `resources/js/pages/settings/website.tsx`

---

## Special Case: Settings Index Redirect

### Route
```php
// Line 13
Route::get('settings', [SettingsController::class, 'indexRedirect'])
    ->name('settings.index')
    ->middleware('require-tenant');
```

### Controller Method
```php
public function indexRedirect()
{
    return Inertia::render('settings/Organization/Loading');
}
```

**Flow:**
1. User visits `/settings`
2. Controller renders Organization Loading page directly
3. Loading page auto-navigates to `/settings/organization/loaded`
4. User sees Organization settings

---

## Pattern Components Summary

### 1. **Route Layer** (`routes/settings.php`)

Each settings page has **TWO routes**:

**A. Loading Route:**
- URL: `/settings/{page}`
- Method: Inline closure
- Returns: `Inertia::render('{page}/Loading')`
- Middleware: `['require-tenant', 'permission:view-{resource}']`

**B. Loaded Route:**
- URL: `/settings/{page}/loaded`
- Method: Controller method
- Returns: `Inertia::render('{page}', $data)`
- Middleware: `['require-tenant', 'permission:view-{resource}']`

### 2. **Controller Layer** (`SettingsController.php`)

Each loaded method follows this pattern:

```php
public function {page}Loaded(Request $request)
{
    // Step 1: X-Inertia header check (security)
    if (! request()->header('X-Inertia')) {
        return redirect()->route('settings.{page}');
    }

    // Step 2: Load heavy data
    $data = [
        // ... database queries, transformations ...
    ];

    // Step 3: Render page with data
    return Inertia::render('settings/{page}', $data);
}
```

**Key Features:**
- ✅ X-Inertia header validation prevents direct URL access
- ✅ Redirects to loading page if accessed directly
- ✅ Heavy data loading logic contained here
- ✅ Returns full page with props

### 3. **Frontend Layer** (React Components)

#### A. Loading Component (`{page}/Loading.tsx`)

**Structure:**
```tsx
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
        <AppLayout breadcrumbs={[...]}>
            <Head title="Loading {Page}" />
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <h2>Loading {Page}</h2>
                <p>Please wait...</p>
            </div>
        </AppLayout>
    );
}
```

**Key Features:**
- ✅ Shows loading spinner immediately
- ✅ 500ms setTimeout before navigation
- ✅ Preserves query parameters
- ✅ Uses Inertia router.visit()
- ✅ Cleanup function to prevent memory leaks
- ✅ Full layout with breadcrumbs

#### B. Data Component (`{page}.tsx`)

- Receives props from controller
- Renders actual data interface
- Handles user interactions

---

## Security Features

### 1. **X-Inertia Header Check**
```php
if (! request()->header('X-Inertia')) {
    return redirect()->route('settings.{page}');
}
```

**Purpose:**
- Prevents direct URL access to `/loaded` endpoints
- Ensures users always go through loading page first
- Maintains the optimization flow

**How It Works:**
- Inertia.js automatically adds `X-Inertia` header to all requests
- Direct browser navigation (typing URL) won't have this header
- Redirect back to loading page ensures proper flow

### 2. **Middleware Protection**
- `require-tenant`: Ensures tenant context exists
- `permission:view-{resource}`: Enforces permission checks
- Applied to BOTH loading and loaded routes

---

## Performance Benefits

### 1. **Perceived Performance**
- Loading page renders instantly (no database queries)
- User sees feedback within milliseconds
- 500ms gives impression of "fast" app

### 2. **Actual Performance**
- Separates render from data fetching
- Heavy queries don't block initial render
- Better user experience for slow queries

### 3. **Progressive Loading**
- Can add skeleton screens
- Can show partial data first
- Supports lazy loading patterns

---

## Common Pattern Elements

### Query Parameter Preservation
All Loading components preserve query parameters:
```tsx
const searchParams = new URLSearchParams(window.location.search);
const queryString = searchParams.toString();
const targetUrl = queryString 
    ? route('settings.{page}.loaded') + '?' + queryString
    : route('settings.{page}.loaded');
```

**Use Cases:**
- Search filters
- Pagination state
- Sort order
- Tab selection

### Consistent Timing
- All pages use **500ms delay**
- Provides consistent UX across app
- Long enough to show loading state
- Short enough to feel responsive

### Layout Consistency
- All use `AppLayout`
- All include breadcrumbs
- All use same loader component (`Loader2`)
- All use similar styling

---

## File Structure

### Routes
```
routes/
└── settings.php                 # All settings routes
```

### Controllers
```
app/Http/Controllers/Settings/
└── SettingsController.php       # All *Loaded() methods
```

### Frontend Components
```
resources/js/pages/settings/
├── Organization/
│   ├── Loading.tsx             # Loading component
│   └── ...                     # Sub-components
├── locations/
│   ├── Loading.tsx
│   └── ...
├── practitioners-list/
│   ├── Loading.tsx
│   └── ...
├── practitioners-invitations/
│   ├── Loading.tsx
│   └── ...
├── services/
│   ├── Loading.tsx
│   └── ...
├── Integrations/
│   ├── Loading.tsx
│   └── ...
├── website/
│   ├── Loading.tsx
│   └── ...
├── organization.tsx            # Data page
├── locations.tsx
├── practitioners-list-working.tsx
├── practitioners-invitations.tsx
├── services.tsx
├── integrations.tsx
└── website.tsx
```

---

## Implementation Checklist

For any new page implementing this pattern:

### ✅ Backend
- [ ] Create loading route (inline closure)
- [ ] Create loaded route (controller method)
- [ ] Add `{page}Loaded()` method to controller
- [ ] Implement X-Inertia header check
- [ ] Add heavy data loading logic
- [ ] Apply proper middleware
- [ ] Add permission checks

### ✅ Frontend
- [ ] Create `{Page}/Loading.tsx` component
- [ ] Add `useEffect` with 500ms setTimeout
- [ ] Implement query parameter preservation
- [ ] Add cleanup function
- [ ] Use consistent layout (AppLayout)
- [ ] Add loading spinner (Loader2)
- [ ] Set proper breadcrumbs
- [ ] Create/update data component
- [ ] Accept props from controller

### ✅ Testing
- [ ] Test direct URL access (should redirect)
- [ ] Test with query parameters
- [ ] Test loading state visibility
- [ ] Test data loads correctly
- [ ] Test permission checks
- [ ] Test tenant context requirement

---

## Best Practices

### 1. **Naming Conventions**
- Route: `settings.{page}` → `settings.{page}.loaded`
- Controller: `{page}Loaded()`
- Component: `Settings{Page}Loading`
- File: `{page}/Loading.tsx`

### 2. **Error Handling**
- Always check X-Inertia header
- Always redirect on direct access
- Handle missing tenant gracefully
- Return proper HTTP status codes

### 3. **Data Loading**
- Keep loading methods focused
- Use helper methods for complex queries
- Include search/filter support
- Add pagination where needed

### 4. **Frontend**
- Always cleanup timeouts
- Preserve query parameters
- Use consistent timing (500ms)
- Match existing UI patterns

---

## Current Issues & Recommendations

### ✅ Implemented Correctly
- All 7 settings pages have `/loaded` pattern
- All have X-Inertia header checks
- All have Loading components
- All preserve query parameters
- All use consistent timing

### 🔄 Minor Inconsistencies
1. **Organization vs organization naming**
   - Route uses `settings/Organization` (capital O)
   - Component path uses `Organization/Loading` (capital O)
   - Data component uses `settings/organization` (lowercase o)
   - **Recommendation:** Standardize to lowercase for consistency

2. **Practitioners complexity**
   - Has extra redirect layer (`/practitioners` → `/practitioners/list`)
   - Uses `practitioners-list-working.tsx` filename
   - **Recommendation:** Simplify or document reasoning

---

## Summary

The `/loaded` pattern is **fully implemented** across all 7 settings pages with:

✅ **Consistent structure**
✅ **Security measures** (X-Inertia checks)
✅ **Performance optimization** (deferred data loading)
✅ **User experience** (loading states)
✅ **Query parameter preservation**
✅ **Proper middleware protection**

The implementation is production-ready and follows Laravel + Inertia.js best practices.

