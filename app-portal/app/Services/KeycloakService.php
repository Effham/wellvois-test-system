<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class KeycloakService
{
    /**
     * Generate the authorization URL for Keycloak login.
     *
     * @param string|null $state Optional state parameter for CSRF protection
     * @return string
     */
    public function getAuthorizationUrl(?string $state = null, ?string $tenantId = null): string
    {
        // Generate state parameter and encode tenant ID if provided
        if (!$state) {
            $randomState = Str::random(32);
            // Encode tenant ID in state if provided (for app-portal tenant context)
            if ($tenantId) {
                // Store the random state in cache for validation (accessible across domains)
                // Cache key includes tenant ID to make it unique
                $cacheKey = "keycloak_state_{$tenantId}_{$randomState}";
                Cache::put($cacheKey, $randomState, now()->addMinutes(10)); // 10 minute expiry
                $state = base64_encode(json_encode(['state' => $randomState, 'tenant_id' => $tenantId]));
            } else {
                $state = $randomState;
                // Store in cache for validation (accessible across domains)
                $cacheKey = "keycloak_state_{$state}";
                Cache::put($cacheKey, $state, now()->addMinutes(10)); // 10 minute expiry
            }
        } else {
            // If state is provided, store it in cache for validation
            $cacheKey = "keycloak_state_{$state}";
            Cache::put($cacheKey, $state, now()->addMinutes(10));
        }

        // For app-portal (tenant context), use central domain redirect URI
        // For practitioner-portal (central), use configured redirect URI
        $redirectUri = config('keycloak.redirect_uri');
        if (tenancy()->initialized) {
            // We're in tenant context, use central domain for callback
            // This ensures Keycloak can redirect to a fixed URL
            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            $protocol = app()->environment('production') ? 'https' : 'http';
            $port = app()->environment('production') ? '' : ':8000';
            $redirectUri = "{$protocol}://{$centralDomain}{$port}/auth/keycloak/callback";
        }

        $params = [
            'client_id' => config('keycloak.client_id'),
            'redirect_uri' => $redirectUri,
            'response_type' => config('keycloak.response_type'),
            'scope' => implode(' ', config('keycloak.scopes')),
            'state' => $state,
        ];

        $authorizationEndpoint = config('keycloak.base_url') . '/realms/' . config('keycloak.realm') . '/protocol/openid-connect/auth';

        return $authorizationEndpoint . '?' . http_build_query($params);
    }

    /**
     * Exchange authorization code for access token and ID token.
     *
     * @param string $code Authorization code from Keycloak
     * @param string $state State parameter for CSRF validation
     * @return array|null Returns array with 'access_token', 'refresh_token', 'id_token', 'expires_in' or null on failure
     */
    public function exchangeCodeForTokens(string $code, string $state): ?array
    {
        // Validate state parameter
        // For app-portal, state is base64 encoded JSON with tenant_id
        // For practitioner-portal, state is plain random string
        $stateValid = false;
        $randomState = null;
        
        // Try to decode the state (might be encoded JSON for app-portal)
        try {
            $decodedState = json_decode(base64_decode($state), true);
            if (isset($decodedState['state']) && isset($decodedState['tenant_id'])) {
                // Encoded state with tenant_id (app-portal)
                $randomState = $decodedState['state'];
                $tenantId = $decodedState['tenant_id'];
                $cacheKey = "keycloak_state_{$tenantId}_{$randomState}";
                $cachedState = Cache::get($cacheKey);
                
                if ($cachedState && $cachedState === $randomState) {
                    $stateValid = true;
                    // Clear from cache after validation
                    Cache::forget($cacheKey);
                }
            }
        } catch (\Exception $e) {
            // Not encoded, treat as plain state (practitioner-portal)
            $cacheKey = "keycloak_state_{$state}";
            $cachedState = Cache::get($cacheKey);
            
            if ($cachedState && $cachedState === $state) {
                $stateValid = true;
                // Clear from cache after validation
                Cache::forget($cacheKey);
            }
        }
        
        if (!$stateValid) {
            Log::error('Keycloak: Invalid state parameter', [
                'received_state' => $state,
                'random_state' => $randomState,
            ]);
            return null;
        }

        // For app-portal, always use central domain redirect URI (callback is in web.php)
        // For practitioner-portal (central), use configured redirect URI
        $redirectUri = config('keycloak.redirect_uri');
        if (tenancy()->initialized) {
            // We're in tenant context, use central domain for callback
            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            $protocol = app()->environment('production') ? 'https' : 'http';
            $port = app()->environment('production') ? '' : ':8000';
            $redirectUri = "{$protocol}://{$centralDomain}{$port}/auth/keycloak/callback";
        }

        $tokenEndpoint = config('keycloak.base_url') . '/realms/' . config('keycloak.realm') . '/protocol/openid-connect/token';

        $response = Http::asForm()->post($tokenEndpoint, [
            'grant_type' => 'authorization_code',
            'client_id' => config('keycloak.client_id'),
            'client_secret' => config('keycloak.client_secret'),
            'code' => $code,
            'redirect_uri' => $redirectUri,
        ]);

        if (!$response->successful()) {
            Log::error('Keycloak: Failed to exchange code for tokens', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return null;
        }

        return $response->json();
    }

    /**
     * Get user information from ID token.
     *
     * @param string $idToken JWT ID token from Keycloak
     * @return array|null Returns decoded user information or null on failure
     */
    public function getUserInfoFromIdToken(string $idToken): ?array
    {
        // Decode JWT token (simple base64 decode, no signature verification for now)
        // In production, you should verify the token signature using JWKS
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            Log::error('Keycloak: Invalid ID token format');
            return null;
        }

        try {
            $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
            return $payload;
        } catch (\Exception $e) {
            Log::error('Keycloak: Failed to decode ID token', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Get user information from userinfo endpoint.
     *
     * @param string $accessToken Access token from Keycloak
     * @return array|null Returns user information or null on failure
     */
    public function getUserInfo(string $accessToken): ?array
    {
        $userinfoEndpoint = config('keycloak.base_url') . '/realms/' . config('keycloak.realm') . '/protocol/openid-connect/userinfo';

        $response = Http::withToken($accessToken)->get($userinfoEndpoint);

        if (!$response->successful()) {
            Log::error('Keycloak: Failed to get user info', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return null;
        }

        return $response->json();
    }

    /**
     * Refresh access token using refresh token.
     *
     * @param string $refreshToken Refresh token from Keycloak
     * @return array|null Returns new tokens or null on failure
     */
    public function refreshAccessToken(string $refreshToken): ?array
    {
        $tokenEndpoint = config('keycloak.base_url') . '/realms/' . config('keycloak.realm') . '/protocol/openid-connect/token';

        $response = Http::asForm()->post($tokenEndpoint, [
            'grant_type' => 'refresh_token',
            'client_id' => config('keycloak.client_id'),
            'client_secret' => config('keycloak.client_secret'),
            'refresh_token' => $refreshToken,
        ]);

        if (!$response->successful()) {
            Log::error('Keycloak: Failed to refresh token', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return null;
        }

        return $response->json();
    }

    /**
     * Get admin access token for Admin API operations.
     *
     * @return string|null Returns admin access token or null on failure
     */
    public function getAdminAccessToken(): ?string
    {
        $tokenEndpoint = config('keycloak.base_url') . '/realms/master/protocol/openid-connect/token';

        $response = Http::asForm()->post($tokenEndpoint, [
            'grant_type' => 'password',
            'client_id' => config('keycloak.admin_api.admin_client_id'),
            'client_secret' => config('keycloak.admin_api.admin_client_secret'),
            'username' => config('keycloak.admin_api.admin_username'),
            'password' => config('keycloak.admin_api.admin_password'),
        ]);

        if (!$response->successful()) {
            Log::error('Keycloak: Failed to get admin access token', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return null;
        }

        $data = $response->json();
        return $data['access_token'] ?? null;
    }
}

