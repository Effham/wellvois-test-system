<?php

namespace App\Services;

use App\Mail\UserSessionActivityMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class GlobalLogoutService
{
    /**
     * Perform global logout across all domains
     */
    public function performGlobalLogout(Request $request): void
    {
        $user = Auth::user();
        $userId = $user?->id;
        $userEmail = $user?->email;
        if ($user) {
            $logoutTime = now();
            Mail::to($user->email)->send(
                new UserSessionActivityMail($user, 'logout', $logoutTime)
            );
        }

        // 1. Logout from current session
        Auth::guard('web')->logout();

        // 2. Invalidate current session
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // 3. Clear all tenant-related sessions and cache
        if ($userId) {
            $this->clearTenantSessions($userId);
            $this->clearUserCache($userId);
        }

        // 4. Set global logout flag for cross-domain logout
        $this->setGlobalLogoutFlag($userId, $userEmail);

        // 5. Clean up database sessions immediately (HIPAA compliance)
        $this->cleanupDatabaseSessions($userId, $userEmail);
    }

    /**
     * Clear all tenant-related sessions
     */
    private function clearTenantSessions(int $userId): void
    {
        // Clear all tenant switch sessions for this user
        $pattern = "tenant_switch_{$userId}_*";

        // Get all keys matching the pattern
        $keys = Cache::store('database')->get($pattern) ?? [];

        foreach ($keys as $key) {
            Cache::store('database')->forget($key);
        }

        // Also clear any other user-specific cache
        Cache::store('database')->forget("user_sessions_{$userId}");
        Cache::store('database')->forget("user_tenants_{$userId}");
    }

    /**
     * Clear user-specific cache
     */
    private function clearUserCache(int $userId): void
    {
        // Clear any user-specific cache entries
        $cacheKeys = [
            "user_{$userId}_permissions",
            "user_{$userId}_roles",
            "user_{$userId}_tenants",
            "user_{$userId}_preferences",
        ];

        foreach ($cacheKeys as $key) {
            Cache::store('database')->forget($key);
        }
    }

    /**
     * Set global logout flag for cross-domain logout
     * Uses central cache as single source of truth with 5-minute TTL
     */
    private function setGlobalLogoutFlag(?int $userId, ?string $userEmail): void
    {
        if ($userId && $userEmail) {
            $timestamp = now()->timestamp;
            $logoutData = [
                'user_id' => $userId,
                'user_email' => $userEmail,
                'timestamp' => $timestamp,
                'version' => $timestamp, // Use timestamp as version for staleness detection
                'domain' => request()->getHost(),
                'ip_address' => request()->ip(),
            ];

            // CRITICAL: Reduce TTL to 5 minutes (matches SSO code TTL)
            // This prevents stale flags from lingering after user re-authenticates
            $ttl = now()->addMinutes(5);

            // Store ONLY in central database cache for single source of truth
            // This eliminates cache synchronization issues across tenant contexts
            tenancy()->central(function () use ($logoutData, $ttl) {
                Cache::store('database')->put(
                    'global_logout_'.$logoutData['user_email'],
                    $logoutData,
                    $ttl
                );
            });

            // DO NOT store in current domain cache to avoid staleness
            // All checks will go through central cache for consistency
        }
    }

    /**
     * Check if user has been globally logged out
     * Includes staleness detection to prevent false positives
     */
    public function isGloballyLoggedOut(string $userEmail): bool
    {
        // Check ONLY central cache (single source of truth)
        $logoutData = tenancy()->central(function () use ($userEmail) {
            return Cache::store('database')->get('global_logout_'.$userEmail);
        });

        if (! $logoutData) {
            return false;
        }

        // Additional staleness check: if flag is older than login time, ignore it
        // This prevents false positives when flag was set before current login session
        $loginTime = session('login_time');
        if ($loginTime && isset($logoutData['timestamp']) && $logoutData['timestamp'] < $loginTime) {
            // Flag is stale - created before current login session
            // Clear it and return false
            $this->clearGlobalLogoutFlag($userEmail);

            return false;
        }

        return true;
    }

    /**
     * Clear global logout flag (when user logs in again)
     * Clears only from central cache (our single source of truth)
     */
    public function clearGlobalLogoutFlag(string $userEmail): void
    {
        // Clear ONLY from central cache (our single source of truth)
        tenancy()->central(function () use ($userEmail) {
            Cache::store('database')->forget('global_logout_'.$userEmail);
        });

        // No need to clear from current domain cache since we're not storing there
    }

    /**
     * Clean up all database sessions for the user across all domains
     * HIPAA Compliance: Ensure immediate session destruction
     */
    private function cleanupDatabaseSessions(?int $userId, ?string $userEmail): void
    {
        if (! $userEmail) {
            return;
        }

        try {
            // Clean sessions from central database
            tenancy()->central(function () use ($userEmail) {
                DB::connection('central')
                    ->table('sessions')
                    ->where('user_id', function ($query) use ($userEmail) {
                        $query->select('id')
                            ->from('users')
                            ->where('email', $userEmail)
                            ->limit(1);
                    })
                    ->delete();
            });

            // Note: Tenant sessions will be cleaned by their own session handlers
            // The global logout flag ensures they're invalidated on next request
        } catch (\Exception $e) {
            Log::warning('Failed to clean database sessions during logout', [
                'user_email' => $userEmail,
                'error' => $e->getMessage(),
            ]);
            // Don't fail logout if session cleanup fails
        }
    }

    /**
     * Get logout redirect URL based on current domain
     */
    public function getLogoutRedirectUrl(): string
    {
        $currentDomain = request()->getHost();
        $centralDomains = config('tenancy.central_domains', []);

        if (in_array($currentDomain, $centralDomains)) {
            // On central domain - redirect to login
            return route('login');
        } else {
            // On tenant domain - redirect to central login
            $protocol = app()->environment('production') ? 'https' : 'http';
            $centralDomain = $centralDomains[0] ?? 'localhost';

            return "{$protocol}://{$centralDomain}".($protocol === 'http' ? ':8000' : '').'/login';
        }
    }
}
