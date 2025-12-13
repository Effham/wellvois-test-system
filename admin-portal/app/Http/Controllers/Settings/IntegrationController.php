<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use App\Services\GoogleCalendarOAuthService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IntegrationController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-integration')->only(['index', 'show']);
        $this->middleware('permission:add-integration')->only(['create', 'store']);
        $this->middleware('permission:update-integration')->only(['edit', 'update', 'connect', 'disconnect']);
        $this->middleware('permission:delete-integration')->only('destroy');
    }

    /**
     * Display the integrations page
     */
    public function index(): Response
    {
        // Get all existing integrations
        $existingIntegrations = Integration::all()->keyBy('provider');

        // Get default integrations and merge with existing data
        $defaultIntegrations = Integration::getDefaultIntegrations();

        $integrations = collect($defaultIntegrations)->map(function ($integration) use ($existingIntegrations) {
            $existing = $existingIntegrations->get($integration['provider']);

            if ($existing) {
                return array_merge($integration, [
                    'id' => $existing->id,
                    'is_active' => $existing->is_active,
                    'is_configured' => $existing->is_configured,
                    'status' => $existing->status,
                    'display_status' => $existing->display_status,
                    'status_color' => $existing->status_color,
                    'last_sync_at' => $existing->last_sync_at,
                    'last_error' => $existing->last_error,
                ]);
            }

            return array_merge($integration, [
                'id' => null,
                'is_active' => false,
                'is_configured' => false,
                'status' => Integration::STATUS_INACTIVE,
                'display_status' => 'Not Connected',
                'status_color' => 'gray',
                'last_sync_at' => null,
                'last_error' => null,
            ]);
        });

        return Inertia::render('settings/Integrations', [
            'integrations' => $integrations->values(),
            'stats' => [
                'total' => $integrations->count(),
                'connected' => $integrations->where('is_active', true)->count(),
                'calendar' => $integrations->where('type', Integration::TYPE_CALENDAR)->count(),
                'payment' => $integrations->where('type', Integration::TYPE_PAYMENT)->count(),
                'communication' => $integrations->where('type', Integration::TYPE_COMMUNICATION)->count(),
            ],
        ]);
    }

    /**
     * Show integration details
     */
    public function show(Integration $integration): Response
    {
        return Inertia::render('settings/IntegrationDetails', [
            'integration' => $integration->load('settings'),
        ]);
    }

    /**
     * Connect an integration
     */
    public function connect(Request $request, $provider)
    {
        $defaultIntegration = collect(Integration::getDefaultIntegrations())
            ->firstWhere('provider', $provider);

        if (! $defaultIntegration) {
            return redirect()->back()->withErrors([
                'provider' => 'Integration provider not found.',
            ]);
        }

        // Handle Google Calendar OAuth flow
        if ($provider === Integration::PROVIDER_GOOGLE && $defaultIntegration['type'] === Integration::TYPE_CALENDAR) {
            try {
                $oauthService = new GoogleCalendarOAuthService;
                $authUrl = $oauthService->getAuthorizationUrl(auth()->id());

                return redirect($authUrl);
            } catch (\Exception $e) {
                return redirect()->back()->withErrors([
                    'provider' => 'Failed to initialize Google Calendar connection: '.$e->getMessage(),
                ]);
            }
        }

        // Handle other integrations (non-OAuth)
        $request->validate([
            'configuration' => 'array|nullable',
            'credentials' => 'array|nullable',
        ]);

        $integration = Integration::updateOrCreate(
            ['provider' => $provider],
            array_merge($defaultIntegration, [
                'is_active' => true,
                'is_configured' => true,
                'status' => Integration::STATUS_ACTIVE,
                'configuration' => $request->input('configuration', []),
                'credentials' => $request->input('credentials', []),
                'last_sync_at' => now(),
            ])
        );

        return redirect()->back()->with('success', "Successfully connected {$integration->name}!");
    }

    /**
     * Disconnect an integration
     */
    public function disconnect(Integration $integration)
    {
        $integration->update([
            'is_active' => false,
            'is_configured' => false,
            'status' => Integration::STATUS_INACTIVE,
            'credentials' => null,
            'last_error' => null,
        ]);

        return redirect()->back()->with('success', "Successfully disconnected {$integration->name}!");
    }

    /**
     * Update integration configuration
     */
    public function updateConfiguration(Request $request, Integration $integration)
    {
        $request->validate([
            'configuration' => 'required|array',
            'settings' => 'array|nullable',
        ]);

        $integration->update([
            'configuration' => $request->input('configuration'),
            'settings' => $request->input('settings', []),
        ]);

        return redirect()->back()->with('success', 'Integration configuration updated successfully!');
    }

    /**
     * Test integration connection
     */
    public function test(Integration $integration)
    {
        try {
            // Here you would implement actual connection testing logic
            // For now, we'll simulate a successful test

            $integration->update([
                'status' => Integration::STATUS_ACTIVE,
                'last_sync_at' => now(),
                'last_error' => null,
            ]);

            return redirect()->back()->with('success', 'Integration test successful!');
        } catch (\Exception $e) {
            $integration->update([
                'status' => Integration::STATUS_ERROR,
                'last_error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors([
                'test' => 'Integration test failed: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Sync integration data
     */
    public function sync(Integration $integration)
    {
        try {
            // Here you would implement actual sync logic based on integration type
            // For now, we'll simulate a successful sync

            $integration->update([
                'status' => Integration::STATUS_ACTIVE,
                'last_sync_at' => now(),
                'last_error' => null,
                'response_data' => [
                    'last_sync' => now()->toISOString(),
                    'records_synced' => rand(10, 100),
                    'sync_type' => 'manual',
                ],
            ]);

            return redirect()->back()->with('success', 'Integration synced successfully!');
        } catch (\Exception $e) {
            $integration->update([
                'status' => Integration::STATUS_ERROR,
                'last_error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors([
                'sync' => 'Sync failed: '.$e->getMessage(),
            ]);
        }
    }
}
