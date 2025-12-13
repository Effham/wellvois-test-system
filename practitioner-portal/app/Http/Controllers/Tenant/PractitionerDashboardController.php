<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant\Appointment;
use App\Services\TenantTimezoneService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PractitionerDashboardController extends Controller
{
    /**
     * Display practitioner dashboard with deferred loading support
     */
    public function index(Request $request)
    {
        try {
            $user = Auth::user();

            // Check if user has Practitioner role OR tenant practitioner record
            $hasPractitionerRole = $user->hasRole('Practitioner');
            $hasTenantPractitionerRecord = Practitioner::where('user_id', $user->id)->exists();

            if (! $hasPractitionerRole && ! $hasTenantPractitionerRecord) {
                abort(403, 'Access denied. You must be a practitioner or have a practitioner record in this tenant.');
            }

            // Get practitioner data from tenant database (tenant-specific practitioner record)
            // NOTE: No select() clause - CipherSweet needs all fields to decrypt properly
            $practitioner = Practitioner::where('user_id', $user->id)->first();
            if (! $practitioner) {
                // Return with default data if practitioner not found
                return $this->returnWithDefaultData('Practitioner profile not found in system');
            }

            // Get filter parameters
            $selectedLocation = $request->get('location', 'all');
            $selectedPeriod = $request->get('period', 'today');

            // Get available locations for this practitioner using direct DB query to avoid relationship issues
            $availableLocations = $this->getPractitionerLocations($practitioner->id);

            // Get tenant timezone using TenantTimezoneService
            $tenantTimezone = TenantTimezoneService::getTenantTimezone();
            $tenantTimezoneAbbr = TenantTimezoneService::getTenantTimezoneAbbreviation();
            $tenantTimezoneDisplay = "{$tenantTimezoneAbbr} ({$tenantTimezone})";

            // Check if this is a partial reload request (deferred data loading)
            $isPartialReload = $request->header('X-Inertia-Partial-Data');

            // On initial load, return lightweight data only
            if (! $isPartialReload) {
                return Inertia::render('PractitionerDashboard/Index', [
                    'practitionerInfo' => [
                        'name' => trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? '')) ?: 'Unknown Practitioner',
                        'preferredName' => $practitioner->title ? $practitioner->title.' '.$practitioner->last_name : $practitioner->first_name ?? 'Dr.',
                        'title' => ($practitioner->title ?? '').($practitioner->primary_specialties ? ' - '.($practitioner->primary_specialties[0] ?? 'General Practice') : ''),
                        'specialty' => $practitioner->primary_specialties[0] ?? 'General Practice',
                        'licenseNumber' => $practitioner->license_number ?? 'N/A',
                        'rating' => 4.8, // Static for now
                        'totalReviews' => 124, // Static for now
                    ],
                    'availableLocations' => $availableLocations,
                    'selectedLocation' => $selectedLocation,
                    'selectedPeriod' => $selectedPeriod,
                    'isCentral' => false,
                    'tenantTimezone' => $tenantTimezone,
                    'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
                    // Heavy data set to null for deferred loading
                    'todayAppointments' => null,
                    'statistics' => null,
                    'recentActivities' => null,
                    'upcomingSchedule' => null,
                    'loadedData' => null,
                ]);
            }

            // DEFERRED HEAVY DATA LOADING (partial reload)
            // Get today's appointments
            $todayAppointments = $this->getTodayAppointments($practitioner->id, $selectedLocation);

            // Calculate statistics
            $statistics = $this->calculateStatistics($practitioner->id, $selectedLocation);

            // Get recent activities
            $recentActivities = $this->getRecentActivities($practitioner->id, $selectedLocation);

            // Get upcoming schedule
            $upcomingSchedule = $this->getUpcomingSchedule($practitioner->id, $selectedLocation);

            return Inertia::render('PractitionerDashboard/Index', [
                'practitionerInfo' => [
                    'name' => trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? '')) ?: 'Unknown Practitioner',
                    'preferredName' => $practitioner->title ? $practitioner->title.' '.$practitioner->last_name : $practitioner->first_name ?? 'Dr.',
                    'title' => ($practitioner->title ?? '').($practitioner->primary_specialties ? ' - '.($practitioner->primary_specialties[0] ?? 'General Practice') : ''),
                    'specialty' => $practitioner->primary_specialties[0] ?? 'General Practice',
                    'licenseNumber' => $practitioner->license_number ?? 'N/A',
                    'rating' => 4.8, // Static for now
                    'totalReviews' => 124, // Static for now
                ],
                'todayAppointments' => $todayAppointments,
                'statistics' => $statistics,
                'recentActivities' => $recentActivities,
                'upcomingSchedule' => $upcomingSchedule,
                'availableLocations' => $availableLocations,
                'selectedLocation' => $selectedLocation,
                'selectedPeriod' => $selectedPeriod,
                'isCentral' => false,
                'tenantTimezone' => $tenantTimezone,
                'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
                'loadedData' => true,
            ]);

        } catch (\Exception $e) {
            Log::error('Practitioner Dashboard Error: '.$e->getMessage());
            Log::error('Stack trace: '.$e->getTraceAsString());

            return $this->returnWithDefaultData('Error loading dashboard: '.$e->getMessage());
        }
    }

    private function getPractitionerLocations($practitionerId)
    {
        try {
            // Get location IDs from pivot table
            $locationIds = DB::table('location_practitioners')
                ->where('practitioner_id', $practitionerId)
                ->where('is_assigned', true)
                ->pluck('location_id');

            // Get location details
            $locations = Location::select('id', 'name', 'address')
                ->whereIn('id', $locationIds)
                ->get();

            return $locations->map(function ($location) {
                return [
                    'id' => $location->id,
                    'name' => $location->name ?? 'Unknown Location',
                    'location' => $location->address ?? 'Unknown Address',
                ];
            })->toArray();
        } catch (\Exception $e) {
            Log::error('Error getting practitioner locations: '.$e->getMessage());

            return [];
        }
    }

    private function getTodayAppointments($practitionerId, $selectedLocation)
    {
        try {
            $query = Appointment::whereHas('practitioners', function ($q) use ($practitionerId) {
                $q->where('practitioner_id', $practitionerId);
            })
                ->whereDate('appointment_datetime', Carbon::today())
                ->whereNotIn('status', ['cancelled', 'no-show']);

            if ($selectedLocation !== 'all') {
                $query->where('location_id', $selectedLocation);
            }

            $appointments = $query->with([
                'service:id,name',
                'location:id,name',
            ])
                ->orderBy('appointment_datetime')
                ->get();

            // Eager load patients to fix N+1 query issue
            $patientIds = $appointments->pluck('patient_id')->filter()->unique();
            $patients = Patient::whereIn('id', $patientIds)
                ->get()
                ->keyBy('id');

            return $appointments->map(function ($appointment) use ($patients) {
                // Get session duration with fallback
                $sessionDuration = 30; // Default fallback
                try {
                    $sessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);
                } catch (\Exception $e) {
                    Log::warning('Could not get session duration, using default: '.$e->getMessage());
                }

                // Calculate duration from start_time and end_time if available
                $duration = $sessionDuration; // Default fallback
                if ($appointment->start_time && $appointment->end_time) {
                    $duration = $appointment->start_time->diffInMinutes($appointment->end_time);
                }

                // Get patient data safely from eager loaded collection
                $patientName = 'Unknown Patient';
                $patientAge = null;
                if ($appointment->patient_id && isset($patients[$appointment->patient_id])) {
                    $patient = $patients[$appointment->patient_id];
                    $patientName = trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) ?: 'Unknown Patient';
                    if ($patient->date_of_birth) {
                        $patientAge = Carbon::parse($patient->date_of_birth)->age;
                    }
                }

                return [
                    'id' => $appointment->id,
                    'time' => $appointment->appointment_datetime->format('g:i A'),
                    'patient' => $patientName,
                    'age' => $patientAge,
                    'service' => $appointment->service->name ?? 'General Consultation',
                    'duration' => $duration.' min',
                    'status' => $appointment->status,
                    'room' => $appointment->location->name ?? 'Virtual',
                    'location_id' => $appointment->location_id,
                    'mode' => $appointment->mode ?? 'in-person',
                ];
            })->toArray();
        } catch (\Exception $e) {
            Log::error('Error getting today appointments: '.$e->getMessage());

            return [];
        }
    }

    private function calculateStatistics($practitionerId, $selectedLocation)
    {
        try {
            $baseQuery = Appointment::whereHas('practitioners', function ($q) use ($practitionerId) {
                $q->where('practitioner_id', $practitionerId);
            });

            if ($selectedLocation !== 'all') {
                $baseQuery->where('location_id', $selectedLocation);
            }

            return [
                'todayAppointments' => (clone $baseQuery)
                    ->whereDate('appointment_datetime', Carbon::today())
                    ->whereNotIn('status', ['cancelled', 'no-show'])
                    ->count(),
                'completedToday' => (clone $baseQuery)
                    ->whereDate('appointment_datetime', Carbon::today())
                    ->where('status', 'completed')
                    ->count(),
                'pendingApprovals' => (clone $baseQuery)
                    ->where('status', 'pending')
                    ->count(),
                'totalPatients' => (clone $baseQuery)
                    ->distinct('patient_id')
                    ->count(),
                'thisWeekRevenue' => 0, // Placeholder until pricing integration
                'newPatientsThisMonth' => (clone $baseQuery)
                    ->whereMonth('created_at', Carbon::now()->month)
                    ->whereYear('created_at', Carbon::now()->year)
                    ->distinct('patient_id')
                    ->count(),
                'prescriptionsThisWeek' => 0, // Placeholder until prescription module
            ];
        } catch (\Exception $e) {
            Log::error('Error calculating statistics: '.$e->getMessage());

            return [
                'todayAppointments' => 0,
                'completedToday' => 0,
                'pendingApprovals' => 0,
                'totalPatients' => 0,
                'thisWeekRevenue' => 0,
                'newPatientsThisMonth' => 0,
                'prescriptionsThisWeek' => 0,
            ];
        }
    }

    private function getRecentActivities($practitionerId, $selectedLocation)
    {
        try {
            $query = Appointment::whereHas('practitioners', function ($q) use ($practitionerId) {
                $q->where('practitioner_id', $practitionerId);
            })
                ->where('appointment_datetime', '>=', Carbon::now()->subDay())
                ->where('appointment_datetime', '<=', Carbon::now())
                ->whereIn('status', ['completed', 'confirmed']);

            if ($selectedLocation !== 'all') {
                $query->where('location_id', $selectedLocation);
            }

            $activities = $query->with(['service:id,name'])
                ->orderBy('appointment_datetime', 'desc')
                ->limit(4)
                ->get();

            // Eager load patients to fix N+1 query issue
            $patientIds = $activities->pluck('patient_id')->filter()->unique();
            $patients = Patient::whereIn('id', $patientIds)
                ->get()
                ->keyBy('id');

            return $activities->map(function ($appointment) use ($patients) {
                // Get patient name safely from eager loaded collection
                $patientName = 'Unknown Patient';
                if ($appointment->patient_id && isset($patients[$appointment->patient_id])) {
                    $patient = $patients[$appointment->patient_id];
                    $patientName = trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) ?: 'Unknown Patient';
                }

                $action = $appointment->status === 'completed'
                    ? 'Completed '.($appointment->service->name ?? 'Appointment')
                    : 'Scheduled for '.($appointment->service->name ?? 'Appointment');

                return [
                    'id' => $appointment->id,
                    'patient' => $patientName,
                    'action' => $action,
                    'time' => $appointment->appointment_datetime->diffForHumans(),
                    'priority' => $appointment->status === 'pending' ? 'high' : 'normal',
                    'details' => 'Mode: '.ucfirst($appointment->mode ?? 'in-person'),
                ];
            })->toArray();
        } catch (\Exception $e) {
            Log::error('Error getting recent activities: '.$e->getMessage());

            return [];
        }
    }

    private function getUpcomingSchedule($practitionerId, $selectedLocation)
    {
        try {
            $schedule = [];
            $today = Carbon::today();

            // Get practitioner availability from database
            $availabilityQuery = DB::table('practitioner_availability')
                ->where('practitioner_id', $practitionerId);

            if ($selectedLocation !== 'all') {
                $availabilityQuery->where('location_id', $selectedLocation);
            }

            $availabilities = $availabilityQuery->get();

            // Map day names to availability data
            $availabilityMap = [];
            foreach ($availabilities as $avail) {
                $dayLower = strtolower($avail->day);
                if (! isset($availabilityMap[$dayLower])) {
                    $availabilityMap[$dayLower] = [];
                }
                $availabilityMap[$dayLower][] = [
                    'start' => Carbon::parse($avail->start_time)->format('g:i A'),
                    'end' => Carbon::parse($avail->end_time)->format('g:i A'),
                ];
            }

            // Show complete week: Tomorrow through the next 7 days
            for ($i = 1; $i <= 7; $i++) {
                $date = $today->copy()->addDays($i);
                $dayOfWeek = strtolower($date->format('l')); // e.g., "monday", "tuesday"

                // Check if practitioner has availability for this day
                $isAvailable = isset($availabilityMap[$dayOfWeek]) && count($availabilityMap[$dayOfWeek]) > 0;

                if ($isAvailable) {
                    // Get appointment count for this day
                    $query = Appointment::whereHas('practitioners', function ($q) use ($practitionerId) {
                        $q->where('practitioner_id', $practitionerId);
                    })
                        ->whereDate('appointment_datetime', $date)
                        ->whereNotIn('status', ['cancelled', 'no-show']);

                    if ($selectedLocation !== 'all') {
                        $query->where('location_id', $selectedLocation);
                    }

                    $appointmentCount = $query->count();

                    // Format time slots
                    $timeSlots = collect($availabilityMap[$dayOfWeek])
                        ->map(fn ($slot) => "{$slot['start']} - {$slot['end']}")
                        ->join(', ');

                    // Format date display - show "Tomorrow" for first day, then day names
                    $dateDisplay = $i === 1 ? 'Tomorrow' : $date->format('l');

                    $schedule[] = [
                        'date' => $dateDisplay,
                        'fullDate' => $date->format('M j, Y'),
                        'appointments' => $appointmentCount,
                        'timeSlots' => $timeSlots,
                        'isAvailable' => true,
                    ];
                } else {
                    // Day not available - show as unavailable
                    $dateDisplay = $i === 1 ? 'Tomorrow' : $date->format('l');

                    $schedule[] = [
                        'date' => $dateDisplay,
                        'fullDate' => $date->format('M j, Y'),
                        'appointments' => 0,
                        'timeSlots' => 'Not Available',
                        'isAvailable' => false,
                    ];
                }
            }

            return $schedule;
        } catch (\Exception $e) {
            Log::error('Error getting upcoming schedule: '.$e->getMessage());
            Log::error('Stack trace: '.$e->getTraceAsString());

            // Default fallback: show 7 days from tomorrow
            $defaultSchedule = [];
            for ($i = 1; $i <= 7; $i++) {
                $date = Carbon::today()->addDays($i);
                $dateDisplay = $i === 1 ? 'Tomorrow' : $date->format('l');
                $defaultSchedule[] = [
                    'date' => $dateDisplay,
                    'fullDate' => $date->format('M j, Y'),
                    'appointments' => 0,
                    'timeSlots' => 'Schedule not configured',
                    'isAvailable' => false,
                ];
            }

            return $defaultSchedule;
        }
    }

    private function returnWithDefaultData($errorMessage = null)
    {
        if ($errorMessage) {
            Log::warning('Returning default data: '.$errorMessage);
        }

        // Get tenant timezone for default data using TenantTimezoneService
        $tenantTimezone = TenantTimezoneService::getTenantTimezone();
        $tenantTimezoneAbbr = TenantTimezoneService::getTenantTimezoneAbbreviation();
        $tenantTimezoneDisplay = "{$tenantTimezoneAbbr} ({$tenantTimezone})";

        return Inertia::render('PractitionerDashboard/Index', [
            'practitionerInfo' => [
                'name' => 'Dr. Test User',
                'preferredName' => 'Dr. Test',
                'title' => 'Test Physician - General Practice',
                'specialty' => 'General Practice',
                'licenseNumber' => 'N/A',
                'rating' => 4.8,
                'totalReviews' => 0,
            ],
            'todayAppointments' => [],
            'statistics' => [
                'todayAppointments' => 0,
                'completedToday' => 0,
                'pendingApprovals' => 0,
                'totalPatients' => 0,
                'thisWeekRevenue' => 0,
                'newPatientsThisMonth' => 0,
                'prescriptionsThisWeek' => 0,
            ],
            'recentActivities' => [],
            'upcomingSchedule' => collect(range(1, 7))->map(function ($i) {
                $date = Carbon::today()->addDays($i);

                return [
                    'date' => $i === 1 ? 'Tomorrow' : $date->format('l'),
                    'fullDate' => $date->format('M j, Y'),
                    'appointments' => 0,
                    'timeSlots' => 'Schedule not configured',
                    'isAvailable' => false,
                ];
            })->toArray(),
            'availableLocations' => [],
            'selectedLocation' => 'all',
            'selectedPeriod' => 'today',
            'isCentral' => false,
            'error' => $errorMessage,
            'tenantTimezone' => $tenantTimezone,
            'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
        ]);
    }
}
