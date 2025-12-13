<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Models\CentralPractitioner;
use App\Models\Patient;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PractitionerDashboardController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            $practitioner = CentralPractitioner::where('user_id', $user->id)->first();

            if (! $practitioner) {
                Log::info('No practitioner found for user', ['user_id' => $user->id]);

                return $this->returnWithDefaultData('Practitioner profile not found in system');
            }

            // Get filter parameters
            $selectedLocation = $request->get('location', 'all');
            $selectedPeriod = $request->get('period', 'today');

            // Get all tenants where this practitioner works
            $availableLocations = $this->getPractitionerTenants($practitioner->id);

            // Get today's appointments across all tenants
            $todayAppointments = $this->getTodayAppointmentsFromAllTenants($practitioner->id, $selectedLocation);

            // Calculate statistics across all tenants
            $statistics = $this->calculateStatisticsFromAllTenants($practitioner->id, $selectedLocation);

            // Get recent activities from all tenants
            $recentActivities = $this->getRecentActivitiesFromAllTenants($practitioner->id, $selectedLocation);

            // Get upcoming schedule from all tenants
            $upcomingSchedule = $this->getUpcomingScheduleFromAllTenants($practitioner->id, $selectedLocation);

            // No longer showing Google Calendar warnings on dashboard

            // Set local timezone for central context
            $tenantTimezone = config('app.timezone', 'UTC');
            $tenantTimezoneDisplay = 'Local Time';

            return Inertia::render('PractitionerDashboard/Index', [
                'practitionerInfo' => [
                    'name' => $practitioner->full_name ?? 'Unknown Practitioner',
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
                'isCentral' => true,
                'tenantTimezone' => $tenantTimezone,
                'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
            ]);

        } catch (\Exception $e) {
            Log::error('Central Practitioner Dashboard Error: '.$e->getMessage());
            Log::error('Stack trace: '.$e->getTraceAsString());

            return $this->returnWithDefaultData('Error loading dashboard: '.$e->getMessage());
        }
    }

    private function getPractitionerTenants($practitionerId)
    {
        try {
            $practitioner = CentralPractitioner::find($practitionerId);
            $tenantIds = $practitioner->tenants()->pluck('tenant_id')->toArray();

            $locations = [];
            foreach ($tenantIds as $tenantId) {
                $tenant = Tenant::find($tenantId);
                if ($tenant) {
                    $locations[] = [
                        'id' => $tenantId,
                        'name' => $tenant->company_name ?? 'Unknown Clinic',
                        'location' => $tenant->company_name ?? 'Unknown Location',
                    ];
                }
            }

            return $locations;
        } catch (\Exception $e) {
            Log::error('Error getting practitioner tenants: '.$e->getMessage());

            return [];
        }
    }

    private function getTodayAppointmentsFromAllTenants($practitionerId, $selectedLocation)
    {
        try {
            $practitioner = CentralPractitioner::find($practitionerId);
            $tenantIds = $practitioner->tenants()->pluck('tenant_id')->toArray();

            // Filter tenants if specific location selected
            if ($selectedLocation !== 'all') {
                $tenantIds = [$selectedLocation];
            }

            $allAppointments = [];

            foreach ($tenantIds as $tenantId) {
                $tenant = Tenant::find($tenantId);
                if (! $tenant) {
                    continue;
                }

                try {
                    tenancy()->initialize($tenant);

                    $appointments = \App\Models\Tenant\Appointment::select('appointments.*', 'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
                        ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                        ->where('appointment_practitioner.practitioner_id', $practitionerId)
                        ->whereDate('appointment_practitioner.start_time', Carbon::today())
                        ->whereNotIn('appointments.status', ['cancelled', 'no-show'])
                        ->with(['service', 'location'])
                        ->orderBy('appointment_practitioner.start_time')
                        ->get();

                    foreach ($appointments as $appointment) {
                        // Get patient name from central database
                        $patientName = 'Unknown Patient';
                        $patientAge = null;
                        if ($appointment->patient_id) {
                            $patient = tenancy()->central(function () use ($appointment) {
                                return Patient::find($appointment->patient_id);
                            });
                            if ($patient) {
                                $patientName = trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) ?: 'Unknown Patient';
                                if ($patient->date_of_birth) {
                                    $patientAge = Carbon::parse($patient->date_of_birth)->age;
                                }
                            }
                        }

                        $startTime = Carbon::parse($appointment->start_time);
                        $endTime = Carbon::parse($appointment->end_time);
                        $durationMinutes = $startTime->diffInMinutes($endTime);

                        $allAppointments[] = [
                            'id' => $appointment->id,
                            'time' => $startTime->format('g:i A'),
                            'patient' => $patientName,
                            'age' => $patientAge,
                            'service' => $appointment->service->name ?? 'General Consultation',
                            'duration' => $durationMinutes.' min',
                            'status' => $appointment->status,
                            'room' => $appointment->location->name ?? 'Virtual',
                            'location_id' => $appointment->location_id,
                            'mode' => $appointment->mode ?? 'in-person',
                            'clinic' => $tenant->company_name ?? 'Unknown Clinic',
                        ];
                    }

                    tenancy()->end();
                } catch (\Exception $e) {
                    Log::error('Error fetching appointments from tenant: '.$tenantId, [
                        'error' => $e->getMessage(),
                        'practitioner_id' => $practitionerId,
                    ]);
                    try {
                        tenancy()->end();
                    } catch (\Exception $endError) {
                        // Ignore end errors
                    }

                    continue;
                }
            }

            // Sort all appointments by time
            usort($allAppointments, function ($a, $b) {
                return strcmp($a['time'], $b['time']);
            });

            return $allAppointments;
        } catch (\Exception $e) {
            Log::error('Error getting today appointments from all tenants: '.$e->getMessage());

            return [];
        }
    }

    private function calculateStatisticsFromAllTenants($practitionerId, $selectedLocation)
    {
        try {
            $practitioner = CentralPractitioner::find($practitionerId);
            $tenantIds = $practitioner->tenants()->pluck('tenant_id')->toArray();

            // Filter tenants if specific location selected
            if ($selectedLocation !== 'all') {
                $tenantIds = [$selectedLocation];
            }

            $totalTodayAppointments = 0;
            $totalCompletedToday = 0;
            $totalPendingApprovals = 0;
            $totalUniquePatients = [];
            $totalNewPatientsThisMonth = [];

            foreach ($tenantIds as $tenantId) {
                $tenant = Tenant::find($tenantId);
                if (! $tenant) {
                    continue;
                }

                try {
                    tenancy()->initialize($tenant);

                    $baseQuery = \App\Models\Tenant\Appointment::select('appointments.*')
                        ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                        ->where('appointment_practitioner.practitioner_id', $practitionerId);

                    $totalTodayAppointments += (clone $baseQuery)
                        ->whereDate('appointment_practitioner.start_time', Carbon::today())
                        ->whereNotIn('appointments.status', ['cancelled', 'no-show'])
                        ->count();

                    $totalCompletedToday += (clone $baseQuery)
                        ->whereDate('appointment_practitioner.start_time', Carbon::today())
                        ->where('appointments.status', 'completed')
                        ->count();

                    $totalPendingApprovals += (clone $baseQuery)
                        ->where('appointments.status', 'pending')
                        ->count();

                    $uniquePatients = (clone $baseQuery)
                        ->distinct('appointments.patient_id')
                        ->pluck('appointments.patient_id')
                        ->toArray();
                    $totalUniquePatients = array_merge($totalUniquePatients, $uniquePatients);

                    $newPatientsThisMonth = (clone $baseQuery)
                        ->whereMonth('appointments.created_at', Carbon::now()->month)
                        ->whereYear('appointments.created_at', Carbon::now()->year)
                        ->distinct('appointments.patient_id')
                        ->pluck('appointments.patient_id')
                        ->toArray();
                    $totalNewPatientsThisMonth = array_merge($totalNewPatientsThisMonth, $newPatientsThisMonth);

                    tenancy()->end();
                } catch (\Exception $e) {
                    Log::error('Error calculating statistics from tenant: '.$tenantId, [
                        'error' => $e->getMessage(),
                        'practitioner_id' => $practitionerId,
                    ]);
                    try {
                        tenancy()->end();
                    } catch (\Exception $endError) {
                        // Ignore end errors
                    }

                    continue;
                }
            }

            return [
                'todayAppointments' => $totalTodayAppointments,
                'completedToday' => $totalCompletedToday,
                'pendingApprovals' => $totalPendingApprovals,
                'totalPatients' => count(array_unique($totalUniquePatients)),
                'thisWeekRevenue' => 0, // Placeholder until pricing integration
                'newPatientsThisMonth' => count(array_unique($totalNewPatientsThisMonth)),
                'prescriptionsThisWeek' => 0, // Placeholder until prescription module
            ];
        } catch (\Exception $e) {
            Log::error('Error calculating statistics from all tenants: '.$e->getMessage());

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

    private function getRecentActivitiesFromAllTenants($practitionerId, $selectedLocation)
    {
        try {
            $practitioner = CentralPractitioner::find($practitionerId);
            $tenantIds = $practitioner->tenants()->pluck('tenant_id')->toArray();

            // Filter tenants if specific location selected
            if ($selectedLocation !== 'all') {
                $tenantIds = [$selectedLocation];
            }

            $allActivities = [];

            foreach ($tenantIds as $tenantId) {
                $tenant = Tenant::find($tenantId);
                if (! $tenant) {
                    continue;
                }

                try {
                    tenancy()->initialize($tenant);

                    $activities = \App\Models\Tenant\Appointment::select('appointments.*', 'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
                        ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                        ->where('appointment_practitioner.practitioner_id', $practitionerId)
                        ->where('appointment_practitioner.start_time', '>=', Carbon::now()->subDay())
                        ->where('appointment_practitioner.start_time', '<=', Carbon::now())
                        ->whereIn('appointments.status', ['completed', 'confirmed'])
                        ->with(['service'])
                        ->orderBy('appointment_practitioner.start_time', 'desc')
                        ->limit(4)
                        ->get();

                    foreach ($activities as $appointment) {
                        // Get patient name from central database
                        $patientName = 'Unknown Patient';
                        if ($appointment->patient_id) {
                            $patient = tenancy()->central(function () use ($appointment) {
                                return Patient::find($appointment->patient_id);
                            });
                            if ($patient) {
                                $patientName = trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) ?: 'Unknown Patient';
                            }
                        }

                        $action = $appointment->status === 'completed'
                            ? 'Completed '.($appointment->service->name ?? 'Appointment')
                            : 'Scheduled for '.($appointment->service->name ?? 'Appointment');

                        $allActivities[] = [
                            'id' => $appointment->id,
                            'patient' => $patientName,
                            'action' => $action,
                            'time' => Carbon::parse($appointment->start_time)->diffForHumans(),
                            'priority' => $appointment->status === 'pending' ? 'high' : 'normal',
                            'details' => 'Mode: '.ucfirst($appointment->mode ?? 'in-person').' at '.($tenant->company_name ?? 'Unknown Clinic'),
                            'clinic' => $tenant->company_name ?? 'Unknown Clinic',
                        ];
                    }

                    tenancy()->end();
                } catch (\Exception $e) {
                    Log::error('Error getting recent activities from tenant: '.$tenantId, [
                        'error' => $e->getMessage(),
                        'practitioner_id' => $practitionerId,
                    ]);
                    try {
                        tenancy()->end();
                    } catch (\Exception $endError) {
                        // Ignore end errors
                    }

                    continue;
                }
            }

            // Sort all activities by time and limit to 4 most recent
            usort($allActivities, function ($a, $b) {
                return strcmp($b['time'], $a['time']);
            });

            return array_slice($allActivities, 0, 4);
        } catch (\Exception $e) {
            Log::error('Error getting recent activities from all tenants: '.$e->getMessage());

            return [];
        }
    }

    private function getUpcomingScheduleFromAllTenants($practitionerId, $selectedLocation)
    {
        try {
            $practitioner = CentralPractitioner::find($practitionerId);
            $tenantIds = $practitioner->tenants()->pluck('tenant_id')->toArray();

            // Filter tenants if specific location selected
            if ($selectedLocation !== 'all') {
                $tenantIds = [$selectedLocation];
            }

            $schedule = [];
            for ($i = 1; $i <= 3; $i++) {
                $date = Carbon::today()->addDays($i);
                $totalAppointments = 0;

                foreach ($tenantIds as $tenantId) {
                    $tenant = Tenant::find($tenantId);
                    if (! $tenant) {
                        continue;
                    }

                    try {
                        tenancy()->initialize($tenant);

                        $appointmentCount = \App\Models\Tenant\Appointment::select('appointments.*')
                            ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                            ->where('appointment_practitioner.practitioner_id', $practitionerId)
                            ->whereDate('appointment_practitioner.start_time', $date)
                            ->whereNotIn('appointments.status', ['cancelled', 'no-show'])
                            ->count();

                        $totalAppointments += $appointmentCount;

                        tenancy()->end();
                    } catch (\Exception $e) {
                        Log::error('Error getting upcoming schedule from tenant: '.$tenantId, [
                            'error' => $e->getMessage(),
                            'practitioner_id' => $practitionerId,
                        ]);
                        try {
                            tenancy()->end();
                        } catch (\Exception $endError) {
                            // Ignore end errors
                        }

                        continue;
                    }
                }

                $schedule[] = [
                    'date' => $date->format('l'), // Day name
                    'appointments' => $totalAppointments,
                    'timeSlots' => '8:00 AM - 6:00 PM', // Could be made dynamic based on availability
                ];
            }

            return $schedule;
        } catch (\Exception $e) {
            Log::error('Error getting upcoming schedule from all tenants: '.$e->getMessage());

            return [
                ['date' => 'Tomorrow', 'appointments' => 0, 'timeSlots' => '8:00 AM - 6:00 PM'],
                ['date' => 'Wednesday', 'appointments' => 0, 'timeSlots' => '8:00 AM - 6:00 PM'],
                ['date' => 'Thursday', 'appointments' => 0, 'timeSlots' => '8:00 AM - 6:00 PM'],
            ];
        }
    }

    private function returnWithDefaultData($errorMessage = null)
    {
        if ($errorMessage) {
            Log::warning('Returning default data: '.$errorMessage);
        }

        // Set local timezone for central context default data
        $tenantTimezone = config('app.timezone', 'UTC');
        $tenantTimezoneDisplay = 'Local Time';

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
            'upcomingSchedule' => [
                ['date' => 'Tomorrow', 'appointments' => 0, 'timeSlots' => '8:00 AM - 6:00 PM'],
                ['date' => 'Wednesday', 'appointments' => 0, 'timeSlots' => '8:00 AM - 6:00 PM'],
                ['date' => 'Thursday', 'appointments' => 0, 'timeSlots' => '8:00 AM - 6:00 PM'],
            ],
            'availableLocations' => [],
            'selectedLocation' => 'all',
            'selectedPeriod' => 'today',
            'isCentral' => true,
            'error' => $errorMessage,
            'tenantTimezone' => $tenantTimezone,
            'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
        ]);
    }

    /**
     * Display the My Details page in central context
     */
    public function myDetails(Request $request)
    {
        try {
            $user = Auth::user();
            $practitioner = CentralPractitioner::where('user_id', $user->id)->first();

            if (! $practitioner) {
                Log::warning('No practitioner found for myDetails', ['user_id' => $user->id]);

                return Inertia::render('MyDetails/Index', [
                    'practitioner' => null,
                    'clinics' => [],
                    'message' => 'Practitioner profile not found in system.',
                ]);
            }

            // Get all tenants this practitioner is associated with from central database
            $associatedTenants = $practitioner->tenants()
                ->wherePivot('invitation_status', 'ACCEPTED')
                ->with('domains')
                ->get()
                ->map(function ($tenant) {
                    return [
                        'id' => $tenant->id,
                        'name' => $tenant->company_name ?? 'Unknown Clinic',
                        'domain' => $tenant->domains->first()->domain ?? null,
                    ];
                })->toArray();

            // Get comprehensive clinic data for all tenants
            $clinics = $this->getComprehensiveClinicData($practitioner->id, $associatedTenants);

            // Get organization settings from the first tenant (or default if none)
            // In multi-tenant context, we use the first tenant's settings as the default for MyDetails
            $organizationSettings = $this->getDefaultOrganizationSettings();
            if (! empty($associatedTenants)) {
                $firstTenantId = $associatedTenants[0]['id'];
                $organizationSettings = $this->getTenantOrganizationSettings($firstTenantId);

                Log::info('Central MyDetails using tenant settings', [
                    'tenant_id' => $firstTenantId,
                    'appointment_session_duration' => $organizationSettings['appointment_session_duration'],
                ]);
            }

            return Inertia::render('MyDetails/Index', [
                'practitioner' => $practitioner->load('user'),
                'clinics' => $clinics,
                'organization_settings' => $organizationSettings,
                'tenancy' => [
                    'is_central' => true,
                    'current' => null,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Central My Details Error: '.$e->getMessage());

            return Inertia::render('MyDetails/Index', [
                'practitioner' => null,
                'clinics' => [],
                'message' => 'Error loading My Details: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Get organization settings from a specific tenant's database
     * This method is used from central context to access tenant-specific settings
     */
    private function getTenantOrganizationSettings($tenantId)
    {
        try {
            $tenant = \App\Models\Tenant::find($tenantId);
            if (! $tenant) {
                return $this->getDefaultOrganizationSettings();
            }

            // Initialize tenancy for the specific tenant
            tenancy()->initialize($tenant);

            // Get organization settings from tenant database
            $settings = [
                'appointment_session_duration' => (int) \App\Models\OrganizationSetting::getValue('appointment_session_duration', 30),
                'appointment_advance_booking_hours' => (int) \App\Models\OrganizationSetting::getValue('appointment_advance_booking_hours', 2),
                'appointment_allow_same_day_booking' => \App\Models\OrganizationSetting::getValue('appointment_allow_same_day_booking', '1') === '1',
                'appointment_max_advance_booking_days' => (int) \App\Models\OrganizationSetting::getValue('appointment_max_advance_booking_days', 60),
            ];

            // End tenancy to return to central context
            tenancy()->end();

            return $settings;
        } catch (\Exception $e) {
            Log::warning('Failed to get tenant organization settings', [
                'tenant_id' => $tenantId,
                'error' => $e->getMessage(),
            ]);

            // Ensure we're back in central context
            tenancy()->end();

            return $this->getDefaultOrganizationSettings();
        }
    }

    /**
     * Get default organization settings when tenant settings are unavailable
     */
    private function getDefaultOrganizationSettings()
    {
        return [
            'appointment_session_duration' => 30,
            'appointment_advance_booking_hours' => 2,
            'appointment_allow_same_day_booking' => true,
            'appointment_max_advance_booking_days' => 60,
        ];
    }

    /**
     * Get comprehensive clinic data for practitioner across all tenants
     */
    private function getComprehensiveClinicData($practitionerId, $associatedTenants)
    {
        try {
            $clinics = [];

            foreach ($associatedTenants as $tenantInfo) {
                $tenantId = $tenantInfo['id'];
                $tenantName = $tenantInfo['name'];
                $tenantDomain = $tenantInfo['domain'];

                try {
                    tenancy()->initialize(Tenant::find($tenantId));

                    // Get locations assigned to this practitioner
                    $assignedLocationIds = \Illuminate\Support\Facades\DB::table('location_practitioners')
                        ->where('practitioner_id', $practitionerId)
                        ->where('is_assigned', true)
                        ->pluck('location_id')
                        ->toArray();

                    $locations = collect();
                    if (! empty($assignedLocationIds)) {
                        // Use raw queries to avoid model issues in tenant context
                        $locations = \Illuminate\Support\Facades\DB::table('locations')
                            ->whereIn('locations.id', $assignedLocationIds)
                            ->where('locations.is_active', true)
                            ->select('locations.*')
                            ->get();
                    }

                    $locationData = [];
                    foreach ($locations as $location) {
                        // Get practitioner availability for each location
                        $availabilityRecords = \Illuminate\Support\Facades\DB::table('practitioner_availability')
                            ->where('practitioner_id', $practitionerId)
                            ->where('location_id', $location->id)
                            ->get()
                            ->groupBy('day');

                        // Format availability by day (same format as tenant controller)
                        $formattedAvailability = [];
                        foreach (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as $day) {
                            $daySlots = $availabilityRecords->get($day, collect());
                            $formattedAvailability[$day] = $daySlots->filter(function ($slot) {
                                return ! empty($slot->start_time) && ! empty($slot->end_time);
                            })->map(function ($slot) {
                                return [
                                    'start_time' => substr($slot->start_time, 0, 5),
                                    'end_time' => substr($slot->end_time, 0, 5),
                                ];
                            })->values()->toArray();
                        }

                        // Get operating hours by day
                        $operatingHours = \Illuminate\Support\Facades\DB::table('operating_hours')
                            ->where('location_id', $location->id)
                            ->where('is_enabled', true)
                            ->get()
                            ->groupBy('day_of_week');

                        $operatingHoursByDay = [];
                        foreach (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as $day) {
                            $dayHours = $operatingHours->get($day, collect());
                            $operatingHoursByDay[$day] = $dayHours->map(function ($hour) {
                                return [
                                    'start_time' => substr($hour->start_time, 0, 5),
                                    'end_time' => substr($hour->end_time, 0, 5),
                                ];
                            })->values()->toArray();
                        }

                        // Build full address manually since we're using raw queries
                        $fullAddress = $location->street_address;
                        if ($location->apt_suite_unit) {
                            $fullAddress .= ', '.$location->apt_suite_unit;
                        }
                        $fullAddress .= ', '.$location->city.', '.$location->province.' '.$location->postal_zip_code;

                        $locationData[] = [
                            'id' => $location->id,
                            'name' => $location->name,
                            'full_address' => $fullAddress,
                            'phone_number' => $location->phone_number,
                            'email_address' => $location->email_address,
                            'timezone' => $location->timezone ?? 'UTC',
                            'is_active' => (bool) $location->is_active,
                            'availability' => $formattedAvailability,
                            'operating_hours' => $operatingHoursByDay,
                            'existing_appointments' => [], // Could be implemented later
                            'tenant_name' => $tenantName,
                            'tenant_id' => $tenantId,
                        ];
                    }

                    // Get services for this practitioner in this tenant
                    $services = \Illuminate\Support\Facades\DB::table('services')
                        ->leftJoin('practitioner_services', function ($join) use ($practitionerId) {
                            $join->on('services.id', '=', 'practitioner_services.service_id')
                                ->where('practitioner_services.practitioner_id', '=', $practitionerId);
                        })
                        ->where('services.is_active', true)
                        ->where('practitioner_services.is_offered', true)
                        ->select(
                            'services.*',
                            'practitioner_services.custom_price',
                            'practitioner_services.custom_duration_minutes',
                            'practitioner_services.is_offered'
                        )
                        ->get()
                        ->map(function ($service) use ($tenantName, $tenantId) {
                            return [
                                'id' => $service->id,
                                'name' => $service->name,
                                'category' => $service->category,
                                'description' => $service->description,
                                'delivery_modes' => json_decode($service->delivery_modes, true) ?? [],
                                'default_price' => $service->default_price,
                                'custom_price' => $service->custom_price,
                                'effective_price' => $service->custom_price ?? $service->default_price,
                                'currency' => $service->currency,
                                'tenant_name' => $tenantName,
                                'tenant_id' => $tenantId,
                            ];
                        });

                    $clinics[] = [
                        'tenant_id' => $tenantId,
                        'tenant_name' => $tenantName,
                        'tenant_domain' => $tenantDomain,
                        'locations' => $locationData,
                        'locations_count' => count($locationData),
                        'services' => $services->toArray(),
                        'services_count' => $services->count(),
                    ];

                    tenancy()->end();
                } catch (\Exception $e) {
                    Log::error('Error getting comprehensive clinic data from tenant: '.$tenantId, [
                        'error' => $e->getMessage(),
                        'practitioner_id' => $practitionerId,
                    ]);

                    try {
                        tenancy()->end();
                    } catch (\Exception $endError) {
                        // Ignore end errors
                    }

                    // Add error clinic entry
                    $clinics[] = [
                        'tenant_id' => $tenantId,
                        'tenant_name' => $tenantName,
                        'tenant_domain' => $tenantDomain,
                        'locations' => [],
                        'locations_count' => 0,
                        'services' => [],
                        'services_count' => 0,
                        'error' => 'Failed to load clinic data: '.$e->getMessage(),
                    ];
                }
            }

            return $clinics;
        } catch (\Exception $e) {
            Log::error('Error getting comprehensive clinic data for practitioner: '.$e->getMessage());

            return [];
        }
    }

    /**
     * Update availability for a practitioner at a specific location
     */
    public function updateAvailability(Request $request, $locationId)
    {
        try {
            $user = Auth::user();
            $practitioner = CentralPractitioner::where('user_id', $user->id)->first();

            // Debug logging
            Log::info('Central UpdateAvailability called', [
                'location_id' => $locationId,
                'user_id' => $user->id,
                'request_data' => $request->all(),
            ]);

            if (! $practitioner) {
                if ($request->header('X-Inertia')) {
                    return back()->with('error', 'Practitioner not found');
                }

                return response()->json(['success' => false, 'message' => 'Practitioner not found'], 404);
            }

            $validatedData = $request->validate([
                'availability' => 'required|array',
                'availability.*' => 'array',
                'availability.*.*.start_time' => 'required|string|regex:/^\d{2}:\d{2}$/',
                'availability.*.*.end_time' => 'required|string|regex:/^\d{2}:\d{2}$/',
                'tenant_id' => 'required|string', // Tenant ID is a string identifier
            ]);

            // Use tenant_id as string (it's the tenant identifier)
            $tenantId = $validatedData['tenant_id'];
            $availability = $validatedData['availability'];

            // Validate tenant exists (but don't initialize it for availability)
            $tenant = Tenant::find($tenantId);
            if (! $tenant) {
                if ($request->header('X-Inertia')) {
                    return back()->with('error', 'Tenant not found');
                }

                return response()->json(['success' => false, 'message' => 'Tenant not found'], 404);
            }

            // Save availability data to TENANT-SPECIFIC portal availability table
            // Initialize tenant context to save portal availability
            tenancy()->initialize($tenant);

            try {
                // Clear existing portal availability for this practitioner and location
                \App\Models\Tenant\PractitionerPortalAvailability::where('practitioner_id', $practitioner->id)
                    ->where('location_id', $locationId)
                    ->delete();

                // Insert new portal availability
                $records = [];
                foreach ($availability as $day => $slots) {
                    if (! empty($slots)) {
                        // Day has enabled slots
                        foreach ($slots as $slot) {
                            $records[] = [
                                'practitioner_id' => $practitioner->id,
                                'location_id' => $locationId,
                                'day' => strtolower($day),
                                'start_time' => $slot['start_time'],
                                'end_time' => $slot['end_time'],
                                'is_enabled' => true,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                        }
                    } else {
                        // Day is explicitly disabled (empty array sent from frontend)
                        // Create a marker record to indicate the day was configured but disabled
                        $records[] = [
                            'practitioner_id' => $practitioner->id,
                            'location_id' => $locationId,
                            'day' => strtolower($day),
                            'start_time' => '00:00:00',
                            'end_time' => '00:00:00',
                            'is_enabled' => false,
                            'notes' => 'Day explicitly disabled by practitioner',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }

                if (! empty($records)) {
                    \App\Models\Tenant\PractitionerPortalAvailability::insert($records);
                }

                Log::info('Portal availability updated successfully', [
                    'practitioner_id' => $practitioner->id,
                    'location_id' => $locationId,
                    'tenant_id' => $tenantId,
                    'records_count' => count($records),
                ]);

            } finally {
                tenancy()->end();
            }

            // Check if this is an Inertia request
            if ($request->header('X-Inertia')) {
                return back()->with('success', 'Availability updated successfully');
            }

            return response()->json([
                'success' => true,
                'message' => 'Availability updated successfully',
                'data' => $availability,
            ]);

        } catch (ValidationException $e) {
            if ($request->header('X-Inertia')) {
                return back()->withErrors($e->errors())->with('error', 'Validation failed');
            }

            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error updating availability: '.$e->getMessage());

            if ($request->header('X-Inertia')) {
                return back()->with('error', 'Failed to update availability: '.$e->getMessage());
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to update availability: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get available days for a practitioner
     */
    public function getAvailableDays(Request $request)
    {
        try {
            $user = Auth::user();
            $practitioner = CentralPractitioner::where('user_id', $user->id)->first();

            if (! $practitioner) {
                return response()->json(['success' => false, 'message' => 'Practitioner not found'], 404);
            }

            // Get portal availability from all tenant databases where this practitioner works
            $associatedTenants = $practitioner->tenants()
                ->wherePivot('invitation_status', 'ACCEPTED')
                ->get();

            $allAvailability = [];

            foreach ($associatedTenants as $tenant) {
                try {
                    tenancy()->initialize($tenant);

                    $availability = \App\Models\Tenant\PractitionerPortalAvailability::where('practitioner_id', $practitioner->id)
                        ->where('is_enabled', true)
                        ->get()
                        ->groupBy(['location_id', 'day'])
                        ->map(function ($locationAvailability) {
                            return $locationAvailability->map(function ($dayAvailability) {
                                return $dayAvailability->map(function ($slot) {
                                    return [
                                        'start_time' => $slot->start_time,
                                        'end_time' => $slot->end_time,
                                    ];
                                });
                            });
                        });

                    $allAvailability[$tenant->id] = $availability;

                    tenancy()->end();
                } catch (\Exception $e) {
                    Log::error('Error getting portal availability from tenant: '.$tenant->id, [
                        'error' => $e->getMessage(),
                    ]);
                    try {
                        tenancy()->end();
                    } catch (\Exception $endError) {
                        // Ignore
                    }
                }
            }

            return response()->json([
                'success' => true,
                'data' => $allAvailability,
            ]);

        } catch (\Exception $e) {
            Log::error('Error getting available days: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to get available days',
            ], 500);
        }
    }
}
