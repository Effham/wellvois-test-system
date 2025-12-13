<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| This file is where you may define all of your Closure based console
| commands. Each Closure is bound to a command instance allowing a
| simple approach to interacting with each command's IO methods.
|
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('sync:google-calendar {user_integration_id}', function ($userIntegrationId) {
    $this->info("🔄 Starting manual Google Calendar sync for integration: {$userIntegrationId}");

    try {
        $integration = \App\Models\UserIntegration::findOrFail($userIntegrationId);

        if ($integration->provider !== \App\Models\UserIntegration::PROVIDER_GOOGLE ||
            $integration->type !== \App\Models\UserIntegration::TYPE_CALENDAR) {
            $this->error('❌ Invalid integration type. Must be Google Calendar.');

            return 1;
        }

        if (! $integration->is_active) {
            $this->error('❌ Integration is not active.');

            return 1;
        }

        // Dispatch the sync job
        \App\Jobs\SyncGoogleCalendarJob::dispatchSync($integration);

        $this->info('✅ Manual sync job dispatched successfully');

        return 0;

    } catch (\Exception $e) {
        $this->error("❌ Failed to start manual sync: {$e->getMessage()}");

        return 1;
    }
})->purpose('Manually sync a specific Google Calendar integration');

Artisan::command('sync:all-google-calendars', function () {
    $this->info('🔄 Starting manual sync for all active Google Calendar integrations');

    try {
        $activeIntegrations = \App\Models\UserIntegration::where('provider', \App\Models\UserIntegration::PROVIDER_GOOGLE)
            ->where('type', \App\Models\UserIntegration::TYPE_CALENDAR)
            ->where('is_active', true)
            ->where('status', \App\Models\UserIntegration::STATUS_ACTIVE)
            ->get();

        if ($activeIntegrations->isEmpty()) {
            $this->info('📭 No active Google Calendar integrations found');

            return 0;
        }

        $this->info("📋 Found {$activeIntegrations->count()} active integrations");

        $jobsDispatched = 0;
        foreach ($activeIntegrations as $integration) {
            try {
                \App\Jobs\SyncGoogleCalendarJob::dispatch($integration);
                $jobsDispatched++;
                $this->line("  ✅ Sync job dispatched for user {$integration->user_id}");
            } catch (\Exception $e) {
                $this->error("  ❌ Failed to dispatch sync for user {$integration->user_id}: {$e->getMessage()}");
            }
        }

        $this->info("✅ Dispatched {$jobsDispatched} sync jobs");

        return 0;

    } catch (\Exception $e) {
        $this->error("❌ Failed to sync all calendars: {$e->getMessage()}");

        return 1;
    }
})->purpose('Manually sync all active Google Calendar integrations');
