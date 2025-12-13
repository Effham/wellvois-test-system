<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientListResource;
use App\Models\Tenant\Patient;
use App\Models\Tenant\PatientInvitation;
use App\Models\User;
use App\Services\BedrockAIService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class PatientController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-patient')->only(['index', 'show', 'invitations']);
        $this->middleware('permission:add-patient')->only(['create', 'store', 'invite', 'resendInvitation']);
        $this->middleware('permission:update-patient')->only(['edit', 'update']);
        $this->middleware('permission:delete-patient')->only('destroy');
        // IS_DEVELOPER bypass is handled in User model
    }

    /**
     * Display patients listing with deferred loading support
     */
    public function index(Request $request)
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
            return Inertia::render('Patient/Index', [
                'items' => null,
                'filters' => $filters,
            ]);
        }

        // Return full data for partial reload
        // Get all patients from tenant database
        $query = Patient::query();

        // Exclude patients with 'Requested' status (they should appear in public portal registrations)
        $query->where('registration_status', '!=', 'Requested');

        // Apply search filter if provided (exact match only - encrypted fields)
        if ($request->has('search') && ! empty($request->search)) {
            $search = $request->search;

            // Search within tenant database using blind indexes
            $query->where(function ($q) use ($search) {
                $q->whereBlind('health_number', 'health_number_index', $search)
                    ->orWhereBlind('first_name', 'first_name_index', $search)
                    ->orWhereBlind('last_name', 'last_name_index', $search)
                    ->orWhereBlind('preferred_name', 'preferred_name_index', $search)
                    ->orWhereBlind('email', 'email_index', $search);
            });
        }

        $perPage = $request->get('perPage', 10);
        $patients = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return Inertia::render('Patient/Index', [
            'items' => PatientListResource::collection($patients),
            'filters' => $filters,
        ]);
    }

    /**
     * Display patient invitations with deferred loading support
     */
    public function invitations(Request $request)
    {
        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // Prepare filters
        $filters = [
            'search' => $request->get('search'),
            'perPage' => $request->get('perPage', 10),
        ];

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('Patient/Invitations', [
                'filters' => $filters,
                'invitations' => null,
            ]);
        }

        // Return full data for partial reload
        $search = $request->get('search');
        $perPage = $request->get('perPage', 10);

        // Load invitations with patient relation (tenant-scoped)
        $invitationsQuery = PatientInvitation::query()
            ->with([
                'patient', // Load all patient columns for proper decryption
            ]);

        // Apply search filter if provided
        if ($search) {
            // Get patient IDs from tenant database that match search criteria
            $matchingPatientIds = Patient::where(function ($q) use ($search) {
                $q->whereBlind('health_number', 'health_number_index', $search)
                    ->orWhereBlind('first_name', 'first_name_index', $search)
                    ->orWhereBlind('last_name', 'last_name_index', $search)
                    ->orWhereBlind('preferred_name', 'preferred_name_index', $search)
                    ->orWhereBlind('email', 'email_index', $search);
            })
                ->pluck('id')
                ->toArray();

            // Filter by matching patient IDs
            if (! empty($matchingPatientIds)) {
                $invitationsQuery->whereIn('patient_id', $matchingPatientIds);
            } else {
                // If no matches found, return empty result
                $invitationsQuery->where('patient_id', -1);
            }
        }

        $invitations = $invitationsQuery->orderBy('created_at', 'desc')->paginate($perPage);

        // Transform the invitations data
        $invitations->getCollection()->transform(function ($invitation) {
            $invitation->patient_name = $invitation->patient->first_name.' '.$invitation->patient->last_name;
            $invitation->patient_email = $invitation->patient->email;
            $invitation->patient_health_number = $invitation->patient->health_number;
            $invitation->is_expired = $invitation->isExpired();
            $invitation->expires_in_days = now()->diffInDays($invitation->expires_at, false);

            return $invitation;
        });

        return Inertia::render('Patient/Invitations', [
            'filters' => $filters,
            'invitations' => $invitations,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'health_number' => ['required', 'string', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'in:male,female,other'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string'],
        ]);

        // Check if health number already exists within this tenant (using blind index for encrypted field)
        $existingPatientByHealthNumber = Patient::whereBlind('health_number', 'health_number_index', $data['health_number'])->first();

        if ($existingPatientByHealthNumber) {
            // Patient exists in current tenant
            return redirect()->back()
                ->withInput()
                ->withErrors(['health_number' => 'A patient with this health number already exists in your organization. Please search for the existing patient instead.']);
        }

        // Custom validation for unique email in users table
        if (! empty($data['email'])) {
            $emailExistsInUsers = tenancy()->central(function () use ($data) {
                return User::where('email', $data['email'])->exists();
            });

            if ($emailExistsInUsers) {
                return redirect()->back()
                    ->withInput()
                    ->withErrors(['email' => 'The email has already been taken.']);
            }
        }

        try {
            // Create patient in tenant database
            $patient = Patient::create([
                ...$data,
                'meta_data' => ['is_onboarding' => 1],
            ]);

            // Create wallet for patient in tenant database
            \App\Models\Tenant\Wallet::getOrCreatePatientWallet($patient->id);

            // Trigger consents for patient creation
            app(\App\Services\ConsentTriggerService::class)->triggerConsentsForEntity('PATIENT', 'creation', $patient);

            return redirect()->route('patients.index')->with('success', 'Patient created successfully.');
        } catch (\Exception $e) {
            return redirect()->back()
                ->withInput()
                ->with('error', 'Failed to create patient: '.$e->getMessage());
        }
    }

    public function edit($id)
    {
        $patient = Patient::findOrFail($id);

        return Inertia::render('Patient/Create', compact('patient'));
    }

    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'health_number' => ['required', 'string', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female,other'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
            'date_of_birth' => ['nullable', 'date'],
        ]);

        try {
            $patient = Patient::findOrFail($id);

            $patient->update($data);

            return redirect()->route('patients.index')->with('success', 'Patient updated successfully.');
        } catch (\Exception $e) {
            return redirect()->back()
                ->withInput()
                ->with('error', 'Failed to update patient: '.$e->getMessage());
        }
    }

    public function destroy($id)
    {
        try {
            $patient = Patient::findOrFail($id);

            // Delete the patient record from tenant database
            $patient->delete();

            return redirect()->route('patients.index')->with('success', 'Patient deleted successfully.');
        } catch (\Exception $e) {
            return redirect()->back()
                ->with('error', 'Failed to delete patient: '.$e->getMessage());
        }
    }

    /**
     * Send invitation to patient
     */
    public function invite(Request $request, $patientId)
    {
        $currentTenantId = tenant('id');

        // Get the patient (if they exist in tenant DB, they are automatically linked)
        $patient = Patient::find($patientId);
        if (! $patient) {
            return back()->with('error', 'Patient not found.');
        }

        // Check if patient has already been approved (can only send invites to approved patients)
        if ($patient->registration_status === 'Requested') {
            return back()->with('error', 'Please approve this patient registration first before sending an invitation.');
        }

        // Check if there's already a pending invitation for this patient
        $existingInvitation = PatientInvitation::where('patient_id', $patientId)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->first();

        // if ($existingInvitation) {
        //     return back()->with('error', 'An invitation has already been sent to this patient.');
        // }

        // Check if Patient role exists in tenant database before sending invitation
        $patientRole = Role::where('name', 'Patient')->first();

        if (! $patientRole) {
            return back()->with('error', 'Patient role does not exist. Please ask your administrator to create the Patient role with proper permissions before sending invitations.');
        }

        // Create invitation (tenant-scoped)
        $invitation = PatientInvitation::create([
            'patient_id' => $patientId,
            'email' => $patient->email,
            'token' => PatientInvitation::generateToken(),
            'expires_at' => now()->addDays(7),
            'sent_at' => now(),
        ]);

        // Send invitation email
        try {
            Mail::to($patient->email)->send(new \App\Mail\Tenant\PatientInvitationMail($invitation));

            $patientName = $patient->first_name.' '.$patient->last_name;
            if ($patient->user_id) {
                $message = "Invitation sent to {$patientName} to join your practice.";
            } else {
                $message = "Registration invitation sent to {$patientName}. They will be able to set up their account and join your practice.";
            }

            return back()->with('success', $message);
        } catch (\Exception $e) {
            // Delete the invitation if email fails
            $invitation->delete();

            Log::error('Failed to send patient invitation email', [
                'patient_id' => $patientId,
                'patient_email' => $patient->email,
                'tenant_id' => $currentTenantId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'Failed to send invitation email. Please try again or contact support if the problem persists.');
        }
    }

    /**
     * Resend patient invitation
     */
    public function resendInvitation($invitationId)
    {
        $oldInvitation = PatientInvitation::with(['patient'])
            ->find($invitationId);

        if (! $oldInvitation) {
            return back()->with('error', 'Invitation not found.');
        }

        try {
            DB::beginTransaction();

            // Step 1: Expire the old invitation
            $oldInvitation->update([
                'status' => 'expired',
            ]);

            // Step 2: Create a new invitation (tenant-scoped)
            $newInvitation = PatientInvitation::create([
                'patient_id' => $oldInvitation->patient_id,
                'email' => $oldInvitation->patient->email,
                'token' => Str::random(64),
                'status' => 'pending',
                'expires_at' => now()->addDays(7),
                'sent_at' => now(),
            ]);

            // Step 3: Send the new invitation email
            Mail::to($newInvitation->patient->email)->send(new \App\Mail\Tenant\PatientInvitationMail($newInvitation));

            DB::commit();

            $patientName = $oldInvitation->patient->first_name.' '.$oldInvitation->patient->last_name;

            return back()->with('success', "New invitation has been sent to {$patientName} ({$oldInvitation->patient->email}). Previous invitation has been expired.");

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to resend patient invitation', [
                'invitation_id' => $invitationId,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to resend invitation. Please try again.');
        }
    }

    public function checkEmail(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $email = $request->email;
        $exists = false;

        $exists = Patient::whereBlind('email', 'email_index', $email)->exists();

        if ($request->expectsJson()) {
            return response()->json(['exists' => $exists]);
        }

        return redirect()->back()->with('exists', $exists);
    }

    public function checkHealthNumber(Request $request)
    {
        $request->validate(['health_number' => 'required|string']);
        $healthNumber = $request->health_number;

        $patientExists = false;
        $patientId = null;
        $status = 'not_found';

        $patient = Patient::whereBlind('health_number', 'health_number_index', $healthNumber)->first();
        if ($patient) {
            $patientExists = true;
            $patientId = $patient->id;
        }

        if ($patientExists) {
            $status = 'exists_in_tenant';
        } else {
            $status = 'not_found';
        }

        if ($request->expectsJson()) {
            return response()->json([
                'status' => $status,
                'patient_id' => $patientId,
                'message' => $this->getStatusMessage($status),
            ]);
        }

        return redirect()->back()->with([
            'patient_status' => $status,
            'patient_id' => $patientId,
            'message' => $this->getStatusMessage($status),
        ]);
    }

    private function getStatusMessage($status)
    {
        switch ($status) {
            case 'exists_in_tenant':
                return 'This patient already exists in your system.';
            case 'not_found':
                return 'Patient does not exist. You can create a new patient.';
            default:
                return 'Unknown status.';
        }
    }

    public function validateEmail(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = $request->email;
        $existsInCentral = false;

        // Check central database
        tenancy()->central(function () use (&$existsInCentral, $email) {
            $existsInCentral = User::where('email', $email)->exists();
        });

        $isAvailable = ! $existsInCentral;

        return response()->json([
            'available' => $isAvailable,
            'message' => $isAvailable ? 'Email is available.' : 'Email is already taken in the system.',
        ]);
    }

    public function getPatientForAutofill(Request $request)
    {
        $request->validate([
            'patient_id' => 'required|integer',
        ]);

        $patient = Patient::find($request->patient_id);

        if (! $patient) {
            return response()->json([
                'error' => 'Patient not found',
            ], 404);
        }

        // Return decrypted patient data for form auto-fill
        return response()->json([
            'patient' => [
                'id' => $patient->id,
                'health_number' => $patient->health_number,
                'first_name' => $patient->first_name,
                'middle_name' => $patient->middle_name,
                'last_name' => $patient->last_name,
                'preferred_name' => $patient->preferred_name,
                'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
                'gender' => $patient->gender,
                'gender_pronouns' => $patient->gender_pronouns,
                'phone_number' => $patient->phone_number,
                'email' => $patient->email,
                'emergency_contact_name' => $patient->emergency_contact_name,
                'emergency_contact_phone' => $patient->emergency_contact_phone,
                'contact_person' => $patient->contact_person,
                'preferred_language' => $patient->preferred_language,
                'client_type' => $patient->client_type,
            ],
        ]);
    }

    public function searchByEmail(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = $request->email;

        // Search for patient by email using blind index
        $patient = Patient::whereBlind('email', 'email_index', $email)->first();

        if (! $patient) {
            return response()->json([
                'status' => 'not_found',
                'patient' => null,
            ]);
        }

        // Return patient summary for selection
        return response()->json([
            'status' => 'found',
            'patient' => [
                'id' => $patient->id,
                'health_number' => $patient->health_number,
                'first_name' => $patient->first_name,
                'last_name' => $patient->last_name,
                'email' => $patient->email,
                'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
            ],
        ]);
    }

    public function searchByName(Request $request)
    {
        $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
        ]);

        $firstName = $request->first_name;
        $lastName = $request->last_name;

        // Search for patients by first_name AND last_name using blind indexes
        $patients = Patient::whereBlind('first_name', 'first_name_index', $firstName)
            ->whereBlind('last_name', 'last_name_index', $lastName)
            ->get();

        if ($patients->isEmpty()) {
            return response()->json([
                'status' => 'not_found',
                'patients' => [],
            ]);
        }

        // Return patient summaries for selection
        $patientData = $patients->map(function ($patient) {
            return [
                'id' => $patient->id,
                'health_number' => $patient->health_number,
                'first_name' => $patient->first_name,
                'last_name' => $patient->last_name,
                'email' => $patient->email,
                'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
            ];
        });

        return response()->json([
            'status' => 'found',
            'patients' => $patientData,
            'count' => $patients->count(),
        ]);
    }

    /**
     * Generate AI Patient Overview based on patient history
     */
    private function generatePatientAIOverview($patient, $appointments, $encounters): string
    {
        try {
            // If no appointment history, return static summary
            if ($appointments->isEmpty()) {
                $displayName = $patient->preferred_name ?: "{$patient->first_name} {$patient->last_name}";
                $memberSince = Carbon::parse($patient->created_at)->format('F Y');

                return "{$displayName} joined our clinic in {$memberSince}. This patient is new to our system with no appointment history yet. We look forward to establishing a strong therapeutic relationship and providing comprehensive care tailored to their specific needs.";
            }

            // Build prompt for AI
            $displayName = $patient->preferred_name ?: "{$patient->first_name} {$patient->last_name}";
            $memberSince = Carbon::parse($patient->created_at)->format('F Y');
            $appointmentCount = $appointments->count();
            $completedCount = $appointments->where('status', 'completed')->count();
            $encounterCount = $encounters->count();

            $prompt = "Generate a professional patient overview summary for:\n\n";
            $prompt .= "Patient: {$displayName}\n";
            $prompt .= "Member Since: {$memberSince}\n";
            $prompt .= "Total Appointments: {$appointmentCount}\n";
            $prompt .= "Completed Sessions: {$completedCount}\n";
            $prompt .= "Total Encounters: {$encounterCount}\n\n";

            // Add recent appointment history
            if ($appointments->count() > 0) {
                $prompt .= "Recent Appointment History:\n";
                foreach ($appointments->take(5) as $apt) {
                    $date = Carbon::parse($apt->appointment_datetime)->format('M d, Y');
                    $service = $apt->service->name ?? 'General';
                    $status = $apt->status;
                    $prompt .= "- {$date}: {$service} ({$status})\n";
                }
                $prompt .= "\n";
            }

            // Add recent encounter details
            if ($encounters->count() > 0) {
                $prompt .= "Recent Session Notes:\n";
                foreach ($encounters->take(3) as $enc) {
                    if ($enc->chief_complaint) {
                        $prompt .= "- Chief Complaint: {$enc->chief_complaint}\n";
                    }
                    if ($enc->clinical_assessment) {
                        $prompt .= "- Assessment: {$enc->clinical_assessment}\n";
                    }
                    if ($enc->treatment_plan) {
                        $prompt .= "- Treatment Plan: {$enc->treatment_plan}\n";
                    }
                    $prompt .= "\n";
                }
            }

            $prompt .= "\nGenerate a professional, compassionate 3-4 paragraph summary that:\n";
            $prompt .= "1. Describes the patient's overall engagement with care\n";
            $prompt .= "2. Highlights their treatment journey and progress\n";
            $prompt .= "3. Notes any patterns in their care (without revealing sensitive details)\n";
            $prompt .= "4. Provides an overall assessment of their therapeutic relationship\n";
            $prompt .= "\nKeep it professional and appropriate for healthcare providers to read.";

            $systemPrompt = 'You are a healthcare AI assistant that generates professional patient overview summaries. Be compassionate, professional, and focus on overall care patterns without revealing sensitive medical details.';

            // Call AI service
            $aiService = new BedrockAIService;
            $aiResponse = $aiService->generateSummary(null, $prompt, $systemPrompt);

            // Convert bullet points to paragraph
            if (is_array($aiResponse) && ! empty($aiResponse)) {
                return implode("\n\n", $aiResponse);
            }

            // Fallback to static if AI fails
            return $this->getStaticPatientOverview($displayName, $memberSince, $appointmentCount, $completedCount);

        } catch (\Exception $e) {
            Log::error('Error generating AI patient overview: '.$e->getMessage());
            $displayName = $patient->preferred_name ?: "{$patient->first_name} {$patient->last_name}";
            $memberSince = Carbon::parse($patient->created_at)->format('F Y');
            $appointmentCount = $appointments->count();
            $completedCount = $appointments->where('status', 'completed')->count();

            return $this->getStaticPatientOverview($displayName, $memberSince, $appointmentCount, $completedCount);
        }
    }

    /**
     * Get static patient overview as fallback
     */
    private function getStaticPatientOverview($displayName, $memberSince, $appointmentCount, $completedCount): string
    {
        return "{$displayName} has been receiving care at our clinic since {$memberSince}. With {$appointmentCount} total appointments and {$completedCount} completed sessions, this patient demonstrates consistent engagement with their healthcare journey.\n\nTheir treatment approach has been collaborative, with regular follow-ups and comprehensive documentation supporting continuity of care. The patient shows good engagement with recommended treatment protocols.\n\nCurrent therapeutic relationship is well-established, with clear communication channels and mutual understanding of treatment goals. Regular monitoring and follow-up appointments ensure optimal care delivery.";
    }

    /**
     * Show edit medical history page for a patient (Admin view)
     */
    public function editMedicalHistory($patientId)
    {
        $patient = tenancy()->central(function () use ($patientId) {
            return Patient::findOrFail($patientId);
        });

        // Get medical history service
        $medicalHistoryService = app(\App\Services\PatientMedicalHistory::class);

        // Get medical data using the service
        $medicalData = $medicalHistoryService->getPatientMedicalData($patient->id);

        // Get medical history summary
        $summary = $medicalHistoryService->getMedicalHistorySummary($patient->id);

        return Inertia::render('Patient/EditMedicalHistory', [
            'patient' => $patient,
            'medicalData' => $medicalData,
            'summary' => $summary,
        ]);
    }

    /**
     * Admin update family medical histories (uses existing service)
     */
    public function adminUpdateFamilyMedicalHistories(Request $request, $patientId)
    {
        $request->validate([
            'family_medical_histories' => 'array',
            'family_medical_histories.*.relationship_to_patient' => 'required|string|max:255',
            'family_medical_histories.*.summary' => 'required|string|max:255',
            'family_medical_histories.*.details' => 'nullable|string',
            'family_medical_histories.*.diagnosis_date' => 'nullable|date',
        ]);

        $medicalHistoryService = app(\App\Services\PatientMedicalHistory::class);

        $result = $medicalHistoryService->saveFamilyMedicalHistories(
            $patientId,
            $request->input('family_medical_histories', [])
        );

        if ($result['success']) {
            // Get patient for notification
            $patient = Patient::find($patientId);

            // Send notification to admins
            $this->sendMedicalHistoryNotification(
                $patient,
                'family_medical_history',
                $request->input('family_medical_histories', [])
            );

            return response()->json(['message' => $result['message']]);
        }

        return response()->json(['message' => $result['error']], 422);
    }

    /**
     * Admin update patient medical histories (with notification)
     */
    public function adminUpdatePatientMedicalHistories(Request $request, $patientId)
    {
        $request->validate([
            'patient_medical_histories' => 'array',
            'patient_medical_histories.*.disease' => 'required|string|max:255',
            'patient_medical_histories.*.recent_tests' => 'nullable|string',
        ]);

        $medicalHistoryService = app(\App\Services\PatientMedicalHistory::class);

        $result = $medicalHistoryService->savePatientMedicalHistories(
            $patientId,
            $request->input('patient_medical_histories', [])
        );

        if ($result['success']) {
            // Get patient for notification
            $patient = Patient::find($patientId);

            // Send notification to admins
            $this->sendMedicalHistoryNotification(
                $patient,
                'medical_history',
                $request->input('patient_medical_histories', [])
            );

            return response()->json(['message' => $result['message']]);
        }

        return response()->json(['message' => $result['error']], 422);
    }

    /**
     * Admin update known allergies (with notification)
     */
    public function adminUpdateKnownAllergies(Request $request, $patientId)
    {
        $request->validate([
            'known_allergies' => 'array',
            'known_allergies.*.allergens' => 'required|string|max:255',
            'known_allergies.*.type' => 'required|string|in:food,medication,environmental,contact,other',
            'known_allergies.*.severity' => 'required|string|in:mild,moderate,severe',
            'known_allergies.*.reaction' => 'nullable|string|max:255',
            'known_allergies.*.notes' => 'nullable|string',
        ]);

        $medicalHistoryService = app(\App\Services\PatientMedicalHistory::class);

        $result = $medicalHistoryService->saveKnownAllergies(
            $patientId,
            $request->input('known_allergies', [])
        );

        if ($result['success']) {
            // Get patient for notification
            $patient = Patient::find($patientId);

            // Send notification to admins
            $this->sendMedicalHistoryNotification(
                $patient,
                'known_allergies',
                $request->input('known_allergies', [])
            );

            return response()->json(['message' => $result['message']]);
        }

        return response()->json(['message' => $result['error']], 422);
    }

    // ==============================================================
    // ALTERNATIVE: WITH TRY-CATCH IN CONTROLLER (More defensive)
    // ==============================================================

    public function adminUpdateKnownAllergiesWithTryCatch(Request $request, $patientId)
    {
        $request->validate([
            'known_allergies' => 'array',
            'known_allergies.*.allergens' => 'required|string|max:255',
            'known_allergies.*.type' => 'required|string|in:food,medication,environmental,contact,other',
            'known_allergies.*.severity' => 'required|string|in:mild,moderate,severe',
            'known_allergies.*.reaction' => 'nullable|string|max:255',
            'known_allergies.*.notes' => 'nullable|string',
        ]);

        $medicalHistoryService = app(\App\Services\PatientMedicalHistory::class);

        $result = $medicalHistoryService->saveKnownAllergies(
            $patientId,
            $request->input('known_allergies', [])
        );

        if ($result['success']) {
            // Send notification (won't fail the main operation if it errors)
            try {
                $patient = Patient::find($patientId);
                $this->sendMedicalHistoryNotification(
                    $patient,
                    'known_allergies',
                    $request->input('known_allergies', [])
                );
            } catch (\Throwable $e) {
                // Log but don't fail the request
                \Log::error('Failed to send allergy update notification', [
                    'patient_id' => $patientId,
                    'error' => $e->getMessage(),
                ]);
            }

            return response()->json(['message' => $result['message']]);
        }

        return response()->json(['message' => $result['error']], 422);
    }

    protected function sendMedicalHistoryNotification($patient, string $historyType, array $records = []): void
    {
        try {
            // Get organization name
            $orgName = \App\Models\OrganizationSetting::getValue('practice_details_name') ?? 'Organization';
            $organization = ['name' => $orgName];

            // Get admin recipients
            $recipients = \App\Models\User::role('Admin')
                ->whereNotNull('email')
                ->pluck('email')
                ->filter()
                ->unique()
                ->values()
                ->all();

            // Fallback to env admin email if no admins found
            if (empty($recipients) && env('ADMIN_EMAIL')) {
                $recipients = [env('ADMIN_EMAIL')];
            }

            if (empty($recipients)) {
                \Log::warning('Medical history notification: no admin recipients found', [
                    'patient_id' => $patient->id ?? null,
                    'history_type' => $historyType,
                ]);

                return;
            }

            // Optional: Generate patient URL
            $patientUrl = null;
            if (function_exists('route')) {
                try {
                    $patientId = is_object($patient) ? $patient->id : ($patient['id'] ?? null);
                    if ($patientId) {
                        $patientUrl = route('admin.patients.show', $patientId);
                    }
                } catch (\Throwable $e) {
                    // Route may not exist; ignore
                }
            }

            // Send the email
            Mail::to($recipients)->send(new \App\Mail\PatientMedicalHistoryUpdatedMail(
                organization: $organization,
                patient: $patient,
                historyType: $historyType,
                updatedBy: auth()->user(),
                records: $records,
                patientUrl: $patientUrl,
                changedAt: now(),
            ));

            \Log::info('Medical history notification sent successfully', [
                'patient_id' => is_object($patient) ? $patient->id : ($patient['id'] ?? null),
                'patient_name' => is_object($patient) ? $patient->name : ($patient['name'] ?? null),
                'history_type' => $historyType,
                'records_count' => count($records),
                'recipients_count' => count($recipients),
            ]);

        } catch (\Throwable $e) {
            \Log::error('Failed to send medical history notification', [
                'patient_id' => is_object($patient) ? $patient->id : ($patient['id'] ?? null),
                'history_type' => $historyType,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
