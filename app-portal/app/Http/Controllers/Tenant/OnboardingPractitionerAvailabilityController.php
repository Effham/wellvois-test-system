<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Practitioner;
use App\Models\PractitionerAvailability;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class OnboardingPractitionerAvailabilityController extends Controller
{
    /**
     * Show the practitioner availability setup page for onboarding
     */
    public function index()
    {
        // Get current user's practitioner record from tenant database
        $currentUser = Auth::user();
        $practitioner = Practitioner::where('user_id', $currentUser->id)->first();

        if (! $practitioner) {
            return redirect()->route('dashboard')
                ->with('error', 'Practitioner record not found.');
        }

        // Get appointment type to determine if virtual location is needed
        $appointmentType = OrganizationSetting::getValue('appointment_type', 'in-person');

        // Ensure virtual location exists for virtual/hybrid appointment types
        if (in_array($appointmentType, ['virtual', 'hybrid'])) {
            $virtualLocation = Location::where('name', 'Virtual')->first();
            if (! $virtualLocation) {
                // Create virtual location if it doesn't exist
                $virtualLocation = Location::create([
                    'name' => 'Virtual',
                    'timezone' => 'America/Toronto',
                    'is_active' => true,
                ]);
                Log::info('[ONBOARDING] Created virtual location for availability setup', [
                    'location_id' => $virtualLocation->id,
                    'tenant_id' => tenant('id'),
                ]);
            }
        }

        // Get all locations (virtual and physical) for this tenant
        $locations = Location::select([
            'id',
            'name',
            'street_address',
            'city',
            'province',
            'timezone',
        ])->get();

        // Get existing availability for this practitioner
        $existingAvailability = PractitionerAvailability::where('practitioner_id', $practitioner->id)
            ->get()
            ->groupBy('location_id');

        // Format locations with their existing schedules
        $locationsWithSchedule = $locations->map(function ($location) use ($existingAvailability) {
            $schedule = [];
            $daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            foreach ($daysOfWeek as $day) {
                $dayLower = strtolower($day);
                $daySlots = $existingAvailability->get($location->id, collect())
                    ->where('day', $dayLower)
                    ->map(function ($slot) {
                        return [
                            'startTime' => substr($slot->start_time, 0, 5), // HH:MM
                            'endTime' => substr($slot->end_time, 0, 5),
                        ];
                    })
                    ->values()
                    ->toArray();

                $schedule[] = [
                    'day' => $day,
                    'isAvailable' => count($daySlots) > 0,
                    'timeSlots' => $daySlots,
                ];
            }

            return [
                'id' => $location->id,
                'name' => $location->name,
                'address' => $location->street_address,
                'city' => $location->city,
                'province' => $location->province,
                'timezone' => $location->timezone,
                'schedule' => $schedule,
                'hasSchedule' => $existingAvailability->has($location->id),
            ];
        });

        // Get appointment type to determine next route
        $appointmentType = OrganizationSetting::getValue('appointment_type', 'in-person');

        // Check if services exist to determine next step
        $serviceCount = Service::count();
        $nextRoute = $serviceCount === 0
            ? route('onboarding.service.create')
            : route('onboarding.index'); // Will check completion and redirect to dashboard

        return Inertia::render('LocationService/Index', [
            'locations' => $locationsWithSchedule,
            'practitionerId' => $practitioner->id, // Pass tenant practitioner ID
            'practitioner' => [
                'id' => $practitioner->id,
            ],
            'appointmentType' => $appointmentType,
            'nextRoute' => $nextRoute,
            'shouldCompleteOnboarding' => $serviceCount > 0, // Flag to indicate if onboarding should be completed
        ]);
    }

    /**
     * Store practitioner availability during onboarding
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'practitioner_id' => 'required|integer',
            'location_id' => 'required|integer|exists:locations,id',
            'schedule' => 'required|array',
            'schedule.*.day' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'schedule.*.isAvailable' => 'required|boolean',
            'schedule.*.timeSlots' => 'array',
            'schedule.*.timeSlots.*.startTime' => 'required|string',
            'schedule.*.timeSlots.*.endTime' => 'required|string',
        ]);

        // Verify practitioner exists in tenant database and belongs to current user
        $currentUser = Auth::user();
        $practitioner = Practitioner::where('id', $validated['practitioner_id'])
            ->where('user_id', $currentUser->id)
            ->first();

        if (! $practitioner) {
            return response()->json([
                'success' => false,
                'error' => 'Practitioner not found or access denied',
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Delete existing availability for this practitioner and location
            PractitionerAvailability::where('practitioner_id', $validated['practitioner_id'])
                ->where('location_id', $validated['location_id'])
                ->delete();

            // Create new availability records
            foreach ($validated['schedule'] as $daySchedule) {
                if ($daySchedule['isAvailable'] && isset($daySchedule['timeSlots']) && count($daySchedule['timeSlots']) > 0) {
                    foreach ($daySchedule['timeSlots'] as $slot) {
                        PractitionerAvailability::create([
                            'practitioner_id' => $validated['practitioner_id'],
                            'location_id' => $validated['location_id'],
                            'day' => strtolower($daySchedule['day']),
                            'start_time' => $slot['startTime'].':00', // Add seconds
                            'end_time' => $slot['endTime'].':00',
                        ]);
                    }
                }
            }

            // Automatically assign location to practitioner when availability is set
            DB::table('location_practitioners')->updateOrInsert(
                [
                    'location_id' => $validated['location_id'],
                    'practitioner_id' => $validated['practitioner_id'],
                ],
                [
                    'is_assigned' => true,
                    'updated_at' => now(),
                ]
            );

            DB::commit();

            Log::info('[ONBOARDING] Practitioner availability saved and location assigned', [
                'practitioner_id' => $validated['practitioner_id'],
                'location_id' => $validated['location_id'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Availability saved successfully',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[ONBOARDING] Failed to save practitioner availability', [
                'error' => $e->getMessage(),
                'practitioner_id' => $validated['practitioner_id'],
                'location_id' => $validated['location_id'],
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to save availability',
            ], 500);
        }
    }
}
