<?php

namespace App\Services;

use App\Models\UserIntegration;
use Exception;
use Google\Client;
use Google\Service\Calendar;
use Illuminate\Support\Facades\Log;

class GoogleCalendarOAuthService
{
    protected $client;

    protected $userIntegration;

    public function __construct()
    {
        $this->client = new Client;
        $this->configureClient();
    }

    /**
     * Configure the Google Client
     */
    protected function configureClient()
    {
        // Use the credentials from config (which has the array directly embedded)
        $credentials = config('google-calendar.auth_profiles.oauth.credentials_json');

        if (! $credentials) {
            throw new Exception('Google Calendar OAuth credentials not found in config.');
        }

        // Configure client with credentials array
        $this->client->setAuthConfig($credentials);

        // Common configuration - limited to read and create events only
        $this->client->addScope(Calendar::CALENDAR_READONLY);
        $this->client->addScope(Calendar::CALENDAR_EVENTS);
        $this->client->setAccessType('offline');
        $this->client->setPrompt('select_account consent');
    }

    /**
     * Get the authorization URL for OAuth flow
     */
    public function getAuthorizationUrl(int $userId): string
    {
        // Store user_id and return URL in state parameter
        $currentRequest = request();
        $originalUrl = $currentRequest->getSchemeAndHttpHost();

        $state = base64_encode(json_encode([
            'user_id' => $userId,
            'return_url' => $originalUrl.'/integrations',
        ]));

        $this->client->setState($state);

        return $this->client->createAuthUrl();
    }

    /**
     * Handle the OAuth callback and store the integration
     */
    public function handleCallback(string $code, string $state): UserIntegration
    {
        try {
            // Decode state to get user ID
            $stateData = json_decode(base64_decode($state), true);
            $userId = $stateData['user_id'] ?? null;

            if (! $userId) {
                throw new Exception('Invalid state parameter');
            }

            // Exchange code for access token
            $token = $this->client->fetchAccessTokenWithAuthCode($code);

            if (isset($token['error'])) {
                throw new Exception('OAuth error: '.$token['error_description']);
            }

            // Set access token to get user info
            $this->client->setAccessToken($token);

            // Get calendar info to verify access
            $calendarService = new Calendar($this->client);
            $calendars = $calendarService->calendarList->listCalendarList();

            // Find primary calendar
            $primaryCalendar = null;
            foreach ($calendars->getItems() as $calendar) {
                if ($calendar->getPrimary()) {
                    $primaryCalendar = $calendar;
                    break;
                }
            }

            if (! $primaryCalendar) {
                throw new Exception('No primary calendar found');
            }

            // Store the integration
            $userIntegration = UserIntegration::updateOrCreate(
                [
                    'user_id' => $userId,
                    'provider' => UserIntegration::PROVIDER_GOOGLE,
                ],
                [
                    'name' => 'Google Calendar',
                    'type' => UserIntegration::TYPE_CALENDAR,
                    'is_active' => true,
                    'is_configured' => true,
                    'status' => UserIntegration::STATUS_ACTIVE,
                    'description' => 'Sync your personal appointments with Google Calendar',
                    'icon_url' => null,
                    'color' => '#4285F4',
                    'credentials' => [
                        'access_token' => $token['access_token'],
                        'refresh_token' => $token['refresh_token'] ?? null,
                        'expires_in' => $token['expires_in'] ?? 3600,
                        'created' => time(),
                        'calendar_id' => $primaryCalendar->getId(),
                        'calendar_name' => $primaryCalendar->getSummary(),
                    ],
                    'response_data' => [
                        'calendar_info' => [
                            'id' => $primaryCalendar->getId(),
                            'name' => $primaryCalendar->getSummary(),
                            'description' => $primaryCalendar->getDescription(),
                            'timezone' => $primaryCalendar->getTimeZone(),
                        ],
                        'oauth_token' => array_merge($token, ['created' => time()]),
                    ],
                    'last_sync_at' => now(),
                    'last_error' => null,
                ]
            );

            Log::info('Google Calendar OAuth integration successful', [
                'user_id' => $userId,
                'integration_id' => $userIntegration->id,
            ]);

            return $userIntegration;

        } catch (Exception $e) {
            Log::error('Google Calendar OAuth integration failed', [
                'error' => $e->getMessage(),
                'code' => $code,
                'state' => $state,
            ]);

            throw $e;
        }
    }

    /**
     * Get available calendars for the user
     */
    public function getAvailableCalendars(UserIntegration $userIntegration): array
    {
        $credentials = $userIntegration->credentials;
        $this->client->setAccessToken($credentials);

        $calendarService = new Calendar($this->client);
        $calendars = $calendarService->calendarList->listCalendarList();

        $result = [];
        foreach ($calendars->getItems() as $calendar) {
            $result[] = [
                'id' => $calendar->getId(),
                'name' => $calendar->getSummary(),
                'description' => $calendar->getDescription(),
                'primary' => $calendar->getPrimary(),
                'timezone' => $calendar->getTimeZone(),
                'access_role' => $calendar->getAccessRole(),
            ];
        }

        return $result;
    }

    /**
     * Automatically refresh access token using refresh token (silent renewal)
     */
    public function refreshAccessToken(UserIntegration $userIntegration): bool
    {
        try {
            $credentials = $userIntegration->credentials;

            if (! $credentials || ! isset($credentials['refresh_token'])) {
                throw new Exception('No refresh token available for silent renewal');
            }

            // Check if token is actually expired
            $tokenExpiryTime = ($credentials['created'] ?? time()) + ($credentials['expires_in'] ?? 3600);
            $currentTime = time();

            // Add 5 minute buffer to refresh before actual expiry
            if ($currentTime < ($tokenExpiryTime - 300)) {
                Log::info('🔄 Access token still valid, no refresh needed', [
                    'user_integration_id' => $userIntegration->id,
                    'expires_at' => date('Y-m-d H:i:s', $tokenExpiryTime),
                    'current_time' => date('Y-m-d H:i:s', $currentTime),
                ]);

                return true; // Token still valid
            }

            Log::info('🔄 Attempting silent token refresh', [
                'user_integration_id' => $userIntegration->id,
                'user_id' => $userIntegration->user_id,
                'token_expired_at' => date('Y-m-d H:i:s', $tokenExpiryTime),
            ]);

            // Set the refresh token
            $this->client->setAccessToken([
                'refresh_token' => $credentials['refresh_token'],
            ]);

            // Refresh the access token
            $newToken = $this->client->fetchAccessTokenWithRefreshToken($credentials['refresh_token']);

            if (isset($newToken['error'])) {
                throw new Exception('Token refresh failed: '.($newToken['error_description'] ?? $newToken['error']));
            }

            // Update stored credentials with new access token
            $updatedCredentials = array_merge($credentials, [
                'access_token' => $newToken['access_token'],
                'expires_in' => $newToken['expires_in'] ?? 3600,
                'created' => time(),
                // Keep the refresh token (it may or may not be renewed)
                'refresh_token' => $newToken['refresh_token'] ?? $credentials['refresh_token'],
            ]);

            $userIntegration->update([
                'credentials' => $updatedCredentials,
                'last_sync_at' => now(),
                'last_error' => null,
                'status' => UserIntegration::STATUS_ACTIVE,
            ]);

            Log::info('✅ Google Calendar token refreshed successfully', [
                'user_integration_id' => $userIntegration->id,
                'user_id' => $userIntegration->user_id,
                'new_expires_at' => date('Y-m-d H:i:s', time() + ($newToken['expires_in'] ?? 3600)),
                'message' => 'Silent token renewal completed - user was not interrupted',
            ]);

            return true;

        } catch (Exception $e) {
            Log::error('❌ Silent token refresh failed', [
                'user_integration_id' => $userIntegration->id,
                'user_id' => $userIntegration->user_id,
                'error' => $e->getMessage(),
                'message' => 'User will need to manually reconnect Google Calendar',
            ]);

            // Mark integration as needing reconnection
            $userIntegration->update([
                'status' => UserIntegration::STATUS_ERROR,
                'last_error' => 'Token refresh failed: '.$e->getMessage().'. Please reconnect your Google Calendar.',
            ]);

            return false;
        }
    }

    /**
     * Get a valid access token, refreshing automatically if needed
     */
    public function getValidAccessToken(UserIntegration $userIntegration): ?string
    {
        // First try to refresh the token silently
        if (! $this->refreshAccessToken($userIntegration)) {
            return null; // Refresh failed, user needs to reconnect
        }

        // Reload the integration to get updated credentials
        $userIntegration->refresh();
        $credentials = $userIntegration->credentials;

        return $credentials['access_token'] ?? null;
    }

    /**
     * Disconnect the Google Calendar integration
     */
    public function disconnect(UserIntegration $userIntegration): bool
    {
        try {
            $credentials = $userIntegration->credentials;

            // Revoke the token if possible
            if ($credentials && isset($credentials['access_token'])) {
                try {
                    $this->client->setAccessToken($credentials);
                    $this->client->revokeToken($credentials['access_token']);

                    Log::info('🔌 Google Calendar token revoked successfully', [
                        'user_integration_id' => $userIntegration->id,
                    ]);
                } catch (Exception $e) {
                    // Log but don't fail the disconnect process
                    Log::warning('⚠️ Failed to revoke Google Calendar token (continuing with disconnect)', [
                        'user_integration_id' => $userIntegration->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Update integration status
            $userIntegration->update([
                'is_active' => false,
                'is_configured' => false,
                'status' => UserIntegration::STATUS_INACTIVE,
                'credentials' => null,
                'response_data' => null,
                'last_error' => null,
                'last_sync_at' => null,
            ]);

            Log::info('✅ Google Calendar integration disconnected successfully', [
                'user_integration_id' => $userIntegration->id,
                'user_id' => $userIntegration->user_id,
                'message' => 'Integration disabled and credentials cleared',
            ]);

            return true;

        } catch (Exception $e) {
            Log::error('❌ Google Calendar disconnect failed', [
                'user_integration_id' => $userIntegration->id,
                'error' => $e->getMessage(),
            ]);

            // Still update the integration to inactive state
            $userIntegration->update([
                'is_active' => false,
                'status' => UserIntegration::STATUS_ERROR,
                'last_error' => 'Disconnect failed: '.$e->getMessage(),
            ]);

            throw $e;
        }
    }
}
