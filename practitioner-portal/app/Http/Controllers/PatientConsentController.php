<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Tenant\Consent;
use App\Models\Tenant\EntityConsent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PatientConsentController extends Controller
{
    /**
     * Show the patient consent page
     */
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            $patient = Patient::where('user_id', $user->id)->first();

            if (! $patient) {
                abort(403, 'Access denied. You are not registered as a patient.');
            }

            // Get pending consents from session (passed from auth route)
            $pendingConsents = $request->session()->get('pending_consents', []);
            $patientId = $request->session()->get('patient_id', $patient->id);

            // If no pending consents in session, check database
            if (empty($pendingConsents)) {
                // Get user's tenants
                $userTenants = userTenants($user);

                if (! empty($userTenants)) {
                    $firstTenant = \App\Models\Tenant::find($userTenants[0]['id']);

                    if ($firstTenant) {
                        // Initialize tenant to check consents
                        \Stancl\Tenancy\Facades\Tenancy::initialize($firstTenant);

                        // Get all patient consents
                        $allConsents = Consent::where('entity_type', 'PATIENT')
                            ->with('activeVersion')
                            ->get()
                            ->filter(fn ($consent) => $consent->activeVersion !== null);

                        // Check which consents patient has accepted
                        foreach ($allConsents as $consent) {
                            $hasAccepted = EntityConsent::where('consentable_type', Patient::class)
                                ->where('consentable_id', $patient->id)
                                ->where('consent_version_id', $consent->activeVersion->id)
                                ->exists();

                            if (! $hasAccepted && $consent->activeVersion) {
                                $pendingConsents[] = [
                                    'id' => $consent->id,
                                    'key' => $consent->key,
                                    'title' => $consent->title,
                                    'entity_type' => $consent->entity_type,
                                    'activeVersion' => [
                                        'id' => $consent->activeVersion->id,
                                        'version' => $consent->activeVersion->version,
                                        'status' => $consent->activeVersion->status,
                                        'consent_body' => $consent->activeVersion->consent_body,
                                        'created_at' => $consent->activeVersion->created_at,
                                        'updated_at' => $consent->activeVersion->updated_at,
                                    ],
                                ];
                            }
                        }

                        \Stancl\Tenancy\Facades\Tenancy::end();
                    }
                }
            }

            Log::info('Patient consent page accessed', [
                'patient_id' => $patient->id,
                'pending_consents_count' => count($pendingConsents),
            ]);

            // If no pending consents, redirect to dashboard
            if (empty($pendingConsents)) {
                return redirect()->route('central.patient-dashboard');
            }

            return Inertia::render('Patient/Consents/Index', [
                'patient' => $patient,
                'pendingConsents' => $pendingConsents,
            ]);

        } catch (\Exception $e) {
            Log::error('Error showing patient consent page', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->route('central.patient-dashboard')
                ->with('error', 'An error occurred. Please try again later.');
        }
    }

    /**
     * Accept patient consents
     */
    public function accept(Request $request)
    {
        try {
            $request->validate([
                'consent_version_ids' => 'required|array',
                'consent_version_ids.*' => 'integer',
            ]);

            $user = Auth::user();
            $patient = Patient::where('user_id', $user->id)->first();

            if (! $patient) {
                return response()->json([
                    'success' => false,
                    'message' => 'Patient not found.',
                ], 404);
            }

            $consentVersionIds = $request->input('consent_version_ids', []);

            // Get user's tenants
            $userTenants = userTenants($user);

            if (empty($userTenants)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No tenants found.',
                ], 404);
            }

            $firstTenant = \App\Models\Tenant::find($userTenants[0]['id']);

            if (! $firstTenant) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tenant not found.',
                ], 404);
            }

            // Accept all consent versions in tenant context
            $acceptedCount = 0;
            \Stancl\Tenancy\Facades\Tenancy::initialize($firstTenant);

            try {
                foreach ($consentVersionIds as $versionId) {
                    // Check if already accepted
                    $existing = EntityConsent::where('consentable_type', Patient::class)
                        ->where('consentable_id', $patient->id)
                        ->where('consent_version_id', $versionId)
                        ->first();

                    if (! $existing) {
                        EntityConsent::create([
                            'consentable_type' => Patient::class,
                            'consentable_id' => $patient->id,
                            'consent_version_id' => $versionId,
                            'consented_at' => now(),
                        ]);
                        $acceptedCount++;
                    }
                }
            } finally {
                \Stancl\Tenancy\Facades\Tenancy::end();
            }

            Log::info('Patient consents accepted', [
                'patient_id' => $patient->id,
                'patient_email' => $patient->email,
                'consents_accepted' => $acceptedCount,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Consents accepted successfully.',
                'accepted_count' => $acceptedCount,
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error accepting patient consents', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred. Please try again.',
            ], 500);
        }
    }

    /**
     * Get pending consents for public portal registration
     */
    public function getPendingConsents(Request $request)
    {
        try {
            $validated = $request->validate([
                'patient_id' => 'required|integer',
            ]);

            $patientId = $validated['patient_id'];

            // We're already in tenant context (route is on tenant domain)
            // Query consents from tenant database
            try {
                // Get all patient consents
                $allConsents = Consent::where('entity_type', 'PATIENT')
                    ->with('activeVersion')
                    ->get()
                    ->filter(fn ($consent) => $consent->activeVersion !== null);

                $pendingConsents = [];
                foreach ($allConsents as $consent) {
                    $hasAccepted = EntityConsent::where('consentable_type', Patient::class)
                        ->where('consentable_id', $patientId)
                        ->where('consent_version_id', $consent->activeVersion->id)
                        ->exists();

                    if (! $hasAccepted && $consent->activeVersion) {
                        // consent_body is already an array (cast in model)
                        $consentBody = is_array($consent->activeVersion->consent_body)
                            ? $consent->activeVersion->consent_body
                            : json_decode($consent->activeVersion->consent_body, true);

                        $pendingConsents[] = [
                            'id' => $consent->id,
                            'key' => $consent->key,
                            'title' => $consent->title,
                            'activeVersion' => [
                                'id' => $consent->activeVersion->id,
                                'version' => $consent->activeVersion->version,
                                'status' => $consent->activeVersion->status,
                                'consent_body' => $consentBody ?? [
                                    'heading' => $consent->title,
                                    'description' => $consent->description,
                                    'content' => $consent->description ?? 'No content available.',
                                ],
                            ],
                        ];
                    }
                }

                Log::info('Pending consents fetched', [
                    'patient_id' => $patientId,
                    'tenant_id' => tenant('id'),
                    'pending_count' => count($pendingConsents),
                ]);

                return response()->json([
                    'success' => true,
                    'pending_consents' => $pendingConsents,
                ]);
            } catch (\Exception $e) {
                Log::error('Error in getPendingConsents within tenant context', [
                    'error' => $e->getMessage(),
                    'patient_id' => $patientId,
                    'tenant_id' => tenant('id'),
                    'trace' => $e->getTraceAsString(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'An error occurred. Please try again.',
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error('Error getting pending consents', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred. Please try again.',
            ], 500);
        }
    }

    /**
     * Accept all consents for public portal registration (no auth required)
     */
    public function acceptAll(Request $request)
    {
        try {
            $request->validate([
                'patient_id' => 'required|integer',
                'consent_version_ids' => 'required|array',
                'consent_version_ids.*' => 'integer',
            ]);

            $patientId = $request->input('patient_id');
            $consentVersionIds = $request->input('consent_version_ids', []);

            // We're already in tenant context (route is on tenant domain)
            // Query consents from tenant database directly
            try {
                $acceptedCount = 0;

                foreach ($consentVersionIds as $versionId) {
                    // Check if already accepted
                    $existing = EntityConsent::where('consentable_type', Patient::class)
                        ->where('consentable_id', $patientId)
                        ->where('consent_version_id', $versionId)
                        ->first();

                    if (! $existing) {
                        EntityConsent::create([
                            'consentable_type' => Patient::class,
                            'consentable_id' => $patientId,
                            'consent_version_id' => $versionId,
                            'consented_at' => now(),
                        ]);
                        $acceptedCount++;
                    }
                }

                Log::info('Public portal patient consents accepted', [
                    'patient_id' => $patientId,
                    'consents_accepted' => $acceptedCount,
                    'tenant_id' => tenant('id'),
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Consents accepted successfully.',
                    'accepted_count' => $acceptedCount,
                ]);
            } catch (\Exception $e) {
                Log::error('Error accepting public portal consents within tenant context', [
                    'error' => $e->getMessage(),
                    'patient_id' => $patientId,
                    'tenant_id' => tenant('id'),
                    'trace' => $e->getTraceAsString(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'An error occurred. Please try again.',
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error('Error accepting public portal consents', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred. Please try again.',
            ], 500);
        }
    }
}
