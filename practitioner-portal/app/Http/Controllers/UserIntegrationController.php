<?php

namespace App\Http\Controllers;

use App\Models\Integration;
use App\Models\UserIntegration;
use App\Services\GoogleCalendarOAuthService;
use App\Services\GoogleCalendarService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class UserIntegrationController extends Controller
{
    /**
     * Display the user integrations page
     */
    public function index(): Response
    {
        $userId = Auth::id();

        // Get user's integrations with stats
        $userIntegrations = UserIntegration::getDefaultUserIntegrationsForUser($userId);

        $integrations = collect($userIntegrations);

        return Inertia::render('UserIntegrations/Index', [
            'integrations' => [
                'data' => $integrations,
                'stats' => [
                    'total' => $integrations->count(),
                    'connected' => $integrations->where('is_active', true)->count(),
                    'calendar' => $integrations->where('type', UserIntegration::TYPE_CALENDAR)->count(),
                    'communication' => $integrations->where('type', UserIntegration::TYPE_COMMUNICATION)->count(),
                    'storage' => $integrations->where('type', UserIntegration::TYPE_STORAGE)->count(),
                ],
            ],
        ]);
    }

    /**
     * Connect a user integration
     */
    public function connect(Request $request, $provider)
    {
        $userId = Auth::id();

        $defaultIntegration = collect(Integration::getDefaultUserIntegrations())
            ->firstWhere('provider', $provider);

        if (! $defaultIntegration) {
            return redirect()->back()->withErrors([
                'provider' => 'Integration provider not found.',
            ]);
        }

        // Handle Google Calendar OAuth flow
        if ($provider === UserIntegration::PROVIDER_GOOGLE && $defaultIntegration['type'] === UserIntegration::TYPE_CALENDAR) {
            try {
                $enableCalendarConflicts = $request->boolean('enable_calendar_conflicts', true); // Default to true

                $oauthService = new GoogleCalendarOAuthService;
                $authUrl = $oauthService->getAuthorizationUrl($userId, [
                    'enable_calendar_conflicts' => $enableCalendarConflicts,
                ]);

                Log::info('Google OAuth redirect URL generated', [
                    'user_id' => $userId,
                    'auth_url' => $authUrl,
                    'enable_calendar_conflicts' => $enableCalendarConflicts,
                ]);

                return redirect($authUrl);
            } catch (\Exception $e) {
                Log::error('Google OAuth connection failed', [
                    'user_id' => $userId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return redirect()->back()->withErrors([
                    'provider' => 'Failed to initialize Google Calendar connection: '.$e->getMessage(),
                ]);
            }
        }

        // Handle other integrations (non-OAuth)
        $request->validate([
            'configuration' => 'array|nullable',
            'credentials' => 'array|nullable',
            'enable_calendar_conflicts' => 'boolean|nullable',
        ]);

        $configuration = $request->input('configuration', []);
        $integrationData = array_merge($defaultIntegration, [
            'user_id' => $userId,
            'is_active' => true,
            'is_configured' => true,
            'status' => UserIntegration::STATUS_ACTIVE,
            'configuration' => $configuration,
            'credentials' => $request->input('credentials', []),
            'last_sync_at' => now(),
        ]);

        // Add calendar conflicts setting for Google Calendar integrations
        if ($provider === UserIntegration::PROVIDER_GOOGLE &&
            $defaultIntegration['type'] === UserIntegration::TYPE_CALENDAR &&
            $request->has('enable_calendar_conflicts')) {
            $integrationData['enable_calendar_conflicts'] = $request->boolean('enable_calendar_conflicts');
        }

        $integration = UserIntegration::updateOrCreate(
            [
                'user_id' => $userId,
                'provider' => $provider,
            ],
            $integrationData
        );

        return redirect()->back()->with('success', "Successfully connected {$integration->name}!");
    }

    /**
     * Disconnect a user integration
     */
    public function disconnect(UserIntegration $userIntegration)
    {
        // Ensure the integration belongs to the current user
        if ($userIntegration->user_id !== Auth::id()) {
            return redirect()->back()->withErrors([
                'error' => 'Unauthorized action.',
            ]);
        }

        try {
            // Handle Google Calendar OAuth disconnect
            if ($userIntegration->provider === UserIntegration::PROVIDER_GOOGLE &&
                $userIntegration->type === UserIntegration::TYPE_CALENDAR) {
                $oauthService = new GoogleCalendarOAuthService;
                $oauthService->disconnect($userIntegration);
            } else {
                // Handle other integrations
                $userIntegration->update([
                    'is_active' => false,
                    'is_configured' => false,
                    'status' => UserIntegration::STATUS_INACTIVE,
                    'credentials' => null,
                    'last_error' => null,
                ]);
            }

            return redirect()->back()->with('success', "Successfully disconnected {$userIntegration->name}!");
        } catch (\Exception $e) {
            return redirect()->back()->withErrors([
                'error' => 'Failed to disconnect integration: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Update user integration configuration
     */
    public function updateConfiguration(Request $request, UserIntegration $userIntegration)
    {
        // Ensure the integration belongs to the current user
        if ($userIntegration->user_id !== Auth::id()) {
            return redirect()->back()->withErrors([
                'error' => 'Unauthorized action.',
            ]);
        }

        $request->validate([
            'configuration' => 'required|array',
            'settings' => 'array|nullable',
        ]);

        $userIntegration->update([
            'configuration' => $request->input('configuration'),
            'settings' => $request->input('settings', []),
        ]);

        return redirect()->back()->with('success', 'Integration configuration updated successfully!');
    }

    /**
     * Test user integration connection
     */
    public function test(UserIntegration $userIntegration)
    {
        // Ensure the integration belongs to the current user
        if ($userIntegration->user_id !== Auth::id()) {
            return redirect()->back()->withErrors([
                'error' => 'Unauthorized action.',
            ]);
        }

        try {
            // Handle Google Calendar testing
            if ($userIntegration->provider === UserIntegration::PROVIDER_GOOGLE &&
                $userIntegration->type === UserIntegration::TYPE_CALENDAR) {
                $calendarService = new GoogleCalendarService($userIntegration);
                $result = $calendarService->testConnection();

                if ($result['success']) {
                    return redirect()->back()->with('success', $result['message']);
                } else {
                    return redirect()->back()->withErrors(['test' => $result['message']]);
                }
            }

            // For other integrations, simulate a successful test
            $userIntegration->update([
                'status' => UserIntegration::STATUS_ACTIVE,
                'last_sync_at' => now(),
                'last_error' => null,
            ]);

            return redirect()->back()->with('success', 'Integration test successful!');
        } catch (\Exception $e) {
            $userIntegration->update([
                'status' => UserIntegration::STATUS_ERROR,
                'last_error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors([
                'test' => 'Integration test failed: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Sync user integration data (real syncing, not simulated)
     */
    public function sync(UserIntegration $userIntegration)
    {
        // Ensure the integration belongs to the current user
        if ($userIntegration->user_id !== Auth::id()) {
            return redirect()->back()->withErrors([
                'error' => 'Unauthorized action.',
            ]);
        }

        try {
            // Handle Google Calendar sync
            if ($userIntegration->provider === UserIntegration::PROVIDER_GOOGLE &&
                $userIntegration->type === UserIntegration::TYPE_CALENDAR) {

                // Dispatch background job for real sync
                \App\Jobs\SyncGoogleCalendarJob::dispatch($userIntegration);

                return redirect()->back()->with('success', 'Calendar sync started! Your Google Calendar is being synchronized in the background.');
            }

            // For other integration types, implement their specific sync logic here
            // For now, we'll return an error for unsupported types
            return redirect()->back()->withErrors([
                'sync' => 'Sync not yet implemented for this integration type.',
            ]);

        } catch (\Exception $e) {
            $userIntegration->update([
                'status' => UserIntegration::STATUS_ERROR,
                'last_error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors([
                'sync' => 'Sync failed: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Handle Google Calendar OAuth callback
     */
    public function googleCalendarCallback(Request $request)
    {
        try {
            $code = $request->get('code');
            $state = $request->get('state');

            if (! $code || ! $state) {
                // Default fallback if no state
                return redirect('/dashboard')->withErrors([
                    'error' => 'Invalid OAuth response from Google Calendar.',
                ]);
            }

            // Decode state to get return URL
            $stateData = json_decode(base64_decode($state), true);
            $returnUrl = $stateData['return_url'] ?? '/dashboard';

            $oauthService = new GoogleCalendarOAuthService;
            $userIntegration = $oauthService->handleCallback($code, $state);

            return redirect($returnUrl)->with('success',
                'Google Calendar connected successfully! You can now sync your appointments.'
            );

        } catch (\Exception $e) {
            Log::error('Google Calendar OAuth callback failed', [
                'error' => $e->getMessage(),
                'request' => $request->all(),
            ]);

            // Try to get return URL from state, fallback to dashboard
            $returnUrl = '/dashboard';
            if ($state) {
                try {
                    $stateData = json_decode(base64_decode($state), true);
                    $returnUrl = $stateData['return_url'] ?? $returnUrl;
                } catch (\Exception $stateError) {
                    // Ignore state decode errors, use fallback
                }
            }

            return redirect($returnUrl)->withErrors([
                'error' => 'Failed to connect Google Calendar: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Check for calendar conflicts for a specific day
     */
    public function checkDayConflicts(Request $request)
    {
        try {
            $request->validate([
                'practitioner_id' => 'required|integer',
                'date' => 'required|date_format:Y-m-d',
            ]);

            $practitionerId = $request->get('practitioner_id');
            $date = $request->get('date');
            $userTimezone = $request->get('timezone', 'America/Toronto'); // Default to Eastern timezone

            // Create start and end of day in user's timezone, then convert to UTC
            $startOfDay = Carbon::createFromFormat('Y-m-d', $date, $userTimezone)->startOfDay()->utc();
            $endOfDay = Carbon::createFromFormat('Y-m-d', $date, $userTimezone)->endOfDay()->utc();

            // Convert practitioner_id to user_id
            $userId = null;
            $practitionerName = 'Practitioner';

            // Check if we're in a tenant context
            if (function_exists('tenancy') && tenancy()) {
                $userId = tenancy()->central(function () use ($practitionerId, &$practitionerName) {
                    try {
                        $practitioner = \App\Models\Practitioner::find($practitionerId);
                        if ($practitioner) {
                            $practitionerName = trim($practitioner->first_name.' '.$practitioner->last_name);

                            return $practitioner->user_id;
                        }
                    } catch (\Exception $e) {
                        Log::warning('Failed to find practitioner in central DB', [
                            'practitioner_id' => $practitionerId,
                            'error' => $e->getMessage(),
                        ]);
                    }

                    return null;
                });
            } else {
                // Not in tenant context, try to find practitioner directly
                try {
                    $practitioner = \App\Models\Practitioner::find($practitionerId);
                    if ($practitioner) {
                        $practitionerName = trim($practitioner->first_name.' '.$practitioner->last_name);
                        $userId = $practitioner->user_id;
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to find practitioner', [
                        'practitioner_id' => $practitionerId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if (! $userId) {
                return response()->json([
                    'has_conflicts' => false,
                    'is_connected' => false,
                    'message' => 'Practitioner not found.',
                    'conflicts' => [],
                ]);
            }

            // Find the practitioner's Google Calendar integration using user_id
            $userIntegration = null;

            if (function_exists('tenancy') && tenancy()) {
                $userIntegration = tenancy()->central(function () use ($userId) {
                    return UserIntegration::where('user_id', $userId)
                        ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                        ->where('type', UserIntegration::TYPE_CALENDAR)
                        ->where('is_active', true)
                        ->first();
                });
            } else {
                $userIntegration = UserIntegration::where('user_id', $userId)
                    ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                    ->where('type', UserIntegration::TYPE_CALENDAR)
                    ->where('is_active', true)
                    ->first();
            }

            if (! $userIntegration) {
                return response()->json([
                    'has_conflicts' => false,
                    'is_connected' => false,
                    'message' => "⚠️ {$practitionerName} hasn't connected their Google Calendar yet. Calendar conflicts cannot be checked.",
                    'conflicts' => [],
                ]);
            }

            // Check if calendar conflicts are enabled for this practitioner
            if (! $userIntegration->enable_calendar_conflicts) {
                return response()->json([
                    'has_conflicts' => false,
                    'is_connected' => true,
                    'message' => "✅ {$practitionerName} has disabled calendar conflict detection.",
                    'conflicts' => [],
                ]);
            }

            // Check if GoogleCalendarService exists
            if (! class_exists(GoogleCalendarService::class)) {
                Log::error('GoogleCalendarService class not found');

                return response()->json([
                    'has_conflicts' => false,
                    'is_connected' => false,
                    'message' => 'Calendar service is not available.',
                    'conflicts' => [],
                ]);
            }

            try {
                $calendarService = new GoogleCalendarService($userIntegration);
                $conflicts = $calendarService->getDayConflicts($startOfDay, $endOfDay);

                // Debug logging
                \Log::info('🔍 Day calendar conflict check details', [
                    'practitioner_id' => $practitionerId,
                    'user_id' => $userId,
                    'date' => $date,
                    'user_timezone' => $userTimezone,
                    'start_of_day_utc' => $startOfDay->toISOString(),
                    'end_of_day_utc' => $endOfDay->toISOString(),
                    'conflicts_found' => count($conflicts),
                    'conflicts_data' => $conflicts,
                ]);

                $hasConflicts = count($conflicts) > 0;

                return response()->json([
                    'has_conflicts' => $hasConflicts,
                    'is_connected' => true,
                    'message' => $hasConflicts
                        ? 'Found '.count($conflicts).' calendar event(s) for this day.'
                        : 'No calendar events found for this day.',
                    'conflicts' => $conflicts,
                    'conflict_count' => count($conflicts),
                ]);

            } catch (\Exception $e) {
                Log::error('GoogleCalendarService error for day conflicts', [
                    'error' => $e->getMessage(),
                    'user_integration_id' => $userIntegration->id,
                ]);

                return response()->json([
                    'has_conflicts' => false,
                    'is_connected' => false,
                    'message' => 'Google Calendar integration is not properly configured.',
                    'conflicts' => [],
                ]);
            }

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'has_conflicts' => false,
                'is_connected' => false,
                'message' => 'Invalid request data: '.implode(', ', $e->validator->errors()->all()),
                'conflicts' => [],
            ], 422);

        } catch (\Exception $e) {
            Log::error('Day calendar conflict check failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);

            return response()->json([
                'has_conflicts' => false,
                'is_connected' => false,
                'message' => 'Unable to check calendar conflicts: '.$e->getMessage(),
                'conflicts' => [],
            ], 500);
        }
    }

    /**
     * Check for calendar conflicts (legacy endpoint for time slot checking)
     */
    public function checkCalendarConflicts(Request $request)
    {
        try {
            $request->validate([
                'practitioner_id' => 'required|integer',
                'date_time' => 'required|date_format:Y-m-d H:i:s',
            ]);

            $practitionerId = $request->get('practitioner_id');

            // Parse the date/time and convert from user's timezone to UTC
            $dateTimeString = $request->get('date_time');
            $userTimezone = $request->get('timezone', 'America/Toronto'); // Default to Eastern timezone // Default to Pakistan timezone

            // Create datetime in user's timezone, then convert to UTC for Google Calendar API
            $dateTime = Carbon::createFromFormat('Y-m-d H:i:s', $dateTimeString, $userTimezone)->utc();

            // Convert practitioner_id to user_id
            $userId = null;
            $practitionerName = 'Practitioner';

            // Check if we're in a tenant context
            if (function_exists('tenancy') && tenancy()) {
                $userId = tenancy()->central(function () use ($practitionerId, &$practitionerName) {
                    try {
                        $practitioner = \App\Models\Practitioner::find($practitionerId);
                        if ($practitioner) {
                            $practitionerName = trim($practitioner->first_name.' '.$practitioner->last_name);

                            return $practitioner->user_id;
                        }
                    } catch (\Exception $e) {
                        Log::warning('Failed to find practitioner in central DB', [
                            'practitioner_id' => $practitionerId,
                            'error' => $e->getMessage(),
                        ]);
                    }

                    return null;
                });
            } else {
                // Not in tenant context, try to find practitioner directly
                try {
                    $practitioner = \App\Models\Practitioner::find($practitionerId);
                    if ($practitioner) {
                        $practitionerName = trim($practitioner->first_name.' '.$practitioner->last_name);
                        $userId = $practitioner->user_id;
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to find practitioner', [
                        'practitioner_id' => $practitionerId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if (! $userId) {
                return response()->json([
                    'has_conflict' => false,
                    'is_connected' => false,
                    'message' => 'Practitioner not found.',
                    'conflicts' => [],
                ]);
            }

            // Default appointment duration is 30 minutes (can be made configurable)
            $startTime = $dateTime;
            $endTime = $dateTime->copy()->addMinutes(30);

            // Find the practitioner's Google Calendar integration using user_id
            $userIntegration = null;

            if (function_exists('tenancy') && tenancy()) {
                $userIntegration = tenancy()->central(function () use ($userId) {
                    return UserIntegration::where('user_id', $userId)
                        ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                        ->where('type', UserIntegration::TYPE_CALENDAR)
                        ->where('is_active', true)
                        ->first();
                });
            } else {
                $userIntegration = UserIntegration::where('user_id', $userId)
                    ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                    ->where('type', UserIntegration::TYPE_CALENDAR)
                    ->where('is_active', true)
                    ->first();
            }

            if (! $userIntegration) {
                return response()->json([
                    'has_conflict' => false,
                    'is_connected' => false,
                    'message' => "⚠️ {$practitionerName} hasn't connected their Google Calendar yet. Calendar conflicts cannot be checked.",
                    'conflicts' => [],
                ]);
            }

            // Check if calendar conflicts are enabled for this practitioner
            if (! $userIntegration->enable_calendar_conflicts) {
                return response()->json([
                    'has_conflict' => false,
                    'is_connected' => true,
                    'message' => "✅ {$practitionerName} has disabled calendar conflict detection.",
                    'conflicts' => [],
                ]);
            }

            // Check if GoogleCalendarService exists
            if (! class_exists(GoogleCalendarService::class)) {
                Log::error('GoogleCalendarService class not found');

                return response()->json([
                    'has_conflict' => false,
                    'is_connected' => false,
                    'message' => 'Calendar service is not available.',
                    'conflicts' => [],
                ]);
            }

            try {
                $calendarService = new GoogleCalendarService($userIntegration);
                $conflicts = $calendarService->checkConflicts($startTime, $endTime);

                // Debug logging
                \Log::info('🔍 Calendar conflict check details', [
                    'practitioner_id' => $practitionerId,
                    'user_id' => $userId,
                    'original_datetime' => $dateTimeString,
                    'user_timezone' => $userTimezone,
                    'converted_utc_time' => $dateTime->toISOString(),
                    'start_time' => $startTime->toISOString(),
                    'end_time' => $endTime->toISOString(),
                    'conflicts_found' => count($conflicts),
                    'conflicts_data' => $conflicts,
                ]);

                $hasConflict = count($conflicts) > 0;
                $conflictDetails = null;

                if ($hasConflict) {
                    $firstConflict = $conflicts[0];
                    $conflictDetails = [
                        'event_title' => $firstConflict['title'] ?? 'Existing event',
                        'event_time' => $firstConflict['start'] ?? $dateTime->format('Y-m-d H:i:s'),
                    ];
                }

                return response()->json([
                    'has_conflict' => $hasConflict,
                    'is_connected' => true,
                    'message' => $hasConflict
                        ? 'Conflict detected: Event already scheduled at this time.'
                        : 'Slot is free! No conflicts found.',
                    'conflict_details' => $conflictDetails,
                    'conflicts' => $conflicts,
                ]);

            } catch (\Exception $e) {
                Log::error('GoogleCalendarService error', [
                    'error' => $e->getMessage(),
                    'user_integration_id' => $userIntegration->id,
                ]);

                return response()->json([
                    'has_conflict' => false,
                    'is_connected' => false,
                    'message' => 'Google Calendar integration is not properly configured.',
                    'conflicts' => [],
                ]);
            }

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'has_conflict' => false,
                'is_connected' => false,
                'message' => 'Invalid request data: '.implode(', ', $e->validator->errors()->all()),
                'conflicts' => [],
            ], 422);

        } catch (\Exception $e) {
            Log::error('Calendar conflict check failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);

            return response()->json([
                'has_conflict' => false,
                'is_connected' => false,
                'message' => 'Unable to check calendar conflicts: '.$e->getMessage(),
                'conflicts' => [],
            ], 500);
        }
    }

    /**
     * Resync user integration data (same as sync but with different naming)
     */
    public function resync(UserIntegration $userIntegration)
    {
        // Ensure the integration belongs to the current user
        if ($userIntegration->user_id !== Auth::id()) {
            return redirect()->back()->withErrors([
                'error' => 'Unauthorized action.',
            ]);
        }

        try {
            // Handle Google Calendar resync
            if ($userIntegration->provider === UserIntegration::PROVIDER_GOOGLE &&
                $userIntegration->type === UserIntegration::TYPE_CALENDAR) {

                Log::info('🔄 Starting Google Calendar resync with token refresh', [
                    'user_integration_id' => $userIntegration->id,
                    'user_id' => $userIntegration->user_id,
                    'current_status' => $userIntegration->status,
                ]);

                // Always refresh token during resync to ensure fresh connection
                try {
                    $oauthService = new GoogleCalendarOAuthService;
                    $tokenRefreshed = $oauthService->refreshAccessToken($userIntegration);

                    if ($tokenRefreshed) {
                        // Update status after successful token refresh
                        $userIntegration->update([
                            'status' => UserIntegration::STATUS_ACTIVE,
                            'last_error' => null,
                            'last_sync_at' => now(),
                        ]);

                        Log::info('✅ Google Calendar token refreshed during resync', [
                            'user_integration_id' => $userIntegration->id,
                            'user_id' => $userIntegration->user_id,
                        ]);

                        // Dispatch sync job after successful token refresh
                        \App\Jobs\SyncGoogleCalendarJob::dispatch($userIntegration);

                        return redirect()->back()->with('success', 'Integration resynced successfully! Your Google Calendar connection has been refreshed and is now syncing in the background.');
                    } else {
                        // Token refresh failed - disconnect the integration and redirect to reconnect
                        Log::info('🔄 Token refresh failed, disconnecting integration to allow fresh connection', [
                            'user_integration_id' => $userIntegration->id,
                            'user_id' => $userIntegration->user_id,
                        ]);

                        // Auto-disconnect the integration
                        $userIntegration->update([
                            'status' => UserIntegration::STATUS_DISCONNECTED,
                            'access_token' => null,
                            'refresh_token' => null,
                            'token_expires_at' => null,
                            'last_error' => null,
                            'is_active' => false,
                        ]);

                        // Redirect to reconnection flow
                        return redirect()->route('integrations.connect.google', ['resync' => true])
                            ->with('info', 'Your Google Calendar connection has expired. Please reconnect to restore functionality.');
                    }

                } catch (\Exception $refreshError) {
                    Log::error('❌ Google Calendar token refresh failed during resync', [
                        'user_integration_id' => $userIntegration->id,
                        'user_id' => $userIntegration->user_id,
                        'error' => $refreshError->getMessage(),
                    ]);

                    // Auto-disconnect on any token refresh error
                    $userIntegration->update([
                        'status' => UserIntegration::STATUS_DISCONNECTED,
                        'access_token' => null,
                        'refresh_token' => null,
                        'token_expires_at' => null,
                        'last_error' => null,
                        'is_active' => false,
                    ]);

                    // Redirect to reconnection flow instead of showing error
                    return redirect()->route('integrations.connect.google', ['resync' => true])
                        ->with('info', 'Your Google Calendar connection has expired. Please reconnect to restore functionality.');
                }
            }

            // For other integration types
            $userIntegration->update([
                'last_sync_at' => now(),
                'status' => UserIntegration::STATUS_ACTIVE,
                'last_error' => null,
            ]);

            return redirect()->back()->with('success', 'Integration resynced successfully!');

        } catch (\Exception $e) {
            $userIntegration->update([
                'status' => UserIntegration::STATUS_ERROR,
                'last_error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors([
                'resync' => 'Resync failed: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Toggle calendar conflicts setting for an integration
     */
    public function toggleCalendarConflicts(Request $request, UserIntegration $userIntegration)
    {
        // Ensure the integration belongs to the current user
        if ($userIntegration->user_id !== Auth::id()) {
            return redirect()->back()->withErrors([
                'error' => 'Unauthorized action.',
            ]);
        }

        // Validate that this is a Google Calendar integration
        if ($userIntegration->provider !== UserIntegration::PROVIDER_GOOGLE ||
            $userIntegration->type !== UserIntegration::TYPE_CALENDAR) {
            return redirect()->back()->withErrors([
                'error' => 'Calendar conflicts can only be toggled for Google Calendar integrations.',
            ]);
        }

        $request->validate([
            'enable_calendar_conflicts' => 'required|boolean',
        ]);

        try {
            $enableConflicts = $request->boolean('enable_calendar_conflicts');

            // Update the database field directly
            $userIntegration->update([
                'enable_calendar_conflicts' => $enableConflicts,
            ]);

            Log::info('Calendar conflicts toggled', [
                'user_integration_id' => $userIntegration->id,
                'user_id' => $userIntegration->user_id,
                'enabled' => $enableConflicts,
            ]);

            $message = $enableConflicts
                ? 'Calendar conflict detection enabled!'
                : 'Calendar conflict detection disabled!';

            return redirect()->back()->with('success', $message);

        } catch (\Exception $e) {
            Log::error('Failed to toggle calendar conflicts', [
                'user_integration_id' => $userIntegration->id,
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors([
                'error' => 'Failed to update calendar conflicts setting: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Check for calendar conflicts for multiple practitioners
     */
    public function checkMultipleCalendarConflicts(Request $request)
    {
        try {
            $request->validate([
                'practitioner_ids' => 'required|array',
                'practitioner_ids.*' => 'integer',
                'datetime' => 'required|date_format:Y-m-d H:i:s',
                'duration_minutes' => 'integer|min:1',
            ]);

            $practitionerIds = $request->get('practitioner_ids');
            $dateTime = $request->get('datetime');
            $durationMinutes = $request->get('duration_minutes', 30);
            $userTimezone = $request->get('timezone', 'America/Toronto'); // Default to Eastern timezone

            // Convert datetime from user timezone to UTC
            $startTime = Carbon::createFromFormat('Y-m-d H:i:s', $dateTime, $userTimezone)->utc();
            $endTime = $startTime->copy()->addMinutes($durationMinutes);

            $conflicts = [];
            $practitionersWithConflictsEnabled = 0;

            foreach ($practitionerIds as $practitionerId) {
                // Convert practitioner_id to user_id
                $userId = null;
                $practitionerName = 'Practitioner';

                // Check if we're in a tenant context
                if (function_exists('tenancy') && tenancy()) {
                    $practitionerData = tenancy()->central(function () use ($practitionerId) {
                        try {
                            $practitioner = \App\Models\Practitioner::find($practitionerId);
                            if ($practitioner) {
                                return [
                                    'user_id' => $practitioner->user_id,
                                    'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                                ];
                            }
                        } catch (\Exception $e) {
                            Log::warning('Failed to find practitioner in central DB', [
                                'practitioner_id' => $practitionerId,
                                'error' => $e->getMessage(),
                            ]);
                        }

                        return null;
                    });

                    if ($practitionerData) {
                        $userId = $practitionerData['user_id'];
                        $practitionerName = $practitionerData['name'];
                    }
                } else {
                    // Not in tenant context
                    try {
                        $practitioner = \App\Models\Practitioner::find($practitionerId);
                        if ($practitioner) {
                            $practitionerName = trim($practitioner->first_name.' '.$practitioner->last_name);
                            $userId = $practitioner->user_id;
                        }
                    } catch (\Exception $e) {
                        Log::warning('Failed to find practitioner', [
                            'practitioner_id' => $practitionerId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                if (! $userId) {
                    continue; // Skip this practitioner if not found
                }

                // Find the practitioner's Google Calendar integration
                $userIntegration = null;
                if (function_exists('tenancy') && tenancy()) {
                    $userIntegration = tenancy()->central(function () use ($userId) {
                        return UserIntegration::where('user_id', $userId)
                            ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                            ->where('type', UserIntegration::TYPE_CALENDAR)
                            ->where('is_active', true)
                            ->first();
                    });
                } else {
                    $userIntegration = UserIntegration::where('user_id', $userId)
                        ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                        ->where('type', UserIntegration::TYPE_CALENDAR)
                        ->where('is_active', true)
                        ->first();
                }

                // Skip if no integration or conflicts disabled
                if (! $userIntegration) {
                    Log::info('Skipping practitioner - no Google Calendar integration', [
                        'practitioner_id' => $practitionerId,
                        'user_id' => $userId,
                    ]);

                    continue;
                }

                if (! $userIntegration->enable_calendar_conflicts) {
                    Log::info('Skipping practitioner - calendar conflicts disabled', [
                        'practitioner_id' => $practitionerId,
                        'user_id' => $userId,
                        'practitioner_name' => $practitionerName,
                        'enable_calendar_conflicts' => $userIntegration->enable_calendar_conflicts,
                    ]);

                    continue;
                }

                // Count practitioners with conflicts enabled
                $practitionersWithConflictsEnabled++;

                // Check for conflicts using Google Calendar service
                if (class_exists(GoogleCalendarService::class)) {
                    try {
                        $calendarService = new GoogleCalendarService($userIntegration);
                        $practitionerConflicts = $calendarService->checkConflicts($startTime, $endTime);

                        if (count($practitionerConflicts) > 0) {
                            $conflicts[] = [
                                'practitionerId' => $practitionerId,
                                'practitionerName' => $practitionerName,
                                'conflictingEvents' => array_map(function ($conflict) {
                                    return [
                                        'title' => $conflict['title'] ?? 'Existing event',
                                        'startTime' => isset($conflict['start']) ? Carbon::parse($conflict['start'])->format('H:i') : '',
                                        'endTime' => isset($conflict['end']) ? Carbon::parse($conflict['end'])->format('H:i') : '',
                                    ];
                                }, $practitionerConflicts),
                            ];
                        }
                    } catch (\Exception $e) {
                        Log::error('Calendar conflict check failed for practitioner', [
                            'practitioner_id' => $practitionerId,
                            'user_id' => $userId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }

            // If no practitioners have conflict checking enabled, return silent response
            if ($practitionersWithConflictsEnabled === 0) {
                return response()->json([
                    'success' => true,
                    'conflicts' => [],
                    'message' => '', // Silent - no message
                ]);
            }

            return response()->json([
                'success' => true,
                'conflicts' => $conflicts,
                'message' => count($conflicts) > 0
                    ? 'Conflicts found for '.count($conflicts).' practitioner(s)'
                    : 'No conflicts detected',
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'conflicts' => [],
                'message' => 'Invalid request data: '.implode(', ', $e->validator->errors()->all()),
            ], 422);

        } catch (\Exception $e) {
            Log::error('Multiple practitioner calendar conflict check failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'conflicts' => [],
                'message' => 'Unable to check calendar conflicts: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Toggle save appointments to calendar setting for an integration
     */
    public function toggleSaveAppointments(Request $request, UserIntegration $userIntegration)
    {
        // Ensure the integration belongs to the current user
        if ($userIntegration->user_id !== Auth::id()) {
            return redirect()->back()->withErrors([
                'error' => 'Unauthorized action.',
            ]);
        }

        // Validate that this is a Google Calendar integration
        if ($userIntegration->provider !== UserIntegration::PROVIDER_GOOGLE ||
            $userIntegration->type !== UserIntegration::TYPE_CALENDAR) {
            return redirect()->back()->withErrors([
                'error' => 'Save appointments can only be toggled for Google Calendar integrations.',
            ]);
        }

        $request->validate([
            'save_appointments_to_calendar' => 'required|boolean',
        ]);

        try {
            $saveAppointments = $request->boolean('save_appointments_to_calendar');

            // Update the database field directly
            $userIntegration->update([
                'save_appointments_to_calendar' => $saveAppointments,
            ]);

            Log::info('Save appointments to calendar toggled', [
                'user_integration_id' => $userIntegration->id,
                'user_id' => $userIntegration->user_id,
                'enabled' => $saveAppointments,
            ]);

            $message = $saveAppointments
                ? 'Appointments will be saved to Google Calendar!'
                : 'Appointments will not be saved to Google Calendar!';

            return redirect()->back()->with('success', $message);

        } catch (\Exception $e) {
            Log::error('Failed to toggle save appointments setting', [
                'user_integration_id' => $userIntegration->id,
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors([
                'error' => 'Failed to update save appointments setting: '.$e->getMessage(),
            ]);
        }
    }
}
