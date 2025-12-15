<?php

namespace App\Http\Controllers;

use App\Services\KeycloakService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;

class KeycloakUserController extends Controller
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    /**
     * Get current Keycloak user information.
     * Used to check if user is logged into Keycloak and get user details.
     * 
     * This method checks for Keycloak session in two ways:
     * 1. First checks if we have a stored access token in Laravel session
     * 2. If no token, attempts to check Keycloak's session status via account endpoint
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getUserInfo(Request $request): JsonResponse
    {
        // Check if user has Keycloak access token in Laravel session
        // This token is stored after successful Keycloak OAuth login via SSO
        $accessToken = session('keycloak_access_token');
        
        $tenantId = null;
        if (tenancy()->initialized) {
            $tenantId = tenant('id');
        }
        
        Log::info('KeycloakUserController::getUserInfo called', [
            'has_access_token' => !empty($accessToken),
            'tenant_id' => $tenantId,
            'user_id' => \Illuminate\Support\Facades\Auth::id(),
            'session_id' => session()->getId(),
        ]);
        
        if ($accessToken) {
            try {
                // Verify token is still valid by calling userinfo endpoint
                $userInfo = $this->keycloakService->getUserInfo($accessToken);
                
                if ($userInfo) {
                    // Build Keycloak account management URL
                    $accountManagementUrl = config('keycloak.base_url') 
                        . '/realms/' . config('keycloak.realm') 
                        . '/account';

                    Log::info('KeycloakUserController: Valid Keycloak session found', [
                        'user_email' => $userInfo['email'] ?? null,
                        'keycloak_user_id' => $userInfo['sub'] ?? null,
                        'tenant_id' => $tenantId,
                    ]);

                    return response()->json([
                        'logged_in' => true,
                        'user' => [
                            'name' => trim(($userInfo['given_name'] ?? '') . ' ' . ($userInfo['family_name'] ?? '')) ?: ($userInfo['name'] ?? 'User'),
                            'email' => $userInfo['email'] ?? null,
                            'keycloak_user_id' => $userInfo['sub'] ?? null,
                        ],
                        'account_management_url' => $accountManagementUrl,
                    ]);
                } else {
                    // Token expired or invalid, clear session
                    Log::warning('KeycloakUserController: Token validation failed, clearing session', [
                        'tenant_id' => $tenantId,
                    ]);
                    session()->forget('keycloak_access_token');
                    session()->forget('keycloak_refresh_token');
                }
            } catch (\Exception $e) {
                Log::error('KeycloakUserController: Error validating token', [
                    'error' => $e->getMessage(),
                    'tenant_id' => $tenantId,
                ]);
                // Clear invalid token from session
                session()->forget('keycloak_access_token');
                session()->forget('keycloak_refresh_token');
            }
        } else {
            Log::info('KeycloakUserController: No access token in session', [
                'tenant_id' => $tenantId,
                'session_keys' => array_keys(session()->all()),
            ]);
        }

        // If no Laravel token, we cannot check Keycloak session server-side
        // Keycloak maintains its own session independently
        // The frontend component will handle checking by attempting OAuth flow
        
        return response()->json([
            'logged_in' => false,
            'message' => 'No active Keycloak session found',
            'has_laravel_token' => !empty($accessToken),
        ]);
    }

    /**
     * Handle Keycloak logout callback.
     * This route is called by Keycloak after logout.
     *
     * @param Request $request
     * @return \Illuminate\Http\RedirectResponse|\Inertia\Response
     */
    public function loggedOut(Request $request)
    {
        Log::info('Keycloak logout callback received', [
            'domain' => $request->getHost(),
            'path' => $request->path(),
            'full_url' => $request->fullUrl(),
            'from_param' => $request->get('from'),
            'tenant_initialized' => tenancy()->initialized,
            'tenant_id' => tenancy()->initialized ? tenant('id') : null,
            'route_name' => $request->route()?->getName(),
        ]);

        // Clear Keycloak tokens from session
        session()->forget('keycloak_access_token');
        session()->forget('keycloak_refresh_token');
        session()->forget('keycloak_state');

        // Logout Laravel user if authenticated
        if (\Illuminate\Support\Facades\Auth::check()) {
            \Illuminate\Support\Facades\Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        // Check if we have a 'from' parameter indicating the original tenant domain
        $fromOrigin = $request->get('from');
        
        if ($fromOrigin) {
            try {
                $fromUrl = parse_url($fromOrigin);
                $fromHost = $fromUrl['host'] ?? null;
                
                if ($fromHost) {
                    // Check if this is a tenant domain
                    $centralDomains = config('tenancy.central_domains', []);
                    
                    if (!in_array($fromHost, $centralDomains)) {
                        // This is a tenant domain, redirect to tenant login
                        $protocol = app()->environment('production') ? 'https' : 'http';
                        $port = app()->environment('production') ? '' : ':8000';
                        
                        Log::info('Keycloak logout: Redirecting to tenant login', [
                            'from_host' => $fromHost,
                            'redirect_url' => "{$protocol}://{$fromHost}{$port}/login",
                        ]);
                        
                        return redirect()->to("{$protocol}://{$fromHost}{$port}/login")
                            ->with('status', 'You have been logged out successfully.');
                    }
                }
            } catch (\Exception $e) {
                Log::warning('Keycloak logout: Error parsing from parameter', [
                    'from' => $fromOrigin,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // If this is an Inertia request, return Inertia response
        if ($request->header('X-Inertia')) {
            return \Inertia\Inertia::location(route('login'));
        }

        // Redirect to login page
        // For app-portal, if we're on a tenant domain, redirect to that tenant's login page
        // Otherwise, redirect to central domain login
        if (tenancy()->initialized) {
            $tenantId = tenant('id');
            $protocol = app()->environment('production') ? 'https' : 'http';
            $port = app()->environment('production') ? '' : ':8000';
            
            // Get tenant domain
            $tenantDomain = tenancy()->central(function () use ($tenantId) {
                $tenant = \App\Models\Tenant::find($tenantId);
                return $tenant ? $tenant->domains()->first() : null;
            });
            
            if ($tenantDomain) {
                return redirect()->to("{$protocol}://{$tenantDomain->domain}{$port}/login")
                    ->with('status', 'You have been logged out successfully.');
            }
        }
        
        // Fallback to central domain login
        $loginUrl = config('tenancy.central_domains')[0] ?? 'localhost';
        $protocol = app()->environment('production') ? 'https' : 'http';
        $port = app()->environment('production') ? '' : ':8000';
        
        return redirect()->to("{$protocol}://{$loginUrl}{$port}/login")
            ->with('status', 'You have been logged out successfully.');
    }
}

