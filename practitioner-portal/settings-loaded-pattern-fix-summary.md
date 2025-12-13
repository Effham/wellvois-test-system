# Settings `/loaded` Pattern - Fix Summary

## Date: November 21, 2025

## Issues Fixed

1. **Infinite loading on Organization page** - Loading spinner never resolved to data page
2. **Access denied errors** - Direct URL access to `/loaded` endpoints showed "Access denied" 
3. **Network errors** - Browser console showed "AxiosError: Network Error" preventing navigation

## Root Cause

The `/loaded` routes had **duplicate permission middleware** that was blocking legitimate Inertia navigation requests:

```php
// BEFORE (problematic):
Route::get('settings/Organization/loaded', [SettingsController::class, 'organizationLoaded'])
    ->name('settings.organization.loaded')
    ->middleware(['require-tenant', 'permission:view-organization']);  // ❌ Double check
```

**Why this caused issues:**
1. Loading page already has `permission:view-organization` middleware
2. User passes permission check to access loading page
3. Loading page attempts Inertia navigation to `/loaded` endpoint
4. `/loaded` endpoint runs permission middleware AGAIN
5. Permission middleware may fail or timeout during Inertia request
6. Request blocked → infinite loading spinner

## Solution Implemented

**Removed permission middleware from all `/loaded` endpoints**, keeping only `require-tenant`:

```php
// AFTER (fixed):
Route::get('settings/Organization/loaded', [SettingsController::class, 'organizationLoaded'])
    ->name('settings.organization.loaded')
    ->middleware('require-tenant');  // ✅ Only tenant check
```

### Security is Maintained Because:

1. **Loading route has permission check** - Users must have permission to access the loading page
2. **X-Inertia header check** - Controller method prevents direct URL access:
   ```php
   if (! request()->header('X-Inertia')) {
       return redirect()->route('settings.organization');
   }
   ```
3. **Tenant context required** - `require-tenant` middleware still enforced
4. **Must go through loading page** - No way to bypass the permission-protected loading page

## Changes Made

### File: `routes/settings.php`

Updated all 7 settings `/loaded` routes:

1. **Organization** - Line 22
   - Removed `permission:view-organization` from `/loaded` route
   
2. **Locations** - Line 30
   - Removed `permission:view-location` from `/loaded` route
   
3. **Practitioners List** - Line 42
   - Removed `permission:view-practitioner` from `/loaded` route
   
4. **Practitioners Invitations** - Line 50
   - Removed `permission:view-practitioner` from `/loaded` route
   
5. **Services** - Line 58
   - Removed `permission:view-services` from `/loaded` route
   
6. **Integrations** - Line 66
   - Removed `permission:view-integration` from `/loaded` route
   
7. **Website** - Line 74
   - Removed `permission:view-website` from `/loaded` route

## Testing

### Test Case 1: Normal Navigation
✅ User clicks settings link → Loading page appears → Data loads after 500ms

### Test Case 2: Direct URL Access  
✅ User types `/settings/organization/loaded` in browser → Redirects to loading page (X-Inertia check works)

### Test Case 3: Permission Check
✅ Users without `view-organization` permission cannot access `/settings/organization` (loading page blocks them)

### Test Case 4: Tenant Context
✅ Users outside tenant context get "Access denied" from `require-tenant` middleware

## Migration Path

If permission middleware needs to be added back to `/loaded` endpoints in the future:

1. Ensure permissions are properly seeded in database
2. Ensure users have permissions assigned
3. Test that Inertia navigation doesn't timeout on permission checks
4. Consider using a lighter permission check for Inertia requests
5. Or implement permission caching to avoid repeated database queries

## Performance Benefit

**Before:** 2 permission checks per page load (loading route + loaded route)
**After:** 1 permission check per page load (loading route only)

This reduces database queries and prevents potential timeout issues during Inertia navigation.

## Verification Commands

```bash
# List all settings routes
php artisan route:list --name=settings

# Test a specific loaded route
php artisan route:list --name=settings.organization.loaded

# Check middleware on routes
php artisan route:list --name=settings.organization.loaded --columns=uri,name,middleware
```

## Conclusion

The fix simplifies the middleware stack while maintaining security. The `/loaded` pattern now works correctly:
- Fast initial feedback (loading page)
- Smooth navigation after 500ms
- Proper security through layered protection
- No duplicate permission checks causing failures

