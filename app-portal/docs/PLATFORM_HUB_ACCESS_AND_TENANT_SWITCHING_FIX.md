# Platform Hub Access and Tenant Switching Fix - Implementation Plan

## Table of Contents

1. [Overview](#overview)
2. [Issues Identified](#issues-identified)
3. [Requirements](#requirements)
4. [Implementation Plan](#implementation-plan)
5. [Testing Scenarios](#testing-scenarios)
6. [Files to Change](#files-to-change)

---

## Overview

This document outlines the plan to fix two critical issues:

1. **TenantCouldNotBeIdentifiedOnDomainException** when switching from tenant to central domain
2. **Platform Hub Access** based on table records (practitioner/patient tables) instead of roles

### Key Principle

**Platform Hub Access = Table Records Only (Not Roles)**
- Access determined by practitioner/patient table records (central + tenant-level)
- Admin/Staff roles don't grant platform hub access
- Users with practitioner/patient records can access platform hub regardless of admin role

---

## Issues Identified

### Issue 1: TenantCouldNotBeIdentifiedOnDomainException

**Error**: `Tenant could not be identified on domain localhost`

**Root Cause**:
- `EnsureOnboardingComplete` middleware tries to access tenant-specific `OrganizationSetting` table
- This requires tenant context to be initialized
- When switching from tenant to central domain, tenant context doesn't exist
- Middleware runs on central domain but tries to access tenant database → Exception

**Stack Trace**:
```
GET /onboarding
Route: onboarding.index (tenant route)
Domain: localhost:8000 (central domain)
Middleware: InitializeTenancyByDomain tries to identify tenant → Fails
```

**Solution**: Skip onboarding check on central domains (onboarding is tenant-specific only)

### Issue 2: Platform Hub Access Logic

**Current Problem**:
- Platform hub access is mixed: Some places check roles, some check table records
- Admin users with practitioner/patient records may not see platform hub option
- Auto-redirect logic prevents multi-context access

**Desired Behavior**:
- Platform hub visibility based ONLY on table records (not roles)
- Check BOTH central database AND tenant-level practitioner/patient tables
- If user has practitioner record in ANY tenant → Show practitioner dashboard
- If user has patient record in ANY tenant → Show patient dashboard
- If user has BOTH → Show both dashboards with merged sidebar
- If user has NEITHER → Hide platform hub option

---

## Requirements

### Platform Hub Access Logic

**Access Determination**:
- ✅ Check **BOTH** central database (`App\Models\Practitioner`, `App\Models\Patient`) AND tenant-level tables (`tenant_practitioners`, `tenant_patients`)
- ✅ If user has practitioner record in ANY tenant → Show practitioner dashboard
- ✅ If user has patient record in ANY tenant → Show patient dashboard
- ✅ If user has BOTH → Show both dashboards with merged sidebar
- ✅ If user has NEITHER → Don't show platform hub option at all

**Data Aggregation** (Already Implemented):
- Practitioner dashboard: Aggregate data from ALL tenants where user is practitioner
- Patient dashboard: Aggregate data from ALL tenants where user is patient
- Controllers already implement this: `CentralPractitionerDashboardController`, `CentralPatientDashboardController`

### Sidebar Behavior

**Single Identity** (Practitioner OR Patient only):
- Show sidebar options for that identity only
- Standard sidebar from `ROLE_BASED_SIDEBAR['Practitioner_Central_Dashboard']` or `Patient_Central_Dashboard`

**Multi-Identity** (Practitioner AND Patient):
- Merge sidebar options from both dashboards
- Common items (like "Appointments") → Conditionally rename:
  - "Appointments" → "Practitioner Appointments" and "Patient Appointments"
  - Or show both as separate items with different hrefs
- Data changes based on which dashboard is active

### Platform Hub Visibility

**Show Platform Hub Option If**:
- User has practitioner record (central OR any tenant) OR
- User has patient record (central OR any tenant)

**Hide Platform Hub Option If**:
- User has NO practitioner records AND NO patient records
- User only has admin/staff roles (no table records)

---

## Implementation Plan

### Phase 1: Fix EnsureOnboardingComplete Middleware

**File**: `app/Http/Middleware/EnsureOnboardingComplete.php`

**Problem**: Middleware tries to access tenant-specific `OrganizationSetting` on central domain

**Solution**: Skip onboarding check on central domains

**Change**:
```php
public function handle(Request $request, Closure $next): Response
{
    // Skip middleware for onboarding routes to avoid redirect loops
    if ($request->routeIs('onboarding.*')) {
        return $next($request);
    }

    // Skip middleware for API routes
    if ($request->is('api/*')) {
        return $next($request);
    }

    // Skip onboarding check on central domains (onboarding is tenant-specific only)
    $isCentralDomain = in_array($request->getHost(), config('tenancy.central_domains', []));
    if ($isCentralDomain) {
        return $next($request);
    }

    // Check if onboarding is complete (only in tenant context)
    $isOnboardingComplete = OrganizationSetting::getValue('isOnboardingComplete', 'false');
    
    // If onboarding is not complete and accessing dashboard, redirect to onboarding
    if ($isOnboardingComplete !== 'true' && $request->routeIs('dashboard')) {
        return redirect()->route('onboarding.index');
    }

    return $next($request);
}
```

**Impact**: Prevents `TenantCouldNotBeIdentifiedOnDomainException` when accessing central routes

---

### Phase 2: Create Helper Function for Record Checks

**File**: `app/helpers.php`

**Purpose**: Create reusable helper functions to check practitioner/patient records across central + tenant-level

**Implementation**:
```php
if (! function_exists('userHasPractitionerRecord')) {
    /**
     * Check if user has practitioner record in central OR any tenant
     */
    function userHasPractitionerRecord($user): bool
    {
        if (! $user) {
            return false;
        }

        return tenancy()->central(function () use ($user) {
            // Check central practitioner table
            $centralPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();
            if ($centralPractitioner) {
                return true;
            }

            // Check tenant-level practitioner tables
            $practitioner = \App\Models\Practitioner::where('user_id', $user->id)->first();
            if ($practitioner) {
                $tenantIds = \Illuminate\Support\Facades\DB::table('tenant_practitioners')
                    ->where('practitioner_id', $practitioner->id)
                    ->pluck('tenant_id');
                return $tenantIds->isNotEmpty();
            }

            return false;
        });
    }
}

if (! function_exists('userHasPatientRecord')) {
    /**
     * Check if user has patient record in central OR any tenant
     */
    function userHasPatientRecord($user): bool
    {
        if (! $user) {
            return false;
        }

        return tenancy()->central(function () use ($user) {
            // Check central patient table
            $centralPatient = \App\Models\Patient::where('user_id', $user->id)->exists();
            if ($centralPatient) {
                return true;
            }

            // Check tenant-level patient tables
            $patient = \App\Models\Patient::where('user_id', $user->id)->first();
            if ($patient) {
                $tenantIds = \Illuminate\Support\Facades\DB::table('tenant_patients')
                    ->where('patient_id', $patient->id)
                    ->pluck('tenant_id');
                return $tenantIds->isNotEmpty();
            }

            return false;
        });
    }
}
```

**Impact**: Reusable functions for checking records across central + tenant-level

---

### Phase 3: Update Central Dashboard Route Logic

**File**: `routes/web.php` (lines 281-317)

**Current Logic**:
- Checks practitioner → Auto-redirects to practitioner dashboard
- Checks patient → Auto-redirects to patient dashboard
- Then checks admin/tenants

**New Logic**:
- Check practitioner/patient records using helper functions
- If practitioner only → Redirect to practitioner dashboard
- If patient only → Redirect to patient dashboard
- If both → Redirect to practitioner dashboard (default, user can switch)
- If neither → Continue to tenant selection/admin dashboard logic

**Implementation**:
```php
Route::get('dashboard', function () {
    $user = Auth::user();

    // Check practitioner/patient records (central + tenant-level)
    $hasPractitionerRecord = userHasPractitionerRecord($user);
    $hasPatientRecord = userHasPatientRecord($user);

    // Redirect based on table records (not roles)
    if ($hasPractitionerRecord && $hasPatientRecord) {
        // Both records → Default to practitioner dashboard
        return redirect()->route('central.practitioner-dashboard');
    } elseif ($hasPractitionerRecord) {
        return redirect()->route('central.practitioner-dashboard');
    } elseif ($hasPatientRecord) {
        return redirect()->route('central.patient-dashboard');
    }

    // No practitioner/patient records → Continue to admin/tenant logic
    // Admin/Staff users: Check tenant relationships
    // - Multiple tenants: show tenant selection (they can switch between clinics)
    // - One tenant: redirect to that tenant
    // - No tenants: central-only admin, show central dashboard
    $tenants = $user->tenants()->with('domains')->get();

    if ($tenants->count() > 1) {
        // Multiple tenants - show tenant selection
        return redirect()->route('tenant.selection');
    }

    if ($tenants->count() === 1) {
        // Single tenant - redirect to that tenant
        $tenant = $tenants->first();
        $tenantSessionService = app(\App\Services\TenantSessionService::class);
        $url = $tenantSessionService->switchToTenant($user, $tenant);

        return Inertia::location($url);
    }

    // No tenants - central-only admin
    return redirect()->route('central.dashboard');
})->name('dashboard');
```

**Impact**: Platform hub access based on table records, not roles

---

### Phase 4: Update CentralGuestAccess Middleware

**File**: `app/Http/Middleware/CentralGuestAccess.php` (lines 34-44)

**Current Logic**:
- Checks practitioner → Auto-redirects to practitioner dashboard
- Checks patient → Auto-redirects to patient dashboard
- Then checks admin/tenants

**New Logic**:
- Don't auto-redirect based on records
- Allow users to access any central route they qualify for
- Only redirect if they're accessing a route they shouldn't

**Change**: Remove auto-redirect logic, allow multi-context access

**Implementation**:
```php
public function handle(Request $request, Closure $next): Response
{
    // Only apply this middleware on central domains
    if (! in_array($request->getHost(), config('tenancy.central_domains', []))) {
        return $next($request);
    }

    // Allow access to change-plan routes for both authenticated and guest users
    if ($request->routeIs('change-plan.*')) {
        return $next($request);
    }

    // Check if user is authenticated
    if (Auth::check()) {
        $user = Auth::user();

        // Don't auto-redirect practitioner/patient users
        // Allow them to access any central route they qualify for
        // Access control is handled by individual route controllers

        // Admin/Staff users: Check tenant relationships
        $tenants = $user->tenants()->with('domains')->get();

        if ($tenants->isEmpty()) {
            // Central-only admin user - can access central dashboard
            // Don't redirect, let them access the route they requested
            return $next($request);
        }

        // User has tenant access - but don't auto-redirect
        // Let them access central routes if they have practitioner/patient records
        // Otherwise, redirect to tenant if accessing root routes
        if ($tenants->count() === 1 && $request->is('/')) {
            // Only redirect root path to tenant
            $tenant = $tenants->first();

            if ($tenant->requiresBilling()) {
                return redirect()->route('billing.setup')
                    ->with('warning', 'Please complete your subscription setup to access your workspace.');
            }

            return app(\App\Http\Controllers\Auth\AuthenticatedSessionController::class)
                ->redirectToTenant($tenant, $user);
        }

        // Multiple tenants or accessing specific routes - allow access
        return $next($request);
    }

    return $next($request);
}
```

**Impact**: Removes auto-redirect, allows multi-context access

---

### Phase 5: Update Central Dashboard Route Access Control

**File**: `routes/web.php` (lines 322-323, 325-330)

**Practitioner Dashboard Route**:
- Current: No access check (assumes redirect handled it)
- New: Check if user has practitioner record (central OR any tenant)
- Allow access if record exists

**Patient Dashboard Route**:
- Current: Checks patient record, aborts if not found
- New: Check if user has patient record (central OR any tenant)
- Allow access if record exists

**Implementation**:
```php
Route::get('/central/practitioner-dashboard', function (Request $request) {
    $user = Auth::user();
    
    // Check if user has practitioner record (central OR any tenant)
    $hasPractitionerRecord = userHasPractitionerRecord($user);
    
    if (! $hasPractitionerRecord) {
        abort(403, 'Access denied. You are not registered as a practitioner.');
    }
    
    return app(CentralPractitionerDashboardController::class)->index($request);
})->name('central.practitioner-dashboard');

Route::get('/central/patient-dashboard', function (Request $request) {
    $user = Auth::user();
    
    // Check if user has patient record (central OR any tenant)
    $hasPatientRecord = userHasPatientRecord($user);
    
    if (! $hasPatientRecord) {
        abort(403, 'Access denied. You are not registered as a patient.');
    }
    
    // Get user's tenants for the dropdown
    $userTenants = userTenants($user);
    
    // ... rest of existing logic
})->name('central.patient-dashboard');
```

**Impact**: Access control based on table records, not roles

---

### Phase 6: Update Frontend Sidebar for Multi-Identity

**File**: `resources/js/components/app-sidebar.tsx`

**Central Context Logic** (lines 251-261):
- Current: Shows one dashboard type based on priority
- New: If user has BOTH practitioner AND patient records → Merge sidebar options

**Implementation**:
```typescript
if (isCentral) {
    // Central context - check for both practitioner and patient records
    const hasPractitioner = auth?.user?.is_practitioner || false;
    const hasPatient = auth?.user?.is_patient || false;
    
    if (hasPractitioner && hasPatient) {
        // Multi-identity: Merge both dashboards
        const practitionerItems = ROLE_BASED_SIDEBAR['Practitioner_Central_Dashboard'] || [];
        const patientItems = ROLE_BASED_SIDEBAR['Patient_Central_Dashboard'] || [];
        
        // Merge items, rename duplicates
        const mergedItems = new Map();
        
        // Add practitioner items first
        practitionerItems.forEach(item => {
            const key = item.href;
            mergedItems.set(key, {
                ...item,
                title: `Practitioner ${item.title}`
            });
        });
        
        // Add patient items, rename if duplicate
        patientItems.forEach(item => {
            const key = item.href;
            if (mergedItems.has(key)) {
                // Duplicate href - create separate entry with different title
                const existingItem = mergedItems.get(key);
                mergedItems.set(`${key}_patient`, {
                    ...item,
                    title: `Patient ${item.title}`
                });
            } else {
                mergedItems.set(key, {
                    ...item,
                    title: `Patient ${item.title}`
                });
            }
        });
        
        allNavItems = Array.from(mergedItems.values());
    } else if (hasPatient) {
        sidebarKey = 'Patient_Central_Dashboard';
        allNavItems = ROLE_BASED_SIDEBAR[sidebarKey as keyof typeof ROLE_BASED_SIDEBAR] || [];
    } else if (hasPractitioner) {
        sidebarKey = 'Practitioner_Central_Dashboard';
        allNavItems = ROLE_BASED_SIDEBAR[sidebarKey as keyof typeof ROLE_BASED_SIDEBAR] || [];
    } else {
        sidebarKey = 'Admin_Central_Dashboard';
        allNavItems = ROLE_BASED_SIDEBAR[sidebarKey as keyof typeof ROLE_BASED_SIDEBAR] || [];
    }
}
```

**Impact**: Multi-identity users see merged sidebar with renamed duplicates

---

### Phase 7: Update Platform Hub Visibility Logic

**File**: `resources/js/components/app-sidebar-header.tsx` (or wherever platform hub link is shown)

**Logic**: Show platform hub option only if user has practitioner/patient records

**Current**: May check roles or have inconsistent logic

**New**: Check `auth?.user?.is_practitioner || auth?.user?.is_patient`

**Note**: The backend flags (`is_practitioner`, `is_patient`) already check both central + tenant records, so frontend just needs to use these flags

**Impact**: Platform hub option visibility based on table records only

---

### Phase 8: Update Switch-to-Central Route

**File**: `routes/tenant.php` (line 314-320)

**Current**: Always redirects to `/dashboard`

**New**: 
- Check user's practitioner/patient records (central + tenant-level)
- Redirect to appropriate dashboard:
  - Both records → Practitioner dashboard (default)
  - Practitioner only → Practitioner dashboard
  - Patient only → Patient dashboard
  - Neither → `/dashboard` (will show tenant selection/admin dashboard)

**Implementation**:
```php
Route::get('/switch-to-central', function () {
    $user = Auth::user();
    
    // Check practitioner/patient records (central + tenant-level)
    $hasPractitionerRecord = userHasPractitionerRecord($user);
    $hasPatientRecord = userHasPatientRecord($user);
    
    $protocol = app()->environment('production') ? 'https' : 'http';
    $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
    $centralUrl = "{$protocol}://{$centralDomain}".($protocol === 'http' ? ':8000' : '');
    
    // Redirect based on table records
    if ($hasPractitionerRecord && $hasPatientRecord) {
        // Both records → Default to practitioner dashboard
        return Inertia::location($centralUrl.'/central/practitioner-dashboard');
    } elseif ($hasPractitionerRecord) {
        return Inertia::location($centralUrl.'/central/practitioner-dashboard');
    } elseif ($hasPatientRecord) {
        return Inertia::location($centralUrl.'/central/patient-dashboard');
    }
    
    // No records → Redirect to dashboard (will show tenant selection/admin dashboard)
    return Inertia::location($centralUrl.'/dashboard');
})->name('tenant.switch-to-central');
```

**Impact**: Smart redirect based on table records

---

## Testing Scenarios

### Test Case 1: Admin Only (No Records)

**Setup**:
- User has Admin role
- No practitioner/patient records (central or tenant-level)

**Expected Results**:
- [ ] Platform hub option: **HIDDEN**
- [ ] Switching to central: Redirects to `/dashboard` → Shows tenant selection or admin dashboard
- [ ] No errors

### Test Case 2: Practitioner Only (Central + Tenant)

**Setup**:
- User has practitioner record in central DB
- User has practitioner record in Tenant A
- No patient records

**Expected Results**:
- [ ] Platform hub option: **VISIBLE**
- [ ] Switching to central: Redirects to practitioner dashboard
- [ ] Practitioner dashboard shows data from all tenants where user is practitioner
- [ ] Sidebar shows practitioner options only
- [ ] No errors

### Test Case 3: Patient Only (Tenant Only)

**Setup**:
- User has patient record in Tenant B only
- No practitioner records
- No central patient record

**Expected Results**:
- [ ] Platform hub option: **VISIBLE**
- [ ] Switching to central: Redirects to patient dashboard
- [ ] Patient dashboard shows data from Tenant B
- [ ] Sidebar shows patient options only
- [ ] No errors

### Test Case 4: Practitioner + Patient (Multi-Identity)

**Setup**:
- User has practitioner record in Tenant A
- User has patient record in Tenant B
- User has Admin role

**Expected Results**:
- [ ] Platform hub option: **VISIBLE**
- [ ] Switching to central: Redirects to practitioner dashboard (default)
- [ ] Can navigate to both practitioner and patient dashboards
- [ ] Sidebar shows merged options with renamed duplicates:
  - "Practitioner Appointments" and "Patient Appointments"
  - "Practitioner Calendar" and "Patient Calendar"
  - etc.
- [ ] No errors

### Test Case 5: Admin + Practitioner + Patient

**Setup**:
- User has Admin role
- User has practitioner record in Tenant A
- User has patient record in Tenant B

**Expected Results**:
- [ ] Platform hub option: **VISIBLE**
- [ ] Can access both practitioner and patient dashboards
- [ ] Sidebar shows merged options
- [ ] Admin role doesn't affect platform hub access
- [ ] No errors

### Test Case 6: Tenant Switching to Central

**Setup**:
- User in Tenant A (Admin role)
- User has practitioner record in Tenant B

**Test Steps**:
1. Click "Switch to Platform Hub" from tenant dashboard
2. Should redirect to central practitioner dashboard

**Expected Results**:
- [ ] No `TenantCouldNotBeIdentifiedOnDomainException` error
- [ ] Redirects to practitioner dashboard
- [ ] Shows practitioner data from Tenant B
- [ ] No errors

---

## Files to Change

### Backend Files

1. **`app/Http/Middleware/EnsureOnboardingComplete.php`**
   - Add central domain check to skip onboarding validation

2. **`app/helpers.php`**
   - Add `userHasPractitionerRecord()` helper function
   - Add `userHasPatientRecord()` helper function

3. **`routes/web.php`**
   - Update `/dashboard` route logic (lines 281-317)
   - Update `/central/practitioner-dashboard` route access check (line 322)
   - Update `/central/patient-dashboard` route access check (line 325)

4. **`app/Http/Middleware/CentralGuestAccess.php`**
   - Remove auto-redirect logic for practitioner/patient users
   - Allow multi-context access

5. **`routes/tenant.php`**
   - Update `/switch-to-central` route redirect logic (line 314)

### Frontend Files

6. **`resources/js/components/app-sidebar.tsx`**
   - Update central context logic to merge sidebar for multi-identity users (lines 251-261)
   - Add logic to rename duplicate sidebar items

7. **`resources/js/components/app-sidebar-header.tsx`** (if platform hub link exists here)
   - Update platform hub visibility logic to use table record flags

---

## Summary

### Current State
- ❌ `EnsureOnboardingComplete` middleware causes exception on central domain
- ❌ Platform hub access mixed between roles and table records
- ❌ Auto-redirect prevents multi-context access
- ❌ Admin users with practitioner/patient records may not see platform hub

### Target State
- ✅ Onboarding check skipped on central domains
- ✅ Platform hub access based ONLY on table records (central + tenant-level)
- ✅ Multi-context access allowed (no auto-redirect)
- ✅ Multi-identity users see merged sidebar with renamed duplicates
- ✅ Platform hub option visible only if user has practitioner/patient records

### Key Benefits
- ✅ **No Exceptions**: Onboarding middleware doesn't break tenant switching
- ✅ **Table Records as Truth**: Platform hub access based on database records
- ✅ **Multi-Context Access**: Users can access both dashboards if they qualify
- ✅ **Multi-Identity Support**: Users with both records see merged interface
- ✅ **Consistent Logic**: Same table-record-based approach across system

### Implementation
- **Primary Changes**: Backend routes and middleware
- **Frontend Changes**: Sidebar merging logic
- **Risk Level**: Medium (affects core routing logic)
- **Testing**: Comprehensive test cases provided above

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Author**: System Analysis

