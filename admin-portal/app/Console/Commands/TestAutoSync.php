<?php

namespace App\Console\Commands;

use App\Jobs\SyncGoogleCalendarJob;
use App\Models\UserIntegration;
use App\Services\GoogleCalendarOAuthService;
use Illuminate\Console\Command;

class TestAutoSync extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'test:auto-sync {--user-id= : Test sync for specific user ID}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test Google Calendar auto sync functionality';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🧪 Testing Google Calendar Auto Sync Functionality');
        $this->line('='.str_repeat('=', 50));

        $userId = $this->option('user-id');

        try {
            // Get integrations to test
            $query = UserIntegration::where('provider', UserIntegration::PROVIDER_GOOGLE)
                ->where('type', UserIntegration::TYPE_CALENDAR)
                ->where('is_active', true);

            if ($userId) {
                $query->where('user_id', $userId);
            }

            $integrations = $query->get();

            if ($integrations->isEmpty()) {
                $this->warn('📭 No active Google Calendar integrations found'.($userId ? " for user {$userId}" : ''));

                return 0;
            }

            $this->info("📋 Found {$integrations->count()} integration(s) to test");
            $this->newLine();

            foreach ($integrations as $integration) {
                $this->testIntegration($integration);
                $this->newLine();
            }

            $this->info('✅ Auto sync testing completed');

            return 0;

        } catch (\Exception $e) {
            $this->error("❌ Testing failed: {$e->getMessage()}");

            return 1;
        }
    }

    protected function testIntegration(UserIntegration $integration)
    {
        $this->line("🔍 Testing integration for User ID: {$integration->user_id}");
        $this->line("   Integration ID: {$integration->id}");
        $this->line("   Status: {$integration->status}");

        // Test 1: Check if credentials exist
        $credentials = $integration->credentials;
        if (! $credentials) {
            $this->error('   ❌ No credentials found');

            return;
        }

        $this->info('   ✅ Credentials found');

        // Test 2: Check if refresh token exists
        if (! isset($credentials['refresh_token'])) {
            $this->error('   ❌ No refresh token found');

            return;
        }

        $this->info('   ✅ Refresh token found');

        // Test 3: Test token refresh
        try {
            $oauthService = new GoogleCalendarOAuthService;
            $accessToken = $oauthService->getValidAccessToken($integration);

            if ($accessToken) {
                $this->info('   ✅ Token refresh successful');
            } else {
                $this->error('   ❌ Token refresh failed');

                return;
            }
        } catch (\Exception $e) {
            $this->error("   ❌ Token refresh error: {$e->getMessage()}");

            return;
        }

        // Test 4: Dispatch sync job
        if ($this->confirm('   🚀 Dispatch real sync job for this integration?', false)) {
            try {
                SyncGoogleCalendarJob::dispatch($integration);
                $this->info('   ✅ Sync job dispatched successfully');
                $this->line('   📝 Check your queue worker and logs to see the sync progress');
            } catch (\Exception $e) {
                $this->error("   ❌ Failed to dispatch sync job: {$e->getMessage()}");
            }
        } else {
            $this->line('   ⏭️ Sync job dispatch skipped');
        }

        // Test 5: Show last sync info
        if ($integration->last_sync_at) {
            $this->line("   📅 Last sync: {$integration->last_sync_at->diffForHumans()}");
        } else {
            $this->line('   📅 Never synced');
        }

        if ($integration->last_error) {
            $this->warn("   ⚠️ Last error: {$integration->last_error}");
        }
    }
}
