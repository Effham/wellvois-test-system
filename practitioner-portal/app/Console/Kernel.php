<?php

namespace App\Console;

use App\Jobs\SyncGoogleCalendarJob;
use App\Models\UserIntegration;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\Log;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Auto sync Google Calendar integrations every 30 minutes
        $schedule->call(function () {
            $this->scheduleGoogleCalendarAutoSync();
        })
            ->everyThirtyMinutes()
            ->name('google-calendar-auto-sync')
            ->withoutOverlapping(30) // Prevent overlapping if sync takes longer than 30 minutes
            ->onOneServer() // Only run on one server in multi-server setup
            ->runInBackground(); // Run in background to not block other scheduled tasks

        // Daily cleanup of failed auto sync jobs (optional)
        $schedule->call(function () {
            $this->cleanupFailedSyncJobs();
        })
            ->daily()
            ->at('02:00') // 2 AM
            ->name('cleanup-failed-sync-jobs')
            ->onOneServer();

        // Weekly token health check (optional)
        $schedule->call(function () {
            $this->checkTokenHealth();
        })
            ->weekly()
            ->sundays()
            ->at('01:00') // 1 AM on Sundays
            ->name('token-health-check')
            ->onOneServer();

        $schedule->command('app:send-appointment-reminder')->dailyAt('08:00');

    }

    /**
     * Schedule Google Calendar auto sync for all active integrations
     */
    protected function scheduleGoogleCalendarAutoSync(): void
    {
        try {
            Log::info('🔄 Starting scheduled Google Calendar auto sync batch');

            // Get all active Google Calendar integrations
            $activeIntegrations = UserIntegration::where('provider', UserIntegration::PROVIDER_GOOGLE)
                ->where('type', UserIntegration::TYPE_CALENDAR)
                ->where('is_active', true)
                ->where('status', UserIntegration::STATUS_ACTIVE)
                ->get();

            if ($activeIntegrations->isEmpty()) {
                Log::info('📭 No active Google Calendar integrations found for auto sync');

                return;
            }

            Log::info('📋 Scheduling auto sync for Google Calendar integrations', [
                'total_integrations' => $activeIntegrations->count(),
                'scheduled_at' => now()->toISOString(),
            ]);

            $jobsScheduled = 0;

            foreach ($activeIntegrations as $integration) {
                try {
                    // Check if integration has required credentials
                    $credentials = $integration->credentials;
                    if (! $credentials || ! isset($credentials['refresh_token'])) {
                        Log::warning('⚠️ Skipping auto sync - missing refresh token', [
                            'user_integration_id' => $integration->id,
                            'user_id' => $integration->user_id,
                        ]);

                        continue;
                    }

                    // Dispatch the sync job
                    SyncGoogleCalendarJob::dispatch($integration)
                        ->onQueue('calendar-sync') // Use dedicated queue for calendar syncing
                        ->delay(now()->addSeconds($jobsScheduled * 10)); // Stagger jobs by 10 seconds

                    $jobsScheduled++;

                    Log::debug('📤 Auto sync job dispatched', [
                        'user_integration_id' => $integration->id,
                        'user_id' => $integration->user_id,
                        'delay_seconds' => $jobsScheduled * 10,
                    ]);

                } catch (\Exception $e) {
                    Log::error('❌ Failed to dispatch auto sync job', [
                        'user_integration_id' => $integration->id,
                        'user_id' => $integration->user_id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            Log::info('✅ Google Calendar auto sync batch scheduled', [
                'total_integrations' => $activeIntegrations->count(),
                'jobs_scheduled' => $jobsScheduled,
                'next_sync_at' => now()->addMinutes(30)->toISOString(),
            ]);

        } catch (\Exception $e) {
            Log::error('💥 Failed to schedule Google Calendar auto sync batch', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Clean up old failed sync job records (optional maintenance)
     */
    protected function cleanupFailedSyncJobs(): void
    {
        try {
            Log::info('🧹 Starting cleanup of old failed sync job records');

            // This would clean up old failed job records from the database
            // Laravel automatically handles this, but you could add custom cleanup logic here

            Log::info('✅ Failed sync job cleanup completed');

        } catch (\Exception $e) {
            Log::error('❌ Failed sync job cleanup failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Check token health for all integrations (optional monitoring)
     */
    protected function checkTokenHealth(): void
    {
        try {
            Log::info('🏥 Starting weekly token health check');

            $integrations = UserIntegration::where('provider', UserIntegration::PROVIDER_GOOGLE)
                ->where('type', UserIntegration::TYPE_CALENDAR)
                ->where('is_active', true)
                ->get();

            $healthyTokens = 0;
            $expiredTokens = 0;
            $missingRefreshTokens = 0;

            foreach ($integrations as $integration) {
                $credentials = $integration->credentials;

                if (! $credentials || ! isset($credentials['refresh_token'])) {
                    $missingRefreshTokens++;

                    continue;
                }

                $tokenExpiryTime = ($credentials['created'] ?? time()) + ($credentials['expires_in'] ?? 3600);
                $currentTime = time();

                if ($currentTime > $tokenExpiryTime) {
                    $expiredTokens++;
                } else {
                    $healthyTokens++;
                }
            }

            Log::info('📊 Token health check completed', [
                'total_integrations' => $integrations->count(),
                'healthy_tokens' => $healthyTokens,
                'expired_tokens' => $expiredTokens,
                'missing_refresh_tokens' => $missingRefreshTokens,
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Token health check failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
