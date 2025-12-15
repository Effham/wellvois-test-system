<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class KeycloakUserService
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    /**
     * Create a new user in Keycloak.
     *
     * @param string $email User email
     * @param string $firstName User first name
     * @param string $lastName User last name
     * @param string|null $temporaryPassword Temporary password (user will be required to change)
     * @param bool $emailVerified Whether email is verified
     * @return string|null Returns Keycloak user ID or null on failure
     */
    public function createUser(
        string $email,
        string $firstName,
        string $lastName,
        ?string $temporaryPassword = null,
        bool $emailVerified = true
    ): ?string {
        $adminToken = $this->keycloakService->getAdminAccessToken();
        if (!$adminToken) {
            Log::error('KeycloakUserService: Failed to get admin token');
            return null;
        }

        $usersEndpoint = config('keycloak.base_url') . '/admin/realms/' . config('keycloak.realm') . '/users';

        $userData = [
            'username' => $email,
            'email' => $email,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'enabled' => true,
            'emailVerified' => $emailVerified,
            'credentials' => [],
        ];

        // Add temporary password if provided
        if ($temporaryPassword) {
            $userData['credentials'][] = [
                'type' => 'password',
                'value' => $temporaryPassword,
                'temporary' => true, // User must change password on first login
            ];
        }

        $response = Http::withToken($adminToken)
            ->post($usersEndpoint, $userData);

        if (!$response->successful()) {
            Log::error('KeycloakUserService: Failed to create user', [
                'status' => $response->status(),
                'body' => $response->body(),
                'email' => $email,
            ]);
            return null;
        }

        // Extract user ID from Location header
        $location = $response->header('Location');
        if ($location) {
            $userId = basename($location);
            Log::info('KeycloakUserService: User created successfully', [
                'email' => $email,
                'keycloak_user_id' => $userId,
            ]);
            return $userId;
        }

        // Fallback: try to find user by email
        return $this->findUserByEmail($email, $adminToken);
    }

    /**
     * Find user by email in Keycloak.
     *
     * @param string $email User email
     * @param string|null $adminToken Admin access token (optional, will be fetched if not provided)
     * @return string|null Returns Keycloak user ID or null if not found
     */
    public function findUserByEmail(string $email, ?string $adminToken = null): ?string
    {
        $adminToken = $adminToken ?? $this->keycloakService->getAdminAccessToken();
        if (!$adminToken) {
            return null;
        }

        $usersEndpoint = config('keycloak.base_url') . '/admin/realms/' . config('keycloak.realm') . '/users';
        
        $response = Http::withToken($adminToken)
            ->get($usersEndpoint, [
                'email' => $email,
                'exact' => true,
            ]);

        if (!$response->successful() || empty($response->json())) {
            return null;
        }

        $users = $response->json();
        return $users[0]['id'] ?? null;
    }

    /**
     * Set password for a Keycloak user.
     *
     * @param string $keycloakUserId Keycloak user ID
     * @param string $password New password
     * @param bool $temporary Whether password is temporary (user must change on next login)
     * @return bool Returns true on success, false on failure
     */
    public function setPassword(string $keycloakUserId, string $password, bool $temporary = false): bool
    {
        $adminToken = $this->keycloakService->getAdminAccessToken();
        if (!$adminToken) {
            return false;
        }

        $passwordEndpoint = config('keycloak.base_url') . '/admin/realms/' . config('keycloak.realm') . '/users/' . $keycloakUserId . '/reset-password';

        $response = Http::withToken($adminToken)
            ->put($passwordEndpoint, [
                'type' => 'password',
                'value' => $password,
                'temporary' => $temporary,
            ]);

        if (!$response->successful()) {
            Log::error('KeycloakUserService: Failed to set password', [
                'status' => $response->status(),
                'body' => $response->body(),
                'keycloak_user_id' => $keycloakUserId,
            ]);
            return false;
        }

        return true;
    }

    /**
     * Send password reset email to Keycloak user.
     *
     * @param string $keycloakUserId Keycloak user ID
     * @return bool Returns true on success, false on failure
     */
    public function sendPasswordResetEmail(string $keycloakUserId): bool
    {
        $adminToken = $this->keycloakService->getAdminAccessToken();
        if (!$adminToken) {
            return false;
        }

        $resetPasswordEndpoint = config('keycloak.base_url') . '/admin/realms/' . config('keycloak.realm') . '/users/' . $keycloakUserId . '/execute-actions-email';

        $response = Http::withToken($adminToken)
            ->put($resetPasswordEndpoint, [
                'UPDATE_PASSWORD',
            ]);

        if (!$response->successful()) {
            Log::error('KeycloakUserService: Failed to send password reset email', [
                'status' => $response->status(),
                'body' => $response->body(),
                'keycloak_user_id' => $keycloakUserId,
            ]);
            return false;
        }

        return true;
    }

    /**
     * Update user information in Keycloak.
     *
     * @param string $keycloakUserId Keycloak user ID
     * @param array $userData User data to update (email, firstName, lastName, etc.)
     * @return bool Returns true on success, false on failure
     */
    public function updateUser(string $keycloakUserId, array $userData): bool
    {
        $adminToken = $this->keycloakService->getAdminAccessToken();
        if (!$adminToken) {
            return false;
        }

        $userEndpoint = config('keycloak.base_url') . '/admin/realms/' . config('keycloak.realm') . '/users/' . $keycloakUserId;

        $response = Http::withToken($adminToken)
            ->put($userEndpoint, $userData);

        if (!$response->successful()) {
            Log::error('KeycloakUserService: Failed to update user', [
                'status' => $response->status(),
                'body' => $response->body(),
                'keycloak_user_id' => $keycloakUserId,
            ]);
            return false;
        }

        return true;
    }

    /**
     * Delete user from Keycloak.
     *
     * @param string $keycloakUserId Keycloak user ID
     * @return bool Returns true on success, false on failure
     */
    public function deleteUser(string $keycloakUserId): bool
    {
        $adminToken = $this->keycloakService->getAdminAccessToken();
        if (!$adminToken) {
            return false;
        }

        $userEndpoint = config('keycloak.base_url') . '/admin/realms/' . config('keycloak.realm') . '/users/' . $keycloakUserId;

        $response = Http::withToken($adminToken)
            ->delete($userEndpoint);

        if (!$response->successful()) {
            Log::error('KeycloakUserService: Failed to delete user', [
                'status' => $response->status(),
                'body' => $response->body(),
                'keycloak_user_id' => $keycloakUserId,
            ]);
            return false;
        }

        return true;
    }
}



