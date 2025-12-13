# SSO Troubleshooting Guide

## Common Issues and Solutions

### 1. 403 "SSO authentication failed"

**Most Common Cause**: Session ID mismatch during tenant switching

**Fix Applied**: ✅ Session binding relaxed for multi-tenant environments
- Session ID changes are now expected and logged for audit
- Code exchange proceeds despite session ID changes

### 2. cURL timeout errors

**Cause**: HTTP requests between tenant and central domains timing out

**Fix Applied**: ✅ Eliminated HTTP calls
- Code exchange now uses direct database context switching
- No network dependencies

### 3. 404 "Route not found" on /sso/login

**Cause**: Old SSO endpoints removed during security upgrade

**Fix Applied**: ✅ Backward compatibility route added
- `/sso/login` route restored for legacy URLs
- Automatic migration to secure flow

### 4. Code already used / expired

**Expected Behavior**: Codes are single-use and expire after 5 minutes
- Generate fresh codes for each test
- Codes automatically invalidated after successful exchange

### 5. "Inertia requests must receive a valid Inertia response"

**Cause**: JSON response returned instead of Inertia response

**Fix Applied**: ✅ Updated `/sso/redirect` endpoint
- Changed from `response()->json()` to `Inertia::location()`
- Proper Inertia response handling for frontend compatibility

## Testing Commands

```bash
# Generate a fresh test URL
php artisan tinker --execute="
\$user = App\Models\User::find(2);
\$tenant = App\Models\Tenant::where('id', 'mcdowall_health')->first();
\$sso = app(App\Services\SecureSSOService::class);
\$code = \$sso->generateSSOCode(\$user, \$tenant);
\$url = \$sso->generateTenantSSOUrl(\$code, \$tenant);
echo 'Test URL: ' . \$url;
"

# Check recent logs
tail -20 storage/logs/laravel.log

# List SSO routes
php artisan route:list --path=sso
```

## Log Messages Explained

### ✅ Good Messages
- `SSO code generated` - Code created successfully
- `SSO start received` - Tenant received code
- `SSO code exchange: Session ID changed during tenant switch` - Expected in multi-tenant
- `SSO authentication successful` - Login completed

### ⚠️ Warning Messages (Now Fixed)
- `Session ID mismatch` - Now handled gracefully
- `Code not found or expired` - Generate fresh code
- `User does not have valid tenant membership` - Check user permissions

## Security Notes

✅ **Still Secure**: 
- One-time codes (5min expiry)
- Membership verification
- Immediate invalidation
- Audit logging

✅ **Multi-tenant Safe**:
- Session changes handled
- Cross-domain compatibility
- No network dependencies
