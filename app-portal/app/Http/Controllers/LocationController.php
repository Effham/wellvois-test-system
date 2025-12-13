<?php

namespace App\Http\Controllers;

use App\Http\Resources\PractitionerMinimalResource;
use App\Models\Location;
use App\Models\Practitioner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class LocationController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-location')->only(['index', 'show']);
        $this->middleware('permission:add-location')->only(['create', 'store']);
        $this->middleware('permission:update-location')->only(['edit', 'update']);
        $this->middleware('permission:delete-location')->only('destroy');
    }

    /**
     * Display a listing of the locations.
     */
    public function index()
    {
        // Load locations with only tenant database relationships
        $locations = Location::select('id', 'name', 'city', 'province', 'timezone', 'is_active')
            ->orderBy('name')
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
                'city' => $location->city,
                'province' => $location->province,
                'timezone' => $location->timezone,
                'is_active' => $location->is_active,
                'status' => $location->is_active ? 'Active' : 'Inactive',
                'practitioners_count' => $assignedPractitionersCount,
            ];
        });

        return response()->json([
            'locations' => $locations,
        ]);
    }

    /**
     * Show the form for creating a new location.
     */
    public function create()
    {
        return response()->json([
            'timezones' => $this->getTimezones(),
            'provinces' => $this->getProvinces(),
            'cities' => $this->getCities(),
        ]);
    }

    /**
     * Show the form for creating a new location during onboarding (returns Inertia view).
     */
    public function onboardingCreate(Request $request)
    {
        // Fetch existing non-virtual locations
        $existingLocations = Location::where('name', '!=', 'Virtual')
            ->select([
                'id',
                'name',
                'timezone',
                'address_lookup', // Assuming this field is stored
                'street_address',
                'apt_suite_unit',
                'city',
                'postal_zip_code',
                'province',
                'phone_number',
                'email_address',
                'is_active',
            ])
            ->get();

        // Get hasMultipleLocations from URL parameter or OrganizationSettings
        $hasMultipleLocations = $request->query('hasMultipleLocations');
        if ($hasMultipleLocations === null) {
            $hasMultipleLocations = \App\Models\OrganizationSetting::getValue('has_multiple_locations', 'false') === 'true' ? 'true' : 'false';
        }

        return Inertia::render('onboarding-location-create', [
            'existingLocations' => $existingLocations,
            'hasMultipleLocations' => $hasMultipleLocations === 'true',
        ]);
    }

    /**
     * Store a newly created location in storage.
     */
    public function store(Request $request)
    {
        Log::info('LocationController::store - Request received', [
            'all_data' => $request->all(),
            'method' => $request->method(),
            'url' => $request->url(),
        ]);

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'timezone' => 'required|string',
                'address_lookup' => 'required|string|max:500',
                'street_address' => 'required|string|max:255',
                'apt_suite_unit' => 'nullable|string|max:50',
                'city' => 'required|string|max:100',
                'postal_zip_code' => 'required|string|max:20',
                'province' => 'required|string',
                'phone_number' => 'required|string|max:20',
                'email_address' => 'required|email|max:255',
                'is_active' => 'boolean',
            ]);

            Log::info('LocationController::store - Validation passed', [
                'validated_data' => $validated,
            ]);

            $location = Location::create($validated);

            Log::info('LocationController::store - Location created successfully', [
                'location_id' => $location->id,
                'location_name' => $location->name,
            ]);

            // Check if onboarding is complete (check if all required steps are done)
            $appointmentType = \App\Models\OrganizationSetting::getValue('appointment_type', null);
            $locationCount = \App\Models\Location::where('name', '!=', 'Virtual')->count();
            $serviceCount = \App\Models\Service::count();

            // Determine required steps based on questionnaire answers
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
                        if ($locationCount === 0) {
                            $isComplete = false;
                        }
                        break;
                    case 'service':
                        if ($serviceCount === 0) {
                            $isComplete = false;
                        }
                        break;
                }
            }

            // If all required steps are complete, check next step
            if ($isComplete) {
                // Redirect to onboarding index to determine next step (services or practitioner)
                return redirect()->route('onboarding.index')
                    ->with('success', 'Location created successfully!');
            }

            // Redirect to next step: services (location is now complete)
            return redirect()->route('onboarding.service.create')
                ->with('success', 'Location created successfully!');

            return redirect()->route('settings.locations', [
                'tab' => 'basic-info',
                'location' => $location->id,
            ])->with('success', 'Location created successfully!');
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('LocationController::store - Validation failed', [
                'errors' => $e->errors(),
                'input' => $request->all(),
            ]);
            throw $e;
        } catch (\Exception $e) {
            Log::error('LocationController::store - Exception caught', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()
                ->withErrors(['error' => $e->getMessage()])
                ->withInput();
        }
    }

    /**
     * Display the specified location.
     */
    public function show(Location $location)
    {
        return Inertia::render('settings/Location/Show', [
            'location' => $location->toArray(),
            'timezones' => $this->getTimezones(),
            'provinces' => $this->getProvinces(),
            'cities' => $this->getCities(),
        ]);
    }

    /**
     * Show the form for editing the specified location.
     */
    public function edit(Location $location)
    {
        return $this->show($location);
    }

    /**
     * Update the specified location in storage.
     */
    public function update(Request $request, Location $location)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'timezone' => 'required|string',
            'address_lookup' => 'required|string|max:500',
            'street_address' => 'required|string|max:255',
            'apt_suite_unit' => 'nullable|string|max:50',
            'city' => 'required|string|max:100',
            'postal_zip_code' => 'required|string|max:20',
            'province' => 'required|string',
            'phone_number' => 'required|string|max:20',
            'email_address' => 'required|email|max:255',
            'is_active' => 'boolean',
        ]);

        $location->update($validated);

        return redirect()->route('settings.locations', [
            'tab' => 'basic-info',
            'location' => $location->id,
        ])->with('success', 'Location updated successfully!');
    }

    /**
     * Remove the specified location from storage.
     */
    public function destroy(Location $location)
    {
        $location->delete(); // This will now be a soft delete

        return redirect()->route('settings.locations')
            ->with('success', 'Location archived successfully!');
    }

    /**
     * Display archived locations
     */
    public function archived(Request $request)
    {
        $query = Location::onlyTrashed();

        // Apply search filter if provided
        if ($request->has('search') && ! empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('city', 'like', '%'.$search.'%')
                    ->orWhere('province', 'like', '%'.$search.'%')
                    ->orWhere('street_address', 'like', '%'.$search.'%');
            });
        }

        $perPage = $request->get('perPage', 10);
        $locations = $query->orderBy('deleted_at', 'desc')->paginate($perPage);

        return Inertia::render('settings/Location/Archived', [
            'locations' => $locations,
            'filters' => [
                'search' => $request->search,
                'perPage' => $perPage,
            ],
        ]);
    }

    /**
     * Restore an archived location
     */
    public function restore($id)
    {
        $location = Location::onlyTrashed()->findOrFail($id);
        $location->restore();

        return redirect()->route('locations.archived')
            ->with('success', 'Location restored successfully.');
    }

    /**
     * Permanently delete a location
     */
    public function forceDelete($id)
    {
        $location = Location::onlyTrashed()->findOrFail($id);
        $location->forceDelete();

        return redirect()->route('locations.archived')
            ->with('success', 'Location permanently deleted.');
    }

    /**
     * Update practitioner assignments for a location
     */
    public function updatePractitioners(Request $request, Location $location)
    {
        try {
            $validated = $request->validate([
                'practitioners' => 'required|array',
                'practitioners.*.id' => 'required|integer',
                'practitioners.*.is_assigned' => 'required|boolean',
            ]);

            // 🚀 NEW: Validate practitioner IDs exist using CentralConnection trait
            $practitionerIds = collect($validated['practitioners'])->pluck('id')->unique();
            $existingIds = Practitioner::whereIn('id', $practitionerIds)->pluck('id');
            $missingIds = $practitionerIds->diff($existingIds);

            if ($missingIds->isNotEmpty()) {
                throw new \Illuminate\Validation\ValidationException(
                    validator([], []),
                    ['practitioners' => 'One or more practitioner IDs do not exist: '.$missingIds->implode(', ')]
                );
            }

            foreach ($validated['practitioners'] as $practitionerData) {
                // Update or insert practitioner assignment in pivot table (tenant DB)
                DB::table('location_practitioners')->updateOrInsert(
                    [
                        'location_id' => $location->id,
                        'practitioner_id' => $practitionerData['id'],
                    ],
                    [
                        'is_assigned' => $practitionerData['is_assigned'],
                        'updated_at' => now(),
                    ]
                );
            }

            return redirect()->route('settings.locations', [
                'tab' => 'practitioners',
                'location' => $location->id,
            ])->with('success', 'Practitioner assignments updated successfully!');
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Re-throw validation exceptions so Inertia can handle them properly
            throw $e;
        } catch (\Exception $e) {
            Log::error('Error updating practitioner assignments', [
                'location_id' => $location->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->route('settings.locations', [
                'tab' => 'practitioners',
                'location' => $location->id,
            ])->with('error', 'Failed to update practitioner assignments. Please try again.');
        }
    }

    /**
     * Get all practitioners (for new locations) - only show practitioners linked to current tenant
     */
    public function getAllPractitioners()
    {
        $currentTenantId = tenant('id');

        // Get all practitioners from tenant database
        $practitioners = Practitioner::all();

        $practitioners = PractitionerMinimalResource::collection($practitioners)
            ->map(function ($practitioner) {
                $practitionerData = [
                    'id' => $practitioner['id'],
                    'first_name' => $practitioner['first_name'],
                    'last_name' => $practitioner['last_name'],
                    'full_name' => $practitioner['full_name'],
                    'display_name' => $practitioner['display_name'],
                    'title' => $practitioner['title'],
                    'email' => $practitioner['email'],
                    'is_assigned' => false, // No assignments for new locations
                ];

                // Generate profile picture proxy URL if S3 key exists
                if (isset($practitioner['profile_picture_s3_key']) && $practitioner['profile_picture_s3_key']) {
                    $cacheBuster = substr(md5($practitioner['profile_picture_s3_key']), 0, 8);
                    $practitionerData['profile_picture_url'] = url("/profile-picture-proxy/{$practitioner['id']}?v={$cacheBuster}");
                }

                return $practitionerData;
            });

        return response()->json([
            'practitioners' => $practitioners,
        ]);
    }

    /**
     * Get practitioners for a location - only show practitioners linked to current tenant
     */
    public function getPractitioners(Location $location)
    {
        // Get location practitioners assignments (from tenant DB pivot table)
        $locationPractitioners = DB::table('location_practitioners')
            ->where('location_id', $location->id)
            ->get()
            ->pluck('is_assigned', 'practitioner_id');

        $currentTenantId = tenant('id');

        // Get all practitioners from tenant database
        $practitioners = Practitioner::all();

        $practitioners = PractitionerMinimalResource::collection($practitioners)
            ->map(function ($practitioner) use ($locationPractitioners) {
                $practitionerData = [
                    'id' => $practitioner['id'],
                    'first_name' => $practitioner['first_name'],
                    'last_name' => $practitioner['last_name'],
                    'full_name' => $practitioner['full_name'],
                    'display_name' => $practitioner['display_name'],
                    'title' => $practitioner['title'],
                    'email' => $practitioner['email'],
                    'is_assigned' => $locationPractitioners->get($practitioner['id'], false),
                ];

                // Generate profile picture proxy URL if S3 key exists
                if (isset($practitioner['profile_picture_s3_key']) && $practitioner['profile_picture_s3_key']) {
                    $cacheBuster = substr(md5($practitioner['profile_picture_s3_key']), 0, 8);
                    $practitionerData['profile_picture_url'] = url("/profile-picture-proxy/{$practitioner['id']}?v={$cacheBuster}");
                }

                return $practitionerData;
            });

        return response()->json([
            'practitioners' => $practitioners,
        ]);
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
     * Store multiple locations at once (for onboarding)
     */
    public function storeMultiple(Request $request)
    {
        Log::info('LocationController::storeMultiple - Request received', [
            'locations_count' => count($request->input('locations', [])),
        ]);

        try {
            $locationsData = $request->validate([
                'locations' => 'required|array|min:1',
                'locations.*.id' => 'nullable|integer|exists:locations,id',
                'locations.*.name' => 'required|string|max:255',
                'locations.*.timezone' => 'required|string',
                'locations.*.address_lookup' => 'required|string|max:500',
                'locations.*.street_address' => 'required|string|max:255',
                'locations.*.apt_suite_unit' => 'nullable|string|max:50',
                'locations.*.city' => 'required|string|max:100',
                'locations.*.postal_zip_code' => 'required|string|max:20',
                'locations.*.province' => 'required|string',
                'locations.*.phone_number' => 'required|string|max:20',
                'locations.*.email_address' => 'required|email|max:255',
                'locations.*.is_active' => 'boolean',
            ]);

            DB::beginTransaction();

            $createdLocations = [];
            foreach ($locationsData['locations'] as $locationData) {
                // Determine if we are updating an existing location or creating a new one
                if (isset($locationData['id']) && $locationData['id']) {
                    $location = Location::find($locationData['id']);
                    if ($location) {
                        $location->update($locationData);
                    } else {
                        // Fallback if ID not found (should be caught by validation, but safe constraint)
                        $location = Location::create($locationData);
                    }
                } else {
                    $location = Location::create($locationData);
                }
                $createdLocations[] = $location;
            }

            DB::commit();

            Log::info('LocationController::storeMultiple - Locations created successfully', [
                'count' => count($createdLocations),
            ]);

            // Check if onboarding is complete (check if all required steps are done)
            $appointmentType = \App\Models\OrganizationSetting::getValue('appointment_type', null);
            $locationCount = \App\Models\Location::where('name', '!=', 'Virtual')->count();
            $serviceCount = \App\Models\Service::count();

            // Determine required steps based on questionnaire answers
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
                        if ($locationCount === 0) {
                            $isComplete = false;
                        }
                        break;
                    case 'service':
                        if ($serviceCount === 0) {
                            $isComplete = false;
                        }
                        break;
                }
            }

            // Redirect to practitioner availability setup (location creation complete)
            return redirect()->route('onboarding.practitioner-availability')
                ->with('success', count($createdLocations).' location(s) created successfully!');
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('LocationController::storeMultiple - Validation failed', [
                'errors' => $e->errors(),
            ]);
            throw $e;
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('LocationController::storeMultiple - Exception caught', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()
                ->withErrors(['error' => $e->getMessage()])
                ->withInput();
        }
    }
}
