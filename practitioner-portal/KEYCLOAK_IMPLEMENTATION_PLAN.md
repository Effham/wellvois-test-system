# Keycloak Authentication Implementation Plan

## Overview
This document outlines the implementation of Keycloak authentication for the Practitioner Portal. The implementation uses Keycloak's standard OAuth 2.0 Authorization Code flow to authenticate users while maintaining Laravel's built-in authentication system for session management, roles, and permissions.

## Architecture

### Authentication Flow
1. User visits `/practitioner/login` and sees a "Login with WELLOVIS" button
2. User clicks the button and is redirected to Keycloak authorization endpoint
3. User authenticates with Keycloak (username/password)
4. Keycloak redirects back to `/auth/keycloak/callback` with an authorization code
5. Backend exchanges the code for tokens (access token, refresh token, ID token)
6. Backend extracts user information from ID token
7. Backend finds or creates Laravel user and creates Laravel session
8. User is authenticated using Laravel's standard authentication system

### Detailed Callback Mechanism (User Lookup & Session Creation)

When a user returns from Keycloak authentication, the `KeycloakController::callback()` method performs the following steps:

#### Step 1: Validate OAuth Response
- Checks for error parameters from Keycloak
- Validates authorization code and state parameter (CSRF protection)
- Logs any validation failures

#### Step 2: Exchange Authorization Code for Tokens
- Calls `KeycloakService::exchangeCodeForTokens()` to exchange the authorization code for:
  - Access token
  - Refresh token
  - ID token (JWT containing user information)

#### Step 3: Extract User Information
- Decodes the ID token to extract:
  - `sub` (Keycloak user ID - unique identifier)
  - `email` (user's email address)
  - `given_name` and `family_name` or `name` (user's full name)
  - `email_verified` (email verification status)
- Falls back to userinfo endpoint if ID token decoding fails

#### Step 4: User Lookup Logic
The system performs a **dual lookup** to find the Laravel user:

```php
$user = User::where('keycloak_user_id', $keycloakUserId)
    ->orWhere('email', $email)
    ->first();
```

**Lookup Priority:**
1. **First**: Search by `keycloak_user_id` (most reliable - direct Keycloak mapping)
2. **Fallback**: Search by `email` (for users created before Keycloak integration or migrated users)

#### Step 5: User Creation/Update Logic

**If User NOT Found:**
- Creates a new Laravel user with:
  - `name`: Extracted from Keycloak user info
  - `email`: From Keycloak user info
  - `keycloak_user_id`: Keycloak's unique user ID (`sub` claim)
  - `email_verified_at`: Set if email is verified in Keycloak
  - `password`: Random 64-character password (not used for authentication, but required by Laravel)
- Logs the creation event

**If User EXISTS:**
- **Updates Keycloak User ID**: If `keycloak_user_id` is null, sets it from the Keycloak response
- **Syncs User Name**: Updates the user's name if it differs from Keycloak
- Logs the authentication event

#### Step 6: Laravel Session Creation
After user lookup/creation, the system creates a Laravel session:

```php
Auth::login($user, true); // Remember user (sets remember token)
```

**What This Does:**
- Creates a Laravel authentication session
- Sets session cookie with user ID
- Enables Laravel's built-in authentication middleware to recognize the user
- Allows all existing Laravel guards, policies, and middleware to work normally

#### Step 7: Store Keycloak Tokens (Optional)
- Stores access token and refresh token in Laravel session for potential future use
- These tokens are NOT used for authentication (Laravel session handles that)
- Can be used for additional Keycloak API calls if needed

#### Step 8: Redirect to Intended URL
- Checks for `url.intended` in session (if user was redirected to login from a protected page)
- Falls back to dashboard route if no intended URL exists
- Redirects user to their destination

### Key Points About This Mechanism

1. **User Matching Strategy**: Uses both `keycloak_user_id` and `email` to ensure users are found even if:
   - They were created before Keycloak integration
   - Their Keycloak user ID wasn't set initially
   - They're logging in for the first time after Keycloak was enabled

2. **Automatic User Linking**: If a user exists by email but doesn't have a `keycloak_user_id`, the system automatically links them on first Keycloak login

3. **Laravel Session-Based**: Once the Laravel session is created, all authentication is handled by Laravel's standard session mechanism. Keycloak is only used for initial authentication.

4. **Roles & Permissions Preserved**: Since we use Laravel's `Auth::login()`, all existing roles, permissions, and authorization logic continues to work without modification.

5. **No Password Required**: Users created via Keycloak login have random passwords since authentication happens through Keycloak, not password verification.

### Key Principles
- **Laravel Session-Based**: All authentication state is managed via Laravel sessions
- **Roles & Permissions Preserved**: Laravel's Spatie Permission package continues to work as-is
- **No Password Storage**: Users authenticate via Keycloak, no passwords stored locally
- **User Sync**: Keycloak user ID is stored in `users.keycloak_user_id` for mapping

## Implementation Components

### 1. Configuration (`config/keycloak.php`)
- Centralized configuration for Keycloak settings
- Reads from environment variables:
  - `KEYCLOAK_BASE_URL`
  - `KEYCLOAK_REALM`
  - `KEYCLOAK_CLIENT_ID`
  - `KEYCLOAK_CLIENT_SECRET`
  - `KEYCLOAK_REDIRECT_URI`

### 2. KeycloakService (`app/Services/KeycloakService.php`)
- Handles all Keycloak API interactions
- Methods:
  - `getAuthorizationUrl()`: Generate authorization URL with state parameter
  - `exchangeCodeForTokens()`: Exchange authorization code for tokens
  - `getUserInfo()`: Get user information from ID token or userinfo endpoint
  - `refreshAccessToken()`: Refresh access token using refresh token
  - `createUser()`: Create a new user in Keycloak (admin API)
  - `updateUser()`: Update user in Keycloak
  - `deleteUser()`: Delete user from Keycloak

### 3. KeycloakUserService (`app/Services/KeycloakUserService.php`)
- Service specifically for user management operations
- Methods:
  - `createUser()`: Create user in Keycloak with email, name, and temporary password
  - `setPassword()`: Set permanent password for user
  - `sendPasswordResetEmail()`: Send password reset email via Keycloak

### 4. KeycloakController (`app/Http/Controllers/Auth/KeycloakController.php`)
- Handles authentication flow
- Methods:
  - `redirect()`: Redirect user to Keycloak authorization endpoint
  - `callback()`: Handle Keycloak callback, performs user lookup/creation, and creates Laravel session
    - Validates OAuth response (code, state)
    - Exchanges authorization code for tokens
    - Extracts user information from ID token
    - **Looks up user by `keycloak_user_id` OR `email`**
    - **Creates new user if not found, or updates existing user**
    - **Creates Laravel session using `Auth::login($user, true)`**
    - Redirects to intended URL or dashboard

### 5. Routes (`routes/auth.php`)
- `/login/keycloak` - GET - Redirect to Keycloak
- `/auth/keycloak/callback` - GET - Handle Keycloak callback

### 6. Database Migration
- Add `keycloak_user_id` column to `users` table
- Nullable string field to store Keycloak user UUID

### 7. Login Page Update (`resources/js/pages/auth/login.tsx`)
- Replace email/password form with single "Login with WELLOVIS" button
- Button redirects to `/login/keycloak` route

### 8. User Creation Integration
- Update `TenantController::runTenantSetup()` to create Keycloak user when tenant is created
- Update `CreateTenantJob` to create Keycloak user for admin user
- Store `keycloak_user_id` in Laravel users table

## Security Considerations

1. **State Parameter**: CSRF protection using state parameter in OAuth flow
2. **PKCE**: Consider adding PKCE for enhanced security (future enhancement)
3. **Token Storage**: Access tokens stored in session, not database
4. **User Mapping**: Keycloak user ID stored for user identification
5. **Session Management**: Laravel handles all session security

## Environment Variables

```env
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=atc
KEYCLOAK_CLIENT_ID=practitioner-portal
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_REDIRECT_URI=http://localhost:8001/auth/keycloak/callback
```

## Keycloak Server Configuration

### Required Client Settings
- Client ID: `practitioner-portal`
- Client Protocol: `openid-connect`
- Access Type: `confidential` (if using client secret) or `public`
- Valid Redirect URIs: `http://localhost:8001/auth/keycloak/callback`
- Standard Flow Enabled: `ON`
- Direct Access Grants Enabled: `ON` (for admin API user creation)

### Required Realm Settings
- Realm: `atc`
- User registration: `OFF` (users created programmatically)

## User Creation Flow

When a tenant is created:
1. Laravel user is created in central database
2. Keycloak user is created via Admin API
3. Temporary password is set (user must change on first login)
4. `keycloak_user_id` is stored in Laravel users table
5. User can now log in via Keycloak

## Testing Checklist

- [ ] Login redirects to Keycloak
- [ ] Successful authentication creates Laravel session
- [ ] User roles and permissions work correctly
- [ ] Keycloak user creation works during tenant setup
- [ ] User can log out properly
- [ ] Session persists across requests
- [ ] Error handling for failed authentication

## Future Enhancements

1. **PKCE Support**: Add Proof Key for Code Exchange for enhanced security
2. **Token Refresh**: Implement automatic token refresh
3. **User Profile Sync**: Sync user profile updates from Keycloak
4. **Multi-Factor Authentication**: Leverage Keycloak's MFA capabilities
5. **Single Sign-Out**: Implement Keycloak logout endpoint

## Files Changed

1. `config/keycloak.php` - New configuration file
2. `app/Services/KeycloakService.php` - New service class
3. `app/Services/KeycloakUserService.php` - New user management service
4. `app/Http/Controllers/Auth/KeycloakController.php` - New controller
5. `routes/auth.php` - Added Keycloak routes
6. `database/migrations/YYYY_MM_DD_HHMMSS_add_keycloak_user_id_to_users_table.php` - New migration
7. `resources/js/pages/auth/login.tsx` - Updated login page
8. `app/Http/Controllers/TenantController.php` - Updated to create Keycloak users
9. `app/Jobs/CreateTenantJob.php` - Updated to create Keycloak users
10. `app/Models/User.php` - Added `keycloak_user_id` to fillable

## Notes

- This implementation maintains backward compatibility with existing Laravel authentication
- All existing middleware, guards, and policies continue to work
- No changes required to existing authorization logic
- Keycloak is purely used for authentication, not authorization

