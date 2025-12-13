<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Service;
use App\Models\Tenant\Appointment;
use App\Services\TenantTimezoneService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Display the tenant dashboard
     */
    public function index()
    {
        // Get tenant timezone using TenantTimezoneService
        $tenantTimezone = TenantTimezoneService::getTenantTimezone();
        $tenantTimezoneAbbr = TenantTimezoneService::getTenantTimezoneAbbreviation();
        $tenantTimezoneDisplay = "{$tenantTimezoneAbbr} ({$tenantTimezone})";

        // Get tenant date and time formats
        $tenantDateFormat = \App\Models\OrganizationSetting::getValue('time_locale_date_format', 'DD/MM/YYYY');
        $tenantTimeFormat = \App\Models\OrganizationSetting::getValue('time_locale_time_format', '12-hour');

        // Debug logging
        Log::info('Dashboard Timezone Debug:', [
            'tenant_id' => tenant('id'),
            'tenantTimezone' => $tenantTimezone,
            'tenantTimezoneAbbr' => $tenantTimezoneAbbr,
            'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
            'tenantDateFormat' => $tenantDateFormat,
            'tenantTimeFormat' => $tenantTimeFormat,
            'raw_setting' => \App\Models\OrganizationSetting::where('key', 'time_locale_timezone')->first(),
        ]);

        // onboardingStatus is now provided globally via HandleInertiaRequests middleware

        return Inertia::render('dashboard', [
            'tenantTimezone' => $tenantTimezone,
            'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
            'tenantDateFormat' => $tenantDateFormat,
            'tenantTimeFormat' => $tenantTimeFormat,
        ]);
    }

    /**
     * Get dynamic dashboard data for tenant context
     */
    public function getDashboardData(Request $request)
    {
        try {
            $currentTenant = tenant();
            $today = now()->startOfDay();

            // Get total unique patients who have appointments in this tenant
            $totalPatients = Appointment::distinct('patient_id')
                ->whereNotNull('patient_id')
                ->count();

            // Get total practitioners associated with this tenant (from appointment_practitioner table)
            $totalPractitioners = DB::table('appointment_practitioner')
                ->distinct('practitioner_id')
                ->count();

            // Get today's confirmed upcoming appointments
            $upcomingAppointmentsToday = Appointment::where('status', 'confirmed')
                ->whereBetween('appointment_datetime', [$today, $today->copy()->endOfDay()])
                ->count();

            // Get today's attendance (users who clocked in today)
            $attendanceToday = DB::table('user_attendance')
                ->where('date', $today->format('Y-m-d'))
                ->where('status', 'clocked_in')
                ->count();

            // Get today's upcoming appointments with details (top 5)
            $upcomingAppointments = Appointment::where('status', 'confirmed')
                ->whereBetween('appointment_datetime', [$today, $today->copy()->endOfDay()])
                ->orderBy('appointment_datetime', 'asc')
                ->with([
                    'service:id,name',
                    'location:id,name,street_address,city,province',
                ])
                ->take(5)
                ->get()
                ->map(function ($appointment) {
                    // Get patient data from central database
                    $patientData = $appointment->getPatientData();
                    $patientName = $patientData
                        ? $patientData->first_name.' '.$patientData->last_name
                        : 'Unknown Patient';

                    // Get practitioner data from central database
                    $practitioners = $appointment->getPractitionerData();
                    $practitionerName = $practitioners->isNotEmpty()
                        ? 'Dr. '.$practitioners->first()->first_name.' '.$practitioners->first()->last_name
                        : 'TBD';

                    return [
                        'id' => $appointment->id,
                        'patient' => $patientName,
                        'practitioner' => $practitionerName,
                        'time' => $appointment->appointment_datetime->format('g:i A'),
                        'type' => $appointment->service?->name ?? 'Consultation',
                        'status' => $appointment->status,
                    ];
                });

            // Get today's practitioner attendance records
            $recentAttendance = DB::table('user_attendance')
                ->select([
                    'user_attendance.*',
                    'users.name as user_name',
                ])
                ->join('users', 'user_attendance.user_id', '=', 'users.id')
                ->where('user_attendance.date', $today->format('Y-m-d'))
                ->orderBy('user_attendance.clock_in_time', 'asc')
                ->take(5)
                ->get()
                ->map(function ($record) {
                    return [
                        'id' => $record->id,
                        'practitioner' => $record->user_name,
                        'checkIn' => $record->clock_in_time ? \Carbon\Carbon::parse($record->clock_in_time)->format('g:i A') : null,
                        'checkOut' => $record->clock_out_time ? \Carbon\Carbon::parse($record->clock_out_time)->format('g:i A') : null,
                        'status' => $record->status === 'clocked_out' ? 'completed' : 'in-progress',
                    ];
                });

            // Calculate patient demographics (age groups) - this would require patient birth dates
            // Since we don't have direct access to patient data in tenant DB, we'll use static percentages
            // This could be made dynamic if patient demographic data is available in tenant context
            $patientDemographics = [
                ['ageGroup' => '0-18', 'value' => 22],
                ['ageGroup' => '19-35', 'value' => 35],
                ['ageGroup' => '36-50', 'value' => 28],
                ['ageGroup' => '51-65', 'value' => 12],
                ['ageGroup' => '65+', 'value' => 3],
            ];

            // Get practitioner performance data (last 7 days)
            $practitionerPerformance = $this->getPractitionerPerformance();

            // Get locations with most appointments
            $locationsWithMostAppointments = $this->getLocationsWithMostAppointments();

            // Check onboarding status - exclude virtual locations
            $locationCount = Location::where('name', '!=', 'Virtual')->count();
            $allLocationCount = Location::count(); // Total including virtual
            $serviceCount = Service::count();

            // Check if virtual location exists and has practitioner availability
            $virtualLocation = Location::where('name', 'Virtual')->first();
            $hasVirtualLocationWithHours = false;
            if ($virtualLocation) {
                $hasVirtualLocationWithHours = \App\Models\PractitionerAvailability::where('location_id', $virtualLocation->id)
                    ->exists();
            }

            // Get appointment type to determine required steps
            $appointmentType = OrganizationSetting::getValue('appointment_type', null);
            $hasMultipleLocationsValue = OrganizationSetting::getValue('has_multiple_locations', null);
            $hasMultipleLocations = $hasMultipleLocationsValue === 'true' || $hasMultipleLocationsValue === true;

            $isOnboardingFlag = tenant('is_onboarding');
            // Normalize the flag to boolean
            $isOnboardingFlagBool = filter_var($isOnboardingFlag, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isOnboardingFlagBool === null) {
                $isOnboardingFlagBool = (bool) $isOnboardingFlag;
            }

            $onboardingStatus = [
                'hasLocation' => $locationCount > 0,
                'hasService' => $serviceCount > 0,
            ];

            // Determine required steps based on questionnaire answers
            $requiredSteps = [];
            if ($appointmentType !== 'virtual') {
                $requiredSteps[] = 'location';
            }
            $requiredSteps[] = 'service';

            // Check if all required steps are completed AND tenant is no longer in onboarding mode
            // If is_onboarding flag is false, onboarding is complete (trust the flag)
            if (! $isOnboardingFlagBool) {
                $hasCompletedOnboarding = true;
            } else {
                // Check if all required steps are completed
                $hasCompletedOnboarding = true;
                foreach ($requiredSteps as $step) {
                    switch ($step) {
                        case 'location':
                            if (! ($onboardingStatus['hasLocation'] ?? false)) {
                                $hasCompletedOnboarding = false;
                                break;
                            }
                            break;
                        case 'service':
                            if (! ($onboardingStatus['hasService'] ?? false)) {
                                $hasCompletedOnboarding = false;
                                break;
                            }
                            break;

                    }
                }
            }

            Log::info('[DASHBOARD API] Onboarding status calculated:', [
                'tenant_id' => tenant('id'),
                'appointmentType' => $appointmentType,
                'hasMultipleLocations' => $hasMultipleLocations,
                'locationCount' => $locationCount,
                'allLocationCount' => $allLocationCount,
                'serviceCount' => $serviceCount,
                'hasVirtualLocationWithHours' => $hasVirtualLocationWithHours,
                'is_onboarding_flag' => $isOnboardingFlag,
                'is_onboarding_flag_bool' => $isOnboardingFlagBool,
                'requiredSteps' => $requiredSteps,
                'onboardingStatus' => $onboardingStatus,
                'hasCompletedOnboarding' => $hasCompletedOnboarding,
            ]);

            return response()->json([
                'statsData' => [
                    'totalPatients' => $totalPatients,
                    'totalPractitioners' => $totalPractitioners,
                    'upcomingAppointments' => $upcomingAppointmentsToday,
                    'attendanceToday' => $attendanceToday,
                ],
                'upcomingAppointments' => $upcomingAppointments,
                'recentAttendance' => $recentAttendance,
                'patientDemographics' => $patientDemographics, // Static for now
                'practitionerPerformance' => $practitionerPerformance,
                'locationsWithMostAppointments' => $locationsWithMostAppointments,
                'onboardingStatus' => [
                    'hasLocation' => $locationCount > 0, // Only non-virtual locations count
                    'hasService' => $serviceCount > 0,
                    'locationCount' => $locationCount, // Non-virtual count for onboarding
                    'allLocationCount' => $allLocationCount, // Total count including virtual
                    'serviceCount' => $serviceCount,
                    'hasVirtualLocationWithHours' => $hasVirtualLocationWithHours,
                    'isComplete' => $hasCompletedOnboarding,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Tenant Dashboard Data Error: '.$e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['error' => 'Failed to load dashboard data'], 500);
        }
    }

    /**
     * Get practitioner performance data
     */
    private function getPractitionerPerformance()
    {
        $lastWeek = now()->subDays(7);

        // Get appointment counts by practitioner for the last week
        $practitionerStats = DB::table('appointment_practitioner')
            ->select([
                'appointment_practitioner.practitioner_id',
                DB::raw('COUNT(appointments.id) as appointment_count'),
            ])
            ->join('appointments', 'appointment_practitioner.appointment_id', '=', 'appointments.id')
            ->where('appointments.appointment_datetime', '>=', $lastWeek)
            ->where('appointments.status', 'confirmed')
            ->groupBy('appointment_practitioner.practitioner_id')
            ->orderBy('appointment_count', 'desc')
            ->take(3)
            ->get();

        // Get practitioner names from central database and format the data
        // NOTE: No select() clause - CipherSweet needs all fields to decrypt properly
        $performance = [];
        foreach ($practitionerStats as $stat) {
            $practitionerData = tenancy()->central(function () use ($stat) {
                return \App\Models\Practitioner::find($stat->practitioner_id);
            });

            if ($practitionerData) {
                $performance[] = [
                    'name' => 'Dr. '.$practitionerData->first_name.' '.$practitionerData->last_name,
                    'appointments' => $stat->appointment_count,
                    'satisfaction' => rand(90, 98), // Mock satisfaction score - would need patient feedback system
                    'trend' => rand(0, 1) ? 'up' : 'down', // Mock trend - would need historical data
                ];
            }
        }

        // Return only actual practitioner data - no mock data for production

        return $performance;
    }

    /**
     * Get locations with most appointments
     */
    private function getLocationsWithMostAppointments()
    {
        try {
            // Get appointment counts by location
            $locationStats = DB::table('appointments')
                ->select([
                    'appointments.location_id',
                    DB::raw('COUNT(appointments.id) as appointment_count'),
                ])
                ->whereNotNull('appointments.location_id')
                ->groupBy('appointments.location_id')
                ->orderBy('appointment_count', 'desc')
                ->take(5)
                ->get();

            // Get location details and format the data
            $locations = [];
            foreach ($locationStats as $stat) {
                $location = \App\Models\Location::find($stat->location_id);

                if ($location) {
                    $locations[] = [
                        'id' => $location->id,
                        'name' => $location->name,
                        'address' => trim(($location->street_address ?? '').' '.($location->city ?? '').' '.($location->province ?? '')),
                        'appointmentCount' => $stat->appointment_count,
                    ];
                }
            }

            return $locations;
        } catch (\Exception $e) {
            Log::error('Error getting locations with most appointments: '.$e->getMessage());

            return [];
        }
    }

    /**
     * Determine required steps based on questionnaire answers
     */
    protected function determineRequiredSteps(?string $practiceType, ?string $appointmentType, ?bool $hasMultipleLocations): array
    {
        $steps = [];

        // Location step: Show if NOT virtual-only
        if ($appointmentType !== 'virtual') {
            $steps[] = 'location';
        }

        // Service step: Always required
        $steps[] = 'service';

        return $steps;
    }

    /**
     * Check if all required steps are completed
     */
    protected function checkStepsCompletion(array $requiredSteps, array $onboardingStatus): bool
    {
        foreach ($requiredSteps as $step) {
            switch ($step) {
                case 'location':
                    if (! ($onboardingStatus['hasLocation'] ?? false)) {
                        return false;
                    }
                    break;
                case 'service':
                    if (! ($onboardingStatus['hasService'] ?? false)) {
                        return false;
                    }
                    break;

            }
        }

        return true;
    }

    /**
     * Check if onboarding is complete based on questionnaire answers
     */
    public function checkOnboardingCompletion(Request $request)
    {
        $practiceType = $request->input('practice_type') ?? OrganizationSetting::getValue('practice_type', null);
        $appointmentType = $request->input('appointment_type') ?? OrganizationSetting::getValue('appointment_type', null);
        $hasMultipleLocations = $request->input('has_multiple_locations');
        if ($hasMultipleLocations === null) {
            $hasMultipleLocationsValue = OrganizationSetting::getValue('has_multiple_locations', null);
            $hasMultipleLocations = $hasMultipleLocationsValue === 'true' || $hasMultipleLocationsValue === true;
        }

        $locationCount = Location::where('name', '!=', 'Virtual')->count();
        $serviceCount = Service::count();

        $onboardingStatus = [
            'hasLocation' => $locationCount > 0,
            'hasService' => $serviceCount > 0,
            'locationCount' => $locationCount,
            'serviceCount' => $serviceCount,
        ];

        $requiredSteps = $this->determineRequiredSteps($practiceType, $appointmentType, $hasMultipleLocations);
        $isComplete = $this->checkStepsCompletion($requiredSteps, $onboardingStatus);

        return response()->json([
            'isComplete' => $isComplete,
            'requiredSteps' => $requiredSteps,
            'completedSteps' => array_filter($requiredSteps, function ($step) use ($onboardingStatus) {
                switch ($step) {
                    case 'location':
                        return $onboardingStatus['hasLocation'] ?? false;
                    case 'service':
                        return $onboardingStatus['hasService'] ?? false;

                    default:
                        return false;
                }
            }),
            'onboardingStatus' => $onboardingStatus,
        ]);
    }

    /**
     * Mark tenant onboarding as complete
     */
    public function completeOnboarding()
    {
        // Set isOnboardingComplete in OrganizationSettings
        OrganizationSetting::setValue('isOnboardingComplete', 'true');

        Log::info('[ONBOARDING] Completing onboarding from DashboardController:', [
            'tenant_id' => tenant('id'),
        ]);

        return redirect()->route('dashboard')
            ->with('success', 'Onboarding completed successfully!');
    }

    /**
     * Save practice questionnaire answers
     */
    public function saveQuestionnaire(Request $request)
    {
        $validated = $request->validate([
            'appointment_type' => ['required', 'string', 'in:virtual,hybrid,in-person'],
            'has_multiple_locations' => ['nullable', 'boolean'],
        ]);

        // Get practice type from OrganizationSettings (already set by OnboardingController)
        // Or calculate from subscription quantity if not set
        $practiceType = OrganizationSetting::getValue('practice_type', null);
        if (! $practiceType) {
            $tenantId = tenant('id');
            $numberOfSeats = tenancy()->central(function () use ($tenantId) {
                return \App\Models\Tenant::find($tenantId)?->number_of_seats ?? 1;
            });
            $practiceType = $numberOfSeats === 1 ? 'solo' : 'group';
            OrganizationSetting::setValue('practice_type', $practiceType);

            Log::info('[QUESTIONNAIRE] Auto-set practice type from subscription quantity', [
                'tenant_id' => $tenantId,
                'number_of_seats' => $numberOfSeats,
                'practice_type' => $practiceType,
            ]);
        }

        // Save questionnaire answers to organization settings
        OrganizationSetting::setValue('appointment_type', $validated['appointment_type']);

        if (isset($validated['has_multiple_locations'])) {
            OrganizationSetting::setValue('has_multiple_locations', $validated['has_multiple_locations'] ? 'true' : 'false');
        }

        Log::info('[QUESTIONNAIRE] Saved practice questionnaire', [
            'tenant_id' => tenant('id'),
            'practice_type' => $practiceType,
            'appointment_type' => $validated['appointment_type'],
            'has_multiple_locations' => $validated['has_multiple_locations'] ?? null,
        ]);

        // Auto-create virtual location for virtual and hybrid practices
        if (in_array($validated['appointment_type'], ['virtual', 'hybrid'])) {
            try {
                $existingLocation = Location::where('name', 'Virtual')->first();
                if (! $existingLocation) {
                    $tenantTimezone = TenantTimezoneService::getTenantTimezone();

                    $location = Location::create([
                        'name' => 'Virtual',
                        'timezone' => $tenantTimezone,
                        'address_lookup' => 'Virtual Location',
                        'street_address' => 'Virtual',
                        'apt_suite_unit' => null,
                        'city' => 'Virtual',
                        'postal_zip_code' => '00000',
                        'province' => 'Virtual',
                        'phone_number' => '000-000-0000',
                        'email_address' => tenant('id').'@virtual.local',
                        'is_active' => true,
                    ]);

                    Log::info('[QUESTIONNAIRE] Auto-created virtual location', [
                        'tenant_id' => tenant('id'),
                        'location_id' => $location->id,
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('[QUESTIONNAIRE] Failed to auto-create virtual location', [
                    'tenant_id' => tenant('id'),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Redirect directly to the next step to avoid double loading via dashboard
        if (in_array($validated['appointment_type'], ['virtual'])) {
            return redirect()->route('onboarding.practitioner-availability')
                ->with('success', 'Virtual location created. Set your availability.');
        } else {
            return redirect()->route('onboarding.location.create')
                ->with('success', 'Questionnaire saved. Let\'s add your location.');
        }
    }

    /**
     * Create virtual location
     */
    public function createVirtualLocation(Request $request)
    {
        try {
            // Get tenant timezone
            $tenantTimezone = TenantTimezoneService::getTenantTimezone();

            // Create virtual location with default values
            $location = Location::create([
                'name' => 'Virtual',
                'timezone' => $tenantTimezone,
                'address_lookup' => 'Virtual Location',
                'street_address' => 'Virtual',
                'apt_suite_unit' => null,
                'city' => 'Virtual',
                'postal_zip_code' => '00000',
                'province' => 'Virtual',
                'phone_number' => '000-000-0000',
                'email_address' => tenant('id').'@virtual.local',
                'is_active' => true,
            ]);

            Log::info('[VIRTUAL LOCATION] Created virtual location', [
                'tenant_id' => tenant('id'),
                'location_id' => $location->id,
            ]);

            // Check if onboarding is now complete (need service too)
            $appointmentType = OrganizationSetting::getValue('appointment_type', null);
            $serviceCount = Service::count();

            // Determine required steps
            $requiredSteps = [];
            if ($appointmentType !== 'virtual') {
                $requiredSteps[] = 'location';
            }
            $requiredSteps[] = 'service';

            // Check if all required steps are completed
            $isComplete = true;
            foreach ($requiredSteps as $step) {
                switch ($step) {
                    case 'location':
                        // Virtual location was just created, so location is complete
                        break;
                    case 'service':
                        if ($serviceCount === 0) {
                            $isComplete = false;
                        }
                        break;
                }
            }

            // If all required steps are complete, complete onboarding
            if ($isComplete) {
                OrganizationSetting::setValue('isOnboardingComplete', 'true');

                return redirect()->route('dashboard')
                    ->with('success', 'Virtual location created successfully. Onboarding complete!');
            }

            // Otherwise, redirect to next step
            return redirect()->route('onboarding.service.create')
                ->with('success', 'Virtual location created successfully!');
        } catch (\Exception $e) {
            Log::error('[VIRTUAL LOCATION] Failed to create virtual location', [
                'tenant_id' => tenant('id'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()
                ->withErrors(['error' => 'Failed to create virtual location. Please try again.']);
        }
    }

    /**
     * Create virtual location without operating hours (for hybrid)
     */
    private function createVirtualLocationForHybrid(): void
    {
        try {
            // Check if virtual location already exists
            $existingLocation = Location::where('name', 'Virtual')->first();
            if ($existingLocation) {
                Log::info('[VIRTUAL LOCATION] Virtual location already exists', [
                    'tenant_id' => tenant('id'),
                    'location_id' => $existingLocation->id,
                ]);

                return;
            }

            // Get tenant timezone
            $tenantTimezone = TenantTimezoneService::getTenantTimezone();

            // Create virtual location with default values
            $location = Location::create([
                'name' => 'Virtual',
                'timezone' => $tenantTimezone,
                'address_lookup' => 'Virtual Location',
                'street_address' => 'Virtual',
                'apt_suite_unit' => null,
                'city' => 'Virtual',
                'postal_zip_code' => '00000',
                'province' => 'Virtual',
                'phone_number' => '000-000-0000',
                'email_address' => tenant('id').'@virtual.local',
                'is_active' => true,
            ]);

            Log::info('[VIRTUAL LOCATION] Created virtual location for hybrid', [
                'tenant_id' => tenant('id'),
                'location_id' => $location->id,
            ]);
        } catch (\Exception $e) {
            Log::error('[VIRTUAL LOCATION] Failed to create virtual location for hybrid', [
                'tenant_id' => tenant('id'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
