<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class TenantSessionService
{
    /**
     * Switch user to a specific tenant using secure SSO
     */
    public function switchToTenant(User $user, Tenant $tenant, string $redirectPath = '/dashboard'): string
    {
        // Use the new secure SSO service
        $ssoService = app(\App\Services\SecureSSOService::class);
        $code = $ssoService->generateSSOCode($user, $tenant, $redirectPath);

        return $ssoService->generateTenantSSOUrl($code, $tenant);
    }

    /**
     * Validate tenant switch session
     */
    public function validateTenantSwitch(string $sessionKey, int $userId, string $tenantId, string $secureToken): bool
    {
        $sessionData = Cache::store('database')->get($sessionKey);

        if (! $sessionData) {
            return false;
        }

        // Validate session data
        if ($sessionData['central_user_id'] !== $userId || $sessionData['tenant_id'] !== $tenantId) {
            return false;
        }

        // Validate secure token
        if ($sessionData['secure_token'] !== $secureToken) {
            return false;
        }

        // Check if session is not expired
        if (now()->timestamp - $sessionData['timestamp'] > 600) { // 10 minutes
            return false;
        }

        return true;
    }

    /**
     * Get redirect path from tenant switch session
     */
    public function getRedirectPath(string $sessionKey): string
    {
        $sessionData = Cache::store('database')->get($sessionKey);

        return $sessionData['redirect_path'] ?? '/dashboard';
    }

    /**
     * Clean up tenant switch session
     */
    public function cleanupTenantSwitch(string $sessionKey): void
    {
        Cache::store('database')->forget($sessionKey);
    }

    /**
     * Get user's accessible tenants
     */
    public function getUserTenants(User $user): array
    {
        return $user->tenants()->with('domains')->get()->map(function ($tenant) {
            return [
                'id' => $tenant->id,
                'name' => $tenant->company_name ?? $tenant->id,
                'domain' => $tenant->domains->first()->domain ?? null,
                'is_onboarding' => $tenant->is_onboarding ?? false,
            ];
        })->toArray();
    }

    /**
     * Check if user can access tenant
     */
    public function canAccessTenant(User $user, Tenant $tenant): bool
    {
        return $user->tenants()->where('tenant_id', $tenant->id)->exists();
    }
}
