<?php

namespace App\Services;

use App\Models\UserIntegration;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;
use Spatie\GoogleCalendar\Event;

class GoogleCalendarService
{
    protected $userIntegration;

    public function __construct(UserIntegration $userIntegration)
    {
        $this->userIntegration = $userIntegration;

        // Check if integration is active, but allow for error states that can be recovered
        if (! $this->userIntegration->is_active || ! $this->userIntegration->is_configured) {
            throw new Exception('Google Calendar integration is not active or configured');
        }

        // If integration is in error state, try to recover by refreshing token
        if ($this->userIntegration->status === UserIntegration::STATUS_ERROR) {
            Log::info('🔄 Google Calendar integration in error state, attempting to recover', [
                'user_integration_id' => $this->userIntegration->id,
                'last_error' => $this->userIntegration->last_error,
            ]);

            try {
                $oauthService = new GoogleCalendarOAuthService;
                if ($oauthService->refreshAccessToken($this->userIntegration)) {
                    // Reload the integration after successful token refresh
                    $this->userIntegration->refresh();
                    Log::info('✅ Google Calendar integration recovered successfully', [
                        'user_integration_id' => $this->userIntegration->id,
                    ]);
                } else {
                    throw new Exception('Failed to refresh Google Calendar token. User needs to reconnect.');
                }
            } catch (Exception $e) {
                Log::error('❌ Failed to recover Google Calendar integration', [
                    'user_integration_id' => $this->userIntegration->id,
                    'error' => $e->getMessage(),
                ]);
                throw new Exception('Google Calendar integration could not be recovered: '.$e->getMessage());
            }
        }

        // Ensure we have a connected integration now
        if (! $this->userIntegration->isConnected()) {
            throw new Exception('Google Calendar integration is not properly connected');
        }

        // Set up the calendar configuration for this user's integration
        $this->configureGoogleCalendar();
    }

    /**
     * Configure Google Calendar for this user's integration with automatic token refresh
     */
    protected function configureGoogleCalendar()
    {
        // Get fresh access token (will refresh automatically if needed)
        $oauthService = new GoogleCalendarOAuthService;
        $accessToken = $oauthService->getValidAccessToken($this->userIntegration);

        if (! $accessToken) {
            throw new Exception('Unable to get valid access token. User may need to reconnect Google Calendar.');
        }

        // Reload integration to get updated credentials after potential refresh
        $this->userIntegration->refresh();
        $credentials = $this->userIntegration->credentials;

        if (! $credentials || ! isset($credentials['calendar_id'])) {
            throw new Exception('Google Calendar credentials not properly configured');
        }

        // Configure the calendar ID for this user
        config(['google-calendar.calendar_id' => $credentials['calendar_id']]);

        // Configure OAuth auth with fresh token
        config(['google-calendar.default_auth_profile' => 'oauth']);

        // Store tokens temporarily for this request
        $this->storeTemporaryTokens($credentials);
    }

    /**
     * Store temporary OAuth tokens for the current request
     */
    protected function storeTemporaryTokens($credentials)
    {
        $tokenData = [
            'access_token' => $credentials['access_token'],
            'refresh_token' => $credentials['refresh_token'] ?? null,
            'expires_in' => $credentials['expires_in'] ?? 3600,
            'created' => $credentials['created'] ?? time(),
        ];

        // Create a temporary token file for this request
        $tempTokenPath = storage_path('app/google-calendar/temp-token-'.$this->userIntegration->id.'.json');

        if (! file_exists(dirname($tempTokenPath))) {
            mkdir(dirname($tempTokenPath), 0755, true);
        }

        file_put_contents($tempTokenPath, json_encode($tokenData));

        // Update config to use the temporary token file
        config(['google-calendar.auth_profiles.oauth.token_json' => $tempTokenPath]);
    }

    /**
     * Check for calendar conflicts at a specific date and time
     */
    public function checkConflicts(Carbon $startDateTime, Carbon $endDateTime): array
    {
        try {
            \Log::info('📅 Fetching events from Google Calendar', [
                'start_time' => $startDateTime->toISOString(),
                'end_time' => $endDateTime->toISOString(),
                'calendar_id' => $this->userIntegration->credentials['calendar_id'] ?? 'unknown',
            ]);

            // Get events for the specified time range
            $events = Event::get($startDateTime, $endDateTime);

            // Note: EMR event filtering is now handled directly in the loop below

            \Log::info('📊 Events retrieved from Google Calendar', [
                'events_count' => count($events),
                'events_data' => collect($events)->map(function ($event) {
                    return [
                        'id' => $event->id,
                        'title' => $event->name,
                        'start' => $event->startDateTime ? Carbon::parse($event->startDateTime)->format('Y-m-d H:i:s T') :
                                  ($event->startDate ? Carbon::parse($event->startDate)->format('Y-m-d H:i:s T') : null),
                        'end' => $event->endDateTime ? Carbon::parse($event->endDateTime)->format('Y-m-d H:i:s T') :
                                ($event->endDate ? Carbon::parse($event->endDate)->format('Y-m-d H:i:s T') : null),
                    ];
                })->toArray(),
            ]);

            $conflicts = [];

            foreach ($events as $event) {
                // Skip events that were created by EMR system
                $isEmrCreated = $this->isEmrCreatedEvent($event);

                if ($isEmrCreated) {
                    continue; // Skip EMR-created events (already logged in isEmrCreatedEvent method)
                }

                // Check if there's an overlap
                $eventStart = $event->startDateTime ?: $event->startDate;
                $eventEnd = $event->endDateTime ?: $event->endDate;

                if ($eventStart && $eventEnd) {
                    $eventStartCarbon = Carbon::parse($eventStart);
                    $eventEndCarbon = Carbon::parse($eventEnd);

                    // Check for overlap
                    if ($this->hasTimeOverlap($startDateTime, $endDateTime, $eventStartCarbon, $eventEndCarbon)) {
                        $conflicts[] = [
                            'id' => $event->id,
                            'title' => $event->name,
                            'start' => $eventStartCarbon->format('Y-m-d H:i:s'),
                            'end' => $eventEndCarbon->format('Y-m-d H:i:s'),
                            'description' => $event->description,
                        ];
                    }
                }
            }

            return $conflicts;

        } catch (Exception $e) {
            Log::error('Google Calendar conflict check failed', [
                'user_integration_id' => $this->userIntegration->id,
                'error' => $e->getMessage(),
                'start_time' => $startDateTime->toISOString(),
                'end_time' => $endDateTime->toISOString(),
            ]);

            // Update integration with error
            $this->userIntegration->update([
                'last_error' => 'Failed to check calendar conflicts: '.$e->getMessage(),
                'status' => UserIntegration::STATUS_ERROR,
            ]);

            throw $e;
        }
    }

    /**
     * Create a calendar event for an appointment
     */
    public function createAppointmentEvent(array $appointmentData): ?string
    {
        try {
            $event = new Event;

            $event->name = $appointmentData['title'] ?? 'Appointment';

            // Add EMR identifier to description to mark this as an EMR-created event
            $emrIdentifier = '[EMR-CREATED]';
            $originalDescription = $appointmentData['description'] ?? '';
            $event->description = $emrIdentifier.' '.$originalDescription;

            $event->startDateTime = Carbon::parse($appointmentData['start_time']);
            $event->endDateTime = Carbon::parse($appointmentData['end_time']);

            // Add attendees if provided
            if (! empty($appointmentData['patient_email'])) {
                $event->addAttendee([
                    'email' => $appointmentData['patient_email'],
                    'name' => $appointmentData['patient_name'] ?? '',
                    'responseStatus' => 'needsAction',
                ]);
            }

            // Add location if provided
            if (! empty($appointmentData['location'])) {
                $event->location = $appointmentData['location'];
            }

            // Add source URL to link back to the appointment
            if (! empty($appointmentData['source_url'])) {
                $event->source = [
                    'title' => 'View Appointment',
                    'url' => $appointmentData['source_url'],
                ];
            }

            // Set color for appointment events
            $event->setColorId(9); // Blue color for appointments

            $savedEvent = $event->save();

            // Update last sync time
            $this->userIntegration->update([
                'last_sync_at' => now(),
                'last_error' => null,
            ]);

            Log::info('✅ Google Calendar API: Event Successfully Saved!', [
                'message' => 'Event has been created and saved to Google Calendar',
                'user_integration_id' => $this->userIntegration->id,
                'google_event_id' => $savedEvent->id,
                'appointment_title' => $appointmentData['title'] ?? 'Appointment',
                'event_details' => [
                    'start_time' => $appointmentData['start_time'],
                    'end_time' => $appointmentData['end_time'],
                    'patient_invited' => ! empty($appointmentData['patient_email']),
                    'location_set' => ! empty($appointmentData['location']),
                    'description_added' => ! empty($appointmentData['description']),
                    'source_link_added' => ! empty($appointmentData['source_url']),
                ],
                'google_calendar_data' => [
                    'event_url' => 'https://calendar.google.com/calendar/event?eid='.base64_encode($savedEvent->id),
                    'event_color' => 'Blue (#1BA1E2)',
                    'calendar_id' => $this->userIntegration->credentials['calendar_id'] ?? 'primary',
                    'attendees_count' => ! empty($appointmentData['patient_email']) ? 1 : 0,
                ],
                'integration_status' => [
                    'last_sync_updated' => true,
                    'error_cleared' => true,
                    'status' => 'active',
                ],
            ]);

            return $savedEvent->id;

        } catch (Exception $e) {
            Log::error('Google Calendar event creation failed', [
                'user_integration_id' => $this->userIntegration->id,
                'error' => $e->getMessage(),
                'appointment_data' => $appointmentData,
            ]);

            // Update integration with error
            $this->userIntegration->update([
                'last_error' => 'Failed to create calendar event: '.$e->getMessage(),
                'status' => UserIntegration::STATUS_ERROR,
            ]);

            throw $e;
        }
    }

    /**
     * Update an existing calendar event
     */
    public function updateAppointmentEvent(string $eventId, array $appointmentData): bool
    {
        try {
            $event = Event::find($eventId);

            if (! $event) {
                throw new Exception('Calendar event not found');
            }

            $event->name = $appointmentData['title'] ?? $event->name;

            // Maintain EMR identifier when updating
            if (isset($appointmentData['description'])) {
                $emrIdentifier = '[EMR-CREATED]';
                $event->description = $emrIdentifier.' '.$appointmentData['description'];
            }

            if (isset($appointmentData['start_time'])) {
                $event->startDateTime = Carbon::parse($appointmentData['start_time']);
            }

            if (isset($appointmentData['end_time'])) {
                $event->endDateTime = Carbon::parse($appointmentData['end_time']);
            }

            if (! empty($appointmentData['location'])) {
                $event->location = $appointmentData['location'];
            }

            $event->save();

            // Update last sync time
            $this->userIntegration->update([
                'last_sync_at' => now(),
                'last_error' => null,
            ]);

            Log::info('Google Calendar event updated successfully', [
                'user_integration_id' => $this->userIntegration->id,
                'event_id' => $eventId,
            ]);

            return true;

        } catch (Exception $e) {
            Log::error('Google Calendar event update failed', [
                'user_integration_id' => $this->userIntegration->id,
                'event_id' => $eventId,
                'error' => $e->getMessage(),
            ]);

            // Update integration with error
            $this->userIntegration->update([
                'last_error' => 'Failed to update calendar event: '.$e->getMessage(),
                'status' => UserIntegration::STATUS_ERROR,
            ]);

            throw $e;
        }
    }

    /**
     * Delete a calendar event
     */
    public function deleteAppointmentEvent(string $eventId): bool
    {
        try {
            $event = Event::find($eventId);

            if (! $event) {
                throw new Exception('Calendar event not found');
            }

            $event->delete();

            // Update last sync time
            $this->userIntegration->update([
                'last_sync_at' => now(),
                'last_error' => null,
            ]);

            Log::info('Google Calendar event deleted successfully', [
                'user_integration_id' => $this->userIntegration->id,
                'event_id' => $eventId,
            ]);

            return true;

        } catch (Exception $e) {
            Log::error('Google Calendar event deletion failed', [
                'user_integration_id' => $this->userIntegration->id,
                'event_id' => $eventId,
                'error' => $e->getMessage(),
            ]);

            // Update integration with error
            $this->userIntegration->update([
                'last_error' => 'Failed to delete calendar event: '.$e->getMessage(),
                'status' => UserIntegration::STATUS_ERROR,
            ]);

            throw $e;
        }
    }

    /**
     * Test the connection to Google Calendar
     */
    public function testConnection(): array
    {
        try {
            // Try to get events from today to test the connection
            $events = Event::get(Carbon::today(), Carbon::today()->addDay());

            // Update integration status
            $this->userIntegration->update([
                'last_sync_at' => now(),
                'last_error' => null,
                'status' => UserIntegration::STATUS_ACTIVE,
            ]);

            return [
                'success' => true,
                'message' => 'Google Calendar connection is working',
                'events_count' => $events->count(),
            ];

        } catch (Exception $e) {
            // Update integration with error
            $this->userIntegration->update([
                'last_error' => 'Connection test failed: '.$e->getMessage(),
                'status' => UserIntegration::STATUS_ERROR,
            ]);

            return [
                'success' => false,
                'message' => 'Google Calendar connection failed: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Get all conflicts (events) for a specific day
     */
    public function getDayConflicts(Carbon $startOfDay, Carbon $endOfDay): array
    {
        try {
            \Log::info('📅 Fetching all events for day from Google Calendar', [
                'start_of_day' => $startOfDay->toISOString(),
                'end_of_day' => $endOfDay->toISOString(),
                'calendar_id' => $this->userIntegration->credentials['calendar_id'] ?? 'unknown',
            ]);

            // Get all events for the entire day
            $events = Event::get($startOfDay, $endOfDay);

            // Note: EMR event filtering is now handled directly in the loop below

            \Log::info('📊 All day events retrieved from Google Calendar', [
                'events_count' => count($events),
                'events_data' => collect($events)->map(function ($event) {
                    return [
                        'id' => $event->id,
                        'title' => $event->name,
                        'start' => $event->startDateTime ? Carbon::parse($event->startDateTime)->format('Y-m-d H:i:s T') :
                                  ($event->startDate ? Carbon::parse($event->startDate)->format('Y-m-d H:i:s T') : null),
                        'end' => $event->endDateTime ? Carbon::parse($event->endDateTime)->format('Y-m-d H:i:s T') :
                                ($event->endDate ? Carbon::parse($event->endDate)->format('Y-m-d H:i:s T') : null),
                    ];
                })->toArray(),
            ]);

            $conflicts = [];

            foreach ($events as $event) {
                // Skip events that were created by EMR system
                $isEmrCreated = $this->isEmrCreatedEvent($event);

                if ($isEmrCreated) {
                    continue; // Skip EMR-created events (already logged in isEmrCreatedEvent method)
                }

                $eventStart = $event->startDateTime ?: $event->startDate;
                $eventEnd = $event->endDateTime ?: $event->endDate;

                if ($eventStart && $eventEnd) {
                    $eventStartCarbon = Carbon::parse($eventStart);
                    $eventEndCarbon = Carbon::parse($eventEnd);

                    $conflicts[] = [
                        'id' => $event->id,
                        'title' => $event->name,
                        'start' => $eventStartCarbon->format('Y-m-d H:i:s'),
                        'end' => $eventEndCarbon->format('Y-m-d H:i:s'),
                        'start_time' => $eventStartCarbon->format('H:i'),
                        'end_time' => $eventEndCarbon->format('H:i'),
                        'duration' => $eventStartCarbon->diffInMinutes($eventEndCarbon).' minutes',
                        'description' => $event->description ?? '',
                        'location' => $event->location ?? '',
                        'is_all_day' => ! $event->startDateTime, // True if it's a date-only event
                    ];
                }
            }

            // Sort conflicts by start time
            usort($conflicts, function ($a, $b) {
                return strcmp($a['start'], $b['start']);
            });

            return $conflicts;

        } catch (Exception $e) {
            Log::error('Google Calendar day conflicts check failed', [
                'user_integration_id' => $this->userIntegration->id,
                'error' => $e->getMessage(),
                'start_of_day' => $startOfDay->toISOString(),
                'end_of_day' => $endOfDay->toISOString(),
            ]);

            // Update integration with error
            $this->userIntegration->update([
                'last_error' => 'Failed to check day conflicts: '.$e->getMessage(),
                'status' => UserIntegration::STATUS_ERROR,
            ]);

            throw $e;
        }
    }

    /**
     * Get Google Calendar event IDs for appointments created by this EMR system
     */
    protected function getEmrCreatedEventIds(): array
    {
        try {
            // Check if we're in a tenant context for appointments
            if (function_exists('tenancy') && tenancy()) {
                // Get all appointments with Google Calendar event IDs for this user
                $appointments = \App\Models\Tenant\Appointment::whereNotNull('google_calendar_event_id')
                    ->select('id', 'google_calendar_event_id', 'appointment_datetime', 'patient_id', 'service_id')
                    ->get();

                $eventIds = $appointments->pluck('google_calendar_event_id')->toArray();

                \Log::info('📋 Retrieved EMR-created calendar event IDs - DETAILED DEBUG', [
                    'user_integration_id' => $this->userIntegration->id,
                    'event_ids_count' => count($eventIds),
                    'event_ids' => $eventIds,
                    'appointments_with_calendar_events' => $appointments->map(function ($appointment) {
                        return [
                            'appointment_id' => $appointment->id,
                            'google_calendar_event_id' => $appointment->google_calendar_event_id,
                            'appointment_datetime' => $appointment->appointment_datetime,
                            'patient_id' => $appointment->patient_id,
                            'service_id' => $appointment->service_id,
                        ];
                    })->toArray(),
                    'tenant_id' => tenancy()->tenant?->id ?? 'unknown',
                ]);

                return $eventIds;
            }

            \Log::info('📋 Not in tenant context - returning empty array', [
                'user_integration_id' => $this->userIntegration->id,
            ]);

            return [];
        } catch (\Exception $e) {
            \Log::error('Failed to retrieve EMR-created event IDs', [
                'user_integration_id' => $this->userIntegration->id,
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * Check if a Google Calendar event was created by the EMR system
     */
    protected function isEmrCreatedEvent($event): bool
    {
        try {
            if (! function_exists('tenancy') || ! tenancy()) {
                return false;
            }

            // Method 1: Check if this Google Calendar event ID exists in appointments table
            $appointment = \App\Models\Tenant\Appointment::where('google_calendar_event_id', $event->id)->first();

            if ($appointment) {
                \Log::info('🔄 EMR appointment found by event ID - excluding from conflicts', [
                    'event_id' => $event->id,
                    'event_title' => $event->name,
                    'appointment_id' => $appointment->id,
                    'method' => 'event_id_match',
                ]);

                return true;
            }

            // Method 2: Check if event title/description contains appointment patterns
            $eventTitle = $event->name ?? '';
            $eventDescription = $event->description ?? '';

            // Look for EMR appointment patterns in title or description
            if ($this->containsAppointmentPattern($eventTitle) || $this->containsAppointmentPattern($eventDescription)) {
                \Log::info('🔄 EMR appointment found by pattern - excluding from conflicts', [
                    'event_id' => $event->id,
                    'event_title' => $event->name,
                    'method' => 'pattern_match',
                ]);

                return true;
            }

            return false;
        } catch (\Exception $e) {
            \Log::error('Error checking if event is EMR-created', [
                'event_id' => $event->id ?? 'unknown',
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Check if text contains EMR appointment patterns
     */
    protected function containsAppointmentPattern(string $text): bool
    {
        // Common EMR appointment patterns
        $patterns = [
            '/Appointment with .+ Service:/i',
            '/Appointment ID: \d+/i',
            '/Mode: (in-person|virtual|phone)/i',
            '/Service: .+ Mode:/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if two time ranges overlap
     */
    protected function hasTimeOverlap(Carbon $start1, Carbon $end1, Carbon $start2, Carbon $end2): bool
    {
        return $start1->lt($end2) && $end1->gt($start2);
    }

    /**
     * Clean up temporary token files
     */
    public function __destruct()
    {
        $tempTokenPath = storage_path('app/google-calendar/temp-token-'.$this->userIntegration->id.'.json');
        if (file_exists($tempTokenPath)) {
            unlink($tempTokenPath);
        }
    }
}
