<?php

namespace App\Services;

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
    public function getAuthorizationUrl(?string $state = null): string
    {
        $state = $state ?? Str::random(40);
        session(['keycloak_state' => $state]);

        $params = [
            'client_id' => config('keycloak.client_id'),
            'redirect_uri' => config('keycloak.redirect_uri'),
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
        $sessionState = session('keycloak_state');
        if (!$sessionState || $sessionState !== $state) {
            Log::error('Keycloak: Invalid state parameter', [
                'session_state' => $sessionState,
                'received_state' => $state,
            ]);
            return null;
        }

        // Clear state from session
        session()->forget('keycloak_state');

        $tokenEndpoint = config('keycloak.base_url') . '/realms/' . config('keycloak.realm') . '/protocol/openid-connect/token';

        $response = Http::asForm()->post($tokenEndpoint, [
            'grant_type' => 'authorization_code',
            'client_id' => config('keycloak.client_id'),
            'client_secret' => config('keycloak.client_secret'),
            'code' => $code,
            'redirect_uri' => config('keycloak.redirect_uri'),
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



