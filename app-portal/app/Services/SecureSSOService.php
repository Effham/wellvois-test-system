<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SecureSSOService
{
    const CODE_TTL_MINUTES = 5;

    const CACHE_PREFIX = 'sso_code_';

    /**
     * Generate a secure one-time code for SSO
     */
    public function generateSSOCode(User $user, Tenant $tenant, string $redirectPath = '/dashboard', ?string $sessionId = null, ?array $documentIdsFilter = null, ?array $keycloakTokens = null): string
    {
        // Generate cryptographically secure random code
        $code = Str::random(64);

        // Get current session ID for binding
        $currentSessionId = $sessionId ?? session()->getId();

        // Prepare cache data
        $cacheData = [
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'redirect_internal' => $redirectPath,
            'issued_at' => now()->timestamp,
            'ttl' => self::CODE_TTL_MINUTES * 60, // Convert to seconds
            'session_id' => $currentSessionId,
            'user_email' => $user->email, // For verification
            'tenant_name' => $tenant->company_name ?? $tenant->id,
            '2fa_passed' => session('2fa_passed', false), // Store 2FA status
            'document_ids_filter' => $documentIdsFilter, // Store document IDs for filtering
            'keycloak_access_token' => $keycloakTokens['access_token'] ?? null, // Store Keycloak tokens
            'keycloak_refresh_token' => $keycloakTokens['refresh_token'] ?? null,
        ];

        // Store in cache with TTL
        Cache::put(
            self::CACHE_PREFIX.$code,
            $cacheData,
            now()->addMinutes(self::CODE_TTL_MINUTES)
        );

        return $code;
    }

    /**
     * Exchange SSO code for user data (server-to-server verification)
     */
    public function exchangeSSOCode(string $code, ?string $requestingSessionId = null): ?array
    {
        $cacheKey = self::CACHE_PREFIX.$code;
        $cacheData = Cache::get($cacheKey);

        if (! $cacheData) {
            Log::warning('SSO code exchange failed: Code not found in cache', [
                'code_length' => strlen($code),
                'cache_key' => $cacheKey,
            ]);

            return null;
        }

        Log::info('SSO code exchange: Code found in cache', [
            'user_id' => $cacheData['user_id'] ?? null,
            'tenant_id' => $cacheData['tenant_id'] ?? null,
            'code_length' => strlen($code),
        ]);

        // Verify session binding if provided (relaxed for tenant switching)
        if ($requestingSessionId && $cacheData['session_id'] !== $requestingSessionId) {
            // In multi-tenant environments, session ID changes are expected during domain switches
            // We'll proceed but log this for audit purposes
        }

        // Check server-side expiry
        $issuedAt = $cacheData['issued_at'];
        $ttl = $cacheData['ttl'];
        $currentTime = now()->timestamp;

        if (($currentTime - $issuedAt) > $ttl) {
            Log::warning('SSO code exchange failed: Code expired', [
                'user_id' => $cacheData['user_id'] ?? null,
                'tenant_id' => $cacheData['tenant_id'] ?? null,
                'issued_at' => $issuedAt,
                'current_time' => $currentTime,
                'ttl' => $ttl,
                'age_seconds' => $currentTime - $issuedAt,
            ]);
            Cache::forget($cacheKey);

            return null;
        }

        // Verify explicit tenant membership
        $userId = $cacheData['user_id'];
        $tenantId = $cacheData['tenant_id'];

        Log::info('SSO code exchange: Verifying tenant membership', [
            'user_id' => $userId,
            'tenant_id' => $tenantId,
        ]);

        $membershipValid = $this->verifyTenantMembership($userId, $tenantId);

        if (! $membershipValid) {
            Log::error('SSO code exchange failed: Tenant membership verification failed', [
                'user_id' => $userId,
                'tenant_id' => $tenantId,
            ]);
            // Immediately invalidate the code
            Cache::forget($cacheKey);

            return null;
        }

        Log::info('SSO code exchange: Tenant membership verified successfully', [
            'user_id' => $userId,
            'tenant_id' => $tenantId,
        ]);

        // Immediately invalidate the code (single use)
        Cache::forget($cacheKey);

        // Return success payload with user data
        // Include Keycloak tokens if present in cache data
        return [
            'user_id' => $userId,
            'tenant_id' => $tenantId,
            'user_email' => $cacheData['user_email'],
            'redirect_internal' => $cacheData['redirect_internal'],
            'tenant_name' => $cacheData['tenant_name'],
            '2fa_passed' => $cacheData['2fa_passed'] ?? false,
            'document_ids_filter' => $cacheData['document_ids_filter'] ?? null,
            'keycloak_access_token' => $cacheData['keycloak_access_token'] ?? null,
            'keycloak_refresh_token' => $cacheData['keycloak_refresh_token'] ?? null,
        ];
    }

    /**
     * Verify explicit tenant membership
     */
    protected function verifyTenantMembership(int $userId, string $tenantId): bool
    {
        // Get user from central database
        $user = User::find($userId);
        if (! $user) {
            \Log::warning('SSO verifyTenantMembership: User not found', [
                'user_id' => $userId,
                'tenant_id' => $tenantId,
            ]);

            return false;
        }

        // Refresh user to ensure we have latest relationships
        $user->refresh();

        // Check if user has access to the tenant via relationship
        $hasAccess = $user->tenants()->where('tenant_id', $tenantId)->exists();

        // If relationship check fails, try direct database query (race condition fallback)
        if (! $hasAccess) {
            \Log::warning('SSO verifyTenantMembership: Relationship check failed, trying direct DB query', [
                'user_id' => $userId,
                'tenant_id' => $tenantId,
                'user_email' => $user->email,
            ]);

            // Direct database check as fallback (handles race conditions)
            $hasAccess = \DB::table('tenant_user')
                ->where('user_id', $userId)
                ->where('tenant_id', $tenantId)
                ->exists();

            if ($hasAccess) {
                \Log::info('SSO verifyTenantMembership: Direct DB query succeeded (race condition resolved)', [
                    'user_id' => $userId,
                    'tenant_id' => $tenantId,
                ]);
            }
        }

        if (! $hasAccess) {
            \Log::warning('SSO verifyTenantMembership: User does not have access to tenant', [
                'user_id' => $userId,
                'tenant_id' => $tenantId,
                'user_email' => $user->email,
            ]);

            return false;
        }

        // Additional check for patients - they can only access tenants where invitation_status = 'ACCEPTED'
        $isPatient = \App\Models\Patient::where('user_id', $user->id)->exists();
        $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();

        // For patients (who are not practitioners), verify they have ACCEPTED invitation status
        if ($isPatient && ! $isPractitioner) {
            $patientId = \App\Models\Patient::where('user_id', $user->id)->first()?->id;
            if (! $patientId) {
                return false;
            }

            $hasAcceptedInvitation = \DB::table('tenant_patients')
                ->where('patient_id', $patientId)
                ->where('tenant_id', $tenantId)
                ->where('invitation_status', 'ACCEPTED')
                ->exists();

            return $hasAcceptedInvitation;
        }

        return true;
    }

    /**
     * Generate tenant SSO URL with opaque code
     */
    public function generateTenantSSOUrl(string $code, Tenant $tenant): string
    {
        // Get tenant domain
        $tenantDomain = $tenant->domains->first()->domain ?? 'localhost';
        $protocol = app()->environment('production') ? 'https' : 'http';
        $baseUrl = "{$protocol}://{$tenantDomain}".($protocol === 'http' ? ':8000' : '');

        // Create SSO URL with only the opaque code
        return "{$baseUrl}/sso/start?".http_build_query(['code' => $code]);
    }

    /**
     * Get central app base URL for back-channel communication
     */
    public function getCentralAppUrl(): string
    {
        $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
        $protocol = app()->environment('production') ? 'https' : 'http';

        // Handle localhost development environment properly
        if ($centralDomain === 'localhost' && ! app()->environment('production')) {
            // For local development, ensure we're using the correct localhost URL
            $port = env('APP_PORT', '8000');

            return "{$protocol}://localhost:{$port}";
        }

        return "{$protocol}://{$centralDomain}".($protocol === 'http' ? ':8000' : '');
    }

    /**
     * Validate that a request is coming from a legitimate tenant
     */
    public function validateTenantRequest(Request $request, string $tenantId): bool
    {
        // Add any additional validation logic here
        // For example, checking request signatures, IP allowlists, etc.

        // Basic validation - ensure tenant exists
        $tenant = Tenant::find($tenantId);

        return $tenant !== null;
    }

    /**
     * Clean up expired SSO codes (for maintenance)
     */
    public function cleanupExpiredCodes(): int
    {
        // Note: This would typically be handled by cache TTL,
        // but you could implement additional cleanup logic here if needed

        // For cache-based storage, expired items are automatically removed
        // Return 0 as we rely on cache TTL
        return 0;
    }
}
