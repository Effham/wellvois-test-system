# Secure SSO Implementation for Multi-Tenant EMR System

## Overview

This implementation replaces the previous URL-based authentication system with a secure, compliant SSO flow using one-time codes and server-to-server verification.

## Security Features Implemented

### ✅ 1. Replace URL params with one-time code
- **Before**: `https://tenant.example.com/sso/login?email=user@example.com&token=xyz&expires=123`
- **After**: `https://tenant.example.com/sso/start?code=<opaque_64_char_code>`
- No sensitive data exposed in URLs

### ✅ 2. Server-side code generation (Central App)
- Codes generated in `SecureSSOService::generateSSOCode()`
- Stored in cache with structure: `{ code, user_id, tenant_id, issued_at, ttl, redirect_internal, session_id }`
- TTL: 5 minutes (300 seconds)
- Uses cryptographically secure random code generation

### ✅ 3. Code redemption via POST (Tenant → Central)
- Tenant makes POST `/sso/exchange` to central app
- Central verifies code and immediately invalidates it (single use)
- Back-channel server-to-server communication

### ✅ 4. Explicit membership verification on exchange
- Central checks `user_tenants` table for valid membership
- Additional patient invitation status verification for patients
- Prevents unauthorized tenant access

### ✅ 5. Tenant session creation only after successful exchange
- No session/authentication on initial GET `/sso/start`
- Session created only after successful code exchange verification
- Uses proper Laravel authentication methods

### ✅ 6. Server-side expiry enforcement
- Cache TTL automatically handles expiration
- Additional server-side timestamp verification
- No client-provided expiry accepted

### ✅ 7. Session binding
- Code bound to initiating user session ID
- Verified during exchange to prevent session hijacking
- Optional but recommended security layer

### ✅ 8. Non-side-effecting initial GET
- `/sso/start` only receives code and performs exchange
- No authentication or state changes on GET
- Immediate back-channel POST to central app

## Implementation Details

### Files Modified/Created

1. **`app/Services/SecureSSOService.php`** (NEW)
   - Core SSO security logic
   - Code generation and validation
   - Membership verification
   - Session binding

2. **`routes/web.php`** (MODIFIED)
   - Central app SSO endpoints
   - `/sso/redirect` - Generate code and redirect
   - `/sso/exchange` - Server-to-server code exchange
   - `/sso/switch-tenant/{tenant}` - Secure tenant switching

3. **`routes/tenant.php`** (MODIFIED)
   - Tenant app SSO endpoints
   - `/sso/start` - Receive code and perform exchange
   - `/switch-to-tenant` - Secure tenant-to-tenant switching

### Flow Diagram

```
Central App                     Tenant App
    |                              |
    | 1. User clicks "Switch"      |
    |                              |
    | 2. Generate secure code      |
    |    Store in cache (5min TTL) |
    |                              |
    | 3. Redirect to tenant        |
    |    /sso/start?code=xyz       |
    |                              |
    |                              | 4. Receive code
    |                              |
    |                              | 5. POST /sso/exchange
    | 6. Verify code & membership  |    {code, tenant_id}
    |    Invalidate code           |
    |                              |
    | 7. Return user data          |
    |    {user_id, email, etc}     |
    |                              |
    |                              | 8. Create tenant session
    |                              | 9. Redirect to app
```

### Security Considerations

1. **Code Uniqueness**: 64-character cryptographically secure random codes
2. **Single Use**: Codes immediately invalidated after exchange
3. **Short TTL**: 5-minute expiration window
4. **Session Binding**: Optional but recommended session ID verification
5. **Explicit Membership**: Server-side tenant access verification
6. **No Sensitive Data in URLs**: Only opaque codes in query strings
7. **Server-to-Server**: Back-channel verification prevents tampering

### Configuration

The implementation uses existing Laravel caching and session infrastructure:

- **Cache**: Uses default Laravel cache for code storage
- **TTL**: 5 minutes (configurable via `SecureSSOService::CODE_TTL_MINUTES`)
- **Sessions**: Standard Laravel session handling
- **HTTP Client**: Laravel's HTTP client for server-to-server calls

### Testing

To verify the implementation:

1. **Central to Tenant**: User switches from central app to tenant
2. **Tenant to Tenant**: User switches between tenants
3. **Code Expiry**: Verify codes expire after 5 minutes
4. **Invalid Codes**: Verify invalid/expired codes are rejected
5. **Membership**: Verify users can only access authorized tenants

### Backward Compatibility

This implementation replaces the previous SSO system entirely. Frontend applications may need updates to handle the new JSON response format from `/sso/redirect`.

### Compliance Notes

This implementation addresses common security requirements for:
- Healthcare applications (HIPAA)
- Multi-tenant SaaS platforms
- Enterprise SSO requirements
- Security audit requirements

The system now uses industry-standard practices for secure authentication flows.
