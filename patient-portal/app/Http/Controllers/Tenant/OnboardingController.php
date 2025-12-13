<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Practitioner;
use App\Models\PractitionerAvailability;
use App\Models\Service;
use App\Models\Tenant;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    /**
     * Show the onboarding questionnaire page
     */
    public function questionnaire()
    {
        $tenantId = tenant('id');

        // Get subscription quantity from central database
        $numberOfSeats = tenancy()->central(function () use ($tenantId) {
            return Tenant::find($tenantId)?->number_of_seats ?? 1;
        });

        // Determine practice type based on quantity
        $practiceType = $numberOfSeats === 1 ? 'solo' : 'group';

        // Auto-save practice type to OrganizationSettings if not already set
        $existingPracticeType = OrganizationSetting::getValue('practice_type', null);
        if (! $existingPracticeType) {
            OrganizationSetting::setValue('practice_type', $practiceType);
            Log::info('[ONBOARDING] Auto-set practice type from subscription quantity', [
                'tenant_id' => $tenantId,
                'number_of_seats' => $numberOfSeats,
                'practice_type' => $practiceType,
            ]);
        } else {
            // Use existing practice type if already set
            $practiceType = $existingPracticeType;
        }

        $appointmentType = OrganizationSetting::getValue('appointment_type', null);

        return Inertia::render('onboarding-questionnaire', [
            'practiceType' => $practiceType,
            'appointmentType' => $appointmentType,
            'numberOfSeats' => $numberOfSeats,
        ]);
    }

    /**
     * Main onboarding entry point - redirects to next incomplete step
     */
    public function index()
    {
        // Check if questionnaire is completed
        $practiceType = OrganizationSetting::getValue('practice_type', null);
        $appointmentType = OrganizationSetting::getValue('appointment_type', null);
        $hasCompletedQuestionnaire = $practiceType && $appointmentType;

        // If questionnaire not completed, redirect to questionnaire
        if (! $hasCompletedQuestionnaire) {
            return redirect()->route('onboarding.questionnaire');
        }

        // Check current onboarding status
        $locationCount = Location::where('name', '!=', 'Virtual')->count();
        $serviceCount = Service::count();

        // Determine next step based on appointment type and completion status
        if ($appointmentType !== 'virtual' && $locationCount === 0) {
            // Need location for hybrid/in-person
            $hasMultipleLocations = OrganizationSetting::getValue('has_multiple_locations', 'false') === 'true';

            return redirect()->route('onboarding.location.create', [
                'hasMultipleLocations' => $hasMultipleLocations ? 'true' : 'false',
                'onboarding' => 'true',
            ]);
        }

        if ($serviceCount === 0) {
            // Need service
            return redirect()->route('onboarding.service.create');
        }

        // Check practitioner step (unified flow for solo and group practice)
        $practitionerUserId = OrganizationSetting::getValue('practitioner_user_id', null);
        $isPractitioner = OrganizationSetting::getValue('is_practitioner', null);

        if ($isPractitioner === null) {
            // Haven't answered "Are you a practitioner?" question yet
            return redirect()->route('onboarding.practitioner.questions');
        }

        if ($isPractitioner === 'true') {
            // User is a practitioner, check timing preference
            $registerTiming = OrganizationSetting::getValue('practitioner_register_timing', null);

            if ($registerTiming === null) {
                // Haven't answered "Register now or later?" question yet - redirect to combined page
                return redirect()->route('onboarding.practitioner.questions');
            }

            if ($registerTiming === 'now' && ! $practitionerUserId) {
                // User chose "now" but hasn't registered yet
                return redirect()->route('onboarding.practitioner.create');
            }
        }

        // Check if practitioner needs to set availability
        if ($practitionerUserId) {
            $currentUser = Auth::user();
            if ($currentUser && $currentUser->id == $practitionerUserId) {
                // Get tenant practitioner record
                $practitioner = Practitioner::where('user_id', $currentUser->id)->first();

                if ($practitioner) {
                    // Check if locations exist
                    $totalLocations = Location::count();

                    if ($totalLocations > 0) {
                        // Check if practitioner has availability set for any location
                        $hasAvailability = PractitionerAvailability::where('practitioner_id', $practitioner->id)
                            ->exists();

                        if (! $hasAvailability) {
                            // Redirect to availability setup
                            return redirect()->route('onboarding.practitioner-availability');
                        }
                    }
                    // If no locations exist, skip availability check (can't set availability without locations)
                }
            }
        }

        // All steps complete - mark onboarding as complete
        OrganizationSetting::setValue('isOnboardingComplete', 'true');

        Log::info('[ONBOARDING] All steps completed, marking onboarding as complete', [
            'tenant_id' => tenant('id'),
        ]);

        return redirect()->route('dashboard')
            ->with('success', 'Onboarding completed successfully!');
    }

    /**
     * Check if current user is admin+practitioner (multi-role)
     */
    private function isUserAdminPlusPractitioner(): bool
    {
        $user = Auth::user();
        if (! $user) {
            return false;
        }

        // Check if user has Admin/Staff role
        $hasAdminRole = $user->hasRole(['Admin', 'Staff']);

        // Check if user has practitioner record in central database
        $hasPractitionerRecord = tenancy()->central(function () use ($user) {
            return \App\Models\Practitioner::where('user_id', $user->id)->exists();
        });

        return $hasAdminRole && $hasPractitionerRecord;
    }
}
