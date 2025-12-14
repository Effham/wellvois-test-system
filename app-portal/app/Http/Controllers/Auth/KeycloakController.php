<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Services\KeycloakService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class KeycloakController extends Controller
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    /**
     * Redirect user to Keycloak authorization endpoint.
     * 
     * IMPORTANT: This method extracts the tenant ID from the current tenant domain/subdomain
     * where the login was initiated. This tenant ID is encoded in the state parameter
     * and will be used to redirect the user back to the SAME tenant after authentication.
     * 
     * We do NOT search for all tenants the user belongs to. We ONLY authenticate for
     * the specific tenant from which the login was initiated.
     *
     * @return RedirectResponse
     */
    public function redirect(): RedirectResponse
    {
        // Get current tenant ID from the tenant domain/subdomain where login was clicked
        // Example: If user clicks login on "tenant-name.localhost:8000", this extracts "tenant-name"
        $tenantId = tenant('id');
        
        if (!$tenantId) {
            Log::error('Keycloak redirect: No tenant ID found in current context');
            // Redirect back to login page with error
            return redirect()->route('login')
                ->withErrors(['keycloak' => 'Invalid tenant context. Please access login from your tenant domain.']);
        }
        
        // Encode tenant ID in state parameter
        // This ensures callback redirects back to THIS specific tenant (not searching for user's tenants)
        $authorizationUrl = $this->keycloakService->getAuthorizationUrl(null, $tenantId);
        return redirect($authorizationUrl);
    }

    /**
     * Handle Keycloak callback after authentication.
     * 
     * IMPORTANT FLOW:
     * 1. Extract tenant ID from state parameter (the tenant that initiated login)
     * 2. Lookup central user by Keycloak user ID
     * 3. Verify user belongs to THIS SPECIFIC tenant (from state) - NOT searching for all user tenants
     * 4. If verified, authenticate user for THIS tenant and redirect back to THIS tenant
     * 5. If not verified, show error and redirect back to THIS tenant's login page
     * 
     * We do NOT:
     * - Search for all tenants the user belongs to
     * - Show tenant selection screen
     * - Redirect to a different tenant than the one that initiated login
     *
     * @param Request $request
     * @return RedirectResponse
     */
    public function callback(Request $request): RedirectResponse
    {
        // STEP 1: Extract tenant ID from state parameter
        // This is the tenant domain/subdomain from which the login was initiated
        // Example: If login was clicked on "tenant-name.localhost:8000", tenantId = "tenant-name"
        $state = $request->get('state');
        $tenantId = null;
        
        if ($state) {
            try {
                $decodedState = json_decode(base64_decode($state), true);
                if (isset($decodedState['tenant_id'])) {
                    $tenantId = $decodedState['tenant_id'];
                }
            } catch (\Exception $e) {
                Log::debug('Keycloak callback: Could not decode tenant ID from state', [
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        if (!$tenantId) {
            Log::error('Keycloak callback: Missing tenant ID in state parameter');
            // Redirect to central domain with error (we don't know which tenant to redirect to)
            return redirect()->to(config('tenancy.central_domains')[0] ?? 'localhost')
                ->withErrors(['keycloak' => 'Invalid authentication request. Please try again from your tenant login page.']);
        }
        
        Log::info('Keycloak callback: Processing authentication for specific tenant', [
            'tenant_id' => $tenantId,
        ]);

        // Get tenant and domain early for error redirects
        $tenant = null;
        $tenantDomain = null;
        tenancy()->central(function () use (&$tenant, &$tenantDomain, $tenantId) {
            $tenant = Tenant::find($tenantId);
            if ($tenant) {
                $tenantDomain = $tenant->domains()->first();
            }
        });

        // Helper function to redirect to tenant login page with error
        // We use both query parameter and flash message to ensure error persists across redirect
        $redirectToTenantLogin = function ($errorMessage) use ($tenantDomain) {
            if ($tenantDomain) {
                $protocol = app()->environment('production') ? 'https' : 'http';
                $port = app()->environment('production') ? '' : ':8000';
                // Pass error as query parameter to ensure it persists across redirect
                $tenantLoginUrl = "{$protocol}://{$tenantDomain->domain}{$port}/login?keycloak_error=" . urlencode($errorMessage);
                return redirect()->to($tenantLoginUrl)
                    ->withErrors(['keycloak' => $errorMessage]) // Also set in session as backup
                    ->with('keycloak_error', $errorMessage); // Flash message as additional backup
            }
            // Fallback to central domain if tenant domain not found
            return redirect()->to(config('tenancy.central_domains')[0] ?? 'localhost')
                ->withErrors(['keycloak' => $errorMessage])
                ->with('keycloak_error', $errorMessage);
        };

        // Check for error from Keycloak
        if ($request->has('error')) {
            Log::error('Keycloak callback error', [
                'error' => $request->get('error'),
                'error_description' => $request->get('error_description'),
                'tenant_id' => $tenantId,
            ]);

            return $redirectToTenantLogin('Authentication failed. Please try again.');
        }

        // Get authorization code and state
        $code = $request->get('code');
        $state = $request->get('state');

        if (!$code || !$state) {
            Log::error('Keycloak callback: Missing code or state', [
                'has_code' => !empty($code),
                'has_state' => !empty($state),
                'tenant_id' => $tenantId,
            ]);

            return $redirectToTenantLogin('Invalid authentication response. Please try again.');
        }

        // Exchange code for tokens
        $tokens = $this->keycloakService->exchangeCodeForTokens($code, $state);
        if (!$tokens) {
            return $redirectToTenantLogin('Failed to authenticate. Please try again.');
        }

        // Extract user information from ID token
        $idToken = $tokens['id_token'] ?? null;
        if (!$idToken) {
            Log::error('Keycloak callback: Missing ID token', ['tenant_id' => $tenantId]);
            return $redirectToTenantLogin('Authentication failed. Please try again.');
        }

        $userInfo = $this->keycloakService->getUserInfoFromIdToken($idToken);
        if (!$userInfo) {
            // Fallback to userinfo endpoint
            $accessToken = $tokens['access_token'] ?? null;
            if ($accessToken) {
                $userInfo = $this->keycloakService->getUserInfo($accessToken);
            }
        }

        if (!$userInfo) {
            Log::error('Keycloak callback: Failed to get user information', ['tenant_id' => $tenantId]);
            return $redirectToTenantLogin('Failed to retrieve user information. Please try again.');
        }

        // Extract Keycloak user ID
        $keycloakUserId = $userInfo['sub'] ?? null;
        if (!$keycloakUserId) {
            Log::error('Keycloak callback: Missing Keycloak user ID', [
                'user_info' => $userInfo,
                'tenant_id' => $tenantId,
            ]);
            return $redirectToTenantLogin('Invalid user information. Please contact support.');
        }

        // STEP 2: Lookup central user by Keycloak user ID
        // We search ONLY by keycloak_user_id (not email) to ensure we get the correct user
        $centralUser = null;
        $userEmail = null;
        
        tenancy()->central(function () use (&$centralUser, &$userEmail, $keycloakUserId) {
            $centralUser = User::where('keycloak_user_id', $keycloakUserId)->first();
            if ($centralUser) {
                $userEmail = $centralUser->email;
            }
        });

        if (!$centralUser || !$userEmail) {
            Log::warning('Keycloak callback: User not found in central database', [
                'keycloak_user_id' => $keycloakUserId,
                'tenant_id' => $tenantId,
            ]);
            return $redirectToTenantLogin('User account not found. Please contact your administrator.');
        }

        // STEP 3: Verify user has access to THIS SPECIFIC tenant (from state parameter)
        // We do NOT search for all tenants the user belongs to
        // We ONLY verify if the user belongs to the tenant that initiated the login
        $hasTenantAccess = false;
        tenancy()->central(function () use (&$hasTenantAccess, $centralUser, $tenantId) {
            $hasTenantAccess = DB::table('tenant_user')
                ->where('user_id', $centralUser->id)
                ->where('tenant_id', $tenantId) // THIS specific tenant from state
                ->exists();
        });

        if (!$hasTenantAccess) {
            Log::warning('Keycloak callback: User does not have access to this specific tenant', [
                'user_id' => $centralUser->id,
                'email' => $userEmail,
                'tenant_id' => $tenantId,
                'note' => 'User attempted to login to tenant they do not belong to',
            ]);
            // Clear user-friendly error message explaining the issue
            return $redirectToTenantLogin('The WELLOVIS account you are logged in with does not have access to this practice. Please contact your administrator or log in with a different account.');
        }

        // STEP 4: Initialize tenancy for THIS SPECIFIC tenant (from state)
        // We authenticate the user for the tenant that initiated the login, not any other tenant
        if (!$tenant) {
            tenancy()->central(function () use (&$tenant, $tenantId) {
                $tenant = Tenant::find($tenantId);
            });
        }
        
        if (!$tenant) {
            Log::error('Keycloak callback: Tenant not found', ['tenant_id' => $tenantId]);
            return $redirectToTenantLogin('Tenant not found. Please contact support.');
        }
        
        // Initialize tenancy context for THIS specific tenant database
        tenancy()->initialize($tenant);
        
        // STEP 5: Find user in THIS tenant's database using email
        // User must already exist in this tenant's database (not created during login)
        $tenantUser = User::where('email', $userEmail)->first();

        if (!$tenantUser) {
            tenancy()->end(); // End tenancy before redirect
            Log::warning('Keycloak callback: User does not exist in tenant database', [
                'email' => $userEmail,
                'keycloak_user_id' => $keycloakUserId,
                'tenant_id' => $tenantId,
            ]);
            return $redirectToTenantLogin('Your account does not exist for this tenant. Please contact your administrator.');
        }

        // Update user information if needed (name sync from Keycloak)
        $name = trim(($userInfo['given_name'] ?? '') . ' ' . ($userInfo['family_name'] ?? '')) ?: ($userInfo['name'] ?? $centralUser->name ?? 'User');
        if ($tenantUser->name !== $name) {
            $tenantUser->name = $name;
            $tenantUser->save();
        }

        Log::info('Keycloak: Authenticated existing tenant user', [
            'user_id' => $tenantUser->id,
            'email' => $userEmail,
            'keycloak_user_id' => $keycloakUserId,
            'tenant_id' => $tenantId,
        ]);

        // STEP 6: Generate SSO code and redirect back to THIS SPECIFIC tenant
        // Sessions don't work across domains, so we use SecureSSOService for cross-domain authentication
        // We redirect back to the SAME tenant that initiated the login (from state parameter)
        
        // Get tenant domain for redirect (must be the tenant from state)
        if (!$tenantDomain) {
            tenancy()->end(); // End tenancy before redirect
            Log::error('Keycloak callback: Tenant domain not found', ['tenant_id' => $tenantId]);
            return redirect()->to(config('tenancy.central_domains')[0] ?? 'localhost')
                ->withErrors(['keycloak' => 'Tenant domain not configured. Please contact support.']);
        }
        
        // Generate SSO code for cross-domain authentication
        // This will authenticate the user on the tenant domain that initiated the login
        $ssoService = app(\App\Services\SecureSSOService::class);
        $ssoCode = $ssoService->generateSSOCode($centralUser, $tenant, '/dashboard');
        $ssoUrl = $ssoService->generateTenantSSOUrl($ssoCode, $tenant);
        
        Log::info('Keycloak: Generated SSO code for tenant authentication', [
            'user_id' => $centralUser->id,
            'email' => $userEmail,
            'tenant_id' => $tenantId,
            'tenant_domain' => $tenantDomain->domain,
            'sso_url' => $ssoUrl,
            'note' => 'Redirecting back to the tenant that initiated login',
        ]);

        // End tenancy before redirect (redirect will be handled on tenant domain)
        tenancy()->end();

        // Redirect to THIS SPECIFIC tenant domain via SSO
        // This is the tenant from which the login was originally initiated
        return redirect()->to($ssoUrl);
    }
}
