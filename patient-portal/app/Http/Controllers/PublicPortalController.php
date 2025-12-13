<?php

namespace App\Http\Controllers;

use App\Models\AppointmentWaitlist;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\PractitionerAvailability;
use App\Models\Service;
use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\PractitionerTenantSettings;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;

class PublicPortalController extends Controller
{
    /**
     * Show the public portal home page
     */
    public function index(Request $request)
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        // Get tenant appearance settings
        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
        $appearanceSettings = $this->processS3Logo($appearanceSettings);
        $websiteSettings = $this->getWebsiteSettings();

        // Debug: Log appearance settings for troubleshooting
        \Log::info('Public Portal - Appearance Settings Retrieved', [
            'tenant_id' => $tenant->id,
            'appearance_settings' => $appearanceSettings,
            'website_settings' => $websiteSettings,
            'has_theme_color' => isset($appearanceSettings['appearance_theme_color']),
            'theme_color' => $appearanceSettings['appearance_theme_color'] ?? 'not set',
        ]);

        // Get basic stats for overview
        $stats = [
            'services_count' => Service::where('is_active', true)->count(),
            'locations_count' => Location::where('is_active', true)->count(),
            'practitioners_count' => $this->getActivePractitionersCount(),
        ];

        // Check for existing patient session
        $patientSession = $this->checkPatientSession($request);

        return Inertia::render('PublicPortal/Index', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
            'stats' => $stats,
            'patientSession' => $patientSession,
        ]);
    }

    /**
     * Show the services page
     */
    public function services()
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        $services = Service::where('is_active', true)
            ->select([
                'id',
                'name',
                'category',
                'description',
                'delivery_modes',
                'default_price',
                'currency',
            ])
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->groupBy('category');

        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
        $appearanceSettings = $this->processS3Logo($appearanceSettings);
        $websiteSettings = $this->getWebsiteSettings();

        // Debug: Ensure appearance settings are available for services page
        \Log::info('Public Portal Services - Appearance Settings', [
            'tenant_id' => $tenant->id,
            'has_appearance_settings' => ! empty($appearanceSettings),
            'theme_color' => $appearanceSettings['appearance_theme_color'] ?? 'not set',
        ]);

        return Inertia::render('PublicPortal/Services', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'services' => $services,
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    /**
     * Show the locations page
     */
    public function locations()
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        $locations = Location::where('is_active', true)
            ->select([
                'id',
                'name',
                'street_address',
                'apt_suite_unit',
                'city',
                'province',
                'postal_zip_code',
                'phone_number',
                'email_address',
            ])
            ->get()
            ->map(function ($location) {
                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'street_address' => $location->street_address,
                    'apt_suite_unit' => $location->apt_suite_unit,
                    'city' => $location->city,
                    'province' => $location->province,
                    'postal_zip_code' => $location->postal_zip_code,
                    'phone_number' => $location->phone_number,
                    'email_address' => $location->email_address,
                    'operating_hours' => [], // Operating hours removed - practitioners set their own availability
                ];
            });

        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
        $appearanceSettings = $this->processS3Logo($appearanceSettings);
        $websiteSettings = $this->getWebsiteSettings();

        return Inertia::render('PublicPortal/Locations', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'locations' => $locations,
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    /**
     * Show the staff page
     */
    public function staff(Request $request)
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        // Get filter parameters
        $filters = [
            'specialties' => $request->input('specialties', []),
            'modalities' => $request->input('modalities', []),
            'client_types' => $request->input('client_types', []),
            'languages' => $request->input('languages', []),
            'professional_associations' => $request->input('professional_associations', []),
        ];

        // Ensure all filters are arrays
        foreach ($filters as $key => $value) {
            if (! is_array($value)) {
                $filters[$key] = $value ? [$value] : [];
            }
        }

        // Get practitioners from tenant database (already tenant-scoped after migration)
        $practitioners = [];
        $availableFilters = [
            'specialties' => [],
            'modalities' => [],
            'client_types' => [],
            'languages' => [],
            'professional_associations' => [],
        ];

        // NOTE: No select() clause - CipherSweet needs all fields to decrypt properly
        $query = Practitioner::query()
            ->where('is_active', true);

        // Apply filters at database level using JSON operators
        if (! empty($filters['specialties'])) {
            $query->where(function ($q) use ($filters) {
                foreach ($filters['specialties'] as $specialty) {
                    $q->orWhereJsonContains('primary_specialties', $specialty);
                }
            });
        }

        if (! empty($filters['modalities'])) {
            $query->where(function ($q) use ($filters) {
                foreach ($filters['modalities'] as $modality) {
                    $q->orWhereJsonContains('therapeutic_modalities', $modality);
                }
            });
        }

        if (! empty($filters['client_types'])) {
            $query->where(function ($q) use ($filters) {
                foreach ($filters['client_types'] as $clientType) {
                    $q->orWhereJsonContains('client_types_served', $clientType);
                }
            });
        }

        if (! empty($filters['languages'])) {
            $query->where(function ($q) use ($filters) {
                foreach ($filters['languages'] as $language) {
                    $q->orWhereJsonContains('languages_spoken', $language);
                }
            });
        }

        if (! empty($filters['professional_associations'])) {
            $query->where(function ($q) use ($filters) {
                foreach ($filters['professional_associations'] as $association) {
                    $q->orWhereJsonContains('professional_associations', $association);
                }
            });
        }

        // Get filtered practitioners
        $practitioners = $query->get();

        // Generate profile picture URLs for S3 images
        $practitioners = $practitioners->map(function ($practitioner) {
            // Generate profile picture proxy URL if S3 key exists
            if ($practitioner->profile_picture_s3_key) {
                $cacheBuster = substr(md5($practitioner->profile_picture_s3_key), 0, 8);
                $practitioner->profile_picture_url = url("/profile-picture-proxy/{$practitioner->id}?v={$cacheBuster}");
            }

            return $practitioner;
        });

        // Get available filter options from all active practitioners (for filter UI)
        $allPractitioners = Practitioner::select([
            'primary_specialties',
            'therapeutic_modalities',
            'client_types_served',
            'languages_spoken',
            'professional_associations',
        ])
            ->where('is_active', true)
            ->get();

        $availableFilters = [
            'specialties' => $allPractitioners->pluck('primary_specialties')->flatten()->filter()->unique()->sort()->values()->toArray(),
            'modalities' => $allPractitioners->pluck('therapeutic_modalities')->flatten()->filter()->unique()->sort()->values()->toArray(),
            'client_types' => $allPractitioners->pluck('client_types_served')->flatten()->filter()->unique()->sort()->values()->toArray(),
            'languages' => $allPractitioners->pluck('languages_spoken')->flatten()->filter()->unique()->sort()->values()->toArray(),
            'professional_associations' => $allPractitioners->pluck('professional_associations')->flatten()->filter()->unique()->sort()->values()->toArray(),
        ];

        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
        $appearanceSettings = $this->processS3Logo($appearanceSettings);
        $websiteSettings = $this->getWebsiteSettings();

        return Inertia::render('PublicPortal/Staff', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'practitioners' => \App\Http\Resources\PractitionerMinimalResource::collection($practitioners)
                ->map(function ($practitioner) {
                    return [
                        'id' => $practitioner['id'],
                        'first_name' => $practitioner['first_name'],
                        'last_name' => $practitioner['last_name'],
                        'full_name' => $practitioner['full_name'],
                        'display_name' => $practitioner['display_name'],
                        'title' => $practitioner['title'],
                        'slug' => $practitioner['slug'] ?? null,
                        'short_bio' => $practitioner['short_bio'] ?? null,
                        'credentials' => $practitioner['credentials'] ?? [],
                        'primary_specialties' => $practitioner['primary_specialties'] ?? [],
                        'therapeutic_modalities' => $practitioner['therapeutic_modalities'] ?? [],
                        'client_types_served' => $practitioner['client_types_served'] ?? [],
                        'languages_spoken' => $practitioner['languages_spoken'] ?? [],
                        'professional_associations' => $practitioner['professional_associations'] ?? [],
                        'profile_picture_url' => $practitioner['profile_picture_url'] ?? null,
                    ];
                }),
            'availableFilters' => $availableFilters,
            'currentFilters' => $filters,
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    /**
     * Show the practitioner detail page
     */
    public function practitionerDetail(Request $request, $practitionerSlug): \Inertia\Response
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        // NOTE: No select() clause - CipherSweet needs all fields to decrypt properly
        // Query tenant practitioners directly (already tenant-scoped after migration)
        $practitioner = Practitioner::query()
            ->where('slug', $practitionerSlug)
            ->where('is_active', true)
            ->first();

        if (! $practitioner) {
            abort(404, 'Practitioner not found');
        }

        $practitionerId = $practitioner->id;

        // Generate profile picture proxy URL if S3 key exists
        if ($practitioner->profile_picture_s3_key) {
            $cacheBuster = substr(md5($practitioner->profile_picture_s3_key), 0, 8);
            $practitioner->profile_picture_url = url("/profile-picture-proxy/{$practitionerId}?v={$cacheBuster}");
        }

        // Get locations from location_practitioners where is_assigned = true (tenant database)
        $locations = DB::connection('tenant')->table('location_practitioners')
            ->join('locations', 'location_practitioners.location_id', '=', 'locations.id')
            ->where('location_practitioners.practitioner_id', $practitionerId)
            ->where('location_practitioners.is_assigned', true)
            ->where('locations.is_active', true)
            ->select('locations.name', 'locations.city')
            ->get()
            ->map(function ($location) {
                return $location->city ? "{$location->name}, {$location->city}" : $location->name;
            })
            ->values()
            ->toArray();

        // Get availability from practitioner_availability (tenant database)
        $availabilityRecords = DB::connection('tenant')->table('practitioner_portal_availability')
            ->where('is_enabled', true)
            ->where('practitioner_id', $practitionerId)
            ->select('day', 'start_time', 'end_time')
            ->orderByRaw("FIELD(day, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')")
            ->orderBy('start_time')
            ->get();

        // Group and format availability
        $availability = [];
        $dayGroups = $availabilityRecords->groupBy('day');

        foreach ($dayGroups as $day => $slots) {
            $dayLabel = strtoupper(substr($day, 0, 3));

            // Determine time of day based on start times
            $timeOfDay = [];
            foreach ($slots as $slot) {
                $hour = (int) substr($slot->start_time, 0, 2);
                if ($hour < 12) {
                    if (! in_array('Morning', $timeOfDay)) {
                        $timeOfDay[] = 'Morning';
                    }
                } elseif ($hour < 17) {
                    if (! in_array('Daytime', $timeOfDay)) {
                        $timeOfDay[] = 'Daytime';
                    }
                } else {
                    if (! in_array('Evening', $timeOfDay)) {
                        $timeOfDay[] = 'Evening';
                    }
                }
            }

            $availability[] = [
                'day' => $dayLabel,
                'time_of_day' => implode(', ', $timeOfDay),
            ];
        }

        // Get services from practitioner_services where is_offered = true (tenant database)
        $services = DB::connection('tenant')->table('practitioner_services')
            ->join('services', 'practitioner_services.service_id', '=', 'services.id')
            ->where('practitioner_services.practitioner_id', $practitionerId)
            ->where('practitioner_services.is_offered', true)
            ->where('services.is_active', true)
            ->select(
                'services.id',
                'services.name',
                'services.category',
                'services.description',
                'services.delivery_modes',
                'services.default_price',
                'services.currency',
                'practitioner_services.custom_price',
                'practitioner_services.custom_duration_minutes'
            )
            ->get()
            ->map(function ($service) {
                return [
                    'id' => $service->id,
                    'name' => $service->name,
                    'category' => $service->category,
                    'description' => $service->description,
                    'delivery_modes' => json_decode($service->delivery_modes, true) ?? [],
                    'price' => $service->custom_price ?? $service->default_price,
                    'currency' => $service->currency,
                    'duration_minutes' => $service->custom_duration_minutes,
                ];
            })
            ->toArray();

        // Calculate min and max hourly rates from services
        $prices = array_filter(array_column($services, 'price'));
        $hourly_rate_min = ! empty($prices) ? min($prices) : null;
        $hourly_rate_max = ! empty($prices) ? max($prices) : null;

        // Determine session types from services delivery modes
        $sessionTypes = [];
        foreach ($services as $service) {
            foreach ($service['delivery_modes'] as $mode) {
                if ($mode === 'in-person' && ! in_array('In-Person', $sessionTypes)) {
                    $sessionTypes[] = 'In-Person';
                }
                if ($mode === 'virtual' && ! in_array('Virtual', $sessionTypes)) {
                    $sessionTypes[] = 'Virtual';
                }
            }
        }

        // Build additional data that's not in the resource
        $additionalData = [
            'accepting_clients' => true, // You can add this field to the model if needed
            'hourly_rate_min' => $hourly_rate_min,
            'hourly_rate_max' => $hourly_rate_max,
            'session_types' => $sessionTypes,
            'locations' => $locations,
            'availability' => $availability,
            'services' => $services,
            'approach' => $practitioner->full_bio ?? $practitioner->short_bio,
            'therapy_experience' => null, // You can add this field to the model if needed
            'about_me' => null, // You can add this field to the model if needed
            'areas_of_treatment' => $practitioner->primary_specialties ?? [],
        ];

        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
        $appearanceSettings = $this->processS3Logo($appearanceSettings);
        $websiteSettings = $this->getWebsiteSettings();

        return Inertia::render('PublicPortal/PractitionerDetail', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'practitioner' => array_merge(
                (new \App\Http\Resources\PractitionerPublicResource($practitioner))->resolve(),
                $additionalData
            ),
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    /**
     * Get count of active practitioners for this tenant
     */
    private function getActivePractitionersCount(): int
    {
        $count = 0;
        $currentTenantId = tenant()->id;

        // Get count from tenant database
        $count = Practitioner::where('is_active', true)->count();

        return $count;
    }

    /**
     * Get practitioner availability for public booking (no auth required)
     */
    public function getPractitionerAvailability(Request $request)
    {
        try {
            $request->validate([
                'practitioner_id' => ['nullable', 'integer'], // Optional for public booking
                'practitioner_ids' => ['nullable', 'array'], // Support multiple practitioners
                'practitioner_ids.*' => ['integer'],
                'service_id' => ['nullable', 'integer'], // Added for general availability
                'location_id' => ['nullable', 'integer'],
                'mode' => ['required', 'string', 'in:in-person,virtual,hybrid'],
            ]);

            $practitionerId = $request->input('practitioner_id');
            $practitionerIds = $request->input('practitioner_ids', []);
            $serviceId = $request->input('service_id');
            $locationId = $request->input('location_id');
            $mode = $request->input('mode');

            // If single practitioner_id is provided, add it to the array
            if ($practitionerId) {
                $practitionerIds[] = $practitionerId;
            }
            $practitionerIds = array_unique($practitionerIds);

            $availability = [];
            $existingAppointments = [];

            // If practitioner(s) are selected, get their specific availability
            if (! empty($practitionerIds)) {
                // Get all practitioners' tenant-specific available days
                $tenantSettings = PractitionerTenantSettings::whereIn('practitioner_id', $practitionerIds)->get();

                // Determine common available days for multiple practitioners
                $commonAvailableDays = null;
                foreach ($practitionerIds as $practitionerId) {
                    $settings = $tenantSettings->where('practitioner_id', $practitionerId)->first();
                    $practitionerAvailableDays = $settings ? $settings->available_days : [];

                    // If practitioner has no specific days set for this tenant, get from practitioner availability
                    if (empty($practitionerAvailableDays)) {
                        $availabilityDays = PractitionerAvailability::where('practitioner_id', $practitionerId)
                            ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
                                return $query->where('location_id', $locationId);
                            })
                            ->distinct('day')
                            ->pluck('day')
                            ->toArray();
                        $practitionerAvailableDays = ! empty($availabilityDays) ? $availabilityDays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                    }

                    // For first practitioner, set as initial common days
                    if ($commonAvailableDays === null) {
                        $commonAvailableDays = $practitionerAvailableDays;
                    } else {
                        // Find intersection of available days
                        $commonAvailableDays = array_intersect($commonAvailableDays, $practitionerAvailableDays);
                    }
                }

                // Get availability for practitioners - check portal availability first
                $availability = [];

                try {
                    // Priority 1: Check if any portal availability configuration exists (enabled OR disabled)
                    $hasPortalConfig = \App\Models\Tenant\PractitionerPortalAvailability::whereIn('practitioner_id', $practitionerIds)
                        ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
                            return $query->where('location_id', $locationId);
                        })
                        ->when(! empty($commonAvailableDays), function ($query) use ($commonAvailableDays) {
                            return $query->whereIn('day', $commonAvailableDays);
                        })
                        ->exists();

                    if ($hasPortalConfig) {
                        // Portal configuration exists - only show enabled slots
                        $portalAvailabilityQuery = \App\Models\Tenant\PractitionerPortalAvailability::whereIn('practitioner_id', $practitionerIds)
                            ->where('is_enabled', true)
                            ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
                                return $query->where('location_id', $locationId);
                            });

                        // Filter by common available days
                        if (! empty($commonAvailableDays)) {
                            $portalAvailabilityQuery->whereIn('day', $commonAvailableDays);
                        }

                        $portalAvailability = $portalAvailabilityQuery
                            ->orderBy('day')
                            ->get()
                            ->groupBy('day')
                            ->map(function ($dayAvailability) {
                                return $dayAvailability->map(function ($slot) {
                                    return [
                                        'start_time' => $slot->start_time,
                                        'end_time' => $slot->end_time,
                                    ];
                                });
                            })
                            ->toArray();

                        $availability = $portalAvailability;
                        \Log::info('Using tenant portal availability (respecting disabled days)', ['practitioner_ids' => $practitionerIds]);
                    } else {
                        // Fallback to general practitioner availability
                        if ($mode === 'in-person' && $locationId) {
                            // Fetch availability for a specific location and practitioners
                            $availabilityQuery = PractitionerAvailability::whereIn('practitioner_id', $practitionerIds)
                                ->where('location_id', $locationId)
                                ->orderBy('day')
                                ->get();
                        } else {
                            // For virtual or hybrid, location might not be relevant
                            $availabilityQuery = PractitionerAvailability::whereIn('practitioner_id', $practitionerIds)
                                ->orderBy('day')
                                ->get();
                        }

                        // Convert to array grouped by day (same as admin controller)
                        $availability = $availabilityQuery
                            ->groupBy('day')
                            ->map(function ($dayAvailability) {
                                return $dayAvailability->map(function ($slot) {
                                    return [
                                        'start_time' => $slot->start_time,
                                        'end_time' => $slot->end_time,
                                    ];
                                });
                            })
                            ->toArray();

                        \Log::info('Using PractitionerAvailability (fallback - no portal config)', [
                            'practitioner_ids' => $practitionerIds,
                            'availability_slots_found' => collect($availability)->sum(function ($day) {
                                return count($day);
                            }),
                        ]);
                    }
                } catch (\Exception $e) {
                    \Log::error('Error fetching practitioner availability', [
                        'error' => $e->getMessage(),
                        'practitioner_ids' => $practitionerIds,
                        'location_id' => $locationId,
                        'mode' => $mode,
                        'tenant_id' => tenant()?->id,
                    ]);

                    // Fallback to empty availability on error
                    $availability = [];
                }

                // Get existing appointments for all selected practitioners
                // Query the appointment_practitioner pivot table directly (same as conflict checker)
                // This ensures we get the actual practitioner-specific time slots
                $appointmentQueryBuilder = DB::table('appointment_practitioner')
                    ->join('appointments', 'appointment_practitioner.appointment_id', '=', 'appointments.id')
                    ->whereIn('appointment_practitioner.practitioner_id', $practitionerIds)
                    ->whereNotNull('appointments.appointment_datetime')
                    ->where('appointments.appointment_datetime', '>=', now()->startOfDay())
                    ->whereNotIn('appointments.status', ['cancelled', 'no-show']);

                // Do NOT filter by location - a practitioner can only be in one place at a time
                // If they have an appointment at Location A, they are unavailable at Location B too

                $currentSessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);

                $existingAppointments = $appointmentQueryBuilder
                    ->select(
                        'appointments.id',
                        'appointments.appointment_datetime',
                        'appointments.status',
                        'appointments.mode',
                        'appointments.location_id',
                        'appointment_practitioner.start_time',
                        'appointment_practitioner.end_time'
                    )
                    ->get()
                    ->map(function ($appointment) use ($currentSessionDuration, $locationId) {
                        $actualDuration = $currentSessionDuration;

                        // Use times from appointment_practitioner pivot table
                        if ($appointment->start_time && $appointment->end_time) {
                            $startTime = \Carbon\Carbon::parse($appointment->start_time);
                            $endTime = \Carbon\Carbon::parse($appointment->end_time);
                            $actualDuration = $startTime->diffInMinutes($endTime);
                        }

                        // Use appointment_datetime if available, fallback to start_time from pivot
                        $dateTime = $appointment->appointment_datetime ? \Carbon\Carbon::parse($appointment->appointment_datetime) : ($appointment->start_time ? \Carbon\Carbon::parse($appointment->start_time) : null);

                        if (! $dateTime) {
                            // Skip appointments without valid datetime
                            return null;
                        }

                        // Convert UTC time to tenant timezone for frontend display (same as admin controller)
                        try {
                            $localDateTime = \App\Services\TenantTimezoneService::convertToTenantTime($dateTime);
                        } catch (\Exception $e) {
                            \Log::warning('Failed to convert appointment time to tenant timezone in public portal', [
                                'appointment_id' => $appointment->id,
                                'utc_datetime' => $dateTime->format('Y-m-d H:i:s'),
                                'error' => $e->getMessage(),
                            ]);
                            // Fallback to UTC if conversion fails
                            $localDateTime = $dateTime;
                        }

                        return [
                            'datetime' => $localDateTime->format('Y-m-d H:i:s'),
                            'date' => $localDateTime->format('Y-m-d'),
                            'time' => $localDateTime->format('H:i'),
                            'appointment_id' => $appointment->id,
                            'status' => $appointment->status,
                            'mode' => $appointment->mode,
                            'location_id' => $appointment->location_id,
                            'duration' => $actualDuration,
                            'start_time' => $appointment->start_time ? \Carbon\Carbon::parse($appointment->start_time)->format('Y-m-d H:i:s') : null,
                            'end_time' => $appointment->end_time ? \Carbon\Carbon::parse($appointment->end_time)->format('Y-m-d H:i:s') : null,
                            'timezone_converted' => $locationId ? true : false, // Debug flag
                            'original_utc' => $dateTime->format('Y-m-d H:i:s'), // Debug info
                        ];
                    })
                    ->filter() // Remove any null entries
                    ->toArray();
            } else {
                // No practitioner selected - show general availability based on all practitioners who offer the service
                if ($serviceId) {
                    // Find all practitioners who offer this service
                    $practitionerIdsForService = \DB::table('practitioner_services')
                        ->where('service_id', $serviceId)
                        ->where('is_offered', true)
                        ->pluck('practitioner_id')
                        ->toArray();

                    if (! empty($practitionerIdsForService)) {
                        // Get all practitioners' tenant-specific available days
                        $tenantSettings = PractitionerTenantSettings::whereIn('practitioner_id', $practitionerIdsForService)->get();

                        // Get all unique available days from all practitioners for this tenant
                        $allAvailableDays = [];
                        foreach ($practitionerIdsForService as $practitionerId) {
                            $settings = $tenantSettings->where('practitioner_id', $practitionerId)->first();
                            $practitionerAvailableDays = $settings ? $settings->available_days : [];

                            // If practitioner has no specific days set for this tenant, get from practitioner availability in central database
                            if (empty($practitionerAvailableDays)) {
                                try {
                                    // Query practitioner availability from central database
                                    $availabilityDays = PractitionerAvailability::where('practitioner_id', $practitionerId)
                                        ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
                                            return $query->where('location_id', $locationId);
                                        })
                                        ->distinct('day')
                                        ->pluck('day')
                                        ->toArray();
                                    $practitionerAvailableDays = ! empty($availabilityDays) ? $availabilityDays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                                } catch (\Exception $e) {
                                    \Log::warning('Error fetching practitioner availability days for service query', [
                                        'practitioner_id' => $practitionerId,
                                        'error' => $e->getMessage(),
                                    ]);
                                    $practitionerAvailableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                                }
                            }

                            $allAvailableDays = array_unique(array_merge($allAvailableDays, $practitionerAvailableDays));
                        }

                        // Get availability for all practitioners who offer this service - check portal availability first
                        $availability = [];

                        try {
                            // Priority 1: Check if any portal availability configuration exists for service practitioners
                            $hasPortalConfig = \App\Models\Tenant\PractitionerPortalAvailability::whereIn('practitioner_id', $practitionerIdsForService)
                                ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
                                    return $query->where('location_id', $locationId);
                                })
                                ->exists();

                            if ($hasPortalConfig) {
                                // Portal configuration exists - only show enabled slots
                                $portalAvailabilityQuery = \App\Models\Tenant\PractitionerPortalAvailability::whereIn('practitioner_id', $practitionerIdsForService)
                                    ->where('is_enabled', true)
                                    ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
                                        return $query->where('location_id', $locationId);
                                    });

                                $portalAvailability = $portalAvailabilityQuery
                                    ->orderBy('day')
                                    ->get()
                                    ->groupBy('day')
                                    ->map(function ($dayAvailability) {
                                        return $dayAvailability->map(function ($slot) {
                                            return [
                                                'start_time' => $slot->start_time,
                                                'end_time' => $slot->end_time,
                                            ];
                                        });
                                    })
                                    ->toArray();

                                $availability = $portalAvailability;
                                \Log::info('Using tenant portal availability for service (respecting disabled days)', ['service_id' => $serviceId]);
                            } else {
                                // Fallback to general practitioner availability
                                if ($mode === 'in-person' && $locationId) {
                                    // Fetch availability for a specific location and practitioners
                                    $availabilityQuery = PractitionerAvailability::whereIn('practitioner_id', $practitionerIdsForService)
                                        ->where('location_id', $locationId)
                                        ->orderBy('day')
                                        ->get();
                                } else {
                                    // For virtual or hybrid, location might not be relevant
                                    $availabilityQuery = PractitionerAvailability::whereIn('practitioner_id', $practitionerIdsForService)
                                        ->orderBy('day')
                                        ->get();
                                }

                                // Convert to array grouped by day (same as admin controller)
                                $availability = $availabilityQuery
                                    ->groupBy('day')
                                    ->map(function ($dayAvailability) {
                                        return $dayAvailability->map(function ($slot) {
                                            return [
                                                'start_time' => $slot->start_time,
                                                'end_time' => $slot->end_time,
                                            ];
                                        });
                                    })
                                    ->toArray();

                                \Log::info('Using PractitionerAvailability for service (fallback - no portal config)', [
                                    'service_id' => $serviceId,
                                    'practitioner_ids_for_service' => $practitionerIdsForService,
                                    'availability_slots_found' => collect($availability)->sum(function ($day) {
                                        return count($day);
                                    }),
                                ]);
                            }
                        } catch (\Exception $e) {
                            \Log::error('Error fetching service-based practitioner availability', [
                                'error' => $e->getMessage(),
                                'practitioner_ids_for_service' => $practitionerIdsForService,
                                'location_id' => $locationId,
                                'mode' => $mode,
                                'service_id' => $serviceId,
                                'tenant_id' => tenant()?->id,
                            ]);

                            // Fallback to empty availability on error
                            $availability = [];
                        }

                        // Get existing appointments for all practitioners who offer this service
                        // Query the appointment_practitioner pivot table directly (same as conflict checker)
                        // This ensures we get the actual practitioner-specific time slots
                        $appointmentQueryBuilder = DB::table('appointment_practitioner')
                            ->join('appointments', 'appointment_practitioner.appointment_id', '=', 'appointments.id')
                            ->whereIn('appointment_practitioner.practitioner_id', $practitionerIdsForService)
                            ->whereNotNull('appointments.appointment_datetime')
                            ->where('appointments.appointment_datetime', '>=', now()->startOfDay())
                            ->whereNotIn('appointments.status', ['cancelled', 'no-show']);

                        // Do NOT filter by location - a practitioner can only be in one place at a time
                        // If they have an appointment at Location A, they are unavailable at Location B too

                        $currentSessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);

                        $existingAppointments = $appointmentQueryBuilder
                            ->select(
                                'appointments.id',
                                'appointments.appointment_datetime',
                                'appointments.status',
                                'appointments.mode',
                                'appointments.location_id',
                                'appointment_practitioner.start_time',
                                'appointment_practitioner.end_time'
                            )
                            ->get()
                            ->map(function ($appointment) use ($currentSessionDuration, $locationId) {
                                $actualDuration = $currentSessionDuration;

                                // Use times from appointment_practitioner pivot table
                                if ($appointment->start_time && $appointment->end_time) {
                                    $startTime = \Carbon\Carbon::parse($appointment->start_time);
                                    $endTime = \Carbon\Carbon::parse($appointment->end_time);
                                    $actualDuration = $startTime->diffInMinutes($endTime);
                                }

                                // Use appointment_datetime if available, fallback to start_time from pivot
                                $dateTime = $appointment->appointment_datetime ? \Carbon\Carbon::parse($appointment->appointment_datetime) : ($appointment->start_time ? \Carbon\Carbon::parse($appointment->start_time) : null);

                                if (! $dateTime) {
                                    // Skip appointments without valid datetime
                                    return null;
                                }

                                // Convert UTC time to location timezone for frontend display
                                $localDateTime = $dateTime;
                                if ($locationId) {
                                    try {
                                        $localDateTime = \App\Services\SimpleTimezoneService::toLocal($dateTime, $locationId);
                                    } catch (\Exception $e) {
                                        Log::warning('Public Portal: Failed to convert appointment time to local timezone', [
                                            'appointment_id' => $appointment->id,
                                            'location_id' => $locationId,
                                            'utc_datetime' => $dateTime->format('Y-m-d H:i:s'),
                                            'error' => $e->getMessage(),
                                        ]);
                                        // Fallback to UTC if conversion fails
                                        $localDateTime = $dateTime;
                                    }
                                }

                                return [
                                    'datetime' => $localDateTime->format('Y-m-d H:i:s'),
                                    'date' => $localDateTime->format('Y-m-d'),
                                    'time' => $localDateTime->format('H:i'),
                                    'appointment_id' => $appointment->id,
                                    'status' => $appointment->status,
                                    'mode' => $appointment->mode,
                                    'location_id' => $appointment->location_id,
                                    'duration' => $actualDuration,
                                    'start_time' => $appointment->start_time ? \Carbon\Carbon::parse($appointment->start_time)->format('Y-m-d H:i:s') : null,
                                    'end_time' => $appointment->end_time ? \Carbon\Carbon::parse($appointment->end_time)->format('Y-m-d H:i:s') : null,
                                ];
                            })->filter()
                            ->toArray();
                    } else {
                        // No practitioners offer this service
                        $availability = [];
                        $existingAppointments = [];
                    }
                } else {
                    // No service selected, return empty availability
                    $availability = [];
                    $existingAppointments = [];
                }
            }

            // Debug logging for availability response
            \Log::info('PublicPortal availability response', [
                'existingAppointments_count' => count($existingAppointments),
                'existingAppointments_all' => $existingAppointments, // Log ALL appointments to see what's being returned
                'existingAppointments_is_array' => is_array($existingAppointments),
                'availability_count' => is_array($availability) ? count($availability) : 'not_array',
                'request_params' => [
                    'practitionerId' => $practitionerId,
                    'practitionerIds' => $practitionerIds ?? null,
                    'serviceId' => $serviceId,
                    'mode' => $mode,
                    'locationId' => $locationId,
                ],
                'query_info' => [
                    'using_pivot_table' => true,
                    'status_filter' => ['cancelled', 'no-show'],
                    'date_filter' => now()->startOfDay()->format('Y-m-d H:i:s'),
                ],
            ]);

            return response()->json([
                'availability' => $availability,
                'existingAppointments' => $existingAppointments,
            ]);

        } catch (\Exception $e) {
            \Log::error('Public practitioner availability failed', [
                'error' => $e->getMessage(),
                'request_data' => $request->all(),
            ]);

            return response()->json([
                'availability' => [],
                'existingAppointments' => [],
                'error' => 'Failed to fetch availability',
            ], 500);
        }
    }

    /**
     * Submit appointment request from public portal
     */
    public function submitAppointment(Request $request)
    {
        try {
            $validated = $request->validate([
                // Service details
                'service_type' => 'required|string',
                'service_name' => 'required|string',
                'service_id' => 'required|integer',
                'practitioner_id' => 'nullable|integer', // Optional
                'location_id' => 'nullable|integer',
                'mode' => 'required|string|in:in-person,virtual,hybrid',
                'date_time_preference' => 'required|string',

                // Client information
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'email' => 'required|email|max:255',
                'phone' => 'required|string|max:255',
                'notes' => 'nullable|string|max:1000',
            ]);

            // For now, just log the appointment request
            \Log::info('Public appointment request received', [
                'data' => $validated,
                'tenant_id' => tenant('id'),
            ]);

            // In a real implementation, you would:
            // 1. Create a pending appointment request
            // 2. Send email notifications to staff
            // 3. Create calendar placeholders
            // 4. Send confirmation to customer

            return response()->json([
                'success' => true,
                'message' => 'Thank you for your appointment request! We will contact you shortly to confirm your booking.',
            ]);

        } catch (\Exception $e) {
            \Log::error('Public appointment submission failed', [
                'error' => $e->getMessage(),
                'request_data' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to submit appointment request. Please try again.',
            ], 500);
        }
    }

    /**
     * Get required patient consents for registration
     */
    public function getPatientConsents()
    {
        try {
            // Get trigger points from session, default to ['creation'] if not set
            $registrationData = session('public_portal_registration');
            $triggerPoints = $registrationData['trigger_points'] ?? ['creation'];

            \Log::info('Fetching patient consents for trigger points', [
                'trigger_points' => $triggerPoints,
                'flow_type' => $registrationData['flow_type'] ?? 'unknown',
                'full_session_data' => $registrationData,
            ]);

            // Get all PATIENT consents (both required and unrequired) filtered by trigger points
            $consentsQuery = \App\Models\Tenant\Consent::where('entity_type', 'PATIENT')
                ->with(['activeVersion' => function ($query) {
                    $query->select('id', 'consent_id', 'version', 'consent_body', 'status');
                }]);

            // Filter by trigger points - check if any of the requested trigger points are in the consent's trigger_points JSON
            $consentsQuery->where(function ($query) use ($triggerPoints) {
                foreach ($triggerPoints as $triggerPoint) {
                    $query->orWhereJsonContains('trigger_points->patient', $triggerPoint);
                }
            });

            $consents = $consentsQuery->get(['id', 'key', 'title', 'entity_type', 'is_required', 'trigger_points']);

            // Log each consent's trigger points for debugging
            \Log::info('Raw consents fetched from database', [
                'count' => $consents->count(),
                'requested_trigger_points' => $triggerPoints,
                'consent_keys_returned' => $consents->pluck('key')->toArray(),
                'consents_detail' => $consents->map(function ($c) {
                    return [
                        'key' => $c->key,
                        'title' => $c->title,
                        'trigger_points' => $c->trigger_points,
                        'is_required' => $c->is_required,
                    ];
                })->toArray(),
            ]);

            // Format consents for frontend
            $formattedConsents = $consents->map(function ($consent) {
                return [
                    'id' => $consent->id,
                    'key' => $consent->key,
                    'title' => $consent->title,
                    'is_required' => $consent->is_required,
                    'version_id' => $consent->activeVersion?->id,
                    'version' => $consent->activeVersion?->version,
                    'body' => $consent->activeVersion?->consent_body ?? [],
                ];
            })->filter(function ($consent) {
                // Only return consents that have an active version
                return ! is_null($consent['version_id']);
            })->values();

            \Log::info('Fetched patient consents', [
                'count' => $formattedConsents->count(),
                'trigger_points' => $triggerPoints,
            ]);

            return response()->json([
                'success' => true,
                'consents' => $formattedConsents,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch patient consents for registration', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch consents. Please try again.',
            ], 500);
        }
    }

    /**
     * Register patient and create appointment from public portal
     */
    public function registerAndBook(Request $request)
    {
        try {
            $validated = $request->validate([
                // Service details
                'service_type' => 'required|string',
                'service_name' => 'required|string',
                'service_id' => 'required|integer',
                'practitioner_id' => 'nullable|integer',
                'practitioner_ids' => 'nullable|array',
                'practitioner_ids.*' => 'integer',
                'location_id' => 'nullable|integer',
                'mode' => 'required|string|in:in-person,virtual,hybrid',
                'date_time_preference' => 'nullable|string',
                // Waiting list parameters
                'is_waiting_list' => 'nullable|boolean',
                'waiting_list_day' => 'nullable|string|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday,any',
                'waiting_list_time' => 'nullable|string|in:morning,afternoon,evening,any',

                // Patient information
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'preferred_name' => 'nullable|string|max:255',
                'email_address' => 'required|email|max:255',
                'phone_number' => 'required|string|max:255',
                'date_of_birth' => 'required|date',
                'gender_pronouns' => 'required|string|max:255',
                'emergency_contact_phone' => 'required|string|max:255',
                'client_type' => 'required|string|in:individual,couple,family,group',
                'health_card_number' => 'nullable|string|max:50',
                'notes' => 'nullable|string|max:1000',

                // Authentication
                'password' => 'required|string|min:8',
                'password_confirmation' => 'required|string|same:password',

                // Flags
                'from_public_portal' => 'boolean',
                'advanced_appointment_settings' => 'nullable|boolean',
                'slot_divisions' => 'nullable|string',
            ]);

            // Make date_time_preference required only if not a waiting list
            if (! $request->boolean('is_waiting_list') && empty($validated['date_time_preference'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Date and time preference is required for regular appointments.',
                ], 422);
            }

            DB::beginTransaction();

            // REMOVED: Patient email validation that prevents registration
            // Users can now register with existing email - they'll be added to this tenant
            // Patient will be linked to existing user if email exists

            // COMPREHENSIVE SERVER-SIDE VALIDATION (ALIGNED WITH FRONTEND)
            $validationErrors = [];

            \Log::info('SERVER VALIDATION: Starting validation for registerAndBook', [
                'fields' => array_keys($validated),
                'tenant_id' => tenant('id'),
            ]);

            // 1. Health card number - format and uniqueness (5-30 chars, alphanumeric + hyphens)
            if (! empty($validated['health_card_number'])) {
                $healthCardNumber = strtoupper(trim($validated['health_card_number']));

                // Length validation (matches frontend: 5-30 chars)
                if (strlen($healthCardNumber) < 5) {
                    $validationErrors['health_card_number'] = 'Health number must be at least 5 characters';
                    \Log::warning('VALIDATION FAILED: health_card_number too short', [
                        'length' => strlen($healthCardNumber),
                        'min_required' => 5,
                    ]);
                } elseif (strlen($healthCardNumber) > 30) {
                    $validationErrors['health_card_number'] = 'Health number must not exceed 30 characters';
                    \Log::warning('VALIDATION FAILED: health_card_number too long', [
                        'length' => strlen($healthCardNumber),
                        'max_allowed' => 30,
                    ]);
                }

                // Format validation (matches frontend: /^[A-Za-z0-9\-]+$/)
                if (empty($validationErrors['health_card_number']) && ! preg_match('/^[A-Za-z0-9\-]+$/', $healthCardNumber)) {
                    $validationErrors['health_card_number'] = 'Health number can only contain letters, numbers, and hyphens';
                    \Log::warning('VALIDATION FAILED: health_card_number invalid characters', [
                        'value' => $healthCardNumber,
                    ]);
                }

                // Uniqueness check (globally unique)
                if (empty($validationErrors['health_card_number'])) {
                    $existingByHealthNumber = null;
                    tenancy()->central(function () use (&$existingByHealthNumber, $healthCardNumber) {
                        $existingByHealthNumber = Patient::where('health_number', $healthCardNumber)->first();
                    });
                    if ($existingByHealthNumber) {
                        $validationErrors['health_card_number'] = 'This health card number is already registered. Please use login if this is your account.';
                        \Log::warning('VALIDATION FAILED: health_card_number duplicate', [
                            'existing_patient_id' => $existingByHealthNumber->id,
                        ]);
                    }
                }
            }

            // 2. First name validation (2-50 chars, letters/spaces/hyphens/apostrophes)
            $firstName = trim($validated['first_name']);
            if (strlen($firstName) < 2) {
                $validationErrors['first_name'] = 'First name must be at least 2 characters';
                \Log::warning('VALIDATION FAILED: first_name too short', ['length' => strlen($firstName)]);
            } elseif (strlen($firstName) > 50) {
                $validationErrors['first_name'] = 'First name must not exceed 50 characters';
                \Log::warning('VALIDATION FAILED: first_name too long', ['length' => strlen($firstName)]);
            } elseif (! preg_match("/^[A-Za-z\s\-']+$/", $firstName)) {
                $validationErrors['first_name'] = 'First name can only contain letters, spaces, hyphens, and apostrophes';
                \Log::warning('VALIDATION FAILED: first_name invalid characters', ['value' => $firstName]);
            }

            // 3. Last name validation (2-50 chars, letters/spaces/hyphens/apostrophes)
            $lastName = trim($validated['last_name']);
            if (strlen($lastName) < 2) {
                $validationErrors['last_name'] = 'Last name must be at least 2 characters';
                \Log::warning('VALIDATION FAILED: last_name too short', ['length' => strlen($lastName)]);
            } elseif (strlen($lastName) > 50) {
                $validationErrors['last_name'] = 'Last name must not exceed 50 characters';
                \Log::warning('VALIDATION FAILED: last_name too long', ['length' => strlen($lastName)]);
            } elseif (! preg_match("/^[A-Za-z\s\-']+$/", $lastName)) {
                $validationErrors['last_name'] = 'Last name can only contain letters, spaces, hyphens, and apostrophes';
                \Log::warning('VALIDATION FAILED: last_name invalid characters', ['value' => $lastName]);
            }

            // 4. Preferred name validation (optional, 0-50 chars)
            if (! empty($validated['preferred_name'])) {
                $preferredName = trim($validated['preferred_name']);
                if (strlen($preferredName) > 50) {
                    $validationErrors['preferred_name'] = 'Preferred name must not exceed 50 characters';
                    \Log::warning('VALIDATION FAILED: preferred_name too long', ['length' => strlen($preferredName)]);
                } elseif (! preg_match("/^[A-Za-z\s\-']*$/", $preferredName)) {
                    $validationErrors['preferred_name'] = 'Preferred name can only contain letters, spaces, hyphens, and apostrophes';
                    \Log::warning('VALIDATION FAILED: preferred_name invalid characters', ['value' => $preferredName]);
                }
            }

            // 5. Phone number validation (must contain 10-20 digits after stripping)
            $phoneNumber = trim($validated['phone_number']);
            // Check initial format (matches frontend: allows digits, spaces, dashes, plus, parentheses)
            if (! preg_match('/^[\d\s\-\+\(\)]+$/', $phoneNumber)) {
                $validationErrors['phone_number'] = 'Phone number can only contain digits, spaces, dashes, plus signs, and parentheses';
                \Log::warning('VALIDATION FAILED: phone_number invalid format', ['value' => $phoneNumber]);
            } else {
                // Strip to digits only (matching frontend transformation)
                $digitsOnly = preg_replace('/[^\d]/', '', $phoneNumber);
                if (strlen($digitsOnly) < 10) {
                    $validationErrors['phone_number'] = 'Phone number must contain at least 10 digits';
                    \Log::warning('VALIDATION FAILED: phone_number too few digits', [
                        'digits_count' => strlen($digitsOnly),
                        'original' => $phoneNumber,
                    ]);
                } elseif (strlen($digitsOnly) > 20) {
                    $validationErrors['phone_number'] = 'Phone number must not exceed 20 digits';
                    \Log::warning('VALIDATION FAILED: phone_number too many digits', [
                        'digits_count' => strlen($digitsOnly),
                        'original' => $phoneNumber,
                    ]);
                }
            }

            // 6. Emergency contact phone validation (same as phone_number)
            $emergencyPhone = trim($validated['emergency_contact_phone']);
            if (! preg_match('/^[\d\s\-\+\(\)]+$/', $emergencyPhone)) {
                $validationErrors['emergency_contact_phone'] = 'Emergency phone can only contain digits, spaces, dashes, plus signs, and parentheses';
                \Log::warning('VALIDATION FAILED: emergency_contact_phone invalid format', ['value' => $emergencyPhone]);
            } else {
                $digitsOnly = preg_replace('/[^\d]/', '', $emergencyPhone);
                if (strlen($digitsOnly) < 10) {
                    $validationErrors['emergency_contact_phone'] = 'Emergency phone must contain at least 10 digits';
                    \Log::warning('VALIDATION FAILED: emergency_contact_phone too few digits', [
                        'digits_count' => strlen($digitsOnly),
                    ]);
                } elseif (strlen($digitsOnly) > 20) {
                    $validationErrors['emergency_contact_phone'] = 'Emergency phone must not exceed 20 digits';
                    \Log::warning('VALIDATION FAILED: emergency_contact_phone too many digits', [
                        'digits_count' => strlen($digitsOnly),
                    ]);
                }
            }

            // 7. Gender pronouns validation (1-50 chars, letters/spaces/slashes/hyphens/apostrophes)
            $genderPronouns = trim($validated['gender_pronouns']);
            if (strlen($genderPronouns) < 1) {
                $validationErrors['gender_pronouns'] = 'Gender/pronouns is required';
                \Log::warning('VALIDATION FAILED: gender_pronouns empty');
            } elseif (strlen($genderPronouns) > 50) {
                $validationErrors['gender_pronouns'] = 'Gender/pronouns must not exceed 50 characters';
                \Log::warning('VALIDATION FAILED: gender_pronouns too long', ['length' => strlen($genderPronouns)]);
            } elseif (! preg_match("/^[A-Za-z\s\/\-']+$/", $genderPronouns)) {
                $validationErrors['gender_pronouns'] = 'Gender/pronouns can only contain letters, spaces, slashes, hyphens, and apostrophes';
                \Log::warning('VALIDATION FAILED: gender_pronouns invalid characters', ['value' => $genderPronouns]);
            }

            // 8. Date of birth validation (YYYY-MM-DD format, not in future)
            try {
                $dob = \Carbon\Carbon::parse($validated['date_of_birth']);
                if ($dob->isFuture()) {
                    $validationErrors['date_of_birth'] = 'Date of birth cannot be in the future';
                    \Log::warning('VALIDATION FAILED: date_of_birth in future', [
                        'provided' => $validated['date_of_birth'],
                        'parsed' => $dob->toDateString(),
                    ]);
                }
                if ($dob->diffInYears(now()) > 120) {
                    $validationErrors['date_of_birth'] = 'Please enter a valid date of birth';
                    \Log::warning('VALIDATION FAILED: date_of_birth age > 120', [
                        'age_years' => $dob->diffInYears(now()),
                    ]);
                }
            } catch (\Exception $e) {
                $validationErrors['date_of_birth'] = 'Invalid date format. Use YYYY-MM-DD';
                \Log::warning('VALIDATION FAILED: date_of_birth parse error', [
                    'value' => $validated['date_of_birth'],
                    'error' => $e->getMessage(),
                ]);
            }

            // Return validation errors if any found
            if (! empty($validationErrors)) {
                DB::rollBack();
                \Log::error('SERVER VALIDATION: Multiple validation failures', [
                    'error_count' => count($validationErrors),
                    'failed_fields' => array_keys($validationErrors),
                    'errors' => $validationErrors,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed. Please check your inputs.',
                    'errors' => $validationErrors,
                ], 422);
            }

            \Log::info('SERVER VALIDATION: All validations passed', [
                'patient_email' => $validated['email_address'],
            ]);

            // Store registration data in session for consent page
            $registrationData = [
                'validated' => $validated,
                'tenant_id' => tenant('id'),
                'flow_type' => 'registerAndBook',
                'trigger_points' => ['creation', 'appointment_creation'],
            ];

            session()->put('public_portal_registration', $registrationData);

            \Log::info('Registration data stored in session for consent acceptance', [
                'email' => $validated['email_address'],
                'flow_type' => 'registerAndBook',
                'trigger_points' => $registrationData['trigger_points'],
                'session_id' => session()->getId(),
            ]);

            DB::commit();

            // Return success and redirect to consent page
            return response()->json([
                'success' => true,
                'message' => 'Please review and accept the required consents to complete your registration.',
                'redirect_to_consents' => true,
            ]);

        } catch (\Exception $e) {
            DB::rollback();

            \Log::error('Public portal registration failed', [
                'error' => $e->getMessage(),
                'request_data' => $request->except(['password', 'password_confirmation']),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Registration failed. Please try again.',
            ], 500);
        }
    }

    /**
     * Show the assess yourself page
     */
    public function assessYourself()
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
        $appearanceSettings = $this->processS3Logo($appearanceSettings);
        $websiteSettings = $this->getWebsiteSettings();

        return Inertia::render('PublicPortal/AssessYourself', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    /**
     * Show the book appointment page for a specific practitioner
     */
    public function bookPractitionerAppointment(Request $request, $practitionerId): \Inertia\Response
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        // Get practitioner from central database
        $practitioner = null;
        $currentTenantId = $tenant->id;

        // Get practitioner from tenant database by slug
        $practitioner = Practitioner::where('slug', $practitionerId)
            ->where('is_active', true)
            ->first();

        if (! $practitioner) {
            abort(404, 'Practitioner not found');
        }

        // Get services from practitioner_services where is_offered = true
        $services = DB::table('practitioner_services')
            ->join('services', 'practitioner_services.service_id', '=', 'services.id')
            ->where('practitioner_services.practitioner_id', $practitioner->id)
            ->where('practitioner_services.is_offered', true)
            ->where('services.is_active', true)
            ->select(
                'services.id',
                'services.name',
                'services.category',
                'services.description',
                'services.delivery_modes',
                'services.default_price',
                'services.currency',
                'practitioner_services.custom_price',
                'practitioner_services.custom_duration_minutes'
            )
            ->get()
            ->map(function ($service) {
                return [
                    'id' => $service->id,
                    'name' => $service->name,
                    'category' => $service->category,
                    'description' => $service->description,
                    'delivery_modes' => json_decode($service->delivery_modes, true) ?? [],
                    'price' => $service->custom_price ?? $service->default_price,
                    'currency' => $service->currency,
                    'duration_minutes' => $service->custom_duration_minutes,
                ];
            })
            ->toArray();

        // Calculate min and max hourly rates from services
        $prices = array_filter(array_column($services, 'price'));
        $hourly_rate_min = ! empty($prices) ? min($prices) : null;
        $hourly_rate_max = ! empty($prices) ? max($prices) : null;

        // Determine session types from services delivery modes
        $sessionTypes = [];
        foreach ($services as $service) {
            foreach ($service['delivery_modes'] as $mode) {
                if ($mode === 'in-person' && ! in_array('In-Person', $sessionTypes)) {
                    $sessionTypes[] = 'In-Person';
                }
                if ($mode === 'virtual' && ! in_array('Virtual', $sessionTypes)) {
                    $sessionTypes[] = 'Virtual';
                }
            }
        }

        // Build additional data that's not in the resource
        $additionalData = [
            'services' => $services,
            'session_types' => $sessionTypes,
            'hourly_rate_min' => $hourly_rate_min,
            'hourly_rate_max' => $hourly_rate_max,
        ];

        // Get locations
        $locations = Location::where('is_active', true)
            ->select(['id', 'name', 'street_address', 'city', 'phone_number'])
            ->get()
            ->map(function ($location) {
                return [
                    'id' => $location->id,
                    'value' => $location->id,
                    'label' => $location->name,
                    'address' => $location->street_address.', '.$location->city,
                    'name' => $location->name,
                ];
            });

        // Get appointment settings
        $appointmentSettings = [
            'advanceBookingHours' => OrganizationSetting::getValue('appointment_advance_booking_hours', '2'),
            'maxAdvanceBookingDays' => OrganizationSetting::getValue('appointment_max_advance_booking_days', '90'),
            'allowSameDayBooking' => OrganizationSetting::getValue('appointment_allow_same_day_booking', '0') === '1',
        ];

        $appointmentSessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);
        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
        $appearanceSettings = $this->processS3Logo($appearanceSettings);
        $websiteSettings = $this->getWebsiteSettings();

        return Inertia::render('PublicPortal/BookPractitionerAppointment', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'practitioner' => array_merge(
                (new \App\Http\Resources\PractitionerPublicResource($practitioner))->resolve(),
                $additionalData
            ),
            'locations' => $locations,
            'appointmentSessionDuration' => $appointmentSessionDuration,
            'appointmentSettings' => $appointmentSettings,
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    /**
     * Show the book appointment page
     */
    public function bookAppointment()
    {
        $tenant = tenant();

        if (! $tenant) {
            abort(404, 'Tenant not found');
        }

        // Start with minimal data to avoid database connection issues
        $services = [];
        $allServices = [];
        $serviceTypes = [];
        $locations = [];
        $allPractitioners = [];
        $practitionerServiceRelations = [];
        $appointmentSettings = [
            'advanceBookingHours' => '24',
            'maxAdvanceBookingDays' => '90',
            'allowSameDayBooking' => true,
        ];
        $appointmentSessionDuration = 30;
        $appearanceSettings = [];
        $websiteSettings = [];

        try {
            // Get services and locations for appointment booking
            $servicesQuery = Service::where('is_active', true)
                ->select(['id', 'name', 'category', 'default_price', 'currency', 'delivery_modes'])
                ->orderBy('category')
                ->orderBy('name')
                ->get();

            $services = $servicesQuery->groupBy('category');

            $allServices = Service::where('is_active', true)
                ->select(['id', 'name', 'category', 'delivery_modes'])
                ->orderBy('category')
                ->orderBy('name')
                ->get();

            $serviceTypes = $allServices->pluck('category')->unique()->values()->toArray();

            $locations = Location::where('is_active', true)
                ->select(['id', 'name', 'street_address', 'city', 'phone_number'])
                ->get()
                ->map(function ($location) {
                    return [
                        'id' => $location->id,
                        'value' => $location->id,
                        'label' => $location->name,
                        'address' => $location->street_address.', '.$location->city,
                        'name' => $location->name,
                        'street_address' => $location->street_address,
                        'city' => $location->city,
                        'phone_number' => $location->phone_number,
                    ];
                });

        } catch (\Exception $e) {
            \Log::error('Failed to fetch basic data in BookAppointment', [
                'tenant_id' => $tenant->id ?? 'unknown',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // Return with empty data but still show the form
        }

        // Get practitioners from central database (following AppointmentController pattern)
        $currentTenantId = $tenant->id;
        try {
            // Get practitioners from tenant database
            $practitioners = Practitioner::where('is_active', true)
                ->get()
                ->map(function ($practitioner) {
                    return [
                        'id' => $practitioner->id, // Use tenant practitioner ID (after migration)
                        'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                        'value' => $practitioner->id, // Use tenant practitioner ID as the value
                        'label' => trim($practitioner->first_name.' '.$practitioner->last_name),
                    ];
                });

            $allPractitioners = $practitioners->toArray();

            // Get practitioner-service relationships for client-side filtering (from tenant database)
            // Note: practitioner_id in practitioner_services now refers to tenant practitioner ID (after migration)
            $practitionerServiceRelations = \DB::table('practitioner_services')
                ->where('is_offered', true)
                ->select('practitioner_id', 'service_id')
                ->get()
                ->groupBy('practitioner_id')
                ->map(function ($relations) {
                    return $relations->pluck('service_id')->toArray();
                })
                ->toArray();
        } catch (\Exception $e) {
            \Log::info('Practitioners not available for BookAppointment (this is optional)', [
                'tenant_id' => $currentTenantId ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
            // Continue without practitioners - they're optional
        }

        // Try to get settings (optional) - following AppointmentController pattern
        try {
            $appointmentSettings = [
                'advanceBookingHours' => OrganizationSetting::getValue('appointment_advance_booking_hours', '2'),
                'maxAdvanceBookingDays' => OrganizationSetting::getValue('appointment_max_advance_booking_days', '90'),
                'allowSameDayBooking' => OrganizationSetting::getValue('appointment_allow_same_day_booking', '0') === '1',
            ];

            $appointmentSessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);
            $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');
            $appearanceSettings = $this->processS3Logo($appearanceSettings);
            $websiteSettings = $this->getWebsiteSettings();
        } catch (\Exception $e) {
            \Log::info('Settings not available for BookAppointment (using defaults)', [
                'tenant_id' => $tenant->id ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
            // Use default values from AppointmentController
            $appointmentSettings = [
                'advanceBookingHours' => '2',
                'maxAdvanceBookingDays' => '90',
                'allowSameDayBooking' => true,
            ];
            $appointmentSessionDuration = 30;
            $appearanceSettings = [];
            $websiteSettings = [];
        }

        return Inertia::render('PublicPortal/BookAppointment', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name ?? 'Healthcare Practice',
            ],
            'services' => $services,
            'serviceTypes' => $serviceTypes,
            'allServices' => $allServices,
            'allPractitioners' => $allPractitioners,
            'practitionerServiceRelations' => $practitionerServiceRelations,
            'locations' => $locations,
            'appointmentSessionDuration' => $appointmentSessionDuration,
            'appointmentSettings' => $appointmentSettings,
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    private function checkPatientSession(Request $request): array
    {
        // First check if user is already authenticated as Patient
        if (auth()->check() && auth()->user()->hasRole('Patient')) {
            // Find the patient record linked to this user
            $patient = null;
            tenancy()->central(function () use (&$patient) {
                $patient = Patient::where('user_id', auth()->id())->first();
            });

            if ($patient) {
                return [
                    'exists' => true,
                    'patient_id' => $patient->id,
                ];
            }
        }

        // Check for cookies from public portal registration
        $fromPublicPortal = $request->cookie('from_public_portal') === 'true';
        $patientId = $request->cookie('patient_id');

        if ($fromPublicPortal && $patientId) {
            // Verify the patient exists in central database
            $patient = null;
            tenancy()->central(function () use (&$patient, $patientId) {
                $patient = Patient::find($patientId);
            });

            if ($patient) {
                return [
                    'exists' => true,
                    'patient_id' => $patient->id,
                ];
            }
        }

        return [
            'exists' => false,
        ];
    }

    /**
     * Check if patient exists in current tenant
     * Fixed to avoid tenant database dependency
     */
    /**
     * Check if patient exists in current tenant
     * Fixed to avoid tenant database dependency
     */
    public function checkPatientExists(Request $request)
    {
        try {
            \Log::info('CHECKPATIENTEXISTS: Function started', [
                'request_data' => $request->only('email', 'tenant_id'),
            ]);

            $request->validate([
                'email' => 'required|email',
                'tenant_id' => 'required|string',
            ]);

            $email = $request->input('email');
            $currentTenantId = $request->input('tenant_id');

            // Check if patient exists in central database and is linked to current tenant
            $patientExists = false;
            $patient = null;

            \Log::info('CHECKPATIENTEXISTS: Switching to central context to check patient existence');
            tenancy()->central(function () use (&$patientExists, &$patient, $email, $currentTenantId) {
                // Find patient by email in central database
                \Log::debug('CHECKPATIENTEXISTS: Searching for patient by email', ['email' => $email]);
                $patient = Patient::whereBlind('email', 'email_index', $email)->first();

                if ($patient) {
                    \Log::debug('CHECKPATIENTEXISTS: Patient found in central DB, checking tenant linkage', [
                        'patient_id' => $patient->id,
                        'tenant_id' => $currentTenantId,
                    ]);
                    // Correcting the table name to 'tenant_patients'
                    $patientExists = \DB::table('tenant_patients')
                        ->where('patient_id', $patient->id)
                        ->where('tenant_id', $currentTenantId)
                        ->exists();

                    \Log::info('CHECKPATIENTEXISTS: Patient tenant linkage check completed', [
                        'patient_id' => $patient->id,
                        'tenant_id' => $currentTenantId,
                        'is_linked' => $patientExists,
                    ]);
                } else {
                    \Log::info('CHECKPATIENTEXISTS: No patient found with email', [
                        'email' => $email,
                        'tenant_id' => $currentTenantId,
                    ]);
                }
            });

            \Log::info('CHECKPATIENTEXISTS: Returning response', [
                'exists' => $patientExists,
                'patient_id' => $patient ? $patient->id : null,
            ]);

            // Handle cross-tenant patient scenario
            if ($patient && ! $patientExists) {
                return response()->json([
                    'exists' => false,
                    'exists_in_other_tenant' => true,
                    'message' => 'Your account exists at a different clinic. Please register as a new patient here, or contact support to link your account.',
                ], 200);
            }

            return response()->json([
                'exists' => $patientExists,
                'patient_id' => $patient ? $patient->id : null,
            ]);

        } catch (\Exception $e) {
            \Log::error('CHECKPATIENTEXISTS: Patient check failed', [
                'error' => $e->getMessage(),
                'email' => $request->input('email', 'not provided'),
                'tenant_id' => $request->input('tenant_id', 'not provided'),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'exists' => false,
                'error' => 'Failed to check patient existence',
            ], 500);
        }
    }

    // -----------------------------------------------------------------------------------------------------------------------------------

    /**
     * Login existing patient and create appointment
     */
    public function loginAndBook(Request $request)
    {
        try {
            \Log::info('LOGINANDBOOK: Function started', [
                'request_data' => $request->except(['password']),
            ]);

            $validated = $request->validate([
                'email' => 'required|email',
                'password' => 'required|string',
                'tenant_id' => 'required|string',
                'service_type' => 'required|string',
                'service_name' => 'required|string',
                'service_id' => 'required|integer',
                'practitioner_id' => 'nullable|integer',
                'practitioner_ids' => 'nullable|array',
                'practitioner_ids.*' => 'integer',
                'location_id' => 'nullable|integer',
                'mode' => 'required|string|in:in-person,virtual,hybrid',
                'date_time_preference' => 'nullable|string',
                // Waiting list parameters
                'is_waiting_list' => 'nullable|boolean',
                'waiting_list_day' => 'nullable|string|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday,any',
                'waiting_list_time' => 'nullable|string|in:morning,afternoon,evening,any',
            ]);

            // Make date_time_preference required only if not a waiting list
            if (! $request->boolean('is_waiting_list') && empty($validated['date_time_preference'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Date and time preference is required for regular appointments.',
                ], 422);
            }

            $currentTenantId = $validated['tenant_id'];
            $email = $validated['email'];

            // Perform all authentication checks in the central context first.
            $authUser = null;
            $patient = null;
            $isLinkedToTenant = false;
            $isRoleConflict = false;
            $roleConflictMessage = '';

            tenancy()->central(function () use (
                $email,
                $currentTenantId,
                $validated,
                &$authUser,
                &$patient,
                &$isLinkedToTenant,
                &$isRoleConflict,
                &$roleConflictMessage
            ) {
                $authUser = User::where('email', $email)->first();

                if (! $authUser) {
                    throw new \Exception('Invalid credentials.');
                }

                // Check for role conflicts (Admin/Practitioner)
                if ($authUser->is_admin) {
                    $isRoleConflict = true;
                    $roleConflictMessage = 'Cannot login as patient. User is an admin. Please use Admin Panel login.';

                    return;
                }

                $isPractitioner = \App\Models\Practitioner::where('user_id', $authUser->id)->exists();
                if ($isPractitioner) {
                    $isRoleConflict = true;
                    $roleConflictMessage = 'Cannot login as patient. User is a practitioner. Please use Admin Panel login.';

                    return;
                }

                // Check password
                if (! Hash::check($validated['password'], $authUser->password)) {
                    throw new \Exception('Invalid credentials.');
                }

                // Find the patient record associated with this user
                $patient = Patient::where('user_id', $authUser->id)->first();
                if (! $patient) {
                    throw new \Exception('User account is not a patient.');
                }

                // Check if the patient is linked to the current tenant
                $isLinkedToTenant = \DB::table('tenant_patients')
                    ->where('patient_id', $patient->id)
                    ->where('tenant_id', $currentTenantId)
                    ->exists();

                \Log::info('LOGINANDBOOK: Authentication checks complete', [
                    'email' => $email,
                    'is_linked_to_tenant' => $isLinkedToTenant,
                ]);
            });

            if ($isRoleConflict) {
                return response()->json([
                    'success' => false,
                    'action' => 'role_conflict',
                    'message' => $roleConflictMessage,
                ], 422);
            }

            // If patient is not linked, return a specific response to trigger the "Request to Join" modal
            if (! $isLinkedToTenant) {
                return response()->json([
                    'success' => false,
                    'action' => 'patient_not_linked',
                    'message' => 'You are not registered at this clinic. Please use the registration form to create an account here.',
                ], 403);
            }

            // Now, and only now, after successful central authentication and linkage check, proceed with tenant-specific operations.
            try {
                tenancy()->initialize($currentTenantId);
            } catch (\Exception $e) {
                \Log::error('Tenant initialization failed in loginAndBook', [
                    'patient_id' => $patient->id ?? null,
                    'tenant_id' => $currentTenantId,
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Unable to access this clinic. Please contact support.',
                    'debug' => config('app.debug') ? $e->getMessage() : null,
                ], 500);
            }

            // Get tenant patient record (different ID from central patient)
            $tenantPatient = \App\Models\Tenant\Patient::where('external_patient_id', $patient->id)->first();

            if (! $tenantPatient) {
                \Log::error('Tenant patient record not found in loginAndBook', [
                    'central_patient_id' => $patient->id,
                    'tenant_id' => $currentTenantId,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Patient record not found in this clinic. Please contact support.',
                ], 404);
            }

            DB::beginTransaction();

            $service = Service::find($validated['service_id']);
            $appointmentId = null;

            // Check if this is a waiting list request or regular appointment
            \Log::info('LOGINANDBOOK: Checking appointment type', [
                'is_waiting_list' => $request->boolean('is_waiting_list'),
                'date_time_preference' => $validated['date_time_preference'] ?? null,
            ]);

            if ($request->boolean('is_waiting_list')) {
                // Create waiting list entry
                $practitionerIds = [];
                if (! empty($validated['practitioner_ids']) && is_array($validated['practitioner_ids'])) {
                    $practitionerIds = $validated['practitioner_ids'];
                } elseif (! empty($validated['practitioner_id'])) {
                    $practitionerIds = [(int) $validated['practitioner_id']];
                }

                AppointmentWaitlist::create([
                    'patient_id' => $tenantPatient->id,
                    'service_type' => $validated['service_type'],
                    'service_name' => $validated['service_name'],
                    'service_id' => $validated['service_id'],
                    'location_id' => $validated['location_id'],
                    'mode' => $validated['mode'],
                    'practitioner_ids' => $practitionerIds,
                    'preferred_day' => $validated['waiting_list_day'],
                    'preferred_time' => $validated['waiting_list_time'],
                    'original_requested_date' => $validated['date_time_preference'] ?? null,
                    'status' => 'waiting',
                ]);

                // Set waiting list cookie for dashboard success message with proper domain
                $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
                cookie()->queue('is_waiting_list', 'true', 60, '/', $centralDomain);
                cookie()->queue('from_public_portal', 'true', 60, '/', $centralDomain);

                $successMessage = 'Login successful! You have been added to the waiting list. We will contact you when a slot becomes available.';
            } else {
                \Log::info('LOGINANDBOOK: Creating regular appointment', [
                    'patient_id' => $patient->id,
                    'service_id' => $validated['service_id'],
                    'date_time_preference' => $validated['date_time_preference'],
                ]);
                // Create regular appointment with timezone conversion
                try {
                    $dateTimeString = trim($validated['date_time_preference']);
                    $locationId = $validated['location_id'];

                    // Get tenant timezone for conversion (consistent with admin controller)
                    $tenantTimezone = \App\Services\TenantTimezoneService::getTenantTimezone();

                    // Convert from tenant timezone to UTC for storage (same as admin controller)
                    $utcDateTime = \App\Services\TenantTimezoneService::convertToUTC($dateTimeString);

                    // Get the current session duration to store with this appointment
                    $sessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);

                    // Calculate end time in UTC
                    $utcEndTime = $utcDateTime->copy()->addMinutes($sessionDuration);

                    Log::info('Public Portal LoginAndBook: Appointment datetime processed with tenant timezone:', [
                        'input' => $dateTimeString,
                        'location_id' => $locationId,
                        'tenant_timezone' => $tenantTimezone,
                        'utc_datetime' => $utcDateTime->toISOString(),
                        'utc_end_time' => $utcEndTime->toISOString(),
                        'session_duration' => $sessionDuration,
                    ]);

                } catch (\Exception $e) {
                    Log::error('Public Portal LoginAndBook: Date parsing failed:', [
                        'date_time_preference' => $validated['date_time_preference'],
                        'location_id' => $validated['location_id'] ?? 'not provided',
                        'error' => $e->getMessage(),
                    ]);
                    throw new \Exception('Invalid date format or location: '.$e->getMessage());
                }

                // Get practitioner IDs before creating appointment
                $practitionerIds = [];
                if (! empty($validated['practitioner_ids']) && is_array($validated['practitioner_ids'])) {
                    $practitionerIds = $validated['practitioner_ids'];
                } elseif (! empty($validated['practitioner_id'])) {
                    $practitionerIds = [(int) $validated['practitioner_id']];
                }

                // Check for appointment conflicts before creating
                if (! empty($practitionerIds)) {
                    foreach ($practitionerIds as $practitionerId) {
                        $this->checkPractitionerConflict($practitionerId, $utcDateTime, $utcEndTime);
                    }
                }

                $appointment = Appointment::create([
                    'patient_id' => $tenantPatient->id,
                    'contact_person' => $patient->first_name.' '.$patient->last_name,
                    'service_name' => $service ? $service->name : 'Unknown Service',
                    'service_type' => $validated['service_type'],
                    'service_id' => $validated['service_id'],
                    'location_id' => ! empty($validated['location_id']) ? $validated['location_id'] : null,
                    'mode' => $validated['mode'],
                    'appointment_datetime' => $utcDateTime,
                    'start_time' => $utcDateTime, // Store the UTC start time
                    'end_time' => $utcEndTime, // Store the UTC end time
                    'stored_timezone' => $tenantTimezone, // Track the tenant timezone this appointment was created in
                    'needs_timezone_migration' => false, // New appointment, no migration needed
                    'date_time_preference' => $validated['date_time_preference'],
                    'booking_source' => 'Public Portal',
                    'admin_override' => 'no-override',
                    'status' => OrganizationSetting::getValue('appointment_default_appointment_status', 'pending'),
                    'notes' => '',
                ]);

                $appointmentId = $appointment->id;

                if (! empty($practitionerIds)) {
                    foreach ($practitionerIds as $index => $practitionerId) {
                        // First practitioner (only one from public portal) becomes primary
                        $isPrimary = ($index === 0);

                        \DB::table('appointment_practitioner')->insert([
                            'appointment_id' => $appointment->id,
                            'practitioner_id' => (int) $practitionerId,
                            'start_time' => $utcDateTime->format('Y-m-d H:i:s'),
                            'end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                            'is_primary' => $isPrimary,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }

                // Set appointment success cookie for dashboard success message with proper domain
                $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
                cookie()->queue('appointment_booked', 'true', 60, '/', $centralDomain);
                cookie()->queue('from_public_portal', 'true', 60, '/', $centralDomain);
                \Log::info('LOGINANDBOOK: Set appointment success cookies', [
                    'appointment_booked' => 'true',
                    'from_public_portal' => 'true',
                    'patient_id' => $patient->id,
                    'appointment_id' => $appointmentId,
                    'cookie_domain' => $centralDomain,
                ]);
                $successMessage = 'Login successful! Appointment booked. Redirecting to your dashboard...';
            }

            \Log::info('LOGINANDBOOK: About to commit transaction', [
                'appointment_id' => $appointmentId,
                'patient_id' => $patient->id,
            ]);

            $authUrl = centralUrl('/central/patient-dashboard');
            if ($authUser) {
                try {
                    $expires = now()->addMinutes(5)->timestamp;
                    $hash = hash('sha256', $authUser->email.$authUser->id.$expires.config('app.key'));
                    $authUrl = centralUrl('/auth/public-portal?'.http_build_query([
                        'user_id' => $authUser->id,
                        'hash' => $hash,
                        'expires' => $expires,
                    ]));

                    \Log::info('Generated auth URL for loginAndBook', [
                        'user_id' => $authUser->id,
                        'email' => $authUser->email,
                        'expires' => $expires,
                    ]);
                } catch (\Exception $e) {
                    \Log::warning('LOGINANDBOOK: Failed to create auth URL, using fallback', [
                        'error' => $e->getMessage(),
                        'user_id' => $authUser->id ?? 'null',
                    ]);
                }
            }

            DB::commit();

            \Log::info('LOGINANDBOOK: Transaction committed successfully');

            return response()->json([
                'success' => true,
                'message' => $successMessage,
                'patient_id' => $patient->id,
                'appointment_id' => $appointmentId,
                'is_waiting_list' => $request->boolean('is_waiting_list'),
                'redirect_url' => $authUrl,
                'fallback_login_url' => centralUrl('/login?patient_login=1'),
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed: '.collect($e->errors())->flatten()->first(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            DB::rollback();

            \Log::error('LOGINANDBOOK: Patient login and book failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->except(['password']),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Login failed. Please try again.',
            ], 500);
        }
    }

    /**
     * Validate email and determine the appropriate action
     */
    /**
     * Debug session state (includes cross-tenant session detection)
     */
    public function debugSession(Request $request)
    {
        try {
            $sessionData = session()->all();
            $authCheck = auth()->check();
            $authUser = auth()->user();
            $currentTenantId = tenant('id') ?: 'unknown';

            // Determine user type if authenticated
            $userType = null;
            $userTypeMessage = null;
            if ($authCheck && $authUser) {
                $userType = $this->determineUserType($authUser);
                $userTypeMessage = $this->getUserTypeMessage($userType);
            }

            // Check for cross-tenant sessions by examining the central database
            $crossTenantSession = ['exists' => false, 'type' => null];
            try {
                $crossTenantSession = $this->checkCrossTenantSessions($request, $currentTenantId);
            } catch (\Exception $e) {
                \Log::error('Cross-tenant session check failed in debugSession', [
                    'error' => $e->getMessage(),
                    'tenant' => $currentTenantId,
                ]);
            }

            // Also check for active browser-based sessions using a different approach
            $browserSessionCheck = ['has_active_session' => false, 'indicators' => []];
            try {
                $browserSessionCheck = $this->checkBrowserCrossTenantSessions($request);
            } catch (\Exception $e) {
                \Log::error('Browser session check failed in debugSession', [
                    'error' => $e->getMessage(),
                    'tenant' => $currentTenantId,
                ]);
            }

            // Safely check for active sessions
            $crossTenantExists = isset($crossTenantSession['exists']) && $crossTenantSession['exists'];
            $browserSessionActive = isset($browserSessionCheck['has_active_session']) && $browserSessionCheck['has_active_session'];
            $hasAnyActiveSession = $authCheck || $crossTenantExists || $browserSessionActive;

            return response()->json([
                'auth_check' => $authCheck,
                'auth_user' => $authUser ? $authUser->email : null,
                'user_type' => $userType,
                'user_type_message' => $userTypeMessage,
                'current_tenant_id' => $currentTenantId,
                'session_keys' => array_keys($sessionData),
                'login_keys' => array_filter(array_keys($sessionData), function ($key) {
                    return str_starts_with($key, 'login_web_');
                }),
                'session_count' => count($sessionData),
                'cross_tenant_session' => $crossTenantSession,
                'browser_session_check' => $browserSessionCheck,
                'has_any_active_session' => $hasAnyActiveSession,
            ]);
        } catch (\Exception $e) {
            \Log::error('debugSession method failed completely', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Return a safe fallback response
            return response()->json([
                'auth_check' => false,
                'auth_user' => null,
                'user_type' => null,
                'user_type_message' => null,
                'current_tenant_id' => 'error',
                'session_keys' => [],
                'login_keys' => [],
                'session_count' => 0,
                'cross_tenant_session' => ['exists' => false],
                'browser_session_check' => ['has_active_session' => false],
                'has_any_active_session' => false,
                'error' => 'Session check failed: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Determine user type based on their roles and relationships
     */
    private function determineUserType(User $user): string
    {
        // Check if user is admin (has admin role or is_admin flag)
        if ($user->is_admin || $user->hasRole('admin') || $user->hasRole('super-admin')) {
            return 'admin';
        }

        // Check if user is a practitioner in tenant database
        $isPractitioner = Practitioner::where('user_id', $user->id)->exists();

        if ($isPractitioner) {
            return 'practitioner';
        }

        // Check if user is a patient in central database
        $isPatient = false;
        tenancy()->central(function () use (&$isPatient, $user) {
            $isPatient = \App\Models\Patient::where('user_id', $user->id)->exists();
        });

        if ($isPatient) {
            return 'patient';
        }

        // Default to admin if none of the above
        return 'admin';
    }

    /**
     * Get appropriate message for user type
     */
    private function getUserTypeMessage(string $userType): string
    {
        switch ($userType) {
            case 'admin':
                return 'Already logged in as admin.';
            case 'practitioner':
                return 'Already logged in as practitioner. Please logout first to login as patient.';
            case 'patient':
                return 'Already logged in as patient.';
            default:
                return 'Already logged in. Please logout first to login as patient.';
        }
    }

    /**
     * Check for browser-based cross-tenant sessions using referrer and other indicators
     */
    private function checkBrowserCrossTenantSessions(Request $request): array
    {
        $result = [
            'has_active_session' => false,
            'indicators' => [],
            'referrer_check' => false,
            'cookie_check' => false,
        ];

        try {
            // Check referrer for signs of other tenant activity
            $referrer = $request->header('referer');
            if ($referrer) {
                $currentDomain = $request->getHost();
                $referrerHost = parse_url($referrer, PHP_URL_HOST);

                if ($referrerHost && $referrerHost !== $currentDomain) {
                    // Check if the referrer looks like another Wellovis tenant
                    if (str_contains($referrerHost, 'wellovis') || str_contains($referrerHost, 'localhost')) {
                        $result['has_active_session'] = true;
                        $result['referrer_check'] = true;
                        $result['indicators'][] = "Referred from possible tenant: {$referrerHost}";
                    }
                }
            }

            // Check for any Wellovis-related cookies that might indicate other sessions
            $cookies = $request->cookies->all();
            $suspiciousCookies = [];

            foreach ($cookies as $name => $value) {
                if (str_contains($name, 'laravel_session') ||
                    str_contains($name, 'remember_web_') ||
                    str_contains($name, 'practitioner') ||
                    str_contains($name, 'tenant')) {
                    $suspiciousCookies[] = $name;
                }
            }

            if (count($suspiciousCookies) > 2) { // More than basic session cookies
                $result['has_active_session'] = true;
                $result['cookie_check'] = true;
                $result['indicators'][] = 'Multiple session cookies found: '.implode(', ', $suspiciousCookies);
            }

            // For testing purposes, force detection if we're on localhost and there are other tenants
            if (str_contains($request->getHost(), 'localhost')) {
                // Check if user has been active in any tenant recently (last 2 hours for testing)
                tenancy()->central(function () use (&$result) {
                    $recentActivity = \DB::table('tenant_user')
                        ->join('users', 'tenant_user.user_id', '=', 'users.id')
                        ->where('users.updated_at', '>=', now()->subHours(2))
                        ->count();

                    if ($recentActivity > 0) {
                        $result['has_active_session'] = true;
                        $result['indicators'][] = 'Recent tenant activity detected (testing mode)';
                    }
                });
            }

            return $result;
        } catch (\Exception $e) {
            \Log::error('Browser cross-tenant session check failed', [
                'error' => $e->getMessage(),
            ]);

            return $result;
        }
    }

    /**
     * Check for active sessions in other tenants or central app
     */
    private function checkCrossTenantSessions(Request $request, string $currentTenantId): array
    {
        $result = [
            'exists' => false,
            'type' => null,
            'email' => null,
            'tenant' => null,
        ];

        try {
            // Method 1: Check browser localStorage/sessionStorage for signs of other sessions
            // This would be done client-side, but we can check server-side indicators

            // Method 2: Check for recent login activities in the central database
            tenancy()->central(function () use (&$result, $request, $currentTenantId) {
                // Get client IP and user agent for session matching
                $clientIp = $request->ip();
                $userAgent = $request->userAgent();

                // Look for recent user activities that might indicate active sessions
                // Check for users who have accessed other tenants recently
                $recentActivities = \DB::table('tenant_user')
                    ->join('users', 'tenant_user.user_id', '=', 'users.id')
                    ->where('tenant_user.tenant_id', '!=', $currentTenantId)
                    ->where('tenant_user.updated_at', '>=', now()->subMinutes(30)) // Active in last 30 minutes
                    ->select('users.email', 'tenant_user.tenant_id', 'users.updated_at')
                    ->orderBy('users.updated_at', 'desc')
                    ->limit(5)
                    ->get();

                if ($recentActivities->isNotEmpty()) {
                    $mostRecent = $recentActivities->first();
                    $result = [
                        'exists' => true,
                        'type' => 'cross_tenant',
                        'email' => $mostRecent->email,
                        'tenant' => $mostRecent->tenant_id,
                        'last_activity' => $mostRecent->updated_at,
                    ];
                }

                // Also check for practitioners who might be active
                $recentPractitioners = \DB::table('tenant_practitioners')
                    ->join('practitioners', 'tenant_practitioners.practitioner_id', '=', 'practitioners.id')
                    ->join('users', 'practitioners.user_id', '=', 'users.id')
                    ->where('tenant_practitioners.tenant_id', '!=', $currentTenantId)
                    ->where('users.updated_at', '>=', now()->subMinutes(30))
                    ->select('users.email', 'tenant_practitioners.tenant_id', 'users.updated_at')
                    ->orderBy('users.updated_at', 'desc')
                    ->limit(3)
                    ->get();

                if ($recentPractitioners->isNotEmpty() && ! $result['exists']) {
                    $mostRecent = $recentPractitioners->first();
                    $result = [
                        'exists' => true,
                        'type' => 'practitioner_cross_tenant',
                        'email' => $mostRecent->email,
                        'tenant' => $mostRecent->tenant_id,
                        'last_activity' => $mostRecent->updated_at,
                    ];
                }
            });

            return $result;
        } catch (\Exception $e) {
            \Log::error('Cross-tenant session check failed', [
                'error' => $e->getMessage(),
                'tenant_id' => $currentTenantId,
            ]);

            return $result;
        }
    }

    /**
     * Simplified validateEmail for public portal use
     * This version avoids complex tenant operations
     */
    public function validateEmail(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
            ]);

            $email = $request->input('email');

            // Get current tenant ID safely
            $currentTenantId = tenant('id');
            if (! $currentTenantId) {
                return response()->json([
                    'action' => 'error',
                    'message' => 'Tenant context not available.',
                ], 500);
            }

            // Check user role and patient status in central database only
            $userRole = null;
            $patient = null;
            $patientExists = false;

            tenancy()->central(function () use (&$userRole, &$patient, &$patientExists, $email, $currentTenantId) {
                // Find central user by email
                $centralUser = \App\Models\User::where('email', $email)->first();
                if (! $centralUser) {
                    $userRole = 'not_found';

                    return;
                }

                // Check if user is a practitioner
                $isPractitioner = \App\Models\Practitioner::where('user_id', $centralUser->id)->exists();
                if ($isPractitioner) {
                    $userRole = 'practitioner';

                    return;
                }

                // Check if user is a patient
                $patient = \App\Models\Patient::whereBlind('email', 'email_index', $email)->first();
                if ($patient) {
                    $userRole = 'patient';

                    // Check if patient is linked to current tenant using raw query
                    $patientExists = \DB::table('patient_tenant')
                        ->where('patient_id', $patient->id)
                        ->where('tenant_id', $currentTenantId)
                        ->exists();
                } else {
                    $userRole = 'admin'; // Default to admin if not practitioner or patient
                }
            });

            // Handle different scenarios
            if ($userRole === 'practitioner') {
                return response()->json([
                    'action' => 'role_conflict',
                    'message' => 'Cannot login the user already exists as practitioner on system. Please use Admin Panel login.',
                ]);
            } elseif ($userRole === 'admin') {
                return response()->json([
                    'action' => 'role_conflict',
                    'message' => 'Cannot login the user already exists as admin on system. Please use Admin Panel login.',
                ]);
            } elseif ($userRole === 'not_found') {
                return response()->json([
                    'action' => 'not_found',
                    'message' => 'No account found with this email address for this healthcare provider.',
                ]);
            } elseif ($userRole === 'patient' && ! $patientExists) {
                // Patient exists but not for this tenant - provide clear guidance
                return response()->json([
                    'action' => 'not_found',
                    'message' => 'Your account exists at a different clinic. Please register as a new patient here, or contact support to link your account.',
                    'exists_in_other_tenant' => true,
                ]);
            } elseif ($userRole === 'patient' && $patientExists) {
                // Patient exists for this tenant - generate auth URL
                $authUser = null;
                tenancy()->central(function () use (&$authUser, $email) {
                    $authUser = \App\Models\User::where('email', $email)->first();
                });

                $authUrl = centralUrl('/central/patient-dashboard'); // Fallback
                if ($authUser) {
                    try {
                        $expires = now()->addMinutes(5)->timestamp;
                        $hash = hash('sha256', $authUser->email.$authUser->id.$expires.config('app.key'));

                        $authUrl = centralUrl('/auth/public-portal?'.http_build_query([
                            'user_id' => $authUser->id,
                            'hash' => $hash,
                            'expires' => $expires,
                        ]));
                    } catch (\Exception $e) {
                        \Log::warning('Failed to create auth URL for validateEmail', [
                            'error' => $e->getMessage(),
                            'user_id' => $authUser->id ?? 'null',
                        ]);
                    }
                }

                return response()->json([
                    'action' => 'direct_login',
                    'message' => 'Welcome back! Redirecting to your dashboard...',
                    'patient_id' => $patient->id,
                    'redirect_url' => $authUrl,
                    'fallback_login_url' => centralUrl('/login?public_portal_success=1'),
                ]);
            }

            // Fallback
            return response()->json([
                'action' => 'error',
                'message' => 'Unable to process request.',
            ], 500);

        } catch (\Exception $e) {
            \Log::error('validateEmail failed', [
                'error' => $e->getMessage(),
                'email' => $request->input('email', 'not provided'),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'action' => 'error',
                'message' => 'An error occurred. Please try again.',
            ], 500);
        }
    }

    /**
     * Show patient registration form
     */
    public function showRegister()
    {
        return Inertia::render('PublicPortal/Register', [
            'tenant' => [
                'id' => tenant('id'),
                'company_name' => tenant('company_name'),
            ],
            'appearanceSettings' => $this->getAppearanceSettings(),
            'websiteSettings' => $this->getWebsiteSettings(),
        ]);
    }

    /**
     * Submit patient registration
     */
    public function submitRegister(Request $request)
    {
        try {
            $request->validate([
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'preferred_name' => 'nullable|string|max:255',
                'email_address' => 'required|email|max:255',
                'phone_number' => 'required|string|max:20',
                'date_of_birth' => 'required|date',
                'gender_pronouns' => 'required|string|max:255',
                'emergency_contact_phone' => 'required|string|max:20',
                'client_type' => 'required|string|in:individual,couple,family,group',
                'health_card_number' => 'nullable|string|max:50',
                'notes' => 'nullable|string|max:1000',
                'password' => 'required|string|min:8|confirmed',
            ]);

            $email = $request->input('email_address');
            $currentTenantId = tenant('id');

            // REMOVED: Email validation that prevents registration with existing email
            // Users can now register with existing email - they'll be added to this tenant
            // Tenant-specific name (first_name + last_name) will be used for tenant user
            // Central user name will NOT be updated

            // COMPREHENSIVE SERVER-SIDE VALIDATION (ALIGNED WITH FRONTEND)
            $validationErrors = [];

            \Log::info('SERVER VALIDATION: Starting validation for submitRegister', [
                'email' => $email,
                'tenant_id' => $currentTenantId,
            ]);

            // 1. Health card number - format and uniqueness (5-30 chars, alphanumeric + hyphens)
            if (! empty($request->input('health_card_number'))) {
                $healthCardNumber = strtoupper(trim($request->input('health_card_number')));

                // Length validation (matches frontend: 5-30 chars)
                if (strlen($healthCardNumber) < 5) {
                    $validationErrors['health_card_number'] = 'Health number must be at least 5 characters';
                    \Log::warning('VALIDATION FAILED: health_card_number too short', [
                        'length' => strlen($healthCardNumber),
                        'min_required' => 5,
                    ]);
                } elseif (strlen($healthCardNumber) > 30) {
                    $validationErrors['health_card_number'] = 'Health number must not exceed 30 characters';
                    \Log::warning('VALIDATION FAILED: health_card_number too long', [
                        'length' => strlen($healthCardNumber),
                        'max_allowed' => 30,
                    ]);
                }

                // Format validation (matches frontend: /^[A-Za-z0-9\-]+$/)
                if (empty($validationErrors['health_card_number']) && ! preg_match('/^[A-Za-z0-9\-]+$/', $healthCardNumber)) {
                    $validationErrors['health_card_number'] = 'Health number can only contain letters, numbers, and hyphens';
                    \Log::warning('VALIDATION FAILED: health_card_number invalid characters', [
                        'value' => $healthCardNumber,
                    ]);
                }

                // Uniqueness check (globally unique)
                if (empty($validationErrors['health_card_number'])) {
                    $existingByHealthNumber = null;
                    tenancy()->central(function () use (&$existingByHealthNumber, $healthCardNumber) {
                        $existingByHealthNumber = Patient::where('health_number', $healthCardNumber)->first();
                    });
                    if ($existingByHealthNumber) {
                        $validationErrors['health_card_number'] = 'This health card number is already registered. Please use login if this is your account.';
                        \Log::warning('VALIDATION FAILED: health_card_number duplicate', [
                            'existing_patient_id' => $existingByHealthNumber->id,
                        ]);
                    }
                }
            }

            // 2. First name validation (2-50 chars, letters/spaces/hyphens/apostrophes)
            $firstName = trim($request->input('first_name'));
            if (strlen($firstName) < 2) {
                $validationErrors['first_name'] = 'First name must be at least 2 characters';
                \Log::warning('VALIDATION FAILED: first_name too short', ['length' => strlen($firstName)]);
            } elseif (strlen($firstName) > 50) {
                $validationErrors['first_name'] = 'First name must not exceed 50 characters';
                \Log::warning('VALIDATION FAILED: first_name too long', ['length' => strlen($firstName)]);
            } elseif (! preg_match("/^[A-Za-z\s\-']+$/", $firstName)) {
                $validationErrors['first_name'] = 'First name can only contain letters, spaces, hyphens, and apostrophes';
                \Log::warning('VALIDATION FAILED: first_name invalid characters', ['value' => $firstName]);
            }

            // 3. Last name validation (2-50 chars, letters/spaces/hyphens/apostrophes)
            $lastName = trim($request->input('last_name'));
            if (strlen($lastName) < 2) {
                $validationErrors['last_name'] = 'Last name must be at least 2 characters';
                \Log::warning('VALIDATION FAILED: last_name too short', ['length' => strlen($lastName)]);
            } elseif (strlen($lastName) > 50) {
                $validationErrors['last_name'] = 'Last name must not exceed 50 characters';
                \Log::warning('VALIDATION FAILED: last_name too long', ['length' => strlen($lastName)]);
            } elseif (! preg_match("/^[A-Za-z\s\-']+$/", $lastName)) {
                $validationErrors['last_name'] = 'Last name can only contain letters, spaces, hyphens, and apostrophes';
                \Log::warning('VALIDATION FAILED: last_name invalid characters', ['value' => $lastName]);
            }

            // 4. Preferred name validation (optional, 0-50 chars)
            if (! empty($request->input('preferred_name'))) {
                $preferredName = trim($request->input('preferred_name'));
                if (strlen($preferredName) > 50) {
                    $validationErrors['preferred_name'] = 'Preferred name must not exceed 50 characters';
                    \Log::warning('VALIDATION FAILED: preferred_name too long', ['length' => strlen($preferredName)]);
                } elseif (! preg_match("/^[A-Za-z\s\-']*$/", $preferredName)) {
                    $validationErrors['preferred_name'] = 'Preferred name can only contain letters, spaces, hyphens, and apostrophes';
                    \Log::warning('VALIDATION FAILED: preferred_name invalid characters', ['value' => $preferredName]);
                }
            }

            // 5. Phone number validation (must contain 10-20 digits after stripping)
            $phoneNumber = trim($request->input('phone_number'));
            // Check initial format (matches frontend: allows digits, spaces, dashes, plus, parentheses)
            if (! preg_match('/^[\d\s\-\+\(\)]+$/', $phoneNumber)) {
                $validationErrors['phone_number'] = 'Phone number can only contain digits, spaces, dashes, plus signs, and parentheses';
                \Log::warning('VALIDATION FAILED: phone_number invalid format', ['value' => $phoneNumber]);
            } else {
                // Strip to digits only (matching frontend transformation)
                $digitsOnly = preg_replace('/[^\d]/', '', $phoneNumber);
                if (strlen($digitsOnly) < 10) {
                    $validationErrors['phone_number'] = 'Phone number must contain at least 10 digits';
                    \Log::warning('VALIDATION FAILED: phone_number too few digits', [
                        'digits_count' => strlen($digitsOnly),
                        'original' => $phoneNumber,
                    ]);
                } elseif (strlen($digitsOnly) > 20) {
                    $validationErrors['phone_number'] = 'Phone number must not exceed 20 digits';
                    \Log::warning('VALIDATION FAILED: phone_number too many digits', [
                        'digits_count' => strlen($digitsOnly),
                        'original' => $phoneNumber,
                    ]);
                }
            }

            // 6. Emergency contact phone validation (same as phone_number)
            $emergencyPhone = trim($request->input('emergency_contact_phone'));
            if (! preg_match('/^[\d\s\-\+\(\)]+$/', $emergencyPhone)) {
                $validationErrors['emergency_contact_phone'] = 'Emergency phone can only contain digits, spaces, dashes, plus signs, and parentheses';
                \Log::warning('VALIDATION FAILED: emergency_contact_phone invalid format', ['value' => $emergencyPhone]);
            } else {
                $digitsOnly = preg_replace('/[^\d]/', '', $emergencyPhone);
                if (strlen($digitsOnly) < 10) {
                    $validationErrors['emergency_contact_phone'] = 'Emergency phone must contain at least 10 digits';
                    \Log::warning('VALIDATION FAILED: emergency_contact_phone too few digits', [
                        'digits_count' => strlen($digitsOnly),
                    ]);
                } elseif (strlen($digitsOnly) > 20) {
                    $validationErrors['emergency_contact_phone'] = 'Emergency phone must not exceed 20 digits';
                    \Log::warning('VALIDATION FAILED: emergency_contact_phone too many digits', [
                        'digits_count' => strlen($digitsOnly),
                    ]);
                }
            }

            // 7. Gender pronouns validation (1-50 chars, letters/spaces/slashes/hyphens/apostrophes)
            $genderPronouns = trim($request->input('gender_pronouns'));
            if (strlen($genderPronouns) < 1) {
                $validationErrors['gender_pronouns'] = 'Gender/pronouns is required';
                \Log::warning('VALIDATION FAILED: gender_pronouns empty');
            } elseif (strlen($genderPronouns) > 50) {
                $validationErrors['gender_pronouns'] = 'Gender/pronouns must not exceed 50 characters';
                \Log::warning('VALIDATION FAILED: gender_pronouns too long', ['length' => strlen($genderPronouns)]);
            } elseif (! preg_match("/^[A-Za-z\s\/\-']+$/", $genderPronouns)) {
                $validationErrors['gender_pronouns'] = 'Gender/pronouns can only contain letters, spaces, slashes, hyphens, and apostrophes';
                \Log::warning('VALIDATION FAILED: gender_pronouns invalid characters', ['value' => $genderPronouns]);
            }

            // 8. Date of birth validation (YYYY-MM-DD format, not in future)
            try {
                $dob = \Carbon\Carbon::parse($request->input('date_of_birth'));
                if ($dob->isFuture()) {
                    $validationErrors['date_of_birth'] = 'Date of birth cannot be in the future';
                    \Log::warning('VALIDATION FAILED: date_of_birth in future', [
                        'provided' => $request->input('date_of_birth'),
                        'parsed' => $dob->toDateString(),
                    ]);
                }
                if ($dob->diffInYears(now()) > 120) {
                    $validationErrors['date_of_birth'] = 'Please enter a valid date of birth';
                    \Log::warning('VALIDATION FAILED: date_of_birth age > 120', [
                        'age_years' => $dob->diffInYears(now()),
                    ]);
                }
            } catch (\Exception $e) {
                $validationErrors['date_of_birth'] = 'Invalid date format. Use YYYY-MM-DD';
                \Log::warning('VALIDATION FAILED: date_of_birth parse error', [
                    'value' => $request->input('date_of_birth'),
                    'error' => $e->getMessage(),
                ]);
            }

            // Return validation errors if any found
            if (! empty($validationErrors)) {
                \Log::error('SERVER VALIDATION: Multiple validation failures', [
                    'error_count' => count($validationErrors),
                    'failed_fields' => array_keys($validationErrors),
                    'errors' => $validationErrors,
                ]);

                if ($request->expectsJson() || $request->ajax()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Validation failed. Please check your inputs.',
                        'errors' => $validationErrors,
                    ], 422);
                }

                return back()->withErrors($validationErrors)->withInput();
            }

            \Log::info('SERVER VALIDATION: All validations passed', [
                'patient_email' => $email,
            ]);

            // Store registration data in session for consent page
            $registrationData = [
                'request_data' => $request->except(['password', 'password_confirmation']),
                'password' => $request->input('password'), // Store for user creation later
                'tenant_id' => $currentTenantId,
                'flow_type' => 'submitRegister',
                'trigger_points' => ['creation'],
            ];

            session()->put('public_portal_registration', $registrationData);

            \Log::info('Registration data stored in session for consent acceptance', [
                'email' => $email,
                'flow_type' => 'submitRegister',
                'trigger_points' => $registrationData['trigger_points'],
                'session_id' => session()->getId(),
            ]);

            // Return success and redirect to consent page
            if ($request->expectsJson() || $request->ajax()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Please review and accept the required consents to complete your registration.',
                    'redirect_to_consents' => true,
                ]);
            }

            return redirect()->route('public-portal.consents');

        } catch (\Exception $e) {
            \Log::error('Patient registration failed', [
                'error' => $e->getMessage(),
                'email' => $request->input('email', 'not provided'),
                'tenant_id' => tenant('id'),
            ]);

            if ($request->expectsJson() || $request->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Registration failed. Please try again.',
                ], 500);
            }

            return back()->withErrors(['error' => 'Registration failed. Please try again.']);
        }
    }

    /**
     * Show consent page for patient registration
     */
    public function showConsents(Request $request)
    {
        // Check if registration data exists in session
        if (! session()->has('public_portal_registration')) {
            return redirect()->route('public-portal.register')->with('error', 'Session expired. Please register again.');
        }

        $tenant = tenant();
        $appearanceSettings = $this->getAppearanceSettings();
        $websiteSettings = $this->getWebsiteSettings();

        return Inertia::render('PublicPortal/Consents', [
            'tenant' => $tenant,
            'appearanceSettings' => $appearanceSettings,
            'websiteSettings' => $websiteSettings,
        ]);
    }

    /**
     * Accept consents and complete patient registration
     */
    public function acceptConsents(Request $request)
    {
        try {
            // Validate consent acceptance
            $request->validate([
                'consent_version_ids' => 'required|array|min:1',
                'consent_version_ids.*' => 'required|integer|exists:tenant.consent_versions,id',
            ]);

            // Retrieve registration data from session
            $registrationData = session()->get('public_portal_registration');
            if (! $registrationData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Session expired. Please register again.',
                ], 422);
            }

            // Verify all required consents are accepted
            $consentVerification = $this->verifyRequiredConsents($request->input('consent_version_ids'));
            if (! $consentVerification['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => 'All required consents must be accepted.',
                    'errors' => ['consents' => ['Please accept all required consents to continue.']],
                ], 422);
            }

            DB::beginTransaction();

            $flowType = $registrationData['flow_type'];
            $currentTenantId = $registrationData['tenant_id'];

            // Complete patient creation based on flow type
            if ($flowType === 'registerAndBook') {
                $result = $this->completeRegisterAndBook($registrationData, $request->input('consent_version_ids'));
            } else {
                $result = $this->completeSubmitRegister($registrationData, $request->input('consent_version_ids'));
            }

            DB::commit();

            // Clear session data
            session()->forget('public_portal_registration');

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'redirect_url' => $result['redirect_url'],
                'fallback_login_url' => $result['fallback_login_url'],
            ]);

        } catch (\Exception $e) {
            DB::rollback();

            \Log::error('Consent acceptance failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to complete registration. Please try again.',
            ], 500);
        }
    }

    /**
     * Complete patient registration and appointment booking with consents
     */
    private function completeRegisterAndBook(array $registrationData, array $consentVersionIds): array
    {
        $validated = $registrationData['validated'];
        $currentTenantId = $registrationData['tenant_id'];

        // Use provided health card number or generate temporary one
        $healthNumber = ! empty($validated['health_card_number'])
            ? strtoupper(trim($validated['health_card_number']))
            : 'TMP-'.time().'-'.uniqid();

        // Create or get patient in central database
        $patient = null;
        $tenantSpecificName = $validated['first_name'].' '.$validated['last_name'];

        tenancy()->central(function () use (&$patient, $validated, $healthNumber) {
            // Check if patient already exists
            $existingPatient = Patient::whereBlind('email', 'email_index', $validated['email_address'])->first();

            if ($existingPatient) {
                // Patient exists - use existing patient
                // Don't update patient fields (preserve original data)
                $patient = $existingPatient;
            } else {
                // Create new patient
                $patient = Patient::create([
                    'health_number' => $healthNumber,
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                    'preferred_name' => $validated['preferred_name'] ?? '',
                    'email' => $validated['email_address'],
                    'phone_number' => $validated['phone_number'],
                    'gender' => $validated['gender_pronouns'],
                    'gender_pronouns' => $validated['gender_pronouns'],
                    'client_type' => $validated['client_type'],
                    'date_of_birth' => $validated['date_of_birth'],
                    'emergency_contact_phone' => $validated['emergency_contact_phone'],
                    'meta_data' => ['is_onboarding' => 1],
                ]);
            }
        });

        // Create EntityConsent records
        $this->createEntityConsents($patient, $consentVersionIds);

        // Create or get user account and link to patient
        $user = null;
        // Use registration form name for tenant-specific name (not patient name which might be from existing patient)
        $tenantSpecificName = $validated['first_name'].' '.$validated['last_name'];

        tenancy()->central(function () use (&$user, $patient, $validated, $currentTenantId, $tenantSpecificName) {
            // Check if user already exists
            $existingUser = User::where('email', $patient->email)->first();

            if ($existingUser) {
                // User exists - use existing user, update password, DON'T update name
                $user = $existingUser;
                $user->update([
                    'password' => Hash::make($validated['password']),
                    'email_verified_at' => now(),
                ]);
                // Name is NOT updated - preserves original central user name
            } else {
                // Create new user
                $user = User::create([
                    'name' => $tenantSpecificName,
                    'email' => $patient->email,
                    'password' => Hash::make($validated['password']),
                    'email_verified_at' => now(),
                ]);
            }

            // Update patient user_id if not set
            if (! $patient->user_id) {
                $patient->update(['user_id' => $user->id]);
            }

            // Create tenant_user relationship if it doesn't exist
            $tenantUserExists = DB::table('tenant_user')
                ->where('user_id', $user->id)
                ->where('tenant_id', $currentTenantId)
                ->exists();

            if (! $tenantUserExists) {
                DB::table('tenant_user')->insert([
                    'user_id' => $user->id,
                    'tenant_id' => $currentTenantId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        // Link patient to tenant with ACCEPTED status (self-registration = auto-accept invitation)
        // Check if patient is already linked to this tenant
        if (! $patient->tenants()->where('tenant_id', $currentTenantId)->exists()) {
            $patient->tenants()->attach($currentTenantId, [
                'invitation_status' => 'ACCEPTED',
            ]);
        }

        // Switch to tenant context
        tenancy()->initialize($currentTenantId);

        // Ensure tenant user exists with tenant-specific name
        $existingTenantUser = \DB::table('users')->where('email', $user->email)->first();
        if (! $existingTenantUser) {
            // Create tenant user with tenant-specific name (from registration form)
            \DB::table('users')->updateOrInsert(
                ['email' => $user->email],
                [
                    'id' => $user->id,
                    'name' => $tenantSpecificName, // Use tenant-specific name, not central user name
                    'email_verified_at' => $user->email_verified_at,
                    'password' => $user->password,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        } else {
            // Update password and email_verified_at, but preserve tenant-specific name
            \DB::table('users')
                ->where('email', $user->email)
                ->update([
                    'email_verified_at' => $user->email_verified_at,
                    'password' => $user->password,
                    'updated_at' => now(),
                ]);
            // Name is NOT updated - preserves tenant-specific name
        }

        // Assign Patient role
        $tenantUser = User::where('email', $user->email)->first();
        if ($tenantUser && ! $tenantUser->hasRole('Patient')) {
            $tenantUser->assignRole('Patient');
        }

        // Create tenant patient record with 'Requested' status
        $tenantPatient = \App\Models\Tenant\Patient::create([
            'uid' => $patient->uid ?? (string) \Illuminate\Support\Str::uuid(),
            'external_patient_id' => $patient->id,
            'external_tenant_id' => $currentTenantId,
            'user_id' => $user->id,
            'health_number' => $patient->health_number,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'preferred_name' => $patient->preferred_name ?? '',
            'date_of_birth' => $patient->date_of_birth,
            'gender' => $patient->gender,
            'gender_pronouns' => $patient->gender_pronouns,
            'client_type' => $patient->client_type,
            'email' => $patient->email,
            'phone_number' => $patient->phone_number,
            'emergency_contact_phone' => $patient->emergency_contact_phone,
            'address' => $patient->address ?? '',
            'street_address' => $patient->street_address ?? '',
            'apt_suite_unit' => $patient->apt_suite_unit ?? '',
            'city' => $patient->city ?? '',
            'postal_zip_code' => $patient->postal_zip_code ?? '',
            'province' => $patient->province ?? '',
            'presenting_concern' => $patient->presenting_concern ?? '',
            'goals_for_therapy' => $patient->goals_for_therapy ?? '',
            'previous_therapy_experience' => $patient->previous_therapy_experience ?? '',
            'current_medications' => $patient->current_medications ?? '',
            'diagnoses' => $patient->diagnoses ?? '',
            'history_of_hospitalization' => $patient->history_of_hospitalization ?? '',
            'risk_safety_concerns' => $patient->risk_safety_concerns ?? '',
            'other_medical_conditions' => $patient->other_medical_conditions ?? '',
            'registration_status' => 'Requested',
            'requested_at' => now(),
            'meta_data' => ['is_onboarding' => 1, 'created_via_public_portal' => true],
        ]);

        // Log patient registration (now using tenant patient)
        \App\Listeners\PublicPortalActivityListener::logPatientRegistration($tenantPatient, $currentTenantId);

        // Handle appointment or waiting list
        $service = Service::find($validated['service_id']);
        $appointmentId = null;
        $successMessage = '';

        \Log::info('PUBLIC PORTAL: completeRegisterAndBook - Booking flow decision', [
            'patient_email' => $patient->email ?? 'unknown',
            'tenant_patient_id' => $tenantPatient->id,
            'is_waiting_list' => $validated['is_waiting_list'] ?? 'not set',
            'service_id' => $validated['service_id'],
            'date_time_preference' => $validated['date_time_preference'] ?? 'not set',
        ]);

        if (! empty($validated['is_waiting_list'])) {
            // Create waiting list entry
            $practitionerIds = $validated['practitioner_ids'] ?? [];
            if (empty($practitionerIds) && ! empty($validated['practitioner_id'])) {
                $practitionerIds = [(int) $validated['practitioner_id']];
            }

            \Log::info('PUBLIC PORTAL: Creating waiting list entry', [
                'patient_id' => $tenantPatient->id,
                'service_id' => $validated['service_id'],
            ]);

            AppointmentWaitlist::create([
                'patient_id' => $tenantPatient->id,
                'service_type' => $validated['service_type'],
                'service_name' => $validated['service_name'],
                'service_id' => $validated['service_id'],
                'location_id' => $validated['location_id'],
                'mode' => $validated['mode'],
                'practitioner_ids' => $practitionerIds,
                'preferred_day' => $validated['waiting_list_day'],
                'preferred_time' => $validated['waiting_list_time'],
                'original_requested_date' => $validated['date_time_preference'] ?? null,
                'status' => 'waiting',
            ]);

            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            cookie()->queue('is_waiting_list', 'true', 60, '/', $centralDomain);
            $successMessage = 'Registration successful! You have been added to the waiting list.';
        } else {
            \Log::info('PUBLIC PORTAL: Creating regular appointment with Requested status', [
                'patient_id' => $tenantPatient->id,
                'service_id' => $validated['service_id'],
                'date_time_preference' => $validated['date_time_preference'],
            ]);

            // Create appointment - parse datetime and convert timezone
            $dateTimeString = trim($validated['date_time_preference']);
            $locationId = $validated['location_id'];

            try {
                // Get tenant timezone for conversion (consistent with admin controller)
                $tenantTimezone = \App\Services\TenantTimezoneService::getTenantTimezone();

                // Convert from tenant timezone to UTC for storage (same as admin controller)
                $utcDateTime = \App\Services\TenantTimezoneService::convertToUTC($dateTimeString);

                $sessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);
                $utcEndTime = $utcDateTime->copy()->addMinutes($sessionDuration);
            } catch (\Exception $e) {
                \Log::error('Public Portal completeRegisterAndBook: Date parsing failed', [
                    'date_time_preference' => $validated['date_time_preference'],
                    'location_id' => $validated['location_id'] ?? 'not provided',
                    'patient_email' => $patient->email ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
                throw new \Exception('Invalid date format or location: '.$e->getMessage());
            }

            // Get practitioner IDs for conflict checking
            $practitionerIds = $validated['practitioner_ids'] ?? [];
            if (empty($practitionerIds) && ! empty($validated['practitioner_id'])) {
                $practitionerIds = [(int) $validated['practitioner_id']];
            }

            // Check for appointment conflicts before creating (same logic as admin controller)
            foreach ($practitionerIds as $practitionerId) {
                $conflictingAppointments = Appointment::whereExists(function ($q) use ($practitionerId) {
                    $q->from('appointment_practitioner')
                        ->whereColumn('appointment_practitioner.appointment_id', 'appointments.id')
                        ->where('appointment_practitioner.practitioner_id', $practitionerId);
                })
                    ->whereNotNull('appointment_datetime')
                    ->where('appointment_datetime', '>=', $utcDateTime->copy()->startOfDay())
                    ->where('appointment_datetime', '<', $utcDateTime->copy()->addDay()->startOfDay())
                    ->whereNotIn('status', ['cancelled', 'no-show'])
                    ->where(function ($query) use ($utcDateTime, $utcEndTime) {
                        $query->where(function ($q) use ($utcDateTime) {
                            // New appointment starts during existing appointment
                            $q->where('appointment_datetime', '<=', $utcDateTime)
                                ->where('end_time', '>', $utcDateTime);
                        })->orWhere(function ($q) use ($utcEndTime) {
                            // New appointment ends during existing appointment
                            $q->where('appointment_datetime', '<', $utcEndTime)
                                ->where('end_time', '>=', $utcEndTime);
                        })->orWhere(function ($q) use ($utcDateTime, $utcEndTime) {
                            // New appointment completely contains existing appointment
                            $q->where('appointment_datetime', '>=', $utcDateTime)
                                ->where('end_time', '<=', $utcEndTime);
                        });
                    })
                    ->get();

                if ($conflictingAppointments->count() > 0) {
                    \Log::warning('🚫 PUBLIC PORTAL APPOINTMENT CONFLICT DETECTED', [
                        'practitioner_id' => $practitionerId,
                        'requested_time' => $utcDateTime->format('Y-m-d H:i:s'),
                        'requested_end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                        'conflicting_appointments' => $conflictingAppointments->map(function ($apt) {
                            return [
                                'id' => $apt->id,
                                'status' => $apt->status,
                                'time' => $apt->appointment_datetime,
                            ];
                        })->toArray(),
                    ]);

                    throw new \Exception(
                        'Time slot conflict: The selected time slot is already booked. '.
                        'Please choose a different time.'
                    );
                }
            }

            $appointment = Appointment::create([
                'patient_id' => $tenantPatient->id,
                'contact_person' => $patient->first_name.' '.$patient->last_name,
                'service_name' => $service ? $service->name : 'Unknown Service',
                'service_type' => $validated['service_type'],
                'service_id' => $validated['service_id'],
                'location_id' => ! empty($validated['location_id']) ? $validated['location_id'] : null,
                'mode' => $validated['mode'],
                'appointment_datetime' => $utcDateTime,
                'start_time' => $utcDateTime,
                'end_time' => $utcEndTime,
                'stored_timezone' => $tenantTimezone, // Track the tenant timezone this appointment was created in
                'needs_timezone_migration' => false,
                'date_time_preference' => $validated['date_time_preference'],
                'booking_source' => 'Public Portal',
                'admin_override' => 'no-override',
                'status' => 'Requested', // New public portal registrations start as 'Requested' pending admin approval
                'notes' => $validated['notes'] ?? '',
            ]);

            \App\Listeners\PublicPortalActivityListener::logPublicPortalAppointment($appointment, $tenantPatient, true);
            $appointmentId = $appointment->id;

            \Log::info('PUBLIC PORTAL: Appointment created successfully', [
                'appointment_id' => $appointmentId,
                'patient_id' => $tenantPatient->id,
                'status' => $appointment->status,
                'appointment_datetime' => $appointment->appointment_datetime,
                'service_id' => $appointment->service_id,
            ]);

            // Attach practitioners (practitioner IDs already extracted above for conflict checking)
            foreach ($practitionerIds as $index => $pid) {
                \DB::table('appointment_practitioner')->insert([
                    'appointment_id' => $appointment->id,
                    'practitioner_id' => (int) $pid,
                    'start_time' => $utcDateTime->format('Y-m-d H:i:s'),
                    'end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                    'is_primary' => ($index === 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            cookie()->queue('appointment_booked', 'true', 60, '/', $centralDomain);
            $successMessage = 'Registration and appointment booking successful!';
        }

        // Set cookies for auto-login
        $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
        cookie()->queue('from_public_portal', 'true', 60, '/', $centralDomain);
        cookie()->queue('patient_id', $patient->id, 60);

        // Create register_from_public_portal entry
        try {
            \DB::table('register_from_public_portal')->insert([
                'patient_id' => $patient->id,
                'user_id' => $user->id,
                'registered_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to create register_from_public_portal entry', ['error' => $e->getMessage()]);
        }

        // Generate auth URL
        $authUser = null;
        tenancy()->central(function () use (&$authUser, $validated) {
            $authUser = User::where('email', $validated['email_address'])->first();
        });

        $authUrl = centralUrl('/central/patient-dashboard');
        if ($authUser) {
            try {
                $expires = now()->addMinutes(5)->timestamp;
                $hash = hash('sha256', $authUser->email.$authUser->id.$expires.config('app.key'));
                $authUrl = centralUrl('/auth/public-portal?'.http_build_query([
                    'user_id' => $authUser->id,
                    'hash' => $hash,
                    'expires' => $expires,
                ]));
            } catch (\Exception $e) {
                \Log::warning('Failed to create auth URL', ['error' => $e->getMessage()]);
            }
        }

        return [
            'message' => $successMessage,
            'redirect_url' => $authUrl,
            'fallback_login_url' => centralUrl('/login?public_portal_success=1'),
        ];
    }

    /**
     * Complete patient registration with consents (direct registration)
     */
    private function completeSubmitRegister(array $registrationData, array $consentVersionIds): array
    {
        $requestData = $registrationData['request_data'];
        $password = $registrationData['password'];
        $currentTenantId = $registrationData['tenant_id'];

        // Use provided health card number or generate temporary one
        $healthNumber = ! empty($requestData['health_card_number'])
            ? strtoupper(trim($requestData['health_card_number']))
            : 'TMP-'.time().'-'.uniqid();

        // Create or get user and patient
        $user = null;
        $patient = null;
        $tenantSpecificName = trim($requestData['first_name'].' '.$requestData['last_name']);

        tenancy()->central(function () use (&$user, &$patient, $requestData, $password, $healthNumber, $currentTenantId, $tenantSpecificName) {
            // Check if user already exists
            $existingUser = User::where('email', $requestData['email_address'])->first();

            if ($existingUser) {
                // User exists - use existing user, update password, DON'T update name
                $user = $existingUser;
                $user->update([
                    'password' => Hash::make($password), // Update password
                    'email_verified_at' => now(), // Update verification status
                ]);
                // Name is NOT updated - preserves original central user name
            } else {
                // Create new user
                $user = User::create([
                    'name' => $tenantSpecificName,
                    'email' => $requestData['email_address'],
                    'password' => Hash::make($password),
                    'email_verified_at' => now(),
                ]);
            }

            // Check if patient already exists
            $existingPatient = Patient::whereBlind('email', 'email_index', $requestData['email_address'])->first();

            if ($existingPatient) {
                // Patient exists - update user_id if not set, but don't update other fields
                $patient = $existingPatient;
                if (! $patient->user_id) {
                    $patient->update(['user_id' => $user->id]);
                }
            } else {
                // Create new patient
                $patient = Patient::create([
                    'health_number' => $healthNumber,
                    'first_name' => $requestData['first_name'],
                    'last_name' => $requestData['last_name'],
                    'preferred_name' => $requestData['preferred_name'] ?? '',
                    'email' => $requestData['email_address'],
                    'phone_number' => $requestData['phone_number'],
                    'gender' => $requestData['gender_pronouns'],
                    'gender_pronouns' => $requestData['gender_pronouns'],
                    'client_type' => $requestData['client_type'],
                    'date_of_birth' => $requestData['date_of_birth'],
                    'emergency_contact_phone' => $requestData['emergency_contact_phone'],
                    'user_id' => $user->id,
                    'meta_data' => ['is_onboarding' => 1],
                ]);
            }

            // Create tenant_user relationship if it doesn't exist
            $tenantUserExists = DB::table('tenant_user')
                ->where('user_id', $user->id)
                ->where('tenant_id', $currentTenantId)
                ->exists();

            if (! $tenantUserExists) {
                DB::table('tenant_user')->insert([
                    'user_id' => $user->id,
                    'tenant_id' => $currentTenantId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        // Link patient to tenant with ACCEPTED status (self-registration = auto-accept invitation)
        // Check if patient is already linked to this tenant
        if (! $patient->tenants()->where('tenant_id', $currentTenantId)->exists()) {
            $patient->tenants()->attach($currentTenantId, [
                'invitation_status' => 'ACCEPTED',
            ]);
        }

        // Switch to tenant context
        tenancy()->initialize($currentTenantId);

        // Create EntityConsent records
        $this->createEntityConsents($patient, $consentVersionIds);

        // Ensure tenant user exists with tenant-specific name and assign role
        $existingTenantUser = \DB::table('users')->where('email', $user->email)->first();
        if (! $existingTenantUser) {
            // Create tenant user with tenant-specific name (from registration form)
            \DB::table('users')->updateOrInsert(
                ['email' => $user->email],
                [
                    'id' => $user->id,
                    'name' => $tenantSpecificName, // Use tenant-specific name, not central user name
                    'email_verified_at' => $user->email_verified_at,
                    'password' => $user->password,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        } else {
            // Update password and email_verified_at, but preserve tenant-specific name
            \DB::table('users')
                ->where('email', $user->email)
                ->update([
                    'email_verified_at' => $user->email_verified_at,
                    'password' => $user->password,
                    'updated_at' => now(),
                ]);
            // Name is NOT updated - preserves tenant-specific name
        }

        $tenantUser = User::where('email', $user->email)->first();
        if ($tenantUser && ! $tenantUser->hasRole('Patient')) {
            $tenantUser->assignRole('Patient');
        }

        // Create tenant patient record with 'Requested' status
        $tenantPatient = \App\Models\Tenant\Patient::create([
            'uid' => $patient->uid ?? (string) \Illuminate\Support\Str::uuid(),
            'external_patient_id' => $patient->id,
            'external_tenant_id' => $currentTenantId,
            'user_id' => $user->id,
            'health_number' => $patient->health_number,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'preferred_name' => $patient->preferred_name ?? '',
            'date_of_birth' => $patient->date_of_birth,
            'gender' => $patient->gender,
            'gender_pronouns' => $patient->gender_pronouns,
            'client_type' => $patient->client_type,
            'email' => $patient->email,
            'phone_number' => $patient->phone_number,
            'emergency_contact_phone' => $patient->emergency_contact_phone,
            'address' => $patient->address ?? '',
            'street_address' => $patient->street_address ?? '',
            'apt_suite_unit' => $patient->apt_suite_unit ?? '',
            'city' => $patient->city ?? '',
            'postal_zip_code' => $patient->postal_zip_code ?? '',
            'province' => $patient->province ?? '',
            'presenting_concern' => $patient->presenting_concern ?? '',
            'goals_for_therapy' => $patient->goals_for_therapy ?? '',
            'previous_therapy_experience' => $patient->previous_therapy_experience ?? '',
            'current_medications' => $patient->current_medications ?? '',
            'diagnoses' => $patient->diagnoses ?? '',
            'history_of_hospitalization' => $patient->history_of_hospitalization ?? '',
            'risk_safety_concerns' => $patient->risk_safety_concerns ?? '',
            'other_medical_conditions' => $patient->other_medical_conditions ?? '',
            'registration_status' => 'Requested',
            'requested_at' => now(),
            'meta_data' => ['is_onboarding' => 1, 'created_via_public_portal' => true],
        ]);

        // Log patient registration (using tenant patient)
        \App\Listeners\PublicPortalActivityListener::logPatientRegistration($tenantPatient, $currentTenantId);

        // Create register_from_public_portal entry
        try {
            \DB::table('register_from_public_portal')->insert([
                'patient_id' => $patient->id,
                'user_id' => $user->id,
                'registered_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to create register_from_public_portal entry', ['error' => $e->getMessage()]);
        }

        // Generate auth URL
        $authUrl = centralUrl('/central/patient-dashboard');
        try {
            $expires = now()->addMinutes(5)->timestamp;
            $hash = hash('sha256', $user->email.$user->id.$expires.config('app.key'));
            $authUrl = centralUrl('/auth/public-portal?'.http_build_query([
                'user_id' => $user->id,
                'hash' => $hash,
                'expires' => $expires,
            ]));
        } catch (\Exception $e) {
            \Log::warning('Failed to create auth URL', ['error' => $e->getMessage()]);
        }

        return [
            'message' => 'Registration successful! Redirecting to your dashboard...',
            'redirect_url' => $authUrl,
            'fallback_login_url' => centralUrl('/login?public_portal_success=1'),
        ];
    }

    /**
     * Get appearance settings for tenant
     */
    private function getAppearanceSettings(): array
    {
        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');

        return $this->processS3Logo($appearanceSettings);
    }

    /**
     * Request to join tenant for existing patient
     */
    public function requestJoinTenant(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'patient_id' => 'required|integer',
                'user_id' => 'required|integer',
            ]);

            $email = $request->input('email');
            $patientId = $request->input('patient_id');
            $userId = $request->input('user_id');
            $currentTenantId = tenant('id');
            $currentTenant = tenant();

            // Verify the patient and user exist and match
            $patient = null;
            $user = null;

            tenancy()->central(function () use (&$patient, &$user, $patientId, $userId, $email) {
                $patient = Patient::where('id', $patientId)
                    ->where('email', $email)
                    ->where('user_id', $userId)
                    ->first();

                $user = User::where('id', $userId)
                    ->where('email', $email)
                    ->first();
            });

            if (! $patient || ! $user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid patient or user information.',
                ], 422);
            }

            // Check if already linked to this tenant
            $alreadyLinked = false;
            tenancy()->central(function () use (&$alreadyLinked, $patient, $currentTenantId) {
                $alreadyLinked = $patient->tenants()->where('tenant_id', $currentTenantId)->exists();
            });

            if ($alreadyLinked) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are already registered with this healthcare provider.',
                ], 422);
            }

            // Link patient to current tenant
            tenancy()->central(function () use ($patient, $currentTenantId) {
                $patient->tenants()->attach($currentTenantId);
            });

            // Switch to tenant context and ensure user exists with Patient role
            tenancy()->initialize($currentTenantId);

            $existingTenantUser = \DB::table('users')->where('email', $user->email)->first();
            if (! $existingTenantUser) {
                \DB::table('users')->updateOrInsert(
                    ['email' => $user->email],
                    [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email_verified_at' => $user->email_verified_at,
                        'password' => $user->password,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            $tenantUser = User::where('email', $user->email)->first();
            if ($tenantUser && ! $tenantUser->hasRole('Patient')) {
                $tenantUser->assignRole('Patient');
            }

            \Log::info('Patient successfully joined tenant', [
                'patient_id' => $patient->id,
                'user_id' => $user->id,
                'tenant_id' => $currentTenantId,
                'tenant_name' => $currentTenant->company_name,
            ]);

            return response()->json([
                'success' => true,
                'message' => "Successfully joined {$currentTenant->company_name}! You can now access your patient dashboard.",
                'redirect_url' => centralUrl('/central/patient-dashboard'),
                'fallback_login_url' => centralUrl('/login?joined_tenant=1'),
            ]);

        } catch (\Exception $e) {
            \Log::error('Request join tenant failed', [
                'error' => $e->getMessage(),
                'email' => $request->input('email', 'not provided'),
                'tenant_id' => tenant('id'),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to join healthcare provider. Please try again.',
            ], 500);
        }
    }

    /**
     * Get website settings for public portal
     */
    private function getWebsiteSettings(): array
    {
        // Get navigation settings
        $navigationSettings = OrganizationSetting::getByPrefix('website_navigation_');
        $defaultNavigationItems = [
            ['id' => 'services', 'label' => 'Services', 'enabled' => true, 'order' => 1],
            ['id' => 'locations', 'label' => 'Locations', 'enabled' => true, 'order' => 2],
            ['id' => 'staff', 'label' => 'Staff', 'enabled' => true, 'order' => 3],
            ['id' => 'assess-yourself', 'label' => 'Assess Yourself', 'enabled' => true, 'order' => 4],
            ['id' => 'book-appointment', 'label' => 'Book Appointment', 'enabled' => true, 'order' => 5],
        ];
        $navigationItems = isset($navigationSettings['website_navigation_items'])
            ? json_decode($navigationSettings['website_navigation_items'], true)
            : $defaultNavigationItems;

        // Get layout settings
        $layoutSettings = OrganizationSetting::getByPrefix('website_layout_');
        $selectedLayout = $layoutSettings['website_layout_selected'] ?? 'sidebar';

        // Get appearance settings
        $appearanceSettings = OrganizationSetting::getByPrefix('website_appearance_');

        return [
            'navigation' => [
                'items' => $navigationItems,
            ],
            'layout' => [
                'selected' => $selectedLayout,
            ],
            'appearance' => [
                'hero_section' => [
                    'enabled' => (bool) ($appearanceSettings['website_appearance_hero_enabled'] ?? true),
                    'title' => $appearanceSettings['website_appearance_hero_title'] ?? 'Welcome to Our Healthcare Practice',
                    'subtitle' => $appearanceSettings['website_appearance_hero_subtitle'] ?? 'Providing comprehensive care with a focus on your health and wellbeing',
                    'background_image' => $appearanceSettings['website_appearance_hero_bg_image'] ?? null,
                ],
                'colors' => [
                    'use_custom' => (bool) ($appearanceSettings['website_appearance_colors_custom'] ?? false),
                    'primary' => $appearanceSettings['website_appearance_colors_primary'] ?? '#7c3aed',
                    'accent' => $appearanceSettings['website_appearance_colors_accent'] ?? '#10b981',
                ],
                'typography' => [
                    'use_custom' => (bool) ($appearanceSettings['website_appearance_typography_custom'] ?? false),
                    'heading_font' => $appearanceSettings['website_appearance_typography_heading'] ?? 'Inter',
                    'body_font' => $appearanceSettings['website_appearance_typography_body'] ?? 'Inter',
                ],
                'footer' => [
                    'enabled' => (bool) ($appearanceSettings['website_appearance_footer_enabled'] ?? true),
                    'copyright' => $appearanceSettings['website_appearance_footer_copyright'] ?? 'All rights reserved.',
                    'links' => json_decode($appearanceSettings['website_appearance_footer_links'] ?? '[]', true),
                ],
            ],
        ];
    }

    /**
     * Handle request to join from public portal
     */
    public function requestToJoin(\Illuminate\Http\Request $request)
    {
        try {
            // Validate the request data
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|email|max:255',
                'health_card_number' => 'required|string|max:50',
            ]);

            // Ensure tenant context is properly initialized
            $tenant = tenant();

            if (! $tenant) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tenant not found. Please ensure you are accessing this from the correct domain.',
                ], 400);
            }

            // Get tenant email and name
            $tenantEmail = $tenant->email ?? config('mail.from.address');
            $tenantName = $tenant->company_name ?? $tenant->id;

            // If tenant doesn't have email, use a default admin email or fail gracefully
            if (! $tenantEmail) {
                \Log::warning('No tenant email found for request to join', [
                    'tenant_id' => $tenant->id,
                    'patient_data' => $validated,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Unable to process request. Please contact the clinic directly.',
                ], 500);
            }

            // Send email to tenant using central connection to avoid tenant DB dependency
            // We'll use the central mail configuration by temporarily switching context
            $result = $this->sendRequestToJoinEmail(
                $tenantEmail,
                $validated['email'],
                $validated['name'],
                $validated['health_card_number'],
                $tenantName,
                $tenant->id
            );

            if (! $result) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to send request. Please try again later.',
                ], 500);
            }

            \Log::info('Request to join email sent successfully', [
                'tenant_id' => $tenant->id,
                'patient_email' => $validated['email'],
                'patient_name' => $validated['name'],
                'tenant_email' => $tenantEmail,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Your request has been sent successfully! The clinic will contact you soon to complete your registration.',
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Please check your input and try again.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Request to join failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->except(['password']),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send request. Please try again later.',
            ], 500);
        }
    }

    /**
     * Send request to join email using central mail configuration
     */
    private function sendRequestToJoinEmail(
        string $tenantEmail,
        string $patientEmail,
        string $patientName,
        string $healthCardNumber,
        string $tenantName,
        string $tenantId
    ): bool {
        try {
            // Use non-tenant mail class to avoid tenant DB dependency
            \Illuminate\Support\Facades\Mail::to($tenantEmail)->send(
                new \App\Mail\RequestToJoinMail(
                    $patientEmail,
                    $patientName,
                    $healthCardNumber,
                    $tenantName,
                    $tenantEmail
                )
            );

            return true;
        } catch (\Exception $e) {
            \Log::error('Failed to send request to join email', [
                'error' => $e->getMessage(),
                'tenant_id' => $tenantId,
                'patient_email' => $patientEmail,
            ]);

            return false;
        }
    }

    /**
     * Handle joining the waiting list
     */
    public function joinWaitingList(Request $request)
    {
        $request->validate([
            'preferred_day' => 'required|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday,any',
            'preferred_time' => 'required|in:morning,afternoon,evening,any',
            'notes' => 'nullable|string|max:1000',
            'tenant_id' => 'required|string',
        ]);

        try {
            // Check if user is logged in
            $user = Auth::user();
            if (! $user) {
                return response()->json([
                    'success' => false,
                    'message' => 'You must be logged in to join the waiting list.',
                ], 401);
            }

            // Find the patient in central database
            $patient = null;
            tenancy()->central(function () use (&$patient, $user) {
                $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();
            });

            if (! $patient) {
                return response()->json([
                    'success' => false,
                    'message' => 'Patient record not found.',
                ], 404);
            }

            // Initialize tenant context
            $tenant = \App\Models\Tenant::find($request->tenant_id);
            if (! $tenant) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tenant not found.',
                ], 404);
            }

            tenancy()->initialize($tenant);

            // Get tenant patient record (different ID from central patient)
            $tenantPatient = \App\Models\Tenant\Patient::where('external_patient_id', $patient->id)->first();

            if (! $tenantPatient) {
                return response()->json([
                    'success' => false,
                    'message' => 'Patient record not found in this clinic. Please contact support.',
                ], 404);
            }

            // Check if patient is already on waiting list for this service
            $existingEntry = AppointmentWaitlist::where('patient_id', $tenantPatient->id)
                ->where('service_id', $request->service_id)
                ->where('status', 'waiting')
                ->first();

            if ($existingEntry) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are already on the waiting list for this service.',
                ], 409);
            }

            // Create waiting list entry
            AppointmentWaitlist::create([
                'patient_id' => $tenantPatient->id,
                'service_type' => $request->service_type,
                'service_name' => $request->service_name,
                'service_id' => $request->service_id,
                'location_id' => $request->location_id,
                'mode' => $request->mode,
                'practitioner_ids' => $request->practitioner_ids,
                'preferred_day' => $request->preferred_day,
                'preferred_time' => $request->preferred_time,
                'original_requested_date' => $request->original_requested_date ?? null,
                'status' => 'pending',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Successfully joined the waiting list! We will contact you when a slot becomes available.',
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to join waiting list', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'request_data' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to join waiting list. Please try again later.',
            ], 500);
        }
    }

    /**
     * Process S3 logo to generate proxy URL
     */
    private function processS3Logo(array $appearanceSettings): array
    {
        // Use the key WITH prefix to match SettingsController approach
        $logoS3Key = $appearanceSettings['appearance_logo_s3_key'] ?? null;

        if (! empty($logoS3Key)) {
            try {
                // Use proxy route to avoid CORS issues with cache-busting parameter
                $tenantId = tenant('id');
                $cacheBuster = substr(md5($logoS3Key), 0, 8); // Use S3 key hash for cache busting
                $appearanceSettings['appearance_logo_path'] = url("/logo-proxy/{$tenantId}?v={$cacheBuster}");
                \Log::info('PublicPortalController: Generated proxy URL for logo', [
                    's3_key' => $logoS3Key,
                    'proxy_url' => $appearanceSettings['appearance_logo_path'],
                ]);
            } catch (\Exception $e) {
                \Log::warning('PublicPortalController: Failed to generate proxy URL for logo', [
                    's3_key' => $logoS3Key,
                    'error' => $e->getMessage(),
                ]);
                $appearanceSettings['appearance_logo_path'] = null;
            }
        } else {
            $appearanceSettings['appearance_logo_path'] = null;
        }

        return $appearanceSettings;
    }

    public function acceptWaitingListSlot(string $token)
    {
        try {
            $waitingListService = app(\App\Services\WaitingListSlotService::class);
            $result = $waitingListService->getOfferDetails($token);

            if (! $result['success']) {
                return Inertia::render('WaitingList/SlotConfirmation', [
                    'success' => false,
                    'message' => $result['message'],
                ]);
            }

            return Inertia::render('WaitingList/SlotConfirmation', [
                'success' => true,
                'token' => $token,
                'patient' => $result['patient'],
                'appointmentDate' => $result['appointmentDate']->toISOString(),
                'appointmentDetails' => $result['appointmentDetails'] ?? null,
                'expiresAt' => $result['expiresAt']->toISOString(),
                'waitingListEntry' => $result['waitingListEntry'],
            ]);
        } catch (\Exception $e) {
            Log::error('Error accepting waiting list slot: '.$e->getMessage());

            return Inertia::render('WaitingList/SlotConfirmation', [
                'success' => false,
                'message' => 'This link has expired or is no longer valid.',
            ]);
        }
    }

    public function confirmWaitingListSlot(string $token)
    {
        Log::info('CONTROLLER: Confirm button clicked', ['token' => $token]);

        $service = app(\App\Services\WaitingListSlotService::class);
        $result = $service->confirmSlotOffer($token);

        Log::info('CONTROLLER: Got result', $result);

        if (! $result['success']) {
            return back()->withErrors(['message' => $result['message']]);
        }

        return Inertia::render('WaitingList/SlotAccepted', [
            'success' => true,
            'message' => $result['message'],
            'appointment' => $result['appointment'] ?? null,
        ]);
    }

    /**
     * Verify that all required patient consents are included in the provided consent version IDs
     *
     * @return array ['valid' => bool, 'missing' => array, 'required' => array]
     */
    private function verifyRequiredConsents(array $consentVersionIds): array
    {
        // Get trigger points from session to validate only relevant consents
        $registrationData = session('public_portal_registration');
        $triggerPoints = $registrationData['trigger_points'] ?? ['creation'];

        // Get required PATIENT consents matching the trigger points
        $requiredConsentsQuery = \App\Models\Tenant\Consent::where('entity_type', 'PATIENT')
            ->where('is_required', true)
            ->with('activeVersion');

        // Filter by trigger points - check if any of the requested trigger points are in the consent's trigger_points JSON
        $requiredConsentsQuery->where(function ($query) use ($triggerPoints) {
            foreach ($triggerPoints as $triggerPoint) {
                $query->orWhereJsonContains('trigger_points->patient', $triggerPoint);
            }
        });

        $requiredConsents = $requiredConsentsQuery->get();

        if ($requiredConsents->isEmpty()) {
            \Log::info('No required patient consents found for trigger points', [
                'trigger_points' => $triggerPoints,
            ]);

            return ['valid' => true];
        }

        // Build list of required consent version IDs
        $requiredVersionIds = $requiredConsents->pluck('activeVersion.id')->filter()->values()->toArray();

        \Log::info('Verifying required consents for trigger points', [
            'trigger_points' => $triggerPoints,
            'required_version_ids' => $requiredVersionIds,
            'provided_version_ids' => $consentVersionIds,
        ]);

        // Check if all required consents are in the provided list
        $missing = array_diff($requiredVersionIds, $consentVersionIds);

        if (! empty($missing)) {
            return [
                'valid' => false,
                'missing' => $missing,
                'required' => $requiredVersionIds,
            ];
        }

        return ['valid' => true];
    }

    /**
     * Create EntityConsent records for a patient
     *
     * @param  \App\Models\Patient  $patient
     */
    private function createEntityConsents($patient, array $consentVersionIds): void
    {
        \Log::info('Creating EntityConsent records', [
            'patient_id' => $patient->id,
            'consent_version_ids' => $consentVersionIds,
        ]);

        foreach ($consentVersionIds as $versionId) {
            \App\Models\Tenant\EntityConsent::create([
                'consentable_type' => Patient::class,
                'consentable_id' => $patient->id,
                'consent_version_id' => $versionId,
                'consented_at' => now(),
            ]);
        }

        \Log::info('EntityConsent records created successfully', [
            'patient_id' => $patient->id,
            'count' => count($consentVersionIds),
        ]);
    }

    /**
     * Check for appointment conflicts for a specific practitioner
     * This method checks against existing appointments in the appointment_practitioner pivot table
     *
     * @param  int  $practitionerId  The practitioner ID to check conflicts for
     * @param  Carbon  $startTime  UTC start time of the new appointment
     * @param  Carbon  $endTime  UTC end time of the new appointment
     *
     * @throws \Exception If conflicts are found
     */
    private function checkPractitionerConflict(int $practitionerId, Carbon $startTime, Carbon $endTime): void
    {
        // Check for conflicts by looking at the appointment_practitioner pivot table
        // This ensures we check against the actual practitioner times (including slot divisions)
        $conflictingAppointments = DB::table('appointment_practitioner')
            ->join('appointments', 'appointment_practitioner.appointment_id', '=', 'appointments.id')
            ->where('appointment_practitioner.practitioner_id', $practitionerId)
            ->whereNotNull('appointments.appointment_datetime')
            ->where('appointments.appointment_datetime', '>=', $startTime->copy()->startOfDay())
            ->where('appointments.appointment_datetime', '<', $startTime->copy()->addDay()->startOfDay())
            ->whereNotIn('appointments.status', ['cancelled', 'no-show'])
            ->where(function ($query) use ($startTime, $endTime) {
                $query->where(function ($q) use ($startTime) {
                    // New appointment starts during existing appointment
                    // Check if new start time is between existing start and end
                    $q->where('appointment_practitioner.start_time', '<=', $startTime)
                        ->where('appointment_practitioner.end_time', '>', $startTime);
                })->orWhere(function ($q) use ($endTime) {
                    // New appointment ends during existing appointment
                    // Check if new end time is between existing start and end
                    $q->where('appointment_practitioner.start_time', '<', $endTime)
                        ->where('appointment_practitioner.end_time', '>=', $endTime);
                })->orWhere(function ($q) use ($startTime, $endTime) {
                    // New appointment completely contains existing appointment
                    // Check if existing appointment is fully within new appointment time range
                    $q->where('appointment_practitioner.start_time', '>=', $startTime)
                        ->where('appointment_practitioner.end_time', '<=', $endTime);
                })->orWhere(function ($q) use ($startTime, $endTime) {
                    // Existing appointment completely contains new appointment
                    // Check if new appointment is fully within existing appointment time range
                    $q->where('appointment_practitioner.start_time', '<=', $startTime)
                        ->where('appointment_practitioner.end_time', '>=', $endTime);
                });
            })
            ->select('appointments.id', 'appointments.status', 'appointments.appointment_datetime',
                'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
            ->get();

        if ($conflictingAppointments->count() > 0) {
            Log::warning('🚫 APPOINTMENT CONFLICT DETECTED (Public Portal)', [
                'practitioner_id' => $practitionerId,
                'requested_start_time' => $startTime->format('Y-m-d H:i:s'),
                'requested_end_time' => $endTime->format('Y-m-d H:i:s'),
                'conflicting_appointments' => $conflictingAppointments->map(function ($apt) {
                    return [
                        'id' => $apt->id,
                        'status' => $apt->status,
                        'appointment_datetime' => $apt->appointment_datetime,
                        'practitioner_start_time' => $apt->start_time,
                        'practitioner_end_time' => $apt->end_time,
                    ];
                })->toArray(),
            ]);

            throw new \Exception(
                "Time slot conflict: Practitioner {$practitionerId} already has an appointment at this time. ".
                'Conflicting appointment(s): '.
                $conflictingAppointments->map(function ($apt) {
                    return "ID {$apt->id} ({$apt->status})";
                })->join(', ')
            );
        }
    }
}
