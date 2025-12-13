<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientMinimalResource;
use App\Models\Patient;
use App\Models\Tenant\Encounter;
use App\Services\DocumentAccessTokenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class DocumentAccessController extends Controller
{
    public function __construct(
        private DocumentAccessTokenService $tokenService
    ) {}

    /**
     * Handle document access entry point from email link.
     */
    public function showAccessPage(Request $request, string $token)
    {
        // Validate token
        $tokenData = $this->tokenService->validateToken($token);

        if (! $tokenData) {
            return Inertia::render('Documents/TokenExpired');
        }

        // Get patient from central database
        $patient = tenancy()->central(function () use ($tokenData) {
            return Patient::find($tokenData['patient_id']);
        });

        if (! $patient) {
            Log::error('Document access: Patient not found', ['patient_id' => $tokenData['patient_id']]);
            abort(404, 'Patient not found');
        }

        $encounterId = $tokenData['encounter_id'];

        // Scenario 1: Patient exists but user_id is NULL → Show verification form
        if (is_null($patient->user_id)) {
            return Inertia::render('Documents/VerifyPatient', [
                'token' => $token,
                'encounterId' => $encounterId,
                'patientEmail' => $patient->email,
            ]);
        }

        // Scenario 2: Patient has user_id AND is logged in → Redirect to preview
        if (Auth::check() && Auth::id() === $patient->user_id) {
            // Store document IDs in session if present in token
            if (! empty($tokenData['document_ids'])) {
                session(['document_ids_filter' => $tokenData['document_ids']]);
            }

            // Mark token as used
            $this->tokenService->markTokenAsUsed($token);

            return redirect()->route('documents.preview', ['encounter' => $encounterId]);
        }

        // Scenario 3: Patient has user_id but NOT logged in → Redirect to login with intended URL
        // Pass intended URL and token as query parameters to bridge tenant→central session gap
        $intendedUrl = route('documents.preview', ['encounter' => $encounterId]);

        return redirect()->route('login', [
            'intended' => $intendedUrl,
            'document_access_token' => $token,
        ])->with('message', 'Please log in to view your documents.');
    }

    /**
     * Verify patient identity and create SSO session.
     */
    public function verifyPatient(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'date_of_birth' => 'required|date',
            'health_number' => 'required|string',
        ]);

        // Validate token
        $tokenData = $this->tokenService->validateToken($validated['token']);

        if (! $tokenData) {
            return back()->withErrors(['token' => 'Invalid or expired token']);
        }

        // Verify patient details against central database (encrypted fields)
        $patient = tenancy()->central(function () use ($validated, $tokenData) {
            return Patient::where('id', $tokenData['patient_id'])
                ->whereBlind('first_name', 'first_name_index', $validated['first_name'])
                ->whereBlind('last_name', 'last_name_index', $validated['last_name'])
                ->whereDate('date_of_birth', $validated['date_of_birth'])
                ->whereBlind('health_number', 'health_number_index', $validated['health_number'])
                ->first();
        });

        if (! $patient) {
            Log::warning('Document access: Patient verification failed', [
                'token' => substr($validated['token'], 0, 10).'...',
                'provided_data' => [
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                ],
            ]);

            return back()->withErrors(['verification' => 'The information provided does not match our records. Please check and try again.']);
        }

        // Mark token as used
        $this->tokenService->markTokenAsUsed($validated['token']);

        // Redirect to preview page with temporary access
        // Store patient ID in session for verification on preview page
        session(['verified_patient_id' => $patient->id]);
        session(['verified_encounter_id' => $tokenData['encounter_id']]);

        // Store document IDs in session if present in token
        if (! empty($tokenData['document_ids'])) {
            session(['document_ids_filter' => $tokenData['document_ids']]);
        }

        return redirect()->route('documents.preview', ['encounter' => $tokenData['encounter_id']]);
    }

    /**
     * Show document preview/download page.
     */
    public function previewDocuments(Request $request, Encounter $encounter)
    {
        // Check access permissions
        if (! $this->canAccessEncounter($encounter)) {
            abort(403, 'You do not have permission to view these documents.');
        }

        // Load encounter with patient and documents
        $this->loadEncounterWithPatient($encounter);

        // Build query for practitioner-uploaded documents
        $query = $encounter->documents()
            ->whereHas('documentRequest', function ($query) {
                $query->where('by_practitioner', true);
            })
            ->with('documentRequest');

        // Check if we should filter by specific document IDs from the token
        $documentIds = session('document_ids_filter');
        Log::info('📄 Document preview - checking for filter', [
            'encounter_id' => $encounter->id,
            'document_ids_filter' => $documentIds,
            'has_filter' => ! empty($documentIds),
        ]);

        if (! empty($documentIds) && is_array($documentIds)) {
            // Filter to only show specific documents mentioned in the email
            $query->whereIn('id', $documentIds);
            Log::info('📄 Applying document ID filter', [
                'encounter_id' => $encounter->id,
                'filtered_document_ids' => $documentIds,
            ]);
            // Clear the session filter after use
            session()->forget('document_ids_filter');
        }

        $practitionerDocuments = $query->orderBy('created_at', 'desc')->get();

        Log::info('📄 Documents fetched for preview', [
            'encounter_id' => $encounter->id,
            'document_count' => $practitionerDocuments->count(),
            'document_ids' => $practitionerDocuments->pluck('id')->toArray(),
        ]);

        // Get clinic name
        $clinicName = tenant('company_name') ?? config('app.name');

        return Inertia::render('Documents/PreviewDocuments', [
            'encounter' => $encounter,
            'documents' => $practitionerDocuments,
            'clinicName' => $clinicName,
            'patient' => $encounter->appointment->patient ? (new PatientMinimalResource($encounter->appointment->patient))->resolve() : null,
        ]);
    }

    /**
     * Check if current user/session can access the encounter.
     */
    private function canAccessEncounter(Encounter $encounter): bool
    {
        // Load appointment relationship to avoid cross-context database access
        $encounter->load('appointment');

        // Extract patient_id before any central context calls
        $appointmentPatientId = $encounter->appointment->patient_id ?? null;

        // If user is authenticated
        if (Auth::check()) {
            $user = Auth::user();

            // Check if user is the patient for this encounter
            $isPatient = tenancy()->central(function () use ($user, $appointmentPatientId) {
                $patient = Patient::where('user_id', $user->id)->first();

                return $patient && $patient->id === $appointmentPatientId;
            });

            if ($isPatient) {
                return true;
            }
        }

        // Check for verified patient session (from verification form)
        if (session('verified_patient_id') && session('verified_encounter_id')) {
            $verifiedPatientId = session('verified_patient_id');
            $verifiedEncounterId = session('verified_encounter_id');

            return $encounter->id === $verifiedEncounterId &&
                   $appointmentPatientId === $verifiedPatientId;
        }

        return false;
    }

    /**
     * Load encounter with patient data from central database.
     */
    private function loadEncounterWithPatient(Encounter $encounter): void
    {
        // Load the appointment with service
        $encounter->load('appointment.service');

        // Manually load patient from central database
        if ($encounter->appointment && $encounter->appointment->patient_id) {
            $patient = tenancy()->central(function () use ($encounter) {
                return Patient::find($encounter->appointment->patient_id);
            });
            $encounter->appointment->patient = $patient ? (new PatientMinimalResource($patient))->resolve() : null;
        }
    }
}
