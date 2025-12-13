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
     * @return RedirectResponse
     */
    public function redirect(): RedirectResponse
    {
        // Get current tenant ID (if in tenant context)
        $tenantId = tenant('id');
        
        // Pass tenant ID to KeycloakService to encode in state parameter
        // This allows callback (on central domain) to know which tenant to authenticate for
        $authorizationUrl = $this->keycloakService->getAuthorizationUrl(null, $tenantId);
        return redirect($authorizationUrl);
    }

    /**
     * Handle Keycloak callback after authentication.
     * This method performs central->tenant user lookup and tenant access verification.
     *
     * @param Request $request
     * @return RedirectResponse
     */
    public function callback(Request $request): RedirectResponse
    {
        // Extract tenant ID from state parameter (encoded during redirect)
        $state = $request->get('state');
        $tenantId = null;
        
        if ($state) {
            try {
                $decodedState = json_decode(base64_decode($state), true);
                if (isset($decodedState['tenant_id'])) {
                    $tenantId = $decodedState['tenant_id'];
                }
            } catch (\Exception $e) {
                // State might be plain (for non-tenant contexts), that's okay
                Log::debug('Keycloak callback: Could not decode tenant ID from state', [
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        if (!$tenantId) {
            Log::error('Keycloak callback: Missing tenant ID in state parameter');
            // Redirect to a generic error page or central login
            return redirect()->to(config('tenancy.central_domains')[0] ?? 'localhost')
                ->withErrors(['keycloak' => 'Invalid authentication request. Please try again from your tenant login page.']);
        }

        // Get tenant and domain early for error redirects
        $tenant = null;
        $tenantDomain = null;
        tenancy()->central(function () use (&$tenant, &$tenantDomain, $tenantId) {
            $tenant = Tenant::find($tenantId);
            if ($tenant) {
                $tenantDomain = $tenant->domains()->first();
            }
        });

        // Helper function to redirect to tenant login page
        $redirectToTenantLogin = function ($errorMessage) use ($tenantDomain) {
            if ($tenantDomain) {
                $protocol = app()->environment('production') ? 'https' : 'http';
                $port = app()->environment('production') ? '' : ':8000';
                $tenantLoginUrl = "{$protocol}://{$tenantDomain->domain}{$port}/login";
                return redirect()->to($tenantLoginUrl)->withErrors(['keycloak' => $errorMessage]);
            }
            // Fallback to central domain if tenant domain not found
            return redirect()->to(config('tenancy.central_domains')[0] ?? 'localhost')
                ->withErrors(['keycloak' => $errorMessage]);
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

        // STEP 1: Check Keycloak user ID in CENTRAL database
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

        // STEP 2: Verify user has access to this tenant via tenant_user table
        $hasTenantAccess = false;
        tenancy()->central(function () use (&$hasTenantAccess, $centralUser, $tenantId) {
            $hasTenantAccess = DB::table('tenant_user')
                ->where('user_id', $centralUser->id)
                ->where('tenant_id', $tenantId)
                ->exists();
        });

        if (!$hasTenantAccess) {
            Log::warning('Keycloak callback: User does not have access to tenant', [
                'user_id' => $centralUser->id,
                'email' => $userEmail,
                'tenant_id' => $tenantId,
            ]);
            return $redirectToTenantLogin('You do not have access to this tenant. Please contact your administrator.');
        }

        // STEP 3: Initialize tenancy and find user in TENANT database
        if (!$tenant) {
            tenancy()->central(function () use (&$tenant, $tenantId) {
                $tenant = Tenant::find($tenantId);
            });
        }
        
        if (!$tenant) {
            Log::error('Keycloak callback: Tenant not found', ['tenant_id' => $tenantId]);
            return $redirectToTenantLogin('Tenant not found. Please contact support.');
        }
        
        // Initialize tenancy to access tenant database
        tenancy()->initialize($tenant);
        
        // Find user in TENANT database using email (user must already exist)
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

        // STEP 4: Use SSO flow to authenticate user on tenant domain
        // Sessions don't work across domains, so we use SecureSSOService
        // The SSO flow will authenticate the user on the tenant domain
        
        // Store Keycloak tokens temporarily (they'll be available after SSO completes)
        // Note: These will need to be stored in a way accessible after SSO if needed

        // Get tenant domain for redirect
        if (!$tenantDomain) {
            tenancy()->end(); // End tenancy before redirect
            Log::error('Keycloak callback: Tenant domain not found', ['tenant_id' => $tenantId]);
            return redirect()->to(config('tenancy.central_domains')[0] ?? 'localhost')
                ->withErrors(['keycloak' => 'Tenant domain not configured. Please contact support.']);
        }
        
        // Generate SSO code for cross-domain authentication
        $ssoService = app(\App\Services\SecureSSOService::class);
        $ssoCode = $ssoService->generateSSOCode($centralUser, $tenant, '/dashboard');
        $ssoUrl = $ssoService->generateTenantSSOUrl($ssoCode, $tenant);
        
        Log::info('Keycloak: Generated SSO code for tenant authentication', [
            'user_id' => $centralUser->id,
            'email' => $userEmail,
            'tenant_id' => $tenantId,
            'sso_url' => $ssoUrl,
        ]);

        // End tenancy before redirect (redirect will be handled on tenant domain)
        tenancy()->end();

        // Redirect to tenant domain via SSO
        return redirect()->to($ssoUrl);
    }
}
