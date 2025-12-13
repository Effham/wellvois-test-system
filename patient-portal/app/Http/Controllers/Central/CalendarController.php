<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Models\UserIntegration;
use App\Services\GoogleCalendarService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CalendarController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        // Fetch practitioner from central database using CentralPractitioner model
        $practitioner = \App\Models\CentralPractitioner::where('user_id', $user->id)->first();

        if (! $practitioner) {
            // Log for debugging
            Log::info('No practitioner found for user', ['user_id' => $user->id]);
            abort(403, 'Access denied. You are not registered as a practitioner.');
        }

        // Get all tenants where this practitioner works
        try {
            $tenantIds = $practitioner->tenants()->pluck('tenant_id')->toArray();
            Log::info('Practitioner tenants', [
                'practitioner_id' => $practitioner->id,
                'tenant_ids' => $tenantIds,
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting practitioner tenants', [
                'practitioner_id' => $practitioner->id,
                'error' => $e->getMessage(),
            ]);
            $tenantIds = [];
        }

        $appointments = [];

        // Fetch only confirmed appointments from all tenants
        foreach ($tenantIds as $tenantId) {
            try {
                $tenant = \App\Models\Tenant::find($tenantId);
                if (! $tenant) {
                    continue;
                }

                // Get tenant company name from JSON settings
                $companyName = $tenant->company_name ?? 'Unknown Clinic';

                // Switch to tenant database and fetch appointments
                tenancy()->initialize($tenant);

                // Get tenant practitioner using central_practitioner_id
                // After migration, appointment_practitioner.practitioner_id stores tenant practitioner IDs
                $tenantPractitioner = \App\Models\Practitioner::where('central_practitioner_id', $practitioner->id)->first();

                if (! $tenantPractitioner) {
                    Log::warning('Tenant practitioner not found for central practitioner', [
                        'central_practitioner_id' => $practitioner->id,
                        'tenant_id' => $tenantId,
                    ]);
                    tenancy()->end();

                    continue;
                }

                // Use tenant practitioner ID to query appointments
                $tenantAppointments = \App\Models\Tenant\Appointment::with(['service', 'location'])
                    ->select('appointments.*', 'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
                    ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                    ->where('appointment_practitioner.practitioner_id', $tenantPractitioner->id)
                    // ->where('status', 'confirmed') // Only show confirmed appointments
                    ->whereNotNull('appointment_practitioner.start_time')
                    ->orderBy('appointment_practitioner.start_time', 'asc')
                    ->get();

                foreach ($tenantAppointments as $appointment) {
                    // Get patient from TENANT database (we're already in tenant context)
                    $patient = null;
                    if ($appointment->patient_id) {
                        // Use tenant-level Patient model to fetch from current tenant's database
                        $patient = \App\Models\Tenant\Patient::find($appointment->patient_id);
                    }

                    $service = $appointment->service;
                    $location = $appointment->location;

                    // Build patient name from tenant patient data
                    $patientName = $patient
                        ? trim($patient->first_name.' '.$patient->last_name)
                        : 'Unknown Patient';

                    // Use start_time and end_time from pivot table (stored in UTC)
                    // Send UTC times to frontend - frontend will convert using JavaScript
                    $utcStartTime = \Carbon\Carbon::parse($appointment->start_time);
                    $utcEndTime = \Carbon\Carbon::parse($appointment->end_time);
                    $durationMinutes = $utcStartTime->diffInMinutes($utcEndTime);

                    $appointments[] = [
                        'id' => $appointment->id,
                        'tenant_id' => $tenantId,
                        'title' => ($service ? $service->name : 'Appointment').' - '.$patientName,
                        'date' => $utcStartTime->format('Y-m-d'),
                        'time' => $utcStartTime->format('H:i'),
                        'duration' => $durationMinutes, // Calculate actual duration from pivot table
                        'patient' => $patientName,
                        'practitioner' => $practitioner->first_name.' '.$practitioner->last_name,
                        'type' => $service ? $service->name : 'General Consultation',
                        'status' => $appointment->status, // Use actual status instead of hardcoding 'confirmed'
                        'location' => $location ? $location->name : ($appointment->mode === 'virtual' ? 'Virtual' : 'Unknown Location'),
                        'clinic' => $companyName,
                        'source' => 'clinic',
                        'clickable' => true,
                        'mode' => $appointment->mode,
                        'appointment_datetime' => $utcStartTime->toISOString(),
                        'timezone' => 'UTC', // Times are in UTC, frontend will convert
                        'start_time' => $utcStartTime->toISOString(), // UTC time
                        'end_time' => $utcEndTime->toISOString(), // UTC time
                        'utc_start_time' => $utcStartTime->toISOString(), // Explicit UTC for frontend conversion
                        'utc_end_time' => $utcEndTime->toISOString(), // Explicit UTC for frontend conversion
                    ];
                }

                // Return to central database
                tenancy()->end();
            } catch (\Exception $e) {
                // Log error and continue with other tenants
                Log::error('Error fetching appointments from tenant: '.$tenantId, [
                    'error' => $e->getMessage(),
                    'practitioner_id' => $practitioner->id,
                ]);

                // Make sure we return to central context even if there's an error
                try {
                    tenancy()->end();
                } catch (\Exception $endError) {
                    // Ignore end errors
                }

                continue;
            }
        }

        // Fetch Google Calendar events and filter out duplicates
        $googleCalendarEvents = $this->fetchGoogleCalendarEvents($user, $practitioner, $appointments);

        // Add non-duplicate Google Calendar events to appointments
        if (! empty($googleCalendarEvents)) {
            $appointments = array_merge($appointments, $googleCalendarEvents);
        }

        return Inertia::render('Calendar/Index', [
            'appointments' => $appointments,
            'currentDate' => now()->toDateString(),
            'isCentral' => true,
            'practitioner' => $practitioner,
        ]);
    }

    /**
     * Fetch Google Calendar events for the practitioner, filtering out duplicates
     */
    private function fetchGoogleCalendarEvents($user, $practitioner, array $dbAppointments = []): array
    {
        $googleEvents = [];

        try {
            // Get user's Google Calendar integration
            $googleIntegration = UserIntegration::forUser($user->id)
                ->byType(UserIntegration::TYPE_CALENDAR)
                ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                ->active()
                ->configured()
                ->first();

            if (! $googleIntegration || ! $googleIntegration->isConnected()) {
                Log::info('No Google Calendar integration found for practitioner', [
                    'practitioner_id' => $practitioner->id,
                    'user_id' => $user->id,
                ]);

                return [];
            }

            // Initialize Google Calendar service
            $calendarService = new GoogleCalendarService($googleIntegration);

            // Get events for the next 30 days (you can adjust this range)
            $startDate = Carbon::now()->startOfDay();
            $endDate = Carbon::now()->addDays(30)->endOfDay();

            $events = $calendarService->getDayConflicts($startDate, $endDate);

            Log::info('Fetched Google Calendar events for practitioner', [
                'practitioner_id' => $practitioner->id,
                'events_count' => count($events),
                'date_range' => [
                    'start' => $startDate->format('Y-m-d'),
                    'end' => $endDate->format('Y-m-d'),
                ],
            ]);

            // Transform Google Calendar events to match appointment format, filtering out duplicates
            foreach ($events as $event) {
                // Google Calendar returns UTC times
                // Send UTC times to frontend - frontend will convert using JavaScript
                $utcStartTime = Carbon::parse($event['start']);
                $utcEndTime = Carbon::parse($event['end']);

                // Check if this Google Calendar event matches any database appointment
                $isDuplicate = false;
                foreach ($dbAppointments as $dbAppointment) {
                    $dbStartTime = Carbon::parse($dbAppointment['start_time']);
                    $dbEndTime = Carbon::parse($dbAppointment['end_time']);

                    // Consider it a duplicate if times match within 5 minutes tolerance
                    if (abs($utcStartTime->diffInMinutes($dbStartTime)) <= 5 &&
                        abs($utcEndTime->diffInMinutes($dbEndTime)) <= 5) {
                        $isDuplicate = true;
                        break;
                    }
                }

                // Skip this Google Calendar event if it's a duplicate of a database appointment
                if ($isDuplicate) {
                    Log::info('Skipping duplicate Google Calendar event', [
                        'google_event_id' => $event['id'],
                        'google_event_title' => $event['title'],
                        'google_start_time' => $utcStartTime->toISOString(),
                        'practitioner_id' => $practitioner->id,
                    ]);

                    continue;
                }

                $durationMinutes = $utcStartTime->diffInMinutes($utcEndTime);

                $googleEvents[] = [
                    'id' => 'google_'.$event['id'],
                    'tenant_id' => null, // Google events don't belong to a tenant
                    'title' => $event['title'].' (Google Calendar)',
                    'date' => $utcStartTime->format('Y-m-d'),
                    'time' => $utcStartTime->format('H:i'),
                    'duration' => $durationMinutes,
                    'patient' => '', // Google events may not have patient info
                    'practitioner' => $practitioner->first_name.' '.$practitioner->last_name,
                    'type' => 'Google Calendar Event',
                    'status' => 'external', // Mark as external event
                    'location' => $event['location'] ?? 'Not specified',
                    'clinic' => 'Google Calendar',
                    'source' => 'google',
                    'icon' => 'google', // Add Google icon identifier
                    'clickable' => false, // Google events are not editable in our system
                    'mode' => ! empty($event['location']) ? 'physical' : 'virtual',
                    'appointment_datetime' => $utcStartTime->toISOString(),
                    'timezone' => 'UTC', // Times are in UTC, frontend will convert
                    'start_time' => $utcStartTime->toISOString(), // UTC time
                    'end_time' => $utcEndTime->toISOString(), // UTC time
                    'utc_start_time' => $utcStartTime->toISOString(), // Explicit UTC for frontend conversion
                    'utc_end_time' => $utcEndTime->toISOString(), // Explicit UTC for frontend conversion
                    'description' => $event['description'] ?? '',
                    'is_all_day' => $event['is_all_day'] ?? false,
                ];
            }

        } catch (\Exception $e) {
            Log::error('Error fetching Google Calendar events for practitioner', [
                'practitioner_id' => $practitioner->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't throw the exception, just log it and continue
            // We don't want Google Calendar issues to break the entire calendar view
        }

        return $googleEvents;
    }
}
