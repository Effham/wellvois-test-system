# Keycloak Authentication Implementation Plan - App Portal

## Overview
This document outlines the implementation of Keycloak authentication for the App Portal (multi-tenant application). The implementation uses Keycloak's standard OAuth 2.0 Authorization Code flow combined with a secure cross-domain SSO mechanism to authenticate users across tenant domains while maintaining Laravel's built-in authentication system for session management, roles, and permissions.

## Critical Design Principle

**IMPORTANT**: The App Portal Keycloak implementation follows a **tenant-initiated authentication** model:

- **Tenant ID Source**: The tenant ID comes from the **state parameter**, which is set when the user clicks "Login with WELLOVIS" on a specific tenant's login page
- **Single Tenant Verification**: We verify if the user belongs to **THAT SPECIFIC tenant** (from state), not all tenants the user belongs to
- **Direct Redirect**: We redirect the user back to **THE SAME tenant** that initiated the login
- **No Tenant Selection**: We do NOT search for all user tenants or show a tenant selection screen
- **No Tenant Switching**: We do NOT redirect to a different tenant than the one that initiated login

**Why This Design?**
- Keycloak callback URL is on the central domain (`localhost:8000/auth/keycloak/callback`)
- We cannot determine the originating tenant from the callback URL alone
- State parameter is the only reliable way to track which tenant initiated the login
- This ensures users authenticate for the tenant they intended to access

**What We Do NOT Do:**
- ❌ Search for all tenants the user belongs to
- ❌ Show tenant selection screen
- ❌ Redirect to a different tenant than the one that initiated login
- ❌ Authenticate user for multiple tenants simultaneously
- ❌ Allow tenant switching during authentication flow

**What We DO:**
- ✅ Extract tenant ID from tenant domain/subdomain where login was clicked
- ✅ Encode tenant ID in state parameter
- ✅ Verify user belongs to THAT SPECIFIC tenant (from state)
- ✅ Authenticate user for THAT SPECIFIC tenant only
- ✅ Redirect back to THAT SAME tenant

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
3. System extracts tenant ID from current tenant domain/subdomain
4. Tenant ID encoded in state parameter and sent to Keycloak
5. User authenticates with Keycloak
6. Keycloak redirects to central domain callback (localhost:8000/auth/keycloak/callback)
7. Backend extracts tenant ID from state parameter (the tenant that initiated login)
8. Backend validates state, exchanges code for tokens
9. Backend looks up central user by Keycloak user ID
10. Backend verifies user belongs to THIS SPECIFIC tenant (from state) - NOT searching for all user tenants
11. Backend finds user in THIS tenant's database
12. Backend generates SSO code for cross-domain authentication
13. Redirect to THIS SPECIFIC tenant domain SSO endpoint (tenant-name.localhost:8000/sso/start?code=...)
14. Tenant domain exchanges SSO code and authenticates user
15. User is redirected to THIS tenant's dashboard
```

**Key Points**:
- Tenant ID comes from the tenant domain where login was clicked (encoded in state)
- We verify user belongs to THAT specific tenant only
- We redirect back to THAT same tenant
- We do NOT search for all user tenants or show tenant selection

## Detailed Authentication Flow

### Phase 1: Initial Redirect (Tenant Domain → Keycloak)

**Location**: `routes/tenant.php` - `/login/keycloak` route  
**Controller**: `KeycloakController::redirect()`

**CRITICAL**: This phase captures the tenant ID from the tenant domain/subdomain where the login was initiated.

1. User clicks "Login with WELLOVIS" on tenant login page (e.g., `tenant-name.localhost:8000/login`)
2. Request hits `/login/keycloak` route on tenant domain (e.g., `tenant-name.localhost:8000/login/keycloak`)
3. **Controller extracts current tenant ID**: `$tenantId = tenant('id')`
   - This is the tenant from the domain/subdomain where login was clicked
   - Example: If login clicked on `roberts-and-nixon-inc.localhost:8000`, tenantId = `roberts_and_nixon_inc`
4. **Tenant ID is encoded in state parameter** and sent to Keycloak
5. Calls `KeycloakService::getAuthorizationUrl(null, $tenantId)`

**Why This Matters**: The tenant ID from this step determines which tenant the user will be authenticated for. We do NOT search for all tenants the user belongs to later.

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

**CRITICAL**: This tenant ID is the tenant that initiated the login. We will authenticate the user for THIS tenant only.

- Decodes the base64-encoded state parameter
- Extracts tenant ID that was encoded during redirect (from Phase 1)
- **This tenant ID determines which tenant to authenticate for**
- Validates tenant ID exists
- **We do NOT search for all tenants the user belongs to**

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

- **Lookup Strategy**: Search by `keycloak_user_id` only (not email)
- **Why Central Database?**: Keycloak user ID is stored in central database
- **User Must Exist**: Users are NOT created during login. They must be pre-created (e.g., during tenant creation)
- **Purpose**: Get the central user ID and email for tenant verification

#### Step 6: Verify User Belongs to THIS SPECIFIC Tenant

```php
tenancy()->central(function () use (&$hasTenantAccess, $centralUser, $tenantId) {
    $hasTenantAccess = DB::table('tenant_user')
        ->where('user_id', $centralUser->id)
        ->where('tenant_id', $tenantId) // THIS specific tenant from state
        ->exists();
});
```

**CRITICAL**: We verify if the user belongs to **THIS SPECIFIC tenant** (from state parameter), NOT all tenants.

- Verifies user has access to **THE tenant that initiated the login** (from state)
- Uses `tenant_user` pivot table to check membership
- **We do NOT**:
  - Search for all tenants the user belongs to
  - Show tenant selection screen
  - Redirect to a different tenant
- **Security**: Prevents users from accessing tenants they're not authorized for
- If access denied, redirects back to **THE SAME tenant's** login page with error message

#### Step 7: Tenant Database User Lookup

```php
tenancy()->initialize($tenant); // Initialize THIS specific tenant's database
$tenantUser = User::where('email', $userEmail)->first();
```

**CRITICAL**: We look up the user in **THIS SPECIFIC tenant's database** (the tenant from state).

- Initializes tenancy context to access **THE tenant's database** (from state parameter)
- Looks up user in **THIS tenant's database** using email from central user
- **User Must Exist**: Tenant user must already exist in THIS tenant's database. No automatic creation.
- If user doesn't exist, redirects back to **THIS tenant's** login page with error
- **We do NOT** search other tenant databases

#### Step 8: User Information Sync

- Updates tenant user's name if it differs from Keycloak
- Keeps user information synchronized between Keycloak and Laravel

#### Step 9: Generate SSO Code and Redirect to THIS SPECIFIC Tenant

**Problem**: Sessions are domain-specific. Authenticating on central domain and redirecting to tenant domain loses the session.

**Solution**: Use SecureSSOService for cross-domain authentication.

**CRITICAL**: We redirect back to **THE SAME tenant** that initiated the login (from state parameter).

```php
$ssoService = app(\App\Services\SecureSSOService::class);
$ssoCode = $ssoService->generateSSOCode($centralUser, $tenant, '/dashboard'); // THIS tenant from state
$ssoUrl = $ssoService->generateTenantSSOUrl($ssoCode, $tenant); // THIS tenant's domain
```

- Generates SSO code for **THIS SPECIFIC tenant** (from state)
- Builds SSO URL for **THIS tenant's domain**
- **We do NOT** redirect to a different tenant
- **We do NOT** show tenant selection

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

**CRITICAL**: We verify user belongs to **THE SPECIFIC tenant from state**, NOT all tenants.

**Multi-Layer Verification**:

1. **Central Database Lookup**: User must exist in central database with `keycloak_user_id`
2. **THIS Tenant Membership Check**: User must have entry in `tenant_user` pivot table for **THIS SPECIFIC tenant** (from state)
   - We do NOT search for all tenants the user belongs to
   - We ONLY verify membership for the tenant that initiated login
3. **THIS Tenant Database Verification**: User must exist in **THIS tenant's database** (not other tenants)
4. **SSO Tenant Verification**: SSO code exchange verifies tenant membership again for **THIS tenant**

**Security Benefits**:
- Prevents unauthorized tenant access
- Ensures user exists in both central and tenant databases
- Multiple verification points reduce attack surface
- **Tenant-specific authentication**: User authenticates for the tenant they intended to access

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
2. **Tenant-Initiated Authentication**: Tenant ID comes from state parameter (the tenant that initiated login)
3. **Single Tenant Verification**: Verifies user belongs to THAT specific tenant only (not all tenants)
4. **Direct Tenant Redirect**: Redirects back to THE SAME tenant that initiated login
5. **No Tenant Selection**: Does NOT search for all user tenants or show tenant selection screen
6. **Cross-Domain SSO**: Uses SecureSSOService for cross-domain session handling
7. **State Management**: Uses cache instead of session for state validation (cross-domain compatible)
8. **Central Domain Callback**: Callback route on central domain (not tenant domain) - requires state to track originating tenant
9. **Tenant ID Encoding**: Tenant ID encoded in state parameter to track originating tenant
10. **Dual User Lookup**: Central database → Tenant database lookup flow
11. **Tenant Access Verification**: Multiple layers of tenant access verification for THE SPECIFIC tenant
12. **No User Creation**: Users must be pre-created (not created during login)

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

## Keycloak User Menu and Session Management

### Overview
When users are logged into Keycloak, they can access their Keycloak account management features directly from the application. This includes password changes, multi-factor authentication setup, and other security settings managed by Keycloak.

### Keycloak User Menu Component

**Location**: `resources/js/components/keycloak-user-menu.tsx`

The Keycloak user menu appears in the top-right corner of login and onboarding layouts when a user is logged into Keycloak (but not necessarily logged into the Laravel application).

**Features**:
- Shows user avatar with initials
- Displays user name and email
- Provides quick access to:
  - **Manage Profile**: Opens Keycloak account management page
  - **Change Password**: Opens Keycloak password change page
  - **Security Settings**: Opens Keycloak security settings (MFA, etc.)
  - **Logout from WELLOVIS**: Logs out from Keycloak (which also logs out from Laravel)

**Visibility**:
- Only shown when user has an active Keycloak session
- Uses `props.keycloak.logged_in` to determine visibility
- Automatically hides if Keycloak session expires

### Keycloak Session Detection

**Backend**: `app/Http/Middleware/HandleInertiaRequests.php`

The middleware checks if the user has a valid Keycloak session by:
1. Checking if `keycloak_access_token` exists in session
2. Calling Keycloak userinfo endpoint to verify token validity
3. Sharing Keycloak user info with frontend via Inertia props

**Shared Data Structure**:
```php
'keycloak' => [
    'logged_in' => bool,
    'user' => [
        'name' => string,
        'email' => string,
    ],
    'account_management_url' => string|null,
]
```

### Keycloak Logout Flow

**Logout Route**: `/logged-out` (configured in Keycloak client settings)

**Flow**:
1. User clicks "Logout from WELLOVIS" in Keycloak user menu
2. Application redirects to Keycloak logout endpoint with `redirect_uri=/logged-out`
3. Keycloak logs out the user and redirects back to `/logged-out`
4. `KeycloakUserController::loggedOut()` handles the callback:
   - Clears Keycloak tokens from Laravel session
   - Logs out Laravel user if authenticated
   - Invalidates and regenerates session
   - Redirects to login page

**Controller**: `app/Http/Controllers/KeycloakUserController.php`

### Session Validation Middleware

**Location**: `app/Http/Middleware/CheckKeycloakSession.php`

This middleware validates Keycloak sessions on page refresh:
- Only runs on full page loads (not AJAX/Inertia requests)
- Checks if user has `keycloak_access_token` in session
- Verifies token validity by calling Keycloak userinfo endpoint
- If token is invalid/expired:
  - Clears Keycloak tokens from session
  - Logs out Laravel user
  - Redirects to login page with message

**Performance**:
- Only checks on page refresh (not every request)
- Skips check for AJAX/Inertia/API requests
- Handles network errors gracefully (doesn't log out on temporary failures)

### User Menu Updates

**Location**: `resources/js/components/user-menu-content.tsx`

**Changes**:
1. **Removed Two-Factor Authentication Menu Item**: 2FA is now managed entirely through Keycloak
2. **Profile Menu**: Redirects to Keycloak account management page (if logged into Keycloak)
3. **Account Settings Menu**: Redirects to Keycloak account management page for password, MFA, etc.
4. **Logout**: Uses Keycloak logout endpoint if user is logged into Keycloak

**Fallback Behavior**:
- If Keycloak URL not available, falls back to Laravel routes
- Maintains backward compatibility for users not using Keycloak

### Layout Updates

**Location**: `resources/js/components/onboarding-layout.tsx`

**Changes**:
- Added Keycloak user menu in top-right corner
- Positioned alongside app logo (top-left)
- Only visible when user is logged into Keycloak

### Keycloak Account Management URL

The account management URL is constructed as:
```
{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}/account
```

This URL provides access to:
- Profile management
- Password changes
- Multi-factor authentication setup
- Security settings
- Session management
- Account deletion

### Integration Points

1. **Login Page**: Shows Keycloak user menu if user is logged into Keycloak but not Laravel
2. **Onboarding Layout**: Shows Keycloak user menu on all pages using this layout
3. **App Header**: User menu redirects to Keycloak for account management
4. **Session Validation**: Middleware ensures Keycloak session validity

### Files Changed

1. `app/Http/Controllers/KeycloakUserController.php` - New controller for user info and logout
2. `app/Http/Middleware/CheckKeycloakSession.php` - New middleware for session validation
3. `app/Http/Middleware/HandleInertiaRequests.php` - Added Keycloak user info to shared data
4. `app/Http/Controllers/Auth/AuthenticatedSessionController.php` - Updated logout to clear Keycloak tokens
5. `resources/js/components/keycloak-user-menu.tsx` - New component for Keycloak user menu
6. `resources/js/components/onboarding-layout.tsx` - Added Keycloak user menu
7. `resources/js/components/user-menu-content.tsx` - Removed 2FA, updated Profile/Settings to redirect to Keycloak
8. `resources/js/types/index.d.ts` - Added Keycloak type to SharedData
9. `routes/web.php` - Added Keycloak user info and logout routes
10. `bootstrap/app.php` - Registered CheckKeycloakSession middleware

## Notes

- This implementation maintains backward compatibility with existing Laravel authentication
- All existing middleware, guards, and policies continue to work
- No changes required to existing authorization logic
- Keycloak is purely used for authentication, not authorization
- Sessions are domain-specific, requiring SSO flow for cross-domain authentication
- Cache is used for state management to enable cross-domain validation
- Keycloak user menu only appears when user has active Keycloak session
- Two-factor authentication is now managed entirely through Keycloak
- Account settings redirect to Keycloak account management page

