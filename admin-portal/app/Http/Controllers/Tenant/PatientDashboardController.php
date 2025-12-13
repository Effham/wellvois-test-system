<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientDashboardResource;
use App\Http\Resources\PatientResource;
use App\Models\Tenant\Patient;
use App\Models\User;
use App\Services\PatientMedicalHistory;
use App\Services\TenantTimezoneService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PatientDashboardController extends Controller
{
    protected PatientMedicalHistory $medicalHistoryService;

    public function __construct(PatientMedicalHistory $medicalHistoryService)
    {
        $this->medicalHistoryService = $medicalHistoryService;
    }

    /**
     * Display the patient dashboard.
     *
     * This controller serves the static patient dashboard component.
     * Role-based access control is handled by the route middleware.
     */
    public function index(Request $request)
    {
        // Check if this is an auto-login from public portal (using cookies)
        $fromPublicPortal = $request->cookie('from_public_portal') === 'true';
        $patientId = $request->cookie('patient_id');
        $waitingListSuccess = $request->cookie('is_waiting_list') === 'true';

        if ($fromPublicPortal && $patientId && ! Auth::check()) {

            // Get patient data from central database (Patient model uses CentralConnection trait)
            $patient = \App\Models\Patient::find($patientId);

            if ($patient) {
                // Create or get user in tenant database
                $user = User::firstOrCreate(
                    ['email' => $patient->email],
                    [
                        'name' => $patient->first_name.' '.$patient->last_name,
                        'email' => $patient->email,
                        'password' => Hash::make('temp-password-'.time()), // Temporary password
                        'email_verified_at' => now(),
                    ]
                );

                // Assign Patient role if not already assigned
                if (! $user->hasRole('Patient')) {
                    $user->assignRole('Patient');
                }

                // Ensure the central user is associated with this tenant for proper tenant switching
                if ($patient->user) {
                    // Get the current tenant and associate it with the central user if not already associated
                    $currentTenant = tenant();

                    // Check both the Patient-Tenant relationship AND the User-Tenant relationship
                    $hasPatientTenantLink = DB::connection('central')->table('tenant_patients')
                        ->where('tenant_id', $currentTenant->id)
                        ->where('patient_id', $patient->id)
                        ->exists();

                    $hasUserTenantLink = DB::connection('central')->table('tenant_user')
                        ->where('user_id', $patient->user->id)
                        ->where('tenant_id', $currentTenant->id)
                        ->exists();

                    // Create Patient-Tenant link if missing
                    if (! $hasPatientTenantLink) {
                        DB::connection('central')->table('tenant_patients')->insert([
                            'tenant_id' => $currentTenant->id,
                            'patient_id' => $patient->id,
                            'invitation_status' => 'ACCEPTED',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        \Log::info('Created missing tenant_patients relationship', [
                            'patient_id' => $patient->id,
                            'tenant_id' => $currentTenant->id,
                        ]);
                    }

                    // Create User-Tenant link if missing (this is what enables tenant switching)
                    if (! $hasUserTenantLink) {
                        DB::connection('central')->table('tenant_user')->insert([
                            'user_id' => $patient->user->id,
                            'tenant_id' => $currentTenant->id,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        \Log::info('Created missing tenant_user relationship for patient', [
                            'user_id' => $patient->user->id,
                            'tenant_id' => $currentTenant->id,
                            'patient_id' => $patient->id,
                        ]);
                    }
                }

                // Auto-login the user
                Auth::login($user);

                // Store login timestamp for absolute session timeout enforcement
                session(['login_time' => now()->timestamp]);

                // Clear the cookies and mark as just registered
                cookie()->forget('from_public_portal');
                cookie()->forget('patient_id');
                if ($waitingListSuccess) {
                    cookie()->forget('is_waiting_list');
                }
                session(['just_registered_from_public_portal' => true]);

                // Log the auto-login
                \Log::info('Public portal auto-login successful', [
                    'patient_id' => $patient->id,
                    'user_id' => $user->id,
                    'tenant_id' => tenant('id'),
                ]);
            }
        }

        $user = Auth::user();

        // Check if user has Patient role OR tenant patient record
        $hasPatientRole = $user && $user->hasRole('Patient');
        $hasTenantPatientRecord = $user && Patient::where('user_id', $user->id)->exists();

        if (! $user || (! $hasPatientRole && ! $hasTenantPatientRecord)) {
            if ($request->cookie('from_public_portal') === 'true') {
                // If still from public portal but no valid user, redirect to login
                cookie()->forget('from_public_portal');
                cookie()->forget('patient_id');
                cookie()->forget('is_waiting_list');

                return redirect()->route('login')->with('error', 'Authentication failed. Please try logging in.');
            }

            // Show toast instead of error page
            return back()->with('error', 'Access denied. You must be a patient or have a patient record in this tenant.');
        }

        // Check if user should see the central-style interface (with tenant switcher)
        // This includes users who registered via public portal and need multi-tenant access
        $fromPublicPortal = session('just_registered_from_public_portal', false);

        // Clear the session flag after first use
        if ($fromPublicPortal) {
            session()->forget('just_registered_from_public_portal');
        }

        // Get available tenants for the user to determine if they should see tenant switcher
        $availableTenants = userTenants($user);

        // Show central-style interface (with tenant switcher) if:
        // 1. User came from public portal, OR
        // 2. User is a Super Admin, OR
        // 3. User has access to multiple tenants (common for patients registered through public portal)
        $isCentral = $fromPublicPortal || $user->hasRole('Super Admin') || count($availableTenants) > 1;

        // Clear waiting list cookie if it exists (for cases where user is already logged in)
        if ($waitingListSuccess) {
            cookie()->forget('is_waiting_list');
        }

        // Get tenant timezone information
        $tenantTimezone = TenantTimezoneService::getTenantTimezone();
        $tenantTimezoneAbbr = TenantTimezoneService::getTenantTimezoneAbbreviation();
        $tenantTimezoneDisplay = "{$tenantTimezoneAbbr} ({$tenantTimezone})";

        // Return the static patient dashboard component
        // Welcome message is now handled via localStorage on frontend
        return Inertia::render('PatientDashboard/Index', [
            'isCentral' => $isCentral,
            'fromPublicPortal' => $fromPublicPortal,
            'waitingListSuccess' => $waitingListSuccess,
            'availableTenants' => $availableTenants,
            'selectedTenant' => tenant('id'),
            'tenantTimezone' => $tenantTimezone,
            'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
        ]);
    }

    /**
     * Display MyDetails page with role-based content
     */
    public function myDetails(Request $request)
    {
        $user = Auth::user();
        $userRole = determineUserRole();

        // Route to appropriate MyDetails based on role
        if ($userRole === 'practitioner') {
            return $this->practitionerMyDetails($request);
        } elseif ($userRole === 'patient') {
            return $this->patientMyDetails($request);
        }

        // Default admin view or error
        return Inertia::render('MyDetails/Index', [
            'error' => 'Unable to determine user role for MyDetails page.',
            'userRole' => $userRole,
        ]);
    }

    /**
     * Update patient MyDetails
     */
    public function updateMyDetails(Request $request)
    {
        $user = Auth::user();
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            return back()->withErrors(['error' => 'Patient record not found.']);
        }

        // Validate the form data
        $validated = $request->validate([
            // Client Information
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'preferred_name' => 'nullable|string|max:255',
            'phone_number' => 'required|string|max:20',
            'gender_pronouns' => 'nullable|string|max:255',
            'date_of_birth' => 'required|date',
            'emergency_contact_phone' => 'required|string|max:20',
            'address_lookup' => 'nullable|string|max:255',
            'street_address' => 'required|string|max:255',
            'apt_suite_unit' => 'nullable|string|max:255',
            'city' => 'required|string|max:255',
            'postal_zip_code' => 'required|string|max:20',
            'province' => 'required|string|max:255',

            // Health & Clinical History
            'presenting_concern' => 'nullable|string',
            'goals_for_therapy' => 'nullable|string',
            'previous_therapy_experience' => 'nullable|string|max:255',
            'current_medications' => 'nullable|string',
            'diagnoses' => 'nullable|string',
            'history_of_hospitalization' => 'nullable|string',
            'risk_safety_concerns' => 'nullable|string',
            'other_medical_conditions' => 'nullable|string',
            'cultural_religious_considerations' => 'nullable|string',
            'accessibility_needs' => 'nullable|string',

            // Insurance & Legal
            'insurance_provider' => 'nullable|string|max:255',
            'policy_number' => 'nullable|string|max:255',
            'coverage_card_path' => 'nullable|string',
            'consent_to_treatment' => 'boolean',
            'consent_to_data_storage' => 'boolean',
            'privacy_policy_acknowledged' => 'boolean',

            // Preferences
            'language_preferences' => 'nullable|string|max:255',
            'best_time_to_contact' => 'nullable|string|max:255',
            'best_way_to_contact' => 'nullable|string|max:255',
            'consent_to_receive_reminders' => 'boolean',
        ]);

        // Handle coverage card S3 path
        $coverageCardPath = $patient->coverage_card_path; // Keep existing if not updated
        if ($request->has('coverage_card_path') && ! empty($validated['coverage_card_path'])) {
            $coverageCardPath = $validated['coverage_card_path'];
            Log::info('PatientDashboardController: Updating S3 coverage card', [
                'patient_id' => $patient->id,
                'path' => $coverageCardPath,
            ]);
        }

        // Update patient record
        $patient->update([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'preferred_name' => $validated['preferred_name'],
            'phone_number' => $validated['phone_number'],
            'gender_pronouns' => $validated['gender_pronouns'],
            'date_of_birth' => $validated['date_of_birth'],
            'emergency_contact_phone' => $validated['emergency_contact_phone'],
            'address_lookup' => $validated['address_lookup'],
            'street_address' => $validated['street_address'],
            'apt_suite_unit' => $validated['apt_suite_unit'],
            'city' => $validated['city'],
            'postal_zip_code' => $validated['postal_zip_code'],
            'province' => $validated['province'],
            'presenting_concern' => $validated['presenting_concern'],
            'goals_for_therapy' => $validated['goals_for_therapy'],
            'previous_therapy_experience' => $validated['previous_therapy_experience'],
            'current_medications' => $validated['current_medications'],
            'diagnoses' => $validated['diagnoses'],
            'history_of_hospitalization' => $validated['history_of_hospitalization'],
            'risk_safety_concerns' => $validated['risk_safety_concerns'],
            'other_medical_conditions' => $validated['other_medical_conditions'],
            'cultural_religious_considerations' => $validated['cultural_religious_considerations'],
            'accessibility_needs' => $validated['accessibility_needs'],
            'insurance_provider' => $validated['insurance_provider'],
            'policy_number' => $validated['policy_number'],
            'coverage_card_path' => $coverageCardPath,
            'consent_to_treatment' => $validated['consent_to_treatment'] ?? false,
            'consent_to_data_storage' => $validated['consent_to_data_storage'] ?? false,
            'privacy_policy_acknowledged' => $validated['privacy_policy_acknowledged'] ?? false,
            'language_preferences' => $validated['language_preferences'],
            'best_time_to_contact' => $validated['best_time_to_contact'],
            'best_way_to_contact' => $validated['best_way_to_contact'],
            'consent_to_receive_reminders' => $validated['consent_to_receive_reminders'] ?? false,
        ]);

        return redirect()->back()->with('success', 'Your details have been updated successfully!');
    }

    /**
     * Display practitioner MyDetails (redirect to central)
     */
    protected function practitionerMyDetails(Request $request)
    {
        // Practitioners should use central MyDetails
        return redirect(centralUrl('my-details'));
    }

    /**
     * Display patient MyDetails
     */
    protected function patientMyDetails(Request $request)
    {
        $user = Auth::user();

        // Find patient record in tenant database
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            return Inertia::render('Patient/MyDetails/Index', [
                'error' => 'Patient record not found.',
                'patient' => null,
                'medicalData' => null,
            ]);
        }

        // Get medical history data using service
        $medicalData = $this->medicalHistoryService->getPatientMedicalData($patient->id);

        // Get medical history summary for dashboard cards
        $summary = $this->medicalHistoryService->getMedicalHistorySummary($patient->id);

        return Inertia::render('Patient/MyDetails/Index', [
            'patient' => new PatientResource($patient),
            'medicalData' => $medicalData,
            'summary' => $summary,
            'userRole' => 'patient',
        ]);
    }

    /**
     * Update family medical histories
     */
    public function updateFamilyMedicalHistories(Request $request)
    {
        $user = Auth::user();
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            throw ValidationException::withMessages([
                'patient' => 'Patient record not found.',
            ]);
        }

        $request->validate([
            'family_medical_histories' => 'array',
            'family_medical_histories.*.relationship_to_patient' => 'required|string|max:255',
            'family_medical_histories.*.summary' => 'required|string|max:255',
            'family_medical_histories.*.details' => 'nullable|string',
            'family_medical_histories.*.diagnosis_date' => 'nullable|date',
        ]);

        $result = $this->medicalHistoryService->saveFamilyMedicalHistories(
            $patient->id,
            $request->input('family_medical_histories', [])
        );

        if ($result['success']) {
            return back()->with('success', $result['message']);
        }

        throw ValidationException::withMessages([
            'family_medical_histories' => $result['error'],
        ]);
    }

    /**
     * Update patient medical histories
     */
    public function updatePatientMedicalHistories(Request $request)
    {
        $user = Auth::user();
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            throw ValidationException::withMessages([
                'patient' => 'Patient record not found.',
            ]);
        }

        $request->validate([
            'patient_medical_histories' => 'array',
            'patient_medical_histories.*.disease' => 'required|string|max:255',
            'patient_medical_histories.*.recent_tests' => 'nullable|string',
        ]);

        $result = $this->medicalHistoryService->savePatientMedicalHistories(
            $patient->id,
            $request->input('patient_medical_histories', [])
        );

        if ($result['success']) {
            return back()->with('success', $result['message']);
        }

        throw ValidationException::withMessages([
            'patient_medical_histories' => $result['error'],
        ]);
    }

    /**
     * Update known allergies
     */
    public function updateKnownAllergies(Request $request)
    {
        $user = Auth::user();
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            throw ValidationException::withMessages([
                'patient' => 'Patient record not found.',
            ]);
        }

        $request->validate([
            'known_allergies' => 'array',
            'known_allergies.*.allergens' => 'required|string|max:255',
            'known_allergies.*.type' => 'required|string|in:food,medication,environmental,contact,other',
            'known_allergies.*.severity' => 'required|string|in:mild,moderate,severe',
            'known_allergies.*.reaction' => 'nullable|string|max:255',
            'known_allergies.*.notes' => 'nullable|string',
        ]);

        $result = $this->medicalHistoryService->saveKnownAllergies(
            $patient->id,
            $request->input('known_allergies', [])
        );

        if ($result['success']) {
            return back()->with('success', $result['message']);
        }

        throw ValidationException::withMessages([
            'known_allergies' => $result['error'],
        ]);
    }

    /**
     * Delete specific family medical history record
     */
    public function deleteFamilyMedicalHistory(Request $request, int $historyId)
    {
        $user = Auth::user();
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            return response()->json(['error' => 'Patient record not found.'], 404);
        }

        $success = $this->medicalHistoryService->deleteFamilyMedicalHistory($patient->id, $historyId);

        if ($success) {
            return response()->json(['success' => true, 'message' => 'Family medical history deleted successfully.']);
        }

        return response()->json(['error' => 'Failed to delete family medical history.'], 500);
    }

    /**
     * Delete specific patient medical history record
     */
    public function deletePatientMedicalHistory(Request $request, int $historyId)
    {
        $user = Auth::user();
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            return response()->json(['error' => 'Patient record not found.'], 404);
        }

        $success = $this->medicalHistoryService->deletePatientMedicalHistory($patient->id, $historyId);

        if ($success) {
            return response()->json(['success' => true, 'message' => 'Patient medical history deleted successfully.']);
        }

        return response()->json(['error' => 'Failed to delete patient medical history.'], 500);
    }

    /**
     * Delete specific known allergy record
     */
    public function deleteKnownAllergy(Request $request, int $allergyId)
    {
        $user = Auth::user();
        $patient = Patient::whereBlind('email', 'email_index', $user->email)->first();

        if (! $patient) {
            return response()->json(['error' => 'Patient record not found.'], 404);
        }

        $success = $this->medicalHistoryService->deleteKnownAllergy($patient->id, $allergyId);

        if ($success) {
            return response()->json(['success' => true, 'message' => 'Known allergy deleted successfully.']);
        }

        return response()->json(['error' => 'Failed to delete known allergy.'], 500);
    }

    /**
     * Get dashboard data for tenant context (specific tenant only)
     */
    public function getDashboardData(Request $request)
    {
        try {
            $user = Auth::user();

            if (! $user) {
                return response()->json(['error' => 'Not authenticated'], 401);
            }

            // Find patient record in central database by email
            $centralPatient = \App\Models\Patient::whereBlind('email', 'email_index', $user->email)->first();

            if (! $centralPatient) {
                return response()->json(['error' => 'Patient record not found'], 404);
            }

            $currentTenant = tenant();

            // Verify patient has access to this tenant
            $tenantPatient = \DB::connection('central')->table('tenant_patients')
                ->where('patient_id', $centralPatient->id)
                ->where('tenant_id', $currentTenant->id)
                ->where('invitation_status', 'ACCEPTED')
                ->first();

            if (! $tenantPatient) {
                return response()->json(['error' => 'Patient not associated with this tenant'], 403);
            }

            // Get real upcoming appointments for this patient in current tenant (confirmed only)
            $upcomingAppointments = \App\Models\Tenant\Appointment::where('patient_id', $centralPatient->id)
                ->where('status', 'confirmed')
                ->where('appointment_datetime', '>', now())
                ->orderBy('appointment_datetime', 'asc')
                ->with(['service', 'location'])
                ->get()
                ->map(function ($appointment) use ($currentTenant) {
                    // Get practitioner data from central database
                    $practitioners = $appointment->getPractitionerData();
                    $practitionerName = $practitioners->isNotEmpty()
                        ? 'Dr. '.$practitioners->first()->first_name.' '.$practitioners->first()->last_name
                        : 'TBD';

                    return [
                        'id' => $appointment->id,
                        'date' => $appointment->appointment_datetime->format('Y-m-d'),
                        'time' => $appointment->appointment_datetime->format('H:i'),
                        'practitioner' => $practitionerName,
                        'specialty' => $practitioners->isNotEmpty() ? $practitioners->first()->primary_specialties[0] ?? 'General' : 'General',
                        'service' => $appointment->service?->name ?? 'Consultation',
                        'location' => $appointment->location?->name ?? $appointment->mode,
                        'address' => $appointment->mode === 'virtual' ? 'Video Call' : ($appointment->location?->address ?? 'TBD'),
                        'mode' => $appointment->mode === 'virtual' ? 'Virtual' : 'In-person',
                        'status' => $appointment->status,
                        'duration' => '60 min', // Default duration
                        'tenant_id' => $currentTenant->id,
                    ];
                });

            // Get real current medications from encounters and prescriptions
            $currentMedications = \App\Models\Tenant\EncounterPrescription::whereHas('encounter.appointment', function ($query) use ($centralPatient) {
                $query->where('patient_id', $centralPatient->id);
            })
                ->with(['encounter.appointment'])
                ->get()
                ->map(function ($prescription) use ($currentTenant) {
                    // Get practitioner who prescribed this medication
                    $appointment = $prescription->encounter->appointment;
                    $practitioners = $appointment->getPractitionerData();
                    $practitionerName = $practitioners->isNotEmpty()
                        ? 'Dr. '.$practitioners->first()->first_name.' '.$practitioners->first()->last_name
                        : 'Unknown Doctor';

                    return [
                        'id' => $prescription->id,
                        'name' => $prescription->medicine_name,
                        'dosage' => $prescription->dosage ?? 'As prescribed',
                        'frequency' => $prescription->frequency ?? 'As directed',
                        'timeToTake' => $this->formatFrequency($prescription->frequency),
                        'purpose' => $prescription->instructions ?? 'As prescribed by doctor',
                        'prescribedBy' => $practitionerName,
                        'nextRefill' => now()->addDays(30)->format('M j, Y'), // Estimate
                        'tenant_id' => $currentTenant->id,
                    ];
                })
                ->unique('medicine_name') // Remove duplicates by medicine name
                ->values();

            // Get real recent visits from completed encounters
            $recentVisits = \App\Models\Tenant\Encounter::whereHas('appointment', function ($query) use ($centralPatient) {
                $query->where('patient_id', $centralPatient->id);
            })
                ->where('status', 'completed')
                ->with(['appointment.service', 'appointment.location'])
                ->orderBy('session_completed_at', 'desc')
                ->take(10)
                ->get()
                ->map(function ($encounter) use ($currentTenant) {
                    $appointment = $encounter->appointment;
                    $practitioners = $appointment->getPractitionerData();
                    $practitionerName = $practitioners->isNotEmpty()
                        ? 'Dr. '.$practitioners->first()->first_name.' '.$practitioners->first()->last_name
                        : 'Unknown Doctor';

                    return [
                        'id' => $encounter->id,
                        'date' => $encounter->session_completed_at ? $encounter->session_completed_at->format('Y-m-d') : $appointment->appointment_datetime->format('Y-m-d'),
                        'practitioner' => $practitionerName,
                        'specialty' => $practitioners->isNotEmpty() ? $practitioners->first()->primary_specialties[0] ?? 'General' : 'General',
                        'service' => $appointment->service?->name ?? 'Consultation',
                        'status' => 'Completed',
                        'summary' => $encounter->clinical_assessment ?? $encounter->chief_complaint ?? 'Visit completed successfully',
                        'followUp' => $encounter->treatment_plan ?? null,
                        'tenant_id' => $currentTenant->id,
                    ];
                });

            // Calculate real statistics
            $currentYear = now()->year;
            $visitsThisYear = \App\Models\Tenant\Encounter::whereHas('appointment', function ($query) use ($centralPatient) {
                $query->where('patient_id', $centralPatient->id);
            })
                ->where('status', 'completed')
                ->whereYear('session_completed_at', $currentYear)
                ->count();

            $nextAppointment = $upcomingAppointments->first();

            $quickStats = [
                'nextAppointment' => $nextAppointment ? $nextAppointment['date'] : null,
                'activeMedications' => $currentMedications->count(),
                'visitsThisYear' => $visitsThisYear,
            ];

            return response()->json([
                'upcomingAppointments' => $upcomingAppointments->take(5)->values(),
                'currentMedications' => $currentMedications->take(10)->values(),
                'recentVisits' => $recentVisits->take(5)->values(),
                'quickStats' => $quickStats,
                'patientInfo' => array_merge(
                    (new PatientDashboardResource($centralPatient))->resolve(),
                    ['current_tenant' => $currentTenant->id]
                ),
            ]);

        } catch (\Exception $e) {
            \Log::error('Tenant Dashboard Data Error: '.$e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['error' => 'Failed to load dashboard data'], 500);
        }
    }

    /**
     * Format frequency for display
     */
    private function formatFrequency(?string $frequency): string
    {
        if (! $frequency) {
            return 'As directed';
        }

        $frequency = strtolower($frequency);

        if (str_contains($frequency, 'once') || str_contains($frequency, '1')) {
            return 'Morning';
        } elseif (str_contains($frequency, 'twice') || str_contains($frequency, '2')) {
            return 'Morning & Evening';
        } elseif (str_contains($frequency, 'three') || str_contains($frequency, '3')) {
            return 'Morning, Afternoon & Evening';
        } else {
            return 'As directed';
        }
    }
}
