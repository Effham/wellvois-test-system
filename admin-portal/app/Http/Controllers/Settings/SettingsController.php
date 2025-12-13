<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Practitioner;
use App\Models\Service;
use App\Models\Tenant\License;
use App\Services\StripeConnectService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class SettingsController extends Controller
{
    /**
     * Display the settings index page.
     */
    public function index(Request $request)
    {
        // Get current section for reference
        $currentTab = $request->get('section', 'organization');

        // Check if we need to load a specific practitioner for editing
        $practitionerId = $request->get('practitioner_id');
        $editPractitioner = null;

        if ($practitionerId) {
            $currentTenantId = tenant('id');

            // Get practitioner from tenant database
            $practitioner = Practitioner::find($practitionerId);

            if ($practitioner) {
                // Check if basic info and professional details are complete
                $hasCompleteBasicInfo = $this->hasCompleteBasicInfo($practitioner);
                $hasCompleteProfessionalDetails = $this->hasCompleteProfessionalDetails($practitioner);

                $editPractitioner = (object) array_merge($practitioner->toArray(), [
                    'canEditBasicInfo' => ! $hasCompleteBasicInfo,
                    'canEditProfessionalDetails' => ! $hasCompleteProfessionalDetails,
                ]);
            }
        }

        // Load all data at once for better user experience when switching tabs
        $data = [
            // Load practitioners data
            'practitioners' => $this->getPractitioners($request),

            // Load invitations data
            'invitations' => $this->getInvitations($request),

            // Load locations data
            'locations' => $this->getLocations($request),

            // Load services data
            'services' => $this->getServices($request),

            // Load organization settings data
            'organizationSettings' => [
                'practiceDetails' => OrganizationSetting::getByPrefix('practice_details_'),
                'appearance' => $this->getAppearanceSettingsWithSignedUrl(),
                'timeLocale' => $this->getTimeLocaleSettings(),
                'businessCompliance' => OrganizationSetting::getByPrefix('business_compliance_'),
                'accounting' => OrganizationSetting::getAccountingSettings(),
            ],

            // Load appointment settings data
            'appointmentSettings' => OrganizationSetting::getByPrefix('appointment_'),

            // Load integrations data
            'integrations' => $this->getIntegrations(),

            // Add filters for practitioners search/pagination
            'filters' => [
                'search' => $request->search,
                'perPage' => $request->get('perPage', 10),
            ],

            // Add current tab information
            'currentTab' => $currentTab,

            // Add specific practitioner if being edited
            'editPractitioner' => $editPractitioner,
        ];

        return Inertia::render('settings/index', $data);
    }

    /**
     * Display the organization settings page
     */
    public function organization(Request $request)
    {
        // Always load data immediately
        $data = [
            'organizationSettings' => [
                'practiceDetails' => OrganizationSetting::getByPrefix('practice_details_'),
                'appearance' => $this->getAppearanceSettingsWithSignedUrl(),
                'timeLocale' => OrganizationSetting::getByPrefix('time_locale_'),
                'businessCompliance' => OrganizationSetting::getByPrefix('business_compliance_'),
            ],
            'appointmentSettings' => OrganizationSetting::getByPrefix('appointment_'),
        ];

        return Inertia::render('settings/organization', $data);
    }

    /**
     * Display the locations settings page
     */
    public function locations(Request $request)
    {
        // Always load data immediately
        return Inertia::render('settings/locations', [
            'locations' => $this->getLocations($request),
        ]);
    }

    /**
     * Get appearance settings with signed URL generated for logo
     */
    private function getAppearanceSettingsWithSignedUrl(): array
    {
        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');

        \Log::info('SettingsController: Raw appearance settings', $appearanceSettings);

        if (isset($appearanceSettings['appearance_logo_s3_key']) && ! empty($appearanceSettings['appearance_logo_s3_key'])) {
            \Log::info('SettingsController: S3 key found, generating proxy URL', [
                's3_key' => $appearanceSettings['appearance_logo_s3_key'],
            ]);

            try {
                // Use proxy route to avoid CORS issues with cache-busting parameter
                $tenantId = tenant('id');
                $cacheBuster = substr(md5($appearanceSettings['appearance_logo_s3_key']), 0, 8); // Use S3 key hash for cache busting
                $proxyUrl = url("/logo-proxy/{$tenantId}?v={$cacheBuster}");
                $appearanceSettings['appearance_logo_path'] = $proxyUrl;

                \Log::info('SettingsController: Proxy URL generated successfully', [
                    'proxy_url' => $proxyUrl,
                ]);
            } catch (\Exception $e) {
                \Log::error('SettingsController: Error generating proxy URL', [
                    'error' => $e->getMessage(),
                ]);
            }
        } else {
            \Log::warning('SettingsController: No S3 key found in appearance settings', [
                'available_keys' => array_keys($appearanceSettings),
            ]);
        }

        \Log::info('SettingsController: Final appearance settings', $appearanceSettings);

        return $appearanceSettings;
    }

    /**
     * Get time locale settings with location timezone as priority
     */
    private function getTimeLocaleSettings(): array
    {
        $timeLocaleSettings = OrganizationSetting::getByPrefix('time_locale_');

        // Get timezone from location as primary source
        $location = \App\Models\Location::where('is_active', true)->first();
        if ($location && $location->timezone) {
            $timeLocaleSettings['time_locale_timezone'] = $location->timezone;
        }

        return $timeLocaleSettings;
    }

    /**
     * Display the practitioners settings page - redirect to list by default
     */
    public function practitioners(Request $request)
    {
        return redirect()->route('settings.practitioners.list', $request->all());
    }

    /**
     * Display the practitioners list page
     * Supports deferred loading via Inertia partial reloads
     */
    public function practitionersList(Request $request)
    {
        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // Prepare filters
        $filters = [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ];

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('settings/practitioners-list-working', [
                'items' => null,
                'filters' => $filters,
            ]);
        }

        // Return full data for partial reload
        $currentTenantId = tenant('id');
        $perPage = $request->get('perPage', 10);
        $search = $request->search;

        // Get all practitioners from tenant database
        $centralPractitionersQuery = Practitioner::query();

        // Apply search filter
        if (! empty($search)) {
            $matchingCentralIds = Practitioner::whereBlind('first_name', 'first_name_index', $search)
                ->orWhereBlind('last_name', 'last_name_index', $search)
                ->orWhereBlind('email', 'email_index', $search)
                ->orWhereBlind('license_number', 'license_number_index', $search)
                ->pluck('id')
                ->toArray();

            if (! empty($matchingCentralIds)) {
                $centralPractitionersQuery->whereIn('id', $matchingCentralIds);
            } else {
                $centralPractitionersQuery->where('id', -1);
            }
        }

        try {
            $centralPractitioners = $centralPractitionersQuery->latest('created_at')->get();

            Log::info('Practitioners list loaded', [
                'count' => $centralPractitioners->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching practitioners', [
                'error' => $e->getMessage(),
            ]);

            $centralPractitioners = collect();
        }

        // Transform practitioners and add profile picture URLs and invitation status
        $centralPractitioners->transform(function ($practitioner) {
            try {
                // Generate profile picture proxy URL if S3 key exists
                if ($practitioner->profile_picture_s3_key) {
                    $cacheBuster = substr(md5($practitioner->profile_picture_s3_key), 0, 8);
                    $practitioner->profile_picture_url = url("/profile-picture-proxy/{$practitioner->id}?v={$cacheBuster}");
                }

                // Add invitation_status based on user_id and is_active
                if ($practitioner->user_id) {
                    $practitioner->invitation_status = 'ACCEPTED';
                } elseif ($practitioner->is_active) {
                    $practitioner->invitation_status = 'PENDING_INVITATION';
                } else {
                    $practitioner->invitation_status = 'DECLINED';
                }

                return $practitioner;
            } catch (\Exception $e) {
                Log::warning('Error processing practitioner', [
                    'practitioner_id' => $practitioner->id ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);

                return $practitioner;
            }
        });

        // Paginate
        $currentPage = \Illuminate\Pagination\Paginator::resolveCurrentPage('page');
        $practitioners = new \Illuminate\Pagination\LengthAwarePaginator(
            $centralPractitioners->forPage($currentPage, $perPage),
            $centralPractitioners->count(),
            $perPage,
            $currentPage,
            ['path' => \Illuminate\Pagination\Paginator::resolveCurrentPath()]
        );

        return Inertia::render('settings/practitioners-list-working', [
            'items' => $practitioners,
            'filters' => $filters,
        ]);
    }

    /**
     * Display the practitioners invitations page
     * Supports deferred loading via Inertia partial reloads
     */
    public function practitionersInvitations(Request $request)
    {
        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // Prepare filters
        $filters = [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ];

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('settings/practitioners-invitations', [
                'invitations' => null,
                'filters' => $filters,
                'activeTab' => 'invitations',
            ]);
        }

        // Return full data for partial reload
        return Inertia::render('settings/practitioners-invitations', [
            'invitations' => $this->getInvitations($request),
            'filters' => $filters,
            'activeTab' => 'invitations',
        ]);
    }

    /**
     * Display the services settings page
     */
    public function services(Request $request)
    {
        // Prepare filters
        $filters = [
            'search' => $request->search,
            'perPage' => $request->get('perPage', 10),
        ];

        // Always load data immediately
        return Inertia::render('settings/services', [
            'services' => $this->getServices($request),
            'filters' => $filters,
        ]);
    }

    /**
     * Display the integrations settings page
     * Supports deferred loading via Inertia partial reloads
     */
    public function integrations(Request $request)
    {
        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('settings/integrations', [
                'integrations' => null,
            ]);
        }

        // Return full data for partial reload
        return Inertia::render('settings/integrations', [
            'integrations' => $this->getIntegrations(),
        ]);
    }

    /**
     * Display the website settings page
     * Supports deferred loading via Inertia partial reloads
     */
    public function website(Request $request)
    {
        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('settings/website', [
                // Website settings data set to null for deferred loading
            ]);
        }

        // Return full data for partial reload
        return Inertia::render('settings/website', [
            // Website settings data can be added here as needed
        ]);
    }

    /**
     * Check if practitioner has complete basic info
     */
    private function hasCompleteBasicInfo($practitioner)
    {
        $requiredBasicFields = [
            'first_name', 'last_name', 'email', 'phone_number',
        ];

        foreach ($requiredBasicFields as $field) {
            if (empty($practitioner->{$field})) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if practitioner has complete professional details
     * Fixed to properly handle Laravel array casts and detect truly empty professional data
     */
    private function hasCompleteProfessionalDetails($practitioner)
    {
        $requiredProfessionalFields = [
            'credentials', 'years_of_experience', 'license_number',
            'primary_specialties', 'therapeutic_modalities',
        ];

        foreach ($requiredProfessionalFields as $field) {
            $value = $practitioner->{$field};

            // Handle array fields (Laravel array cast converts null to empty array [])
            if (is_array($value)) {
                // Empty array means no data has been set
                if (empty($value)) {
                    return false;
                }
                // Check if array contains only empty values
                $filteredArray = array_filter($value, function ($item) {
                    return ! empty($item);
                });
                if (empty($filteredArray)) {
                    return false;
                }
            }
            // Handle string fields
            elseif (is_string($value)) {
                if (empty(trim($value))) {
                    return false;
                }
            }
            // Handle null values
            elseif (is_null($value)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get practitioners data (can be used by other methods) - only show practitioners linked to current tenant
     */
    private function getPractitioners(Request $request)
    {
        try {
            $currentTenantId = tenant('id');

            if (! $currentTenantId) {
                throw new \Exception('No tenant context available');
            }

            // Build query with timeout protection from tenant database
            $query = Practitioner::query(); // No need to eager load tenants relation

            // Handle search functionality with sanitization
            if ($request->has('search') && ! empty(trim($request->search))) {
                $searchTerm = trim($request->search);
                // Limit search term length to prevent issues
                if (strlen($searchTerm) > 100) {
                    $searchTerm = substr($searchTerm, 0, 100);
                }

                $query->where(function ($q) use ($searchTerm) {
                    $q->where('first_name', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('last_name', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('email', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('title', 'LIKE', "%{$searchTerm}%");
                });
            }

            // Apply pagination with reasonable limits
            $perPage = min(max((int) $request->get('perPage', 10), 5), 50); // Between 5-50 items

            // Add timeout and limit to prevent hanging queries
            $practitioners = $query->orderBy('first_name')
                ->orderBy('last_name')
                ->paginate($perPage);

            // Add invitation_status to each practitioner based on their state
            $practitioners->getCollection()->transform(function ($practitioner) {
                // Determine status based on user_id and is_active
                if ($practitioner->user_id) {
                    // Has user account - they're active
                    $practitioner->invitation_status = 'ACCEPTED';
                } elseif ($practitioner->is_active) {
                    // No user account but active - pending invitation
                    $practitioner->invitation_status = 'PENDING_INVITATION';
                } else {
                    // Inactive
                    $practitioner->invitation_status = 'DECLINED';
                }

                return $practitioner;
            });

            return $practitioners;

        } catch (\Exception $e) {
            Log::error('Error in getPractitioners: '.$e->getMessage());

            // Return empty paginated collection on error
            return new LengthAwarePaginator(
                collect([]), // items
                0, // total
                10, // perPage
                1, // currentPage
                ['path' => request()->url()]
            );
        }
    }

    /**
     * Get invitations data for current tenant
     */
    private function getInvitations(Request $request)
    {
        $currentTenantId = tenant('id');

        $query = \App\Models\PractitionerInvitation::where('tenant_id', $currentTenantId)
            ->with(['practitioner', 'tenant']);

        // Apply search filter if provided
        if ($request->has('search') && ! empty($request->search)) {
            $search = $request->search;

            // Get practitioner IDs from central database that match search criteria
            $matchingPractitionerIds = tenancy()->central(function () use ($search) {
                return \App\Models\Practitioner::whereBlind('first_name', 'first_name_index', $search)
                    ->orWhereBlind('last_name', 'last_name_index', $search)
                    ->orWhereBlind('email', 'email_index', $search)
                    ->orWhereBlind('license_number', 'license_number_index', $search)
                    ->pluck('id')
                    ->toArray();
            });

            // Filter by matching practitioner IDs
            if (! empty($matchingPractitionerIds)) {
                $query->whereIn('practitioner_id', $matchingPractitionerIds);
            } else {
                // If no matches found, return empty result
                $query->where('practitioner_id', -1);
            }
        }

        $perPage = $request->get('perPage', 10);
        $invitations = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Transform the data to include practitioner name and additional info
        $invitations->getCollection()->transform(function ($invitation) {
            // Look up practitioner from tenant database if practitioner_id exists
            if ($invitation->practitioner_id) {
                $practitioner = Practitioner::find($invitation->practitioner_id);

                if ($practitioner) {
                    $invitation->practitioner_name = $practitioner->first_name.' '.$practitioner->last_name;
                    $invitation->practitioner_email = $practitioner->email;
                    $invitation->practitioner_title = $practitioner->title;
                } else {
                    // Practitioner not found in tenant database
                    $invitation->practitioner_name = 'Unknown';
                    $invitation->practitioner_email = $invitation->email ?? 'N/A';
                    $invitation->practitioner_title = null;
                }
            } else {
                // Email-only invitation
                $invitation->practitioner_name = 'Email Invitation';
                $invitation->practitioner_email = $invitation->email;
                $invitation->practitioner_title = null;
            }

            $invitation->is_expired = $invitation->isExpired();
            $invitation->expires_in_days = now()->diffInDays($invitation->expires_at, false);

            return $invitation;
        });

        return $invitations;
    }

    /**
     * Get locations data with related information
     */
    private function getLocations(Request $request)
    {
        // Load locations with only tenant database relationships (excluding soft deleted)
        $locations = Location::orderBy('name')
            ->get();

        // Get practitioner assignments from the pivot table (tenant database)
        $practitionerAssignments = DB::table('location_practitioners')
            ->where('is_assigned', true)
            ->get()
            ->groupBy('location_id');

        $locations = $locations->map(function ($location) use ($practitionerAssignments) {
            // Count assigned practitioners for this location
            $assignedPractitionersCount = isset($practitionerAssignments[$location->id])
? $practitionerAssignments[$location->id]->count()
                : 0;

            return [
                'id' => $location->id,
                'name' => $location->name,
                'timezone' => $location->timezone,
                'address_lookup' => $location->address_lookup,
                'street_address' => $location->street_address,
                'apt_suite_unit' => $location->apt_suite_unit,
                'city' => $location->city,
                'postal_zip_code' => $location->postal_zip_code,
                'province' => $location->province,
                'phone_number' => $location->phone_number,
                'email_address' => $location->email_address,
                'is_active' => $location->is_active,
                'status' => $location->is_active ? 'Active' : 'Inactive',
                'full_address' => $location->full_address,
                'practitioners_count' => $assignedPractitionersCount,
                'operating_hours_count' => 0,
                'operating_hours' => [],
            ];
        });

        return [
            'data' => $locations,
            'total' => $locations->count(),
            'timezones' => $this->getTimezones(),
            'provinces' => $this->getProvinces(),
            'cities' => $this->getCities(),
        ];
    }

    /**
     * Get available timezones
     */
    private function getTimezones(): array
    {
        return [
            // North American Time Zones
            ['value' => 'America/Toronto', 'label' => 'Eastern Time (GMT-5) - Toronto, Ottawa, Montreal'],
            ['value' => 'America/New_York', 'label' => 'Eastern Time (GMT-5) - New York'],
            ['value' => 'America/Chicago', 'label' => 'Central Time (GMT-6) - Winnipeg, Chicago'],
            ['value' => 'America/Denver', 'label' => 'Mountain Time (GMT-7) - Calgary, Edmonton, Denver'],
            ['value' => 'America/Vancouver', 'label' => 'Pacific Time (GMT-8) - Vancouver, Seattle'],
            ['value' => 'America/Los_Angeles', 'label' => 'Pacific Time (GMT-8) - Los Angeles'],
            ['value' => 'America/Halifax', 'label' => 'Atlantic Time (GMT-4) - Halifax, Moncton'],
            ['value' => 'America/St_Johns', 'label' => 'Newfoundland Time (GMT-3:30) - St. Johns'],

            // Other Common Time Zones
            ['value' => 'UTC', 'label' => 'UTC (GMT+0) - Coordinated Universal Time'],
            ['value' => 'Europe/London', 'label' => 'GMT (GMT+0) - London'],
            ['value' => 'Europe/Paris', 'label' => 'CET (GMT+1) - Paris, Berlin'],
            ['value' => 'Asia/Tokyo', 'label' => 'JST (GMT+9) - Tokyo'],
            ['value' => 'Australia/Sydney', 'label' => 'AEST (GMT+10) - Sydney'],
            ['value' => 'Pacific/Auckland', 'label' => 'NZST (GMT+12) - Auckland'],
        ];
    }

    /**
     * Get Canadian provinces
     */
    private function getProvinces(): array
    {
        return [
            ['value' => 'AB', 'label' => 'Alberta'],
            ['value' => 'BC', 'label' => 'British Columbia'],
            ['value' => 'MB', 'label' => 'Manitoba'],
            ['value' => 'NB', 'label' => 'New Brunswick'],
            ['value' => 'NL', 'label' => 'Newfoundland and Labrador'],
            ['value' => 'NS', 'label' => 'Nova Scotia'],
            ['value' => 'NT', 'label' => 'Northwest Territories'],
            ['value' => 'NU', 'label' => 'Nunavut'],
            ['value' => 'ON', 'label' => 'Ontario'],
            ['value' => 'PE', 'label' => 'Prince Edward Island'],
            ['value' => 'QC', 'label' => 'Quebec'],
            ['value' => 'SK', 'label' => 'Saskatchewan'],
            ['value' => 'YT', 'label' => 'Yukon'],
        ];
    }

    /**
     * Get Canadian cities by province
     */
    private function getCities(): array
    {
        return [
            'AB' => [
                'Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Medicine Hat',
                'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Leduc', 'Lloydminster',
                'Camrose', 'Fort McMurray', 'Beaumont', 'St. Albert', 'Sherwood Park',
            ],
            'BC' => [
                'Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond',
                'Abbotsford', 'Coquitlam', 'Kelowna', 'Saanich', 'Langley',
                'Delta', 'North Vancouver', 'Kamloops', 'Nanaimo', 'Chilliwack',
                'Prince George', 'Vernon', 'Courtenay', 'Penticton', 'Campbell River',
            ],
            'MB' => [
                'Winnipeg', 'Brandon', 'Steinbach', 'Portage la Prairie', 'Thompson',
                'Winkler', 'Selkirk', 'Morden', 'Dauphin', 'The Pas',
                'Flin Flon', 'Swan River', 'Stonewall', 'Beausejour', 'Gimli',
            ],
            'NB' => [
                'Saint John', 'Moncton', 'Fredericton', 'Dieppe', 'Riverview',
                'Campbellton', 'Edmundston', 'Bathurst', 'Miramichi', 'Sackville',
                'Caraquet', 'Sussex', 'Woodstock', 'Shediac', 'Oromocto',
            ],
            'NL' => [
                'St. Johns', 'Mount Pearl', 'Corner Brook', 'Conception Bay South', 'Grand Falls-Windsor',
                'Paradise', 'Happy Valley-Goose Bay', 'Gander', 'Labrador City', 'Stephenville',
                'Torbay', 'Bay Roberts', 'Clarenville', 'Deer Lake', 'Carbonear',
            ],
            'NS' => [
                'Halifax', 'Sydney', 'Dartmouth', 'Truro', 'New Glasgow',
                'Glace Bay', 'Yarmouth', 'Kentville', 'Amherst', 'Bridgewater',
                'Antigonish', 'Wolfville', 'Digby', 'Pictou', 'Shelburne',
            ],
            'NT' => [
                'Yellowknife', 'Hay River', 'Inuvik', 'Fort Smith', 'Behchoko',
                'Tuktoyaktuk', 'Norman Wells', 'Fort Simpson', 'Fort Good Hope', 'Fort Providence',
            ],
            'NU' => [
                'Iqaluit', 'Rankin Inlet', 'Arviat', 'Baker Lake', 'Cambridge Bay',
                'Igloolik', 'Pangnirtung', 'Pond Inlet', 'Kugluktuk', 'Cape Dorset',
            ],
            'ON' => [
                'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton',
                'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
                'Richmond Hill', 'Oakville', 'Burlington', 'Oshawa', 'Barrie',
                'St. Catharines', 'Cambridge', 'Kingston', 'Guelph', 'Thunder Bay',
                'Waterloo', 'Sudbury', 'Sault Ste. Marie', 'Sarnia', 'Peterborough',
                'Niagara Falls', 'Brantford', 'Pickering', 'Ajax', 'Whitby',
            ],
            'PE' => [
                'Charlottetown', 'Summerside', 'Stratford', 'Cornwall', 'Montague',
                'Kensington', 'Souris', 'Alberton', 'Georgetown', 'Tignish',
            ],
            'QC' => [
                'Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil',
                'Sherbrooke', 'Saguenay', 'Lévis', 'Trois-Rivières', 'Terrebonne',
                'Saint-Jean-sur-Richelieu', 'Repentigny', 'Brossard', 'Drummondville', 'Saint-Jérôme',
                'Granby', 'Blainville', 'Saint-Hyacinthe', 'Shawinigan', 'Dollard-des-Ormeaux',
            ],
            'SK' => [
                'Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current',
                'Yorkton', 'North Battleford', 'Estevan', 'Weyburn', 'Lloydminster',
                'Martensville', 'Warman', 'Meadow Lake', 'Kindersley', 'Melfort',
            ],
            'YT' => [
                'Whitehorse', 'Dawson City', 'Watson Lake', 'Haines Junction', 'Mayo',
                'Carmacks', 'Faro', 'Teslin', 'Old Crow', 'Beaver Creek',
            ],
        ];
    }

    /**
     * Get services data (can be used by other methods)
     */
    private function getServices(Request $request)
    {
        // Query excludes soft deleted services by default due to SoftDeletes trait
        $query = Service::query();

        // Handle search functionality
        if ($request->has('search') && ! empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('category', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('description', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Apply pagination
        $perPage = $request->get('perPage', 10);
        $services = $query->orderBy('name')->paginate($perPage);

        return $services;
    }

    /**
     * Get integrations data
     */
    private function getIntegrations()
    {
        // Get all existing integrations
        $existingIntegrations = Integration::all()->keyBy('provider');

        // Get default tenant-level integrations and merge with existing data
        $defaultIntegrations = Integration::getDefaultTenantIntegrations();

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

        return [
            'data' => $integrations->values(),
            'stats' => [
                'total' => $integrations->count(),
                'connected' => $integrations->where('is_active', true)->count(),
                'calendar' => $integrations->where('type', Integration::TYPE_CALENDAR)->count(),
                'payment' => $integrations->where('type', Integration::TYPE_PAYMENT)->count(),
                'communication' => $integrations->where('type', Integration::TYPE_COMMUNICATION)->count(),
            ],
        ];
    }

    /**
     * Display the subscription page with Billing and Payment Setup tabs
     */
    public function subscription(Request $request)
    {
        $tenant = tenancy()->tenant;
        $stripeConnectService = app(StripeConnectService::class);

        // Refresh requirements from Stripe if account exists
        if ($tenant->stripe_account_id) {
            $stripeConnectService->refreshAccountRequirements($tenant);
            $tenant->refresh();
        }

        // Get subscription plan
        $subscriptionPlan = $tenant->subscriptionPlan;

        // Get all practitioners with their license status
        $allPractitioners = Practitioner::where('is_active', true)
            ->with(['licenses' => function ($query) {
                $query->where('status', 'assigned');
            }])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name', 'email'])
            ->map(function ($practitioner) {
                $license = $practitioner->licenses->first();
                return [
                    'id' => $practitioner->id,
                    'first_name' => $practitioner->first_name,
                    'last_name' => $practitioner->last_name,
                    'email' => $practitioner->email,
                    'has_license' => $license !== null,
                    'license_id' => $license ? $license->id : null,
                ];
            })
            ->values()
            ->toArray();

        // Get available licenses for assignment
        $availableLicenses = License::where('status', 'available')
            ->orderBy('created_at', 'desc')
            ->get(['id', 'license_key', 'status'])
            ->toArray();

        return Inertia::render('settings/subscription', [
            // Payment Setup props
            'tenant' => $tenant,
            'stripeRequirements' => $tenant->stripe_requirements ?? [],
            'isOnboardingComplete' => $tenant->stripe_onboarding_complete,
            'canAcceptPayments' => $tenant->stripe_account_id ?
                $stripeConnectService->canAcceptPayments($tenant) : false,
            'canReceivePayouts' => $tenant->stripe_account_id ?
                $stripeConnectService->canReceivePayouts($tenant) : false,
            // Billing props
            'subscriptionPlan' => $subscriptionPlan ? [
                'id' => $subscriptionPlan->id,
                'name' => $subscriptionPlan->name,
                'slug' => $subscriptionPlan->slug,
                'price' => (float) $subscriptionPlan->price,
                'currency' => $subscriptionPlan->currency,
                'billing_interval' => $subscriptionPlan->billing_interval,
                'billing_interval_count' => $subscriptionPlan->billing_interval_count,
                'description' => $subscriptionPlan->description,
                'features' => $subscriptionPlan->features,
            ] : null,
            'numberOfSeats' => $tenant->number_of_seats ?? 0,
            'allPractitioners' => $allPractitioners,
            'availableLicenses' => $availableLicenses,
        ]);
    }

    /**
     * Future methods for other settings sections can be added here:
     *
     * private function getOrganizations()
     * {
     *     // Logic to fetch organization data
     * }
     */
}
