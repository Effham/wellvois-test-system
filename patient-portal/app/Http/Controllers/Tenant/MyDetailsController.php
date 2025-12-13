<?php

/**
 * DEPRECATED: This controller has been moved to Central\PractitionerDashboardController@myDetails
 * All MyDetails functionality is now handled in the central context.
 * This file is kept for legacy compatibility but should not be used.
 *
 * @deprecated Use Central\PractitionerDashboardController@myDetails instead
 */

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\Practitioner;
use App\Models\PractitionerAvailability;
use App\Models\Service;
use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\PractitionerPortalAvailability;
use App\Models\Tenant\PractitionerTenantSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class MyDetailsController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $currentTenant = tenant(); // Store current tenant context

        // Get practitioner profile from central database
        $practitioner = null;
        tenancy()->central(function () use (&$practitioner, $user) {
            $practitioner = Practitioner::where('user_id', $user->id)->first();
        });

        if (! $practitioner) {
            return Inertia::render('MyDetails/Index', [
                'practitioner' => null,
                'clinics' => [],
                'message' => 'No practitioner profile found. Please contact support.',
            ]);
        }

        // Get all tenants this practitioner is associated with from central database
        $associatedTenants = [];
        tenancy()->central(function () use (&$associatedTenants, $practitioner) {
            $tenantsData = $practitioner->tenants()
                ->wherePivot('invitation_status', 'ACCEPTED')
                ->with('domains')
                ->get();

            $associatedTenants = $tenantsData->map(function ($tenant) {
                return [
                    'id' => $tenant->id,
                    'name' => $tenant->company_name ?? 'Unknown Clinic',
                    'domain' => $tenant->domains->first()->domain ?? null,
                ];
            })->toArray();
        });

        // Collect all data across tenants for this practitioner
        $allLocations = collect();
        $allServices = collect();
        $clinics = [];
        $totalLocations = 0;

        foreach ($associatedTenants as $tenantInfo) {
            $tenantId = $tenantInfo['id'];
            $tenantName = $tenantInfo['name'];
            $tenantDomain = $tenantInfo['domain'];

            try {
                tenancy()->initialize(Tenant::find($tenantId));

                // Get locations assigned to this practitioner
                // Since practitioners table is in central DB, we need to query differently
                $assignedLocationIds = DB::table('location_practitioners')
                    ->where('practitioner_id', $practitioner->id)
                    ->where('is_assigned', true)
                    ->pluck('location_id')
                    ->toArray();

                $locations = collect();
                if (! empty($assignedLocationIds)) {
                    $locations = Location::whereIn('id', $assignedLocationIds)->get();
                }

                // Get practitioner availability for each location with tenant markers
                $locationsWithAvailability = $locations->map(function ($location) use ($practitioner, $tenantName, $tenantId) {
                    $availability = PractitionerAvailability::where('practitioner_id', $practitioner->id)
                        ->where('location_id', $location->id)
                        ->get()
                        ->groupBy('day');

                    // Format availability by day with tenant information (use lowercase keys like AppointmentController)
                    $formattedAvailability = [];
                    foreach (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as $day) {
                        $formattedAvailability[$day] = $availability->get($day, collect())->filter(function ($slot) {
                            // Only include slots with valid start and end times
                            return ! empty($slot->start_time) && ! empty($slot->end_time);
                        })->map(function ($slot) {
                            return [
                                'start_time' => substr($slot->start_time, 0, 5), // HH:MM format for MyDetails
                                'end_time' => substr($slot->end_time, 0, 5),     // HH:MM format for MyDetails
                            ];
                        })->toArray();
                    }

                    // Operating hours removed - practitioners set their own availability without location restrictions
                    $operatingHoursByDay = [];
                    foreach (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as $dow) {
                        $operatingHoursByDay[$dow] = [];
                    }

                    // Temporarily disable appointment fetching to isolate the issue
                    $existingAppointments = [];

                    // TODO: Re-enable appointment fetching once the main issue is resolved
                    // Get existing appointments for this practitioner at this location (next 30 days for slot checking)
                    // $startDateTime = now()->startOfDay();
                    // $endDateTime = now()->addDays(30)->endOfDay();
                    //
                    // $existingAppointments = Appointment::whereHas('practitioners', function ($q) use ($practitioner) {
                    //         $q->where('practitioner_id', $practitioner->id);
                    //     })
                    //     ->where('location_id', $location->id)
                    //     ->whereBetween('appointment_datetime', [$startDateTime, $endDateTime])
                    //     ->whereIn('status', ['CONFIRMED', 'PENDING']) // Only count confirmed/pending appointments
                    //     ->get()
                    //     ->map(function ($appointment) {
                    //         $appointmentDateTime = $appointment->appointment_datetime;
                    //         return [
                    //             'datetime' => $appointmentDateTime->format('Y-m-d H:i:s'),
                    //             'date' => $appointmentDateTime->format('Y-m-d'),
                    //             'time' => $appointmentDateTime->format('H:i'), // HH:MM format
                    //             'appointment_id' => $appointment->id,
                    //             'status' => $appointment->status,
                    //             'duration' => 30, // Default duration in minutes (since duration field doesn't exist)
                    //         ];
                    //     })
                    //     ->toArray();

                    $locationData = [
                        'id' => $location->id,
                        'name' => $location->name,
                        'full_address' => $location->full_address,
                        'phone_number' => $location->phone_number,
                        'email_address' => $location->email_address,
                        'timezone' => $location->timezone,
                        'is_active' => $location->is_active,
                        'availability' => $formattedAvailability,
                        'operating_hours' => $operatingHoursByDay,
                        'existing_appointments' => $existingAppointments,
                        'tenant_name' => $tenantName,
                        'tenant_id' => $tenantId,
                    ];

                    return $locationData;
                });

                // Add to global locations collection
                $allLocations = $allLocations->merge($locationsWithAvailability);

                // Get services and pricing for this practitioner in this tenant
                $services = Service::where('is_active', true)
                    ->leftJoin('practitioner_services', function ($join) use ($practitioner) {
                        $join->on('services.id', '=', 'practitioner_services.service_id')
                            ->where('practitioner_services.practitioner_id', '=', $practitioner->id);
                    })
                    ->select(
                        'services.*',
                        'practitioner_services.custom_price',
                        'practitioner_services.custom_duration_minutes',
                        'practitioner_services.is_offered'
                    )
                    ->get()
                    ->filter(function ($service) {
                        return $service->is_offered; // Only show services that are offered
                    })
                    ->map(function ($service) use ($tenantName, $tenantId) {
                        $serviceData = [
                            'id' => $service->id,
                            'name' => $service->name,
                            'category' => $service->category,
                            'description' => $service->description,
                            'delivery_modes' => $service->delivery_modes,

                            'default_price' => $service->default_price,
                            'custom_price' => $service->custom_price,

                            'effective_price' => $service->custom_price ?? $service->default_price,

                            'currency' => $service->currency,
                            'tenant_name' => $tenantName,
                            'tenant_id' => $tenantId,
                        ];

                        return $serviceData;
                    })
                    ->values();

                // Add to global services collection
                $allServices = $allServices->merge($services);

                $servicesArray = $services->toArray();

                $totalLocations += $locationsWithAvailability->count();

                // Get all available services in this tenant (not just practitioner's)
                $allTenantServices = Service::where('is_active', true)->get()->map(function ($service) use ($tenantName, $tenantId) {
                    return [
                        'id' => $service->id,
                        'name' => $service->name,
                        'category' => $service->category,
                        'description' => $service->description,
                        'delivery_modes' => $service->delivery_modes,

                        'default_price' => $service->default_price,
                        'currency' => $service->currency,
                        'tenant_name' => $tenantName,
                        'tenant_id' => $tenantId,
                    ];
                })->toArray();

                $clinics[] = [
                    'tenant_id' => $tenantId,
                    'tenant_name' => $tenantName,
                    'tenant_domain' => $tenantDomain,
                    'locations_count' => $locationsWithAvailability->count(),
                    'services_count' => count($servicesArray),
                    'locations' => $locationsWithAvailability->toArray(),
                    'services' => $servicesArray,
                    'available_services' => $allTenantServices,
                    'error' => null,
                ];

                tenancy()->end();
            } catch (\Exception $e) {

                tenancy()->end();

                Log::error('Error processing tenant in MyDetails', [
                    'tenant_id' => $tenantId,
                    'error' => $e->getMessage(),
                ]);

                $clinics[] = [
                    'tenant_id' => $tenantId,
                    'tenant_name' => $tenantName,
                    'tenant_domain' => $tenantDomain,
                    'locations_count' => 0,
                    'services_count' => 0,
                    'locations' => [],
                    'services' => [],
                    'available_services' => [],
                    'error' => 'Unable to load clinic data. Please try again later.',
                ];
            }
        }

        // Restore original tenant context before rendering
        if ($currentTenant) {
            tenancy()->initialize($currentTenant);
        } else {
            tenancy()->end();
        }

        // Get organization settings for dynamic slot generation
        $organizationSettings = [];
        try {
            $organizationSettings = [
                'appointment_session_duration' => (int) \App\Models\OrganizationSetting::getValue('appointment_session_duration', 30),
                'appointment_advance_booking_hours' => (int) \App\Models\OrganizationSetting::getValue('appointment_advance_booking_hours', 2),
                'appointment_allow_same_day_booking' => (bool) \App\Models\OrganizationSetting::getValue('appointment_allow_same_day_booking', false),
                'appointment_max_advance_booking_days' => (int) \App\Models\OrganizationSetting::getValue('appointment_max_advance_booking_days', 60),
                'appointment_buffer_time_between_appointments' => (int) \App\Models\OrganizationSetting::getValue('appointment_buffer_time_between_appointments', 0),
                'appointment_allow_back_to_back_appointments' => (bool) \App\Models\OrganizationSetting::getValue('appointment_allow_back_to_back_appointments', true),
            ];
        } catch (\Exception $e) {
            // Default settings if organization settings can't be loaded
            $organizationSettings = [
                'appointment_session_duration' => 30,
                'appointment_advance_booking_hours' => 2,
                'appointment_allow_same_day_booking' => false,
                'appointment_max_advance_booking_days' => 60,
                'appointment_buffer_time_between_appointments' => 0,
                'appointment_allow_back_to_back_appointments' => true,
            ];
        }

        try {
            return Inertia::render('MyDetails/Index', [
                'practitioner' => [
                    'id' => $practitioner->id,
                    'full_name' => $practitioner->full_name,
                    'title' => $practitioner->title,
                    'email' => $practitioner->email,
                    'phone_number' => $practitioner->phone_number,
                ],
                'clinics' => $clinics,
                'all_locations' => $allLocations->toArray(),
                'all_services' => $allServices->toArray(),
                'summary' => [
                    'total_clinics' => count($clinics),
                    'total_locations' => $totalLocations,
                    'total_services' => $allServices->count(),
                ],
                'organization_settings' => $organizationSettings,
                'tenancy' => [
                    'is_central' => false,
                    'current' => $currentTenant?->id,
                    'company_name' => $currentTenant?->company_name,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('MyDetailsController error: '.$e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return Inertia::render('MyDetails/Index', [
                'practitioner' => null,
                'clinics' => [],
                'message' => 'Unable to load clinic data. Please try again later.',
                'error' => $e->getMessage(), // Temporary for debugging
                'tenancy' => [
                    'is_central' => false,
                    'current' => $currentTenant?->id,
                    'company_name' => $currentTenant?->company_name,
                ],
            ]);
        }
    }

    /**
     * Update service pricing and availability for the current tenant
     */
    public function updateService(Request $request, Service $service)
    {
        $user = Auth::user();
        $currentTenant = tenant();

        // Get practitioner from central database
        $practitioner = null;
        tenancy()->central(function () use (&$practitioner, $user) {
            $practitioner = Practitioner::where('user_id', $user->id)->first();
        });

        if (! $practitioner) {
            throw ValidationException::withMessages([
                'practitioner' => 'Practitioner profile not found.',
            ]);
        }

        $validated = $request->validate([
            'custom_price' => 'nullable|numeric|min:0',
            'custom_duration_minutes' => 'nullable|integer|min:1',
            'is_offered' => 'required|boolean',
        ]);

        try {
            // Update or create practitioner service relationship in current tenant
            DB::table('practitioner_services')->updateOrInsert(
                [
                    'practitioner_id' => $practitioner->id,
                    'service_id' => $service->id,
                ],
                [
                    'custom_price' => $validated['custom_price'],
                    'custom_duration_minutes' => $validated['custom_duration_minutes'],
                    'is_offered' => $validated['is_offered'],
                    'updated_at' => now(),
                ]
            );

            return redirect()->back()->with('success', 'Service updated successfully.');

        } catch (\Exception $e) {
            Log::error('Error updating service in MyDetails', [
                'tenant_id' => $currentTenant->id,
                'service_id' => $service->id,
                'practitioner_id' => $practitioner->id,
                'error' => $e->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'service' => 'Failed to update service. Please try again.',
            ]);
        }
    }

    /**
     * Update availability for a location in the current tenant
     */
    public function updateAvailability(Request $request, $locationId)
    {
        $user = Auth::user();
        $currentTenant = tenant();

        // Log the request for debugging
        Log::info('UpdateAvailability called', [
            'location_id' => $locationId,
            'user_id' => $user->id,
            'tenant_id' => $currentTenant?->id,
            'request_data' => $request->all(),
        ]);

        // Find the location manually to provide better error messages
        $location = Location::find($locationId);
        if (! $location) {
            Log::error('Location not found', [
                'location_id' => $locationId,
                'tenant_id' => $currentTenant?->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => "Location with ID {$locationId} not found in this clinic.",
            ], 404);
        }

        // Get practitioner from central database
        $practitioner = null;
        tenancy()->central(function () use (&$practitioner, $user) {
            $practitioner = Practitioner::where('user_id', $user->id)->first();
        });

        if (! $practitioner) {
            return response()->json([
                'success' => false,
                'message' => 'Practitioner profile not found.',
            ], 404);
        }

        $validated = $request->validate([
            'availability' => 'required|array',
            'availability.*' => 'array',
            'availability.*.*.start_time' => 'required|string',
            'availability.*.*.end_time' => 'required|string',
        ]);

        try {
            // Remove existing portal availability for this practitioner and location
            PractitionerPortalAvailability::where('practitioner_id', $practitioner->id)
                ->where('location_id', $location->id)
                ->delete();

            // Insert new portal availability slots
            $records = [];
            foreach ($validated['availability'] as $day => $slots) {
                if (! empty($slots)) {
                    // Day has enabled slots
                    foreach ($slots as $slot) {
                        if (! empty($slot['start_time']) && ! empty($slot['end_time'])) {
                            $records[] = [
                                'practitioner_id' => $practitioner->id,
                                'location_id' => $location->id,
                                'day' => strtolower($day),
                                'start_time' => $slot['start_time'],
                                'end_time' => $slot['end_time'],
                                'is_enabled' => true,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                        }
                    }
                } else {
                    // Day is explicitly disabled (empty array sent from frontend)
                    // Create a marker record to indicate the day was configured but disabled
                    $records[] = [
                        'practitioner_id' => $practitioner->id,
                        'location_id' => $location->id,
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
                PractitionerPortalAvailability::insert($records);
            }

            return response()->json([
                'success' => true,
                'message' => 'Availability updated successfully.',
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating availability in MyDetails', [
                'tenant_id' => $currentTenant->id,
                'location_id' => $location->id,
                'practitioner_id' => $practitioner->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update availability: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Add a new service for the practitioner in the current tenant - COMMENTED OUT
     */
    /* public function addService(Request $request)
    {
        $user = Auth::user();
        $currentTenant = tenant();

        // Get practitioner from central database
        $practitioner = null;
        tenancy()->central(function () use (&$practitioner, $user) {
            $practitioner = Practitioner::where('user_id', $user->id)->first();
        });

        if (!$practitioner) {
            throw ValidationException::withMessages([
                'practitioner' => 'Practitioner profile not found.'
            ]);
        }

        $validated = $request->validate([
            'service_id' => 'required|exists:services,id',
            'custom_price' => 'nullable|numeric|min:0',
            'custom_duration_minutes' => 'nullable|integer|min:1',
            'is_offered' => 'required|boolean',
        ]);

        try {
            // Check if service already exists for this practitioner
            $exists = DB::table('practitioner_services')
                ->where('practitioner_id', $practitioner->id)
                ->where('service_id', $validated['service_id'])
                ->exists();

            if ($exists) {
                throw ValidationException::withMessages([
                    'service_id' => 'This service is already configured for you.'
                ]);
            }

            // Add practitioner service relationship in current tenant
            DB::table('practitioner_services')->insert([
                'practitioner_id' => $practitioner->id,
                'service_id' => $validated['service_id'],
                'custom_price' => $validated['custom_price'],
                'custom_duration_minutes' => $validated['custom_duration_minutes'],
                'is_offered' => $validated['is_offered'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return redirect()->back()->with('success', 'Service added successfully.');

        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            Log::error('Error adding service in MyDetails', [
                'tenant_id' => $currentTenant->id,
                'service_id' => $validated['service_id'],
                'practitioner_id' => $practitioner->id,
                'error' => $e->getMessage()
            ]);

            throw ValidationException::withMessages([
                'service' => 'Failed to add service. Please try again.'
            ]);
        }
    } */

    /**
     * Get practitioner's available days for the current tenant
     */
    public function getAvailableDays(Request $request)
    {
        $user = Auth::user();

        // Get practitioner profile from central database
        $practitioner = null;
        tenancy()->central(function () use (&$practitioner, $user) {
            $practitioner = Practitioner::where('user_id', $user->id)->first();
        });

        if (! $practitioner) {
            return response()->json(['error' => 'Practitioner not found'], 404);
        }

        // Get tenant-specific settings
        $tenantSettings = PractitionerTenantSettings::where('practitioner_id', $practitioner->id)->first();

        $availableDays = $tenantSettings ? $tenantSettings->available_days : [];

        // If no specific days set, get default from practitioner availability in this tenant
        $defaultDays = [];
        if (empty($availableDays)) {
            $defaultDays = tenancy()->central(function () use ($practitioner) {
                return \App\Models\PractitionerAvailability::where('practitioner_id', $practitioner->id)
                    ->distinct('day')
                    ->pluck('day')
                    ->toArray();
            });
        }

        return response()->json([
            'available_days' => $availableDays,
            'default_days_from_availability' => $defaultDays,
        ]);
    }

    /**
     * Update practitioner's available days for the current tenant
     */
    public function updateAvailableDays(Request $request)
    {
        $request->validate([
            'available_days' => 'nullable|array',
            'available_days.*' => 'string|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
        ]);

        $user = Auth::user();

        // Get practitioner profile from central database
        $practitioner = null;
        tenancy()->central(function () use (&$practitioner, $user) {
            $practitioner = Practitioner::where('user_id', $user->id)->first();
        });

        if (! $practitioner) {
            return back()->withErrors(['error' => 'Practitioner not found']);
        }

        // Update or create tenant-specific settings
        $tenantSettings = PractitionerTenantSettings::updateOrCreate(
            ['practitioner_id' => $practitioner->id],
            ['available_days' => $request->available_days ?? []]
        );

        return back()->with('success', 'Available days updated successfully');
    }

    /**
     * Get available locations for debugging
     */
    public function getLocations()
    {
        try {
            $locations = Location::all(['id', 'name', 'is_active']);

            return response()->json([
                'success' => true,
                'locations' => $locations,
                'tenant_id' => tenant()?->id,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
