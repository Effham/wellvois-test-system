---
name: Auto-logout on 403 unauthorized errors
overview: When a user receives a 403 unauthorized error (especially from CanAccessTenant middleware), automatically log them out and redirect to the login page instead of showing the error page. This prevents the need for double logout and provides immediate feedback when access is denied.
todos: []
---

# Auto-Logout on 403 Unauthorized Errors

## Problem

When a user gets a 403 unauthorized error (e.g., from `CanAccessTenant` middleware), Laravel shows the 403 error page but the user remains authenticated. The user then needs to logout twice to get back to the login screen:

1. First logout attempt shows "unauthorized" but doesn't logout
2. Second logout finally logs them out

## Root Cause

1. `CanAccessTenant` middleware calls `abort(403, ...)` when user doesn't have access to tenant
2. Laravel throws `HttpException` with 403 status code
3. Laravel shows default 403 error page
4. User session remains valid (user is still authenticated)
5. User must manually logout, which may require multiple attempts

## Solution

Add an exception handler in `bootstrap/app.php` that:

1. Catches `HttpException` with 403 status code
2. Checks if user is authenticated
3. If authenticated, automatically performs global logout
4. Redirects to appropriate login page (central or tenant)
5. Handles both Inertia and regular requests

## Implementation Details

### File: `bootstrap/app.php`

Add exception handler in `withExceptions()` closure:

- Catch `Symfony\Component\HttpKernel\Exception\HttpException` with status code 403
- Check if user is authenticated (`Auth::check()`)
- If authenticated:
- Call `GlobalLogoutService::performGlobalLogout()`
- Get redirect URL using `GlobalLogoutService::getLogoutRedirectUrl()`
- Redirect to login page
- Handle Inertia requests specially (use Inertia redirect)
- Log the unauthorized access attempt

### Special Cases to Handle

1. **CanAccessTenant 403**: User doesn't have access to tenant → logout and redirect to central login
2. **Permission-based 403**: User lacks permission → logout and redirect to login
3. **Inertia requests**: Use Inertia redirect instead of regular redirect
4. **Already logged out**: If user is not authenticated, just show 403 error page

## Files to Modify

1. `bootstrap/app.php`

- Add exception handler for 403 HttpException
- Import necessary classes (HttpException, GlobalLogoutService, Auth)

## Testing

- User accessing tenant they don't have access to → automatically logged out and redirected to login
- User with insufficient permissions → automatically logged out and redirected to login
- User already logged out → shows normal 403 error page
- Inertia requests → properly redirected using Inertia
- Regular requests → properly redirected using standard redirect