<?php

namespace App\Jobs;

use App\Models\UserIntegration;
use App\Services\GoogleCalendarOAuthService;
use App\Services\GoogleCalendarService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncGoogleCalendarJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes timeout

    public $tries = 3; // Retry up to 3 times

    public $backoff = [60, 180, 600]; // Backoff delays: 1min, 3min, 10min

    protected $userIntegration;

    /**
     * Create a new job instance.
     */
    public function __construct(UserIntegration $userIntegration)
    {
        $this->userIntegration = $userIntegration;
    }

    /**
     * Execute the job - Automatically sync Google Calendar events
     */
    public function handle(): void
    {
        try {
            Log::info('🔄 Starting automatic Google Calendar sync', [
                'user_integration_id' => $this->userIntegration->id,
                'user_id' => $this->userIntegration->user_id,
                'job_id' => $this->job->getJobId(),
            ]);

            // Check if integration is still active
            if (! $this->userIntegration->is_active) {
                Log::info('⏭️ Skipping sync - integration is inactive', [
                    'user_integration_id' => $this->userIntegration->id,
                ]);

                return;
            }

            // Initialize OAuth service for token management
            $oauthService = new GoogleCalendarOAuthService;

            // Get valid access token (will refresh automatically if needed)
            $accessToken = $oauthService->getValidAccessToken($this->userIntegration);

            if (! $accessToken) {
                throw new \Exception('Unable to get valid access token for Google Calendar sync');
            }

            // Initialize Calendar service
            $calendarService = new GoogleCalendarService($this->userIntegration);

            // Perform the actual sync
            $syncResult = $this->performSync($calendarService);

            // Update integration with sync results
            $this->userIntegration->update([
                'last_sync_at' => now(),
                'last_error' => null,
                'status' => UserIntegration::STATUS_ACTIVE,
                'response_data' => array_merge(
                    $this->userIntegration->response_data ?? [],
                    [
                        'last_auto_sync' => [
                            'timestamp' => now()->toISOString(),
                            'sync_type' => 'automatic',
                            'events_processed' => $syncResult['events_processed'] ?? 0,
                            'conflicts_detected' => $syncResult['conflicts_detected'] ?? 0,
                            'job_id' => $this->job->getJobId(),
                        ],
                    ]
                ),
            ]);

            Log::info('✅ Google Calendar auto sync completed successfully', [
                'user_integration_id' => $this->userIntegration->id,
                'user_id' => $this->userIntegration->user_id,
                'events_processed' => $syncResult['events_processed'] ?? 0,
                'conflicts_detected' => $syncResult['conflicts_detected'] ?? 0,
                'duration_seconds' => $syncResult['duration_seconds'] ?? 0,
                'message' => 'Auto sync completed - user was not interrupted',
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Google Calendar auto sync failed', [
                'user_integration_id' => $this->userIntegration->id,
                'user_id' => $this->userIntegration->user_id,
                'error' => $e->getMessage(),
                'attempt' => $this->attempts(),
                'max_attempts' => $this->tries,
            ]);

            // Update integration with error info
            $this->userIntegration->update([
                'last_error' => 'Auto sync failed: '.$e->getMessage(),
                'status' => UserIntegration::STATUS_ERROR,
            ]);

            // Re-throw to trigger retry mechanism
            throw $e;
        }
    }

    /**
     * Perform the actual calendar sync
     */
    protected function performSync(GoogleCalendarService $calendarService): array
    {
        $startTime = microtime(true);
        $eventsProcessed = 0;
        $conflictsDetected = 0;

        try {
            // Get events from the last 7 days and next 30 days for conflict checking
            $startDate = Carbon::now()->subDays(7)->startOfDay();
            $endDate = Carbon::now()->addDays(30)->endOfDay();

            Log::info('📅 Syncing Google Calendar events', [
                'start_date' => $startDate->toISOString(),
                'end_date' => $endDate->toISOString(),
                'user_integration_id' => $this->userIntegration->id,
            ]);

            // Get events for the date range using the existing getDayConflicts method
            // We'll process this day by day to track conflicts properly
            $currentDate = $startDate->copy();

            while ($currentDate->lte($endDate)) {
                $dayStart = $currentDate->copy()->startOfDay();
                $dayEnd = $currentDate->copy()->endOfDay();

                try {
                    $dayEvents = $calendarService->getDayConflicts($dayStart, $dayEnd);
                    $eventsProcessed += count($dayEvents);

                    // Check for potential conflicts with existing appointments
                    // (This would integrate with your appointment system)
                    $conflictsDetected += $this->checkForAppointmentConflicts($dayEvents, $currentDate);

                } catch (\Exception $e) {
                    Log::warning('⚠️ Failed to sync events for specific day', [
                        'date' => $currentDate->toDateString(),
                        'error' => $e->getMessage(),
                        'user_integration_id' => $this->userIntegration->id,
                    ]);
                }

                $currentDate->addDay();
            }

            $duration = microtime(true) - $startTime;

            return [
                'events_processed' => $eventsProcessed,
                'conflicts_detected' => $conflictsDetected,
                'duration_seconds' => round($duration, 2),
                'date_range' => [
                    'start' => $startDate->toISOString(),
                    'end' => $endDate->toISOString(),
                ],
            ];

        } catch (\Exception $e) {
            Log::error('Failed to perform calendar sync', [
                'error' => $e->getMessage(),
                'user_integration_id' => $this->userIntegration->id,
            ]);
            throw $e;
        }
    }

    /**
     * Check for conflicts with existing appointments (placeholder for future integration)
     */
    protected function checkForAppointmentConflicts(array $calendarEvents, Carbon $date): int
    {
        // TODO: Integrate with your appointment system to check for conflicts
        // For now, we'll just return 0 as we're focusing on the auto sync mechanism

        if (count($calendarEvents) > 0) {
            Log::debug('📊 Calendar events found for conflict checking', [
                'date' => $date->toDateString(),
                'events_count' => count($calendarEvents),
                'user_integration_id' => $this->userIntegration->id,
            ]);
        }

        return 0; // No conflicts detected for now
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('💥 Google Calendar auto sync job failed permanently', [
            'user_integration_id' => $this->userIntegration->id,
            'user_id' => $this->userIntegration->user_id,
            'error' => $exception->getMessage(),
            'attempts_made' => $this->attempts(),
            'message' => 'Auto sync job has been permanently failed after all retries',
        ]);

        // Mark integration as having sync issues
        $this->userIntegration->update([
            'status' => UserIntegration::STATUS_ERROR,
            'last_error' => 'Auto sync failed permanently: '.$exception->getMessage().'. Will retry on next scheduled sync.',
        ]);
    }
}
