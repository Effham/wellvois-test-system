<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Tenant\Consent;
use App\Models\Tenant\Patient as TenantPatient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PatientConsentController extends Controller
{
    /**
     * Display consent management page for the authenticated patient
     */
    public function index()
    {
        $user = auth()->user();

        // Check if user has Patient role OR tenant patient record
        $hasPatientRole = $user->hasRole('Patient');
        $hasTenantPatientRecord = \App\Models\Tenant\Patient::where('user_id', $user->id)->exists();

        if (! $hasPatientRole && ! $hasTenantPatientRecord) {
            abort(403, 'Access denied. You must be a patient or have a patient record in this tenant.');
        }

        // Get patient from tenant database (preferred) or central database (fallback)
        $patient = \App\Models\Tenant\Patient::where('user_id', $user->id)->first();

        // Fallback to central database if not found in tenant
        if (! $patient) {
            $patient = tenancy()->central(function () use ($user) {
                return Patient::where('user_id', $user->id)->first();
            });
        }

        if (! $patient) {
            return redirect()->route('dashboard')
                ->with('error', 'Patient record not found.');
        }

        // Get all patient consents (pending and accepted)
        $allPatientConsents = Consent::where('entity_type', 'PATIENT')
            ->with('activeVersion')
            ->get()
            ->filter(fn ($consent) => $consent->activeVersion !== null);

        $pendingConsents = collect();
        $acceptedConsents = collect();

        foreach ($allPatientConsents as $consent) {
            $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', TenantPatient::class)
                ->where('consentable_id', $patient->id)
                ->where('consent_version_id', $consent->activeVersion->id)
                ->first();

            if ($hasAccepted) {
                $acceptedConsents->push([
                    'id' => $consent->id,
                    'key' => $consent->key,
                    'title' => $consent->title,
                    'is_required' => $consent->is_required,
                    'version_id' => $consent->activeVersion->id,
                    'version' => $consent->activeVersion->version,
                    'body' => $consent->activeVersion->consent_body,
                    'accepted_at' => $hasAccepted->consented_at,
                ]);
            } else {
                $pendingConsents->push([
                    'id' => $consent->id,
                    'key' => $consent->key,
                    'title' => $consent->title,
                    'is_required' => $consent->is_required,
                    'version_id' => $consent->activeVersion->id,
                    'version' => $consent->activeVersion->version,
                    'body' => $consent->activeVersion->consent_body,
                ]);
            }
        }

        return Inertia::render('Consents/PatientConsentManagement', [
            'patient' => $patient,
            'pendingConsents' => $pendingConsents,
            'acceptedConsents' => $acceptedConsents,
        ]);
    }

    /**
     * Accept a specific consent version
     */
    public function accept(Request $request, int $consentVersionId)
    {
        Log::info('PatientConsentController::accept START', [
            'consent_version_id' => $consentVersionId,
            'request_data' => $request->all(),
        ]);

        // Get user first
        $user = auth()->user();
        Log::info('Auth user check', ['user_id' => $user->id, 'user_email' => $user->email]);

        // Validate without database check - we'll verify manually
        $request->validate([
            'patient_id' => 'required|integer',
        ]);

        $patientId = $request->input('patient_id');

        try {
            // Verify patient belongs to user
            $patient = tenancy()->central(function () use ($user, $patientId) {
                return Patient::where('id', $patientId)
                    ->where('user_id', $user->id)
                    ->first();
            });

            Log::info('Patient lookup', ['patient' => $patient ? ['id' => $patient->id, 'email' => $patient->email] : 'not found']);

            if (! $patient) {
                Log::error('Unauthorized - patient not found or does not belong to user', [
                    'patient_id' => $patientId,
                    'user_id' => $user->id,
                ]);

                return back()->with('error', 'Unauthorized access.');
            }

            // Check if consent version exists and is for patient
            $consentVersion = \App\Models\Tenant\ConsentVersion::find($consentVersionId);

            if (! $consentVersion) {
                Log::error('Consent version not found', ['consent_version_id' => $consentVersionId]);

                return back()->with('error', 'Consent version not found.');
            }

            // Verify it's a patient consent
            $consent = $consentVersion->consent;
            if ($consent->entity_type !== 'PATIENT') {
                Log::error('Consent is not for patients', [
                    'consent_id' => $consent->id,
                    'entity_type' => $consent->entity_type,
                ]);

                return back()->with('error', 'Invalid consent type.');
            }

            // Check if consent already exists
            $existing = \App\Models\Tenant\EntityConsent::where('consentable_type', Patient::class)
                ->where('consentable_id', $patient->id)
                ->where('consent_version_id', $consentVersionId)
                ->first();

            if ($existing) {
                Log::info('Consent already exists', ['entity_consent_id' => $existing->id]);

                return back()->with('success', 'Consent already accepted.');
            }

            // Accept consent in tenant database context
            $entityConsent = \App\Models\Tenant\EntityConsent::create([
                'consentable_type' => TenantPatient::class,
                'consentable_id' => $patient->id,
                'consent_version_id' => $consentVersionId,
                'consented_at' => now(),
            ]);

            Log::info('Patient consent accepted SUCCESS', [
                'patient_id' => $patient->id,
                'consent_version_id' => $consentVersionId,
                'entity_consent_id' => $entityConsent->id,
            ]);

            return back()->with('success', 'Consent accepted successfully.');
        } catch (\Exception $e) {
            Log::error('Failed to accept patient consent', [
                'patient_id' => $patientId,
                'consent_version_id' => $consentVersionId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'Failed to accept consent: '.$e->getMessage());
        }
    }

    /**
     * Accept multiple consents at once
     */
    public function acceptAll(Request $request)
    {
        Log::info('PatientConsentController::acceptAll START', [
            'request_data' => $request->all(),
        ]);

        $user = auth()->user();
        Log::info('Auth user check', ['user_id' => $user->id, 'user_email' => $user->email]);

        $request->validate([
            'patient_id' => 'required|integer',
            'consent_version_ids' => 'required|array',
            'consent_version_ids.*' => 'required|integer',
        ]);

        $patientId = $request->input('patient_id');
        $consentVersionIds = $request->input('consent_version_ids', []);

        try {
            // Verify patient belongs to user
            $patient = tenancy()->central(function () use ($user, $patientId) {
                return Patient::where('id', $patientId)
                    ->where('user_id', $user->id)
                    ->first();
            });

            Log::info('Patient lookup', ['patient' => $patient ? ['id' => $patient->id, 'email' => $patient->email] : 'not found']);

            if (! $patient) {
                Log::error('Unauthorized - patient not found or does not belong to user');

                return back()->with('error', 'Unauthorized access.');
            }

            $acceptedCount = 0;
            $skippedCount = 0;

            foreach ($consentVersionIds as $consentVersionId) {
                // Check if consent version exists and is for patient
                $consentVersion = \App\Models\Tenant\ConsentVersion::find($consentVersionId);

                if (! $consentVersion) {
                    Log::warning('Consent version not found, skipping', ['consent_version_id' => $consentVersionId]);

                    continue;
                }

                // Verify it's a patient consent
                $consent = $consentVersion->consent;
                if ($consent->entity_type !== 'PATIENT') {
                    Log::warning('Consent is not for patients, skipping', ['consent_id' => $consent->id]);

                    continue;
                }

                // Check if already accepted
                $existing = \App\Models\Tenant\EntityConsent::where('consentable_type', Patient::class)
                    ->where('consentable_id', $patient->id)
                    ->where('consent_version_id', $consentVersionId)
                    ->first();

                if (! $existing) {
                    \App\Models\Tenant\EntityConsent::create([
                        'consentable_type' => TenantPatient::class,
                        'consentable_id' => $patient->id,
                        'consent_version_id' => $consentVersionId,
                        'consented_at' => now(),
                    ]);
                    $acceptedCount++;
                } else {
                    $skippedCount++;
                }
            }

            Log::info('Patient consents accepted (batch)', [
                'patient_id' => $patient->id,
                'accepted_count' => $acceptedCount,
                'skipped_count' => $skippedCount,
                'total_consent_ids' => count($consentVersionIds),
            ]);

            return back()->with('success', "Successfully accepted {$acceptedCount} consents.");
        } catch (\Exception $e) {
            Log::error('Failed to accept patient consents (batch)', [
                'patient_id' => $patientId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'Failed to accept consents. Please try again.');
        }
    }

    /**
     * Revoke an accepted consent
     */
    public function revoke(Request $request, int $consentVersionId)
    {
        Log::info('PatientConsentController::revoke START', [
            'consent_version_id' => $consentVersionId,
            'request_data' => $request->all(),
        ]);

        // Get user first
        $user = auth()->user();
        Log::info('Auth user check', ['user_id' => $user->id, 'user_email' => $user->email]);

        // Validate without database check - we'll verify manually
        $request->validate([
            'patient_id' => 'required|integer',
        ]);

        $patientId = $request->input('patient_id');

        try {
            // Verify patient belongs to user
            $patient = tenancy()->central(function () use ($user, $patientId) {
                return Patient::where('id', $patientId)
                    ->where('user_id', $user->id)
                    ->first();
            });

            Log::info('Patient lookup', ['patient' => $patient ? ['id' => $patient->id, 'email' => $patient->email] : 'not found']);

            if (! $patient) {
                Log::error('Unauthorized - patient not found or does not belong to user', [
                    'patient_id' => $patientId,
                    'user_id' => $user->id,
                ]);

                return back()->with('error', 'Unauthorized access.');
            }

            // Find the entity consent
            $entityConsent = \App\Models\Tenant\EntityConsent::where('consentable_type', Patient::class)
                ->where('consentable_id', $patient->id)
                ->where('consent_version_id', $consentVersionId)
                ->first();

            Log::info('Entity consent lookup', ['entity_consent' => $entityConsent ? ['id' => $entityConsent->id] : 'not found']);

            if (! $entityConsent) {
                Log::error('Consent not found for revocation', [
                    'patient_id' => $patient->id,
                    'consent_version_id' => $consentVersionId,
                ]);

                return back()->with('error', 'Consent not found.');
            }

            // Check if this consent is required - required consents cannot be revoked
            $consentVersion = \App\Models\Tenant\ConsentVersion::find($consentVersionId);
            $consent = $consentVersion ? \App\Models\Tenant\Consent::find($consentVersion->consent_id) : null;

            if ($consent && $consent->is_required) {
                Log::warning('Attempt to revoke required consent blocked', [
                    'patient_id' => $patient->id,
                    'consent_id' => $consent->id,
                    'consent_title' => $consent->title,
                ]);

                return back()->with('error', 'This consent is required and cannot be revoked.');
            }

            $entityConsent->delete();

            Log::info('Patient consent revoked SUCCESS', [
                'patient_id' => $patient->id,
                'consent_version_id' => $consentVersionId,
            ]);

            return back()->with('success', 'Consent revoked successfully.');
        } catch (\Exception $e) {
            Log::error('Failed to revoke patient consent', [
                'patient_id' => $patientId,
                'consent_version_id' => $consentVersionId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'Failed to revoke consent: '.$e->getMessage());
        }
    }

    /**
     * Show consent page from email link (public, no auth required)
     */
    public function show(string $token)
    {
        // TODO: Implement token-based consent acceptance
        // For now, this will show the consent page
        // The token should be generated when sending consent emails
        // and should allow accepting consents without authentication

        return Inertia::render('Consents/PatientConsentFromEmail', [
            'token' => $token,
        ]);
    }

    /**
     * Accept consent from email link
     */
    public function acceptFromEmail(Request $request, string $token)
    {
        // TODO: Implement token-based acceptance
        // This should:
        // 1. Decode/verify the token
        // 2. Extract patient ID from token
        // 3. Accept the consents
        // 4. Redirect to login or dashboard

        return back()->with('info', 'Token-based consent acceptance will be implemented.');
    }
}
