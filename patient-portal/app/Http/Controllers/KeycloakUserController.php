<?php

namespace App\Http\Controllers;

use App\Services\KeycloakService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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
     * @param Request $request
     * @return JsonResponse
     */
    public function getUserInfo(Request $request): JsonResponse
    {
        // Check if user has Keycloak access token in Laravel session
        $accessToken = session('keycloak_access_token');
        
        Log::info('KeycloakUserController::getUserInfo called', [
            'has_access_token' => !empty($accessToken),
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
                    Log::warning('KeycloakUserController: Token validation failed, clearing session');
                    session()->forget('keycloak_access_token');
                    session()->forget('keycloak_refresh_token');
                }
            } catch (\Exception $e) {
                Log::error('KeycloakUserController: Error validating token', [
                    'error' => $e->getMessage(),
                ]);
                // Clear invalid token from session
                session()->forget('keycloak_access_token');
                session()->forget('keycloak_refresh_token');
            }
        } else {
            Log::info('KeycloakUserController: No access token in session', [
                'session_keys' => array_keys(session()->all()),
            ]);
        }
        
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

        // If this is an Inertia request, return Inertia response
        if ($request->header('X-Inertia')) {
            return \Inertia\Inertia::location(route('login.patient'));
        }

        // Redirect to patient login page
        return redirect()->route('login.patient')
            ->with('status', 'You have been logged out successfully.');
    }
}


