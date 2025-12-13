<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientMaskedResource;
use App\Http\Resources\PatientMinimalResource;
use App\Http\Resources\PatientResource;
use App\Mail\PatientRegistrationMail;
use App\Models\Tenant\Patient;
use App\Services\PatientMedicalHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class IntakeController extends Controller
{
    protected PatientMedicalHistory $medicalHistoryService;

    public function __construct(PatientMedicalHistory $medicalHistoryService)
    {
        $this->medicalHistoryService = $medicalHistoryService;
        $this->middleware('permission:view-intake')->only(['index', 'show']);
        $this->middleware('permission:add-intake')->only(['create', 'store']);
        $this->middleware('permission:update-intake')->only(['edit', 'update']);
        $this->middleware('permission:delete-intake')->only('destroy');
    }

    /**
     * Show the form for creating a new intake with deferred loading support.
     */
    public function create(Request $request)
    {
        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('Intake/Create', [
                'initialHealthNumber' => $request->get('health_number', ''),
                'redirectSource' => $request->get('from', ''),
                'existingData' => null,
            ]);
        }

        // Return full data for partial reload (heavy medical data loading)
        $patientId = $request->get('patient_id');

        $existingData = null;

        if ($patientId) {
            $patient = Patient::find($patientId);
            if ($patient) {
                // Get medical history data (heavy operation)
                $medicalData = $this->medicalHistoryService->getPatientMedicalData($patientId);

                // Prepare existing data for form
                $existingData = [
                    'patient' => new PatientResource($patient),
                    'family_medical_histories' => $medicalData['family_medical_histories']->toArray(),
                    'patient_medical_histories' => $medicalData['patient_medical_histories']->toArray(),
                    'known_allergies' => $medicalData['known_allergies']->toArray(),
                ];
            }
        }

        return Inertia::render('Intake/Create', [
            'initialHealthNumber' => $request->get('health_number', ''),
            'redirectSource' => $request->get('from', ''),
            'existingData' => $existingData,
        ]);
    }

    /**
     * Search for existing patients by health number or name.
     */
    public function searchPatients(Request $request)
    {
        $request->validate([
            'first_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
            'last_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
            'health_card_number' => ['nullable', 'string', 'min:2'],
        ], [
            'first_name.regex' => 'First name and last name can have letters only.',
            'last_name.regex' => 'First name and last name can have letters only.',
        ]);

        $firstName = $request->first_name;
        $lastName = $request->last_name;
        $healthCardNumber = $request->health_card_number;
        $currentTenantId = tenant('id');

        // Search with exact first and last name matching (and optional health card) - encrypted fields
        $query = Patient::whereBlind('first_name', 'first_name_index', $firstName)
            ->whereBlind('last_name', 'last_name_index', $lastName);

        // Add health card number filter if provided (encrypted field)
        if ($healthCardNumber) {
            $query->whereBlind('health_number', 'health_number_index', $healthCardNumber);
        }

        $patients = $query->limit(10)->get();

        // Return masked patient data using resource
        $maskedPatients = PatientMaskedResource::collection($patients);

        return response()->json([
            'patients' => $maskedPatients,
        ]);
    }

    /**
     * Mask a string keeping first and last characters visible
     */
    private function maskString(string $str, int $start = 1, int $end = 1): string
    {
        $length = strlen($str);
        if ($length <= $start + $end) {
            return str_repeat('*', $length);
        }

        return substr($str, 0, $start).
               str_repeat('*', $length - $start - $end).
               substr($str, -$end);
    }

    /**
     * Mask an email address
     */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return $email;
        }

        $username = $parts[0];
        $domain = $parts[1];

        $maskedUsername = $this->maskString($username, 1, 1);

        return $maskedUsername.'@'.$domain;
    }

    /**
     * Mask a health card number
     */
    private function maskHealthNumber(?string $healthNumber): ?string
    {
        if (! $healthNumber) {
            return null;
        }

        return $this->maskString($healthNumber, 2, 2);
    }

    /**
     * Mask a date (show only year)
     */
    private function maskDate(string $date): string
    {
        $dateObj = new \DateTime($date);

        return '****-**-'.$dateObj->format('d'); // Show only day, mask month and keep year structure
    }

    /**
     * Link an existing patient to the current tenant.
     * NOTE: With tenant-scoped patients, this method finds existing patients within the tenant only.
     */
    public function linkPatient(Request $request)
    {
        $request->validate([
            'patient_id' => ['required', 'integer'],
            'redirect_source' => ['nullable', 'string', 'max:255'],
        ]);

        $patientId = $request->patient_id;

        // Find patient in tenant database
        $patient = Patient::find($patientId);
        if (! $patient) {
            return response()->json(['error' => 'Patient not found'], 404);
        }

        // Patient already exists in tenant database, return success
        if (request()->wantsJson()) {
            return response()->json([
                'message' => 'Patient found successfully',
                'type' => 'success',
                'patient' => (new PatientMinimalResource($patient))->resolve(),
            ], 200);
        }

        // For regular requests, redirect with flash message
        $redirectSource = $request->get('redirect_source', '');
        if ($redirectSource === 'patients') {
            return redirect()->route('patients.index')->with('success', 'Patient found successfully!');
        }

        return redirect()->route('intake.create')->with('success', 'Patient found successfully!');
    }

    /**
     * Store a new patient intake in the central database and link to tenant.
     */
    public function store(Request $request)
    {
        $currentTenantId = tenant('id');

        // DEBUG: Log incoming request data for coverage_card_path
        Log::info('[Intake] Step 1 - Incoming Request', [
            'coverage_card_path' => $request->input('coverage_card_path'),
            'has_coverage_card' => $request->has('coverage_card_path'),
            'filled_coverage_card' => $request->filled('coverage_card_path'),
            'timestamp' => now()->toDateTimeString(),
        ]);

        // Validate the intake form data with custom error handling
        try {
            $validated = $request->validate([
                // Client Information
                'health_number' => 'required|string|max:20',
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'preferred_name' => 'nullable|string|max:255',
                'phone_number' => 'required|string|max:20',
                'email_address' => 'required|email|max:255',
                'gender_pronouns' => 'nullable|string|max:255',
                'client_type' => 'required|string|max:255',
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

                // Family Medical History
                'family_medical_histories' => 'nullable|array',
                'family_medical_histories.*.relationship_to_patient' => 'required|string|max:255',
                'family_medical_histories.*.summary' => 'required|string|max:255',
                'family_medical_histories.*.details' => 'nullable|string',
                'family_medical_histories.*.diagnosis_date' => 'nullable|date',

                // Patient Medical History
                'patient_medical_histories' => 'nullable|array',
                'patient_medical_histories.*.disease' => 'required|string|max:255',
                'patient_medical_histories.*.recent_tests' => 'nullable|string',

                // Known Allergies
                'known_allergies' => 'nullable|array',
                'known_allergies.*.allergens' => 'required|string|max:255',
                'known_allergies.*.type' => 'required|string|in:food,medication,environmental,contact,other',
                'known_allergies.*.severity' => 'required|string|in:mild,moderate,severe',
                'known_allergies.*.reaction' => 'nullable|string|max:255',
                'known_allergies.*.notes' => 'nullable|string',

                // Redirect source for flow control
                'redirect_source' => 'nullable|string|max:255',
            ]);

            // DEBUG: Log validated data for coverage_card_path
            Log::info('[Intake] Step 2 - After Validation', [
                'coverage_card_path' => $validated['coverage_card_path'] ?? 'KEY_NOT_IN_VALIDATED',
                'isset' => isset($validated['coverage_card_path']),
                'empty' => empty($validated['coverage_card_path']),
                'timestamp' => now()->toDateTimeString(),
            ]);

            // Tenant-scoped validation
            $errors = [];

            // Check email uniqueness within this tenant (encrypted field)
            $existingPatientByEmail = Patient::whereBlind('email', 'email_index', $validated['email_address'])
                ->first();
            if ($existingPatientByEmail) {
                $errors['email_address'] = ['This email is already registered with your organization. Use the search feature to link the existing patient instead.'];
            }

            // Check health number uniqueness within this tenant (encrypted field)
            $existingPatientByHealthNumber = Patient::whereBlind('health_number', 'health_number_index', $validated['health_number'])
                ->first();
            if ($existingPatientByHealthNumber) {
                $errors['health_number'] = ['This health number is already registered with your organization. Use the search feature to link the existing patient instead.'];
            }

            // Throw validation exception if any errors found
            if (! empty($errors)) {
                throw \Illuminate\Validation\ValidationException::withMessages($errors);
            }

            // Handle coverage card - S3 only (no traditional file upload)
            $coverageCardPath = ! empty($validated['coverage_card_path']) ? $validated['coverage_card_path'] : null;

            // DEBUG: Log what we're about to save
            Log::info('[Intake] Step 3 - Preparing to Save', [
                'coverageCardPath_variable' => $coverageCardPath,
                'validated_value' => $validated['coverage_card_path'] ?? 'NULL',
                'is_null' => is_null($coverageCardPath),
                'timestamp' => now()->toDateTimeString(),
            ]);

            // Create new patient record in tenant database
            $patient = Patient::create([
                'health_number' => $validated['health_number'],
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'preferred_name' => $validated['preferred_name'],
                'email' => $validated['email_address'],
                'phone_number' => $validated['phone_number'],
                'gender' => $validated['gender_pronouns'],
                'gender_pronouns' => $validated['gender_pronouns'],
                'client_type' => $validated['client_type'],
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
                'meta_data' => ['is_onboarding' => 1],
            ]);

            $patientId = $patient->id;

            // DEBUG: Log what was actually saved
            Log::info('[Intake] Step 4 - After Patient Created', [
                'patient_id' => $patient->id,
                'coverage_card_path_in_db' => $patient->coverage_card_path,
                'fresh_from_db' => $patient->fresh()->coverage_card_path,
                'timestamp' => now()->toDateTimeString(),
            ]);

            // Create wallet for new patient in tenant database
            \App\Models\Tenant\Wallet::getOrCreatePatientWallet($patientId);

            try {
                Log::info('Starting patient intake confirmation email process', [
                    'patient_id' => $patientId,
                    'tenant_id' => $currentTenantId,
                ]);

                // Get the patient record (either existing or newly created)
                $patient = Patient::find($patientId);

                if (! $patient) {
                    throw new \Exception('Patient record not found after creation/linking');
                }

                if (! $patient->email) {
                    throw new \Exception('Patient email address is missing');
                }

                // Get current tenant for clinic name
                $currentTenant = tenant();

                if (! $currentTenant) {
                    throw new \Exception('Current tenant not found');
                }

                Log::info('Sending patient intake confirmation email', [
                    'patient_id' => $patient->id,
                    'patient_email' => $patient->email,
                    'clinic_name' => $currentTenant->company_name ?? 'Unknown Clinic',
                    'tenant_id' => $currentTenantId,
                ]);

                // Create and send the email
                $welcomeMail = new PatientRegistrationMail($patient, $currentTenant);
                Mail::to($patient->email)->send($welcomeMail);

                Log::info('Patient intake confirmation email sent successfully', [
                    'patient_id' => $patient->id,
                    'patient_email' => $patient->email,
                    'tenant_id' => $currentTenantId,
                ]);

                // Trigger consents for patient creation
                app(\App\Services\ConsentTriggerService::class)->triggerConsentsForEntity('PATIENT', 'creation', $patient);
            } catch (\Exception $e) {
                // Comprehensive error logging
                Log::error('Failed to send patient emails (registration or consent)', [
                    'error_message' => $e->getMessage(),
                    'error_trace' => $e->getTraceAsString(),
                    'patient_id' => $patientId ?? null,
                    'tenant_id' => $currentTenantId,
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]);

                // Continue with the process - don't let email failure break patient creation
            }

            // Save medical history data using service
            if (! empty($validated['family_medical_histories']) ||
                ! empty($validated['patient_medical_histories']) ||
                ! empty($validated['known_allergies'])) {

                $medicalHistoryData = [
                    'family_medical_histories' => $validated['family_medical_histories'] ?? [],
                    'patient_medical_histories' => $validated['patient_medical_histories'] ?? [],
                    'known_allergies' => $validated['known_allergies'] ?? [],
                ];

                $medicalHistoryResult = $this->medicalHistoryService->saveAllMedicalHistories($patientId, $medicalHistoryData);

                if (! $medicalHistoryResult['success']) {
                    Log::warning('Medical history save failed during intake', [
                        'patient_id' => $patientId,
                        'error' => $medicalHistoryResult['error'],
                    ]);
                    // Continue with intake but log the warning
                }
            }

            // Check if user came from patients page to determine redirect
            $redirectSource = $request->get('redirect_source', '');
            if ($redirectSource === 'patients') {
            }

            return redirect()->route('patients.index')->with('success', 'Patient intake completed successfully! Patient has been added to your organization.');
            // return redirect()->route('intake.create')->with('success', 'Patient intake completed successfully! Patient has been added to your organization.');

        } catch (\Illuminate\Validation\ValidationException $e) {
            // Determine which tab has errors and redirect there
            $errorTab = $this->getErrorTab($e->validator->errors());

            return redirect()->route('intake.create')
                ->withInput()
                ->withErrors($e->validator->errors())
                ->with('activeTab', $errorTab);
        }
    }

    /**
     * Determine which tab contains validation errors
     */
    private function getErrorTab($errors): string
    {
        // Define field-to-tab mapping
        $tabFields = [
            'client-info' => [
                'health_number', 'first_name', 'last_name', 'preferred_name',
                'phone_number', 'email_address', 'gender_pronouns', 'client_type',
                'date_of_birth', 'emergency_contact_phone', 'address_lookup',
                'street_address', 'apt_suite_unit', 'city', 'postal_zip_code', 'province',
            ],
            'health-clinical' => [
                'presenting_concern', 'goals_for_therapy', 'previous_therapy_experience',
                'current_medications', 'diagnoses', 'history_of_hospitalization',
                'risk_safety_concerns', 'other_medical_conditions',
                'cultural_religious_considerations', 'accessibility_needs',
            ],
            'insurance-legal' => [
                'insurance_provider', 'policy_number', 'coverage_card',
                'consent_to_treatment', 'consent_to_data_storage', 'privacy_policy_acknowledged',
            ],
            'family-medical' => [
                'family_medical_histories',
            ],
            'patient-medical' => [
                'patient_medical_histories',
            ],
            'known-allergies' => [
                'known_allergies',
            ],
            'preferences' => [
                'language_preferences', 'best_time_to_contact', 'best_way_to_contact',
                'consent_to_receive_reminders',
            ],
        ];

        // Check each tab for errors (prioritize earlier tabs)
        foreach ($tabFields as $tab => $fields) {
            foreach ($fields as $field) {
                if ($errors->has($field)) {
                    return $tab;
                }
            }
        }

        // Default to first tab if no specific errors found
        return 'client-info';
    }
}
