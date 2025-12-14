<?php

namespace App\Http\Middleware;

use App\Services\KeycloakService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class CheckKeycloakSession
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    /**
     * Handle an incoming request.
     * Check if user has valid Keycloak session. If not, log them out.
     * Only checks on full page loads (not AJAX requests) to avoid performance issues.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Skip check for logout callback route (user is already logging out)
        if ($request->routeIs('keycloak.logged-out') || $request->path() === 'logged-out') {
            return $next($request);
        }

        // Skip check for login routes to avoid redirect loops
        if ($request->routeIs('login') || $request->routeIs('keycloak.login')) {
            return $next($request);
        }

        // Only check on full page loads (not AJAX/Inertia requests) to avoid performance issues
        // Skip check for AJAX requests, API calls, and Inertia requests
        if ($request->expectsJson() || $request->header('X-Inertia') || $request->header('X-Requested-With') === 'XMLHttpRequest') {
            return $next($request);
        }

        // Only check if user is authenticated
        if (!Auth::check()) {
            return $next($request);
        }

        $user = Auth::user();
        
        // Check if user logged in via Keycloak (has keycloak_user_id)
        // We need to check in central database since keycloak_user_id is stored there
        $hasKeycloakUserId = false;
        $userEmail = $user->email;
        
        try {
            tenancy()->central(function () use (&$hasKeycloakUserId, $userEmail) {
                $centralUser = \App\Models\User::where('email', $userEmail)->first();
                $hasKeycloakUserId = $centralUser && !empty($centralUser->keycloak_user_id);
            });
        } catch (\Exception $e) {
            Log::warning('CheckKeycloakSession: Error checking central user', [
                'error' => $e->getMessage(),
                'user_id' => $user->id,
            ]);
            // If we can't check, continue with request (don't block)
            return $next($request);
        }

        // If user logged in via Keycloak, they MUST have a valid Keycloak session
        if ($hasKeycloakUserId) {
            $accessToken = session('keycloak_access_token');
            
            // If no access token, user's Keycloak session is gone - log them out
            if (!$accessToken) {
                Log::info('Keycloak user has no access token, logging out Laravel session', [
                    'user_id' => $user->id,
                    'email' => $userEmail,
                ]);
                
                session()->forget('keycloak_access_token');
                session()->forget('keycloak_refresh_token');
                session()->forget('keycloak_state');
                
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
                
                // Determine redirect URL based on tenant context
                $loginRoute = 'login';
                if (tenancy()->initialized) {
                    $tenantId = tenant('id');
                    $protocol = app()->environment('production') ? 'https' : 'http';
                    $port = app()->environment('production') ? '' : ':8000';
                    
                    $tenantDomain = tenancy()->central(function () use ($tenantId) {
                        $tenant = \App\Models\Tenant::find($tenantId);
                        return $tenant ? $tenant->domains()->first() : null;
                    });
                    
                    if ($tenantDomain) {
                        return redirect()->to("{$protocol}://{$tenantDomain->domain}{$port}/login")
                            ->with('status', 'Your Keycloak session has expired. Please log in again.');
                    }
                }
                
                return redirect()->route($loginRoute)
                    ->with('status', 'Your Keycloak session has expired. Please log in again.');
            }
            
            // Verify token is still valid by calling userinfo endpoint
            // This is a lightweight check that happens only on page refresh
            try {
                $userInfo = $this->keycloakService->getUserInfo($accessToken);
                
                if (!$userInfo) {
                    // Token expired or invalid, clear session and log out
                    Log::info('Keycloak session expired, logging out user', [
                        'user_id' => $user->id,
                        'email' => $userEmail,
                    ]);
                    
                    session()->forget('keycloak_access_token');
                    session()->forget('keycloak_refresh_token');
                    session()->forget('keycloak_state');
                    
                    Auth::logout();
                    $request->session()->invalidate();
                    $request->session()->regenerateToken();
                    
                    // Determine redirect URL based on tenant context
                    $loginRoute = 'login';
                    if (tenancy()->initialized) {
                        $tenantId = tenant('id');
                        $protocol = app()->environment('production') ? 'https' : 'http';
                        $port = app()->environment('production') ? '' : ':8000';
                        
                        $tenantDomain = tenancy()->central(function () use ($tenantId) {
                            $tenant = \App\Models\Tenant::find($tenantId);
                            return $tenant ? $tenant->domains()->first() : null;
                        });
                        
                        if ($tenantDomain) {
                            return redirect()->to("{$protocol}://{$tenantDomain->domain}{$port}/login")
                                ->with('status', 'Your Keycloak session has expired. Please log in again.');
                        }
                    }
                    
                    return redirect()->route($loginRoute)
                        ->with('status', 'Your Keycloak session has expired. Please log in again.');
                }
            } catch (\Exception $e) {
                // If check fails, don't log out - might be temporary network issue
                // Log the error but continue with request
                Log::warning('Keycloak session check failed', [
                    'user_id' => $user->id,
                    'email' => $userEmail,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $next($request);
    }
}
