# Keycloak Authentication Implementation Plan - App Portal

## Overview
This document outlines the implementation of Keycloak authentication for the App Portal (multi-tenant application). The implementation uses Keycloak's standard OAuth 2.0 Authorization Code flow combined with a secure cross-domain SSO mechanism to authenticate users across tenant domains while maintaining Laravel's built-in authentication system for session management, roles, and permissions.

## Architecture

### Multi-Tenant Context
The App Portal is a multi-tenant application where:
- Each tenant has its own domain (e.g., `tenant-name.localhost:8000`)
- Each tenant has its own database
- Users exist in both central database (for cross-tenant access) and tenant databases (for tenant-specific data)
- Authentication must work seamlessly across domains

### Authentication Flow Overview

```
1. User visits tenant login page (tenant-name.localhost:8000/login)
2. User clicks "Login with WELLOVIS" button
3. Redirect to Keycloak authorization endpoint (with tenant ID encoded in state)
4. User authenticates with Keycloak
5. Keycloak redirects to central domain callback (localhost:8000/auth/keycloak/callback)
6. Backend validates state, exchanges code for tokens
7. Backend performs central → tenant user lookup and tenant access verification
8. Backend generates SSO code for cross-domain authentication
9. Redirect to tenant domain SSO endpoint (tenant-name.localhost:8000/sso/start?code=...)
10. Tenant domain exchanges SSO code and authenticates user
11. User is redirected to tenant dashboard
```

## Detailed Authentication Flow

### Phase 1: Initial Redirect (Tenant Domain → Keycloak)

**Location**: `routes/tenant.php` - `/login/keycloak` route  
**Controller**: `KeycloakController::redirect()`

1. User clicks "Login with WELLOVIS" on tenant login page
2. Request hits `/login/keycloak` route on tenant domain (e.g., `tenant-name.localhost:8000/login/keycloak`)
3. Controller extracts current tenant ID: `$tenantId = tenant('id')`
4. Calls `KeycloakService::getAuthorizationUrl(null, $tenantId)`

**KeycloakService::getAuthorizationUrl()**:
- Generates random 32-character state string
- Encodes tenant ID in state: `base64_encode(json_encode(['state' => $randomState, 'tenant_id' => $tenantId]))`
- Stores random state in **cache** (not session) with key: `keycloak_state_{tenantId}_{randomState}`
  - **Why Cache?**: Sessions are domain-specific. Cache is shared across domains, allowing validation on central domain callback
- Builds redirect URI pointing to **central domain**: `http://localhost:8000/auth/keycloak/callback`
  - **Why Central Domain?**: Keycloak requires a fixed redirect URI. Using central domain avoids wildcard configuration
- Redirects user to Keycloak authorization endpoint

**Security**: State parameter provides CSRF protection. Cache storage ensures state is accessible across domains.

### Phase 2: Keycloak Authentication

1. User is redirected to Keycloak login page
2. User enters credentials (username/password)
3. Keycloak validates credentials
4. Keycloak redirects back to callback URL with:
   - `code`: Authorization code (short-lived, single-use)
   - `state`: The exact same state parameter sent in Phase 1

### Phase 3: Callback Processing (Central Domain)

**Location**: `routes/web.php` - `/auth/keycloak/callback` route  
**Controller**: `KeycloakController::callback()`

#### Step 1: Extract Tenant ID from State

```php
$state = $request->get('state');
$decodedState = json_decode(base64_decode($state), true);
$tenantId = $decodedState['tenant_id'];
```

- Decodes the base64-encoded state parameter
- Extracts tenant ID that was encoded during redirect
- Validates tenant ID exists

#### Step 2: Validate OAuth Response

- Checks for error parameters from Keycloak
- Validates authorization code and state parameter exist
- All errors redirect back to tenant login page (not central domain)

#### Step 3: Exchange Authorization Code for Tokens

**KeycloakService::exchangeCodeForTokens()**:

1. **State Validation**:
   - Decodes received state to extract `randomState` and `tenantId`
   - Retrieves cached state: `Cache::get("keycloak_state_{$tenantId}_{$randomState}")`
   - Compares cached state with extracted random state
   - **Why Cache?**: Session state wouldn't be accessible on central domain callback
   - Clears cache after validation (single-use)

2. **Token Exchange**:
   - POST request to Keycloak token endpoint
   - Exchanges authorization code for:
     - `access_token`: For API calls to Keycloak
     - `refresh_token`: For refreshing access token
     - `id_token`: JWT containing user information
   - Uses central domain redirect URI in token exchange

#### Step 4: Extract User Information

- Decodes ID token (JWT) to extract:
  - `sub`: Keycloak user ID (unique identifier)
  - `email`: User's email address
  - `given_name`, `family_name`, `name`: User's name
- Falls back to userinfo endpoint if ID token decoding fails

#### Step 5: Central Database User Lookup

```php
tenancy()->central(function () use (&$centralUser, &$userEmail, $keycloakUserId) {
    $centralUser = User::where('keycloak_user_id', $keycloakUserId)->first();
    if ($centralUser) {
        $userEmail = $centralUser->email;
    }
});
```

- **Lookup Strategy**: Search by `keycloak_user_id` only
- **Why Central Database?**: Keycloak user ID is stored in central database
- **User Must Exist**: Users are NOT created during login. They must be pre-created (e.g., during tenant creation)

#### Step 6: Tenant Access Verification

```php
tenancy()->central(function () use (&$hasTenantAccess, $centralUser, $tenantId) {
    $hasTenantAccess = DB::table('tenant_user')
        ->where('user_id', $centralUser->id)
        ->where('tenant_id', $tenantId)
        ->exists();
});
```

- Verifies user has access to the specific tenant via `tenant_user` pivot table
- **Security**: Prevents users from accessing tenants they're not authorized for
- If access denied, redirects to tenant login with error message

#### Step 7: Tenant Database User Lookup

```php
tenancy()->initialize($tenant);
$tenantUser = User::where('email', $userEmail)->first();
```

- Initializes tenancy context to access tenant database
- Looks up user in tenant database using email from central user
- **User Must Exist**: Tenant user must already exist. No automatic creation.
- If user doesn't exist, redirects to tenant login with error

#### Step 8: User Information Sync

- Updates tenant user's name if it differs from Keycloak
- Keeps user information synchronized between Keycloak and Laravel

#### Step 9: Generate SSO Code for Cross-Domain Authentication

**Problem**: Sessions are domain-specific. Authenticating on central domain and redirecting to tenant domain loses the session.

**Solution**: Use SecureSSOService for cross-domain authentication.

```php
$ssoService = app(\App\Services\SecureSSOService::class);
$ssoCode = $ssoService->generateSSOCode($centralUser, $tenant, '/dashboard');
$ssoUrl = $ssoService->generateTenantSSOUrl($ssoCode, $tenant);
```

**SecureSSOService::generateSSOCode()**:
- Generates cryptographically secure 64-character random code
- Stores in cache with TTL of 5 minutes:
  ```php
  Cache::put('sso_code_' . $code, [
      'user_id' => $centralUser->id,
      'tenant_id' => $tenant->id,
      'redirect_internal' => '/dashboard',
      'issued_at' => now()->timestamp,
      'ttl' => 300, // 5 minutes
      'session_id' => session()->getId(),
      'user_email' => $centralUser->email,
  ], now()->addMinutes(5));
  ```
- Returns opaque code

**SecureSSOService::generateTenantSSOUrl()**:
- Builds tenant domain SSO URL: `http://tenant-name.localhost:8000/sso/start?code={ssoCode}`
- Returns URL for redirect

#### Step 10: Redirect to Tenant Domain SSO Endpoint

- Ends tenancy context
- Redirects to tenant domain SSO URL
- User's browser navigates to tenant domain

### Phase 4: SSO Code Exchange (Tenant Domain)

**Location**: `routes/tenant.php` - `/sso/start` route  
**Controller**: Handled by existing SSO flow

1. Tenant domain receives request: `GET /sso/start?code={ssoCode}`
2. Backend calls `SecureSSOService::exchangeSSOCode($code)`
3. **SSO Code Validation**:
   - Retrieves code from cache
   - Validates code exists and hasn't expired (5-minute TTL)
   - Verifies tenant membership via `tenant_user` table
   - **Single-Use**: Code is immediately deleted from cache after validation
4. **User Authentication**:
   - Finds user in tenant database using user_id from SSO data
   - Creates Laravel session: `Auth::login($tenantUser, true)`
   - User is now authenticated on tenant domain
5. **Redirect to Dashboard**:
   - Redirects to `/dashboard` (or intended URL)
   - User is fully authenticated and can access tenant resources

## Security Architecture

### 1. State Parameter (CSRF Protection)

**Implementation**:
- Random 32-character state string generated per request
- Tenant ID encoded in state: `base64_encode(json_encode(['state' => $randomState, 'tenant_id' => $tenantId]))`
- State stored in cache (shared across domains) with 10-minute TTL
- State validated on callback by comparing cached value with received value
- Cache cleared immediately after validation (single-use)

**Security Benefits**:
- Prevents CSRF attacks
- Ensures callback is from legitimate Keycloak redirect
- Tenant ID validation prevents tenant switching attacks

### 2. Authorization Code Flow

**OAuth 2.0 Authorization Code Flow**:
- Authorization code is short-lived (typically 1-10 minutes)
- Single-use: Code can only be exchanged once
- Server-to-server exchange: Code never exposed to browser JavaScript
- Client secret required for token exchange (confidential client)

**Security Benefits**:
- No credentials exposed to browser
- Code cannot be reused if intercepted
- Tokens only obtained via secure server-to-server call

### 3. Cross-Domain Session Security

**Problem**: Sessions don't work across domains (`localhost` vs `tenant-name.localhost`)

**Solution**: Secure SSO Code Exchange

**SSO Code Security**:
- 64-character cryptographically secure random code
- Stored in cache (not URL or session) with 5-minute TTL
- Single-use: Code deleted immediately after exchange
- Server-to-server validation: Code exchange happens on backend
- Tenant membership verification: Ensures user has access to tenant

**Security Benefits**:
- Prevents session hijacking across domains
- Time-limited codes prevent replay attacks
- Single-use prevents code reuse
- Tenant verification prevents unauthorized tenant access

### 4. Tenant Access Control

**Multi-Layer Verification**:

1. **Central Database Lookup**: User must exist in central database with `keycloak_user_id`
2. **Tenant Membership Check**: User must have entry in `tenant_user` pivot table
3. **Tenant Database Verification**: User must exist in tenant database
4. **SSO Tenant Verification**: SSO code exchange verifies tenant membership again

**Security Benefits**:
- Prevents unauthorized tenant access
- Ensures user exists in both central and tenant databases
- Multiple verification points reduce attack surface

### 5. User Creation Policy

**Strict Policy**: Users are **NOT** created during login

**Rationale**:
- Prevents unauthorized account creation
- Ensures users are properly provisioned with roles/permissions
- Maintains data integrity across tenant databases

**User Creation Flow**:
- Users created during tenant creation (`CreateTenantJob`)
- Keycloak user created via Admin API
- Laravel user created in both central and tenant databases
- Proper roles and permissions assigned

### 6. Token Storage

**Keycloak Tokens**:
- Access token and refresh token stored in Laravel session (optional)
- Not used for authentication (Laravel session handles that)
- Can be used for additional Keycloak API calls if needed
- Session-based storage (not database) for security

**Laravel Session**:
- Standard Laravel session management
- Database session driver (HIPAA compliant)
- 15-minute idle timeout
- 8-hour absolute timeout
- Secure, HTTP-only cookies

## Implementation Components

### 1. Configuration (`config/keycloak.php`)

Centralized configuration for Keycloak settings:
- `KEYCLOAK_BASE_URL`: Keycloak server URL
- `KEYCLOAK_REALM`: Keycloak realm name
- `KEYCLOAK_CLIENT_ID`: OAuth client ID
- `KEYCLOAK_CLIENT_SECRET`: OAuth client secret
- `KEYCLOAK_REDIRECT_URI`: Callback URL (central domain)

### 2. KeycloakService (`app/Services/KeycloakService.php`)

Handles all Keycloak OAuth interactions:

**Methods**:
- `getAuthorizationUrl($state, $tenantId)`: Generate authorization URL with tenant ID encoded in state
- `exchangeCodeForTokens($code, $state)`: Exchange authorization code for tokens with cache-based state validation
- `getUserInfoFromIdToken($idToken)`: Decode JWT ID token to extract user information
- `getUserInfo($accessToken)`: Get user information from userinfo endpoint (fallback)
- `refreshAccessToken($refreshToken)`: Refresh access token
- `getAdminAccessToken()`: Get admin token for Admin API operations

**Key Features**:
- Cache-based state storage (cross-domain compatible)
- Dynamic redirect URI based on tenancy context
- Tenant ID encoding in state parameter

### 3. KeycloakUserService (`app/Services/KeycloakUserService.php`)

Service for Keycloak Admin API user management:

**Methods**:
- `createUser($email, $firstName, $lastName, $password, $emailVerified)`: Create user in Keycloak
- `setPassword($keycloakUserId, $password, $temporary)`: Set user password
- `sendPasswordResetEmail($keycloakUserId)`: Send password reset email
- `updateUser($keycloakUserId, $userData)`: Update user information
- `deleteUser($keycloakUserId)`: Delete user from Keycloak
- `findUserByEmail($email)`: Find user by email

### 4. KeycloakController (`app/Http/Controllers/Auth/KeycloakController.php`)

Handles authentication flow:

**Methods**:
- `redirect()`: Redirect user to Keycloak (from tenant domain)
  - Extracts tenant ID from current tenancy context
  - Generates authorization URL with tenant ID encoded in state
  - Redirects to Keycloak

- `callback()`: Handle Keycloak callback (on central domain)
  - Extracts tenant ID from state parameter
  - Validates OAuth response (code, state)
  - Exchanges code for tokens
  - Extracts user information from ID token
  - **Central Database Lookup**: Finds user by `keycloak_user_id`
  - **Tenant Access Verification**: Verifies user has access to tenant
  - **Tenant Database Lookup**: Finds user in tenant database
  - **SSO Code Generation**: Generates SSO code for cross-domain authentication
  - **Redirect to Tenant**: Redirects to tenant domain SSO endpoint

### 5. SecureSSOService (`app/Services/SecureSSOService.php`)

Handles cross-domain authentication:

**Methods**:
- `generateSSOCode($user, $tenant, $redirectPath)`: Generate secure SSO code
- `exchangeSSOCode($code)`: Exchange SSO code for user data
- `generateTenantSSOUrl($code, $tenant)`: Generate tenant SSO URL
- `verifyTenantMembership($userId, $tenantId)`: Verify user has tenant access

**Security Features**:
- Cryptographically secure random codes (64 characters)
- Cache-based storage with TTL
- Single-use codes (deleted after exchange)
- Tenant membership verification
- Server-to-server validation

### 6. Routes

**Tenant Routes** (`routes/tenant.php`):
```php
Route::get('/login/keycloak', [KeycloakController::class, 'redirect'])->name('keycloak.login');
```

**Central Routes** (`routes/web.php`):
```php
Route::get('/auth/keycloak/callback', [KeycloakController::class, 'callback'])->name('keycloak.callback');
```

**Why Separate Routes?**:
- Redirect route on tenant domain (needs tenant context)
- Callback route on central domain (fixed URL for Keycloak)

### 7. Database Migrations

**Central Database** (`database/migrations/`):
- `add_keycloak_user_id_to_users_table.php`: Adds `keycloak_user_id` column to central `users` table

**Tenant Databases** (`database/migrations/tenant/`):
- `add_keycloak_user_id_to_users_table.php`: Adds `keycloak_user_id` column to tenant `users` table
- **Note**: Tenant databases don't use `keycloak_user_id` for lookup (uses email instead)

### 8. Login Page (`resources/js/pages/auth/login.tsx`)

- Displays tenant logo and company name
- Shows "Login with WELLOVIS" button
- Button uses `window.location.href` for full browser redirect (required for OAuth)
- Displays Keycloak-specific error messages

## User Creation Flow

### During Tenant Creation (`CreateTenantJob`)

When a new tenant is created:

1. **Central User Creation**:
   - User created in central database
   - Password stored as plain text in registration token (for Keycloak)
   - Password hashed when storing in Laravel database

2. **Keycloak User Creation**:
   - Keycloak user created via Admin API (`KeycloakUserService::createUser()`)
   - Uses registration password (plain text) for Keycloak
   - `keycloak_user_id` stored in central user record

3. **Tenant User Creation**:
   - User created in tenant database
   - Password hashed with bcrypt
   - Roles and permissions assigned via seeders

**Important**: Users are created with the password they provide during registration. This password is:
- Stored in Keycloak (for Keycloak authentication)
- Hashed and stored in Laravel (for Laravel authentication, though not used with Keycloak)

## Security Considerations

### 1. State Parameter Security

✅ **Implemented**:
- Random state generation per request
- Cache-based storage (cross-domain compatible)
- State validation on callback
- Single-use state (deleted after validation)
- Tenant ID encoding prevents tenant switching attacks

### 2. Authorization Code Security

✅ **Implemented**:
- Short-lived codes (1-10 minutes)
- Single-use codes
- Server-to-server exchange
- Client secret required

### 3. Cross-Domain Session Security

✅ **Implemented**:
- Secure SSO code exchange
- Cryptographically secure codes
- Time-limited codes (5 minutes)
- Single-use codes
- Tenant membership verification

### 4. Tenant Access Control

✅ **Implemented**:
- Central database user lookup
- Tenant membership verification (`tenant_user` table)
- Tenant database user verification
- SSO tenant verification

### 5. User Creation Security

✅ **Implemented**:
- No automatic user creation during login
- Users must be pre-created with proper roles/permissions
- Keycloak users created via Admin API (not public registration)

### 6. Token Security

✅ **Implemented**:
- Tokens stored in Laravel session (not database)
- Session-based authentication (not token-based)
- Secure, HTTP-only session cookies
- Database session driver (HIPAA compliant)

### 7. Error Handling

✅ **Implemented**:
- All errors redirect to tenant login page (not central domain)
- User-friendly error messages
- Comprehensive logging for debugging
- No sensitive information exposed in errors

## Environment Variables

```env
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=atc
KEYCLOAK_CLIENT_ID=app-portal
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_REDIRECT_URI=http://localhost:8000/auth/keycloak/callback
```

**Note**: `KEYCLOAK_REDIRECT_URI` must point to central domain callback URL.

## Keycloak Server Configuration

### Required Client Settings
- **Client ID**: `app-portal`
- **Client Protocol**: `openid-connect`
- **Access Type**: `confidential` (requires client secret)
- **Valid Redirect URIs**: `http://localhost:8000/auth/keycloak/callback`
- **Standard Flow Enabled**: `ON`
- **Direct Access Grants Enabled**: `ON` (for Admin API user creation)

### Required Realm Settings
- **Realm**: `atc`
- **User Registration**: `OFF` (users created programmatically)

## Flow Diagram

```
┌─────────────────┐
│ Tenant Login    │
│ Page            │
│ (tenant domain)│
└────────┬────────┘
         │
         │ Click "Login with WELLOVIS"
         ▼
┌─────────────────┐
│ Keycloak        │
│ Authorization   │
│ Endpoint        │
└────────┬────────┘
         │
         │ User authenticates
         ▼
┌─────────────────┐
│ Central Domain  │
│ Callback        │
│ (localhost)     │
└────────┬────────┘
         │
         │ Validate & Exchange Code
         │ Lookup Central User
         │ Verify Tenant Access
         │ Lookup Tenant User
         │ Generate SSO Code
         ▼
┌─────────────────┐
│ Tenant Domain   │
│ SSO Endpoint    │
│ (tenant domain) │
└────────┬────────┘
         │
         │ Exchange SSO Code
         │ Authenticate User
         ▼
┌─────────────────┐
│ Tenant          │
│ Dashboard       │
│ (authenticated) │
└─────────────────┘
```

## Key Differences from Practitioner Portal

1. **Multi-Tenant Architecture**: App portal handles tenant-specific authentication
2. **Cross-Domain SSO**: Uses SecureSSOService for cross-domain session handling
3. **State Management**: Uses cache instead of session for state validation
4. **Central Domain Callback**: Callback route on central domain (not tenant domain)
5. **Tenant ID Encoding**: Tenant ID encoded in state parameter
6. **Dual User Lookup**: Central database → Tenant database lookup flow
7. **Tenant Access Verification**: Multiple layers of tenant access verification
8. **No User Creation**: Users must be pre-created (not created during login)

## Testing Checklist

- [ ] Login redirects to Keycloak from tenant domain
- [ ] Tenant ID is correctly encoded in state parameter
- [ ] State validation works across domains (cache-based)
- [ ] Central database user lookup works correctly
- [ ] Tenant access verification prevents unauthorized access
- [ ] Tenant database user lookup works correctly
- [ ] SSO code generation and exchange works
- [ ] User is authenticated on tenant domain after SSO
- [ ] User roles and permissions work correctly
- [ ] Keycloak user creation works during tenant setup
- [ ] User can log out properly
- [ ] Session persists across requests on tenant domain
- [ ] Error handling redirects to tenant login page
- [ ] Users without tenant access are denied
- [ ] Users without tenant database entry are denied

## Future Enhancements

1. **PKCE Support**: Add Proof Key for Code Exchange for enhanced security
2. **Token Refresh**: Implement automatic token refresh
3. **User Profile Sync**: Sync user profile updates from Keycloak
4. **Multi-Factor Authentication**: Leverage Keycloak's MFA capabilities
5. **Single Sign-Out**: Implement Keycloak logout endpoint
6. **Session Sharing**: Consider session sharing mechanisms for better UX

## Files Changed

1. `config/keycloak.php` - Keycloak configuration
2. `app/Services/KeycloakService.php` - OAuth service with cache-based state
3. `app/Services/KeycloakUserService.php` - Admin API service
4. `app/Http/Controllers/Auth/KeycloakController.php` - Authentication controller
5. `routes/tenant.php` - Keycloak redirect route
6. `routes/web.php` - Keycloak callback route
7. `database/migrations/tenant/add_keycloak_user_id_to_users_table.php` - Tenant migration
8. `resources/js/pages/auth/login.tsx` - Login page with Keycloak button
9. `app/Jobs/CreateTenantJob.php` - Keycloak user creation during tenant setup
10. `app/Models/User.php` - Added `keycloak_user_id` to fillable

## Security Summary

### Authentication Security
- ✅ OAuth 2.0 Authorization Code flow
- ✅ CSRF protection via state parameter
- ✅ Cache-based state validation (cross-domain compatible)
- ✅ Single-use authorization codes
- ✅ Server-to-server token exchange

### Cross-Domain Security
- ✅ Secure SSO code exchange
- ✅ Cryptographically secure codes
- ✅ Time-limited codes (5 minutes)
- ✅ Single-use codes
- ✅ Tenant membership verification

### Access Control
- ✅ Central database user verification
- ✅ Tenant membership verification
- ✅ Tenant database user verification
- ✅ Multiple verification layers

### Session Security
- ✅ Laravel session-based authentication
- ✅ Database session driver (HIPAA compliant)
- ✅ Secure, HTTP-only cookies
- ✅ 15-minute idle timeout
- ✅ 8-hour absolute timeout

### User Management Security
- ✅ No automatic user creation during login
- ✅ Users pre-created with proper roles/permissions
- ✅ Keycloak users created via Admin API
- ✅ Password stored securely (hashed in Laravel, plain in Keycloak)

## Notes

- This implementation maintains backward compatibility with existing Laravel authentication
- All existing middleware, guards, and policies continue to work
- No changes required to existing authorization logic
- Keycloak is purely used for authentication, not authorization
- Sessions are domain-specific, requiring SSO flow for cross-domain authentication
- Cache is used for state management to enable cross-domain validation

