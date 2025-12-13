# 500 Error on Page Reload - Fix Documentation

## Problem Summary

After implementing persistent layouts with Inertia.js v2, certain pages were throwing **500 browser errors** when reloaded on the live server, but not locally. This is NOT a Laravel application error, but a middleware failure that prevents the HTML response from being generated.

## Root Cause

The issue occurred in the `HandleInertiaRequests::share()` method, which runs on **every request** (both initial page loads and Inertia navigations). The method contains multiple database queries and complex operations that could fail in production:

### Critical Issues Found:

1. **No Error Handling**: Multiple database queries without try-catch blocks
2. **Production Environment Differences**: 
   - Database connection timeouts (more restrictive in production)
   - Network latency to database servers
   - Resource limits (memory, CPU, concurrent connections)
   - Cache behavior differences
3. **Heavy Operations in Shared Data**:
   - Multiple `tenancy()->central()` calls (cross-database queries)
   - Nested closures with database operations
   - `OrganizationSetting::getByPrefix()` queries
   - Complex tenant relationships loading

### Why It Only Happened on Reload

When you navigate using Inertia links:
- Only JSON data is fetched
- Partial page updates
- Less likely to hit timeout/failure scenarios

When you reload the page:
- Full HTML page must be generated
- All shared data must be computed
- All database queries execute sequentially
- **Any failure in `share()` causes entire request to fail with 500 error**

## The Fix

### 1. Comprehensive Error Handling

Wrapped all database operations and complex queries in try-catch blocks with proper logging:

```php
try {
    // Database query
} catch (\Exception $e) {
    \Log::error('Operation failed', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
    ]);
    
    // Return safe defaults
    return defaultValue;
}
```

### 2. Refactored Complex Logic

Extracted nested database queries into separate protected methods:

**Before:**
```php
'auth' => [
    'user' => $request->user() 
        ? array_merge(/* 100+ lines of nested queries */)
        : null
]
```

**After:**
```php
'auth' => [
    'user' => $request->user()
        ? $this->getUserAuthData($request, $isCentral)
        : null
]
```

### 3. Protected Helper Methods

Created dedicated methods with individual error handling:

- `getUserAuthData()` - Gets user authentication data with fallback
- `getUserPermissions()` - Loads permissions with error handling
- `checkIsPractitioner()` - Checks practitioner status safely
- `checkIsPatient()` - Checks patient status safely
- `checkIsOnboarding()` - Checks onboarding status safely
- `getUserTenants()` - Loads tenant relationships with fallback
- `determineUserRole()` - Determines user role with error handling

Each method:
- Has its own try-catch block
- Logs errors with context
- Returns safe default values on failure
- Prevents cascading failures

### 4. Safe Defaults Strategy

When operations fail, the middleware now returns sensible defaults instead of crashing:

```php
// If getUserAuthData fails entirely
return [
    'roles' => [],
    'permissions' => [],
    'is_practitioner' => false,
    'is_patient' => false,
    'tenants' => null,
    // ... other safe defaults
];
```

## Benefits of This Approach

### 1. Resilience
- Application stays functional even if some data fails to load
- Users see the page with reduced data rather than 500 error
- Critical user info (id, name, email) still loads

### 2. Debugging
- Detailed logs for each failure point
- Easy to identify which specific query is failing
- Context included (user_id, tenant_id, error traces)

### 3. Production Stability
- Handles database timeouts gracefully
- Survives temporary database connection issues
- Continues to work during high load scenarios

### 4. Maintainability
- Clear separation of concerns
- Each operation isolated and testable
- Easy to add more error handling as needed

## How to Monitor

### Check Laravel Logs

On your production server, monitor logs for these new error messages:

```bash
# Check for middleware errors
tail -f storage/logs/laravel.log | grep "HandleInertiaRequests"

# Check for specific failures
grep "Failed to load user auth data" storage/logs/laravel.log
grep "Failed to load organization settings" storage/logs/laravel.log
grep "Failed to check is_practitioner" storage/logs/laravel.log
```

### Common Issues to Look For

1. **Database Connection Timeouts**
   ```
   Failed to load user tenants: SQLSTATE[HY000]: General error: 2006 MySQL server has gone away
   ```

2. **Missing Relationships**
   ```
   Failed to get patient invitation status: Call to a member function on null
   ```

3. **Permission Issues**
   ```
   Failed to load user permissions: Connection refused
   ```

## Testing the Fix

### 1. Local Testing
```bash
# Clear cache
php artisan cache:clear
php artisan config:clear

# Test page reload on all major pages
# - Dashboard
# - Patients list
# - Calendar
# - Settings
```

### 2. Production Testing
1. Deploy the updated `HandleInertiaRequests.php`
2. Test page reload on pages that previously failed
3. Monitor logs for any new error messages
4. Verify that pages load (even if with reduced data)

### 3. Load Testing
- Test during high-traffic periods
- Simulate slow database connections
- Test with multiple concurrent users

## What Changed in the Code

### File Modified
- `app/Http/Middleware/HandleInertiaRequests.php`

### Changes Made
1. Added error handling to `share()` method
2. Wrapped inspiring quotes in try-catch
3. Added error handling for tenant name loading
4. Extracted user auth data into `getUserAuthData()` method
5. Created 7 new protected helper methods with error handling
6. Added safe defaults for organization settings
7. Added comprehensive logging throughout

### Backwards Compatibility
✅ **Fully backwards compatible** - all existing functionality preserved
✅ **No breaking changes** - same data structure returned
✅ **Enhanced reliability** - gracefully handles failures

## Why This Is Better Than Before

### Before
❌ Single failure crashes entire page
❌ No visibility into what failed
❌ Users see unhelpful 500 error
❌ Hard to debug production issues
❌ Fragile in production environment

### After
✅ Isolated failures don't crash page
✅ Detailed logs for each failure
✅ Users see page with partial data
✅ Easy to debug specific issues
✅ Resilient in production environment

## Next Steps

### Immediate
1. ✅ Deploy to production
2. Monitor logs for 24-48 hours
3. Verify 500 errors are resolved

### Short Term
- Review logs to identify common failures
- Optimize slow database queries identified
- Consider caching frequently accessed data

### Long Term
- Add database query performance monitoring
- Implement Redis caching for shared data
- Consider moving heavy queries to background jobs

## Additional Notes

### About Inertia Persistent Layouts

Persistent layouts make the `share()` method even more critical because:
- It runs on every navigation (not just full page loads)
- Layout components depend on this shared data
- Failures are more visible to users
- Performance impact is multiplied

### Production vs Local Differences

Common reasons production fails but local works:
- **Database**: Production has connection limits, local doesn't
- **Network**: Production has latency, local is instant
- **Resources**: Production is shared, local is dedicated
- **Data**: Production has more records, local has test data
- **Load**: Production has concurrent users, local doesn't

## Support

If you continue to see 500 errors after this fix:

1. Check Laravel logs: `storage/logs/laravel.log`
2. Look for "HandleInertiaRequests" in logs
3. Check web server error logs (nginx/apache)
4. Verify database connectivity
5. Check server resources (memory, CPU)

The detailed logging will now show exactly which operation is failing, making it much easier to diagnose and fix any remaining issues.

