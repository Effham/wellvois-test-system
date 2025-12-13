<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CentralPractitioner;
use App\Models\Patient;
use App\Models\Tenant;
use App\Models\Tenant\Encounter;
use App\Models\Tenant\EncounterRecording;
use App\Models\Tenant\Patient as TenantPatient;
use App\Models\Tenant\Practitioner;
use App\Services\S3BucketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class RecordingController extends Controller
{
    public function __construct(
        private S3BucketService $s3BucketService
    ) {}

    /**
     * Get all recordings for the authenticated user.
     * For practitioners: recordings from encounters they're assigned to.
     * For patients: recordings from their appointments.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $recordings = collect();

        // Check if user is a practitioner
        $isPractitioner = $user->isPractitioner();
        $centralPractitioner = null;

        if ($isPractitioner) {
            // Get central practitioner
            $centralPractitioner = tenancy()->central(function () use ($user) {
                return CentralPractitioner::where('user_id', $user->id)->first();
            });

            if (! $centralPractitioner) {
                return response()->json([
                    'success' => false,
                    'message' => 'Practitioner profile not found.',
                ], 403);
            }

            // Get all tenant IDs where this practitioner has accepted invitations
            $tenantIds = $centralPractitioner->tenants()
                ->wherePivot('invitation_status', 'ACCEPTED')
                ->pluck('tenant_id')
                ->toArray();

            // Get recordings from all tenants
            foreach ($tenantIds as $tenantId) {
                $tenant = Tenant::find($tenantId);
                if (! $tenant) {
                    continue;
                }

                tenancy()->initialize($tenant);

                try {
                    // Get tenant practitioner
                    $tenantPractitioner = Practitioner::where('central_practitioner_id', $centralPractitioner->id)->first();

                    if (! $tenantPractitioner) {
                        tenancy()->end();

                        continue;
                    }

                    // Get encounter IDs where this practitioner is assigned
                    $encounterIds = Encounter::query()
                        ->join('appointments', 'encounters.appointment_id', '=', 'appointments.id')
                        ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                        ->where('appointment_practitioner.practitioner_id', $tenantPractitioner->id)
                        ->pluck('encounters.id')
                        ->toArray();

                    // Get recordings for these encounters
                    if (! empty($encounterIds)) {
                        $tenantRecordings = EncounterRecording::whereIn('encounter_id', $encounterIds)
                            ->with('encounter:id,appointment_id,status')
                            ->get();

                        $recordings = $recordings->merge($tenantRecordings);
                    }

                    tenancy()->end();
                } catch (\Exception $e) {
                    Log::error('Error fetching recordings from tenant', [
                        'tenant_id' => $tenantId,
                        'error' => $e->getMessage(),
                    ]);

                    try {
                        tenancy()->end();
                    } catch (\Exception $endError) {
                        // Ignore end errors
                    }

                    continue;
                }
            }
        } else {
            // User is a patient - get recordings from their appointments
            $centralPatient = tenancy()->central(function () use ($user) {
                return Patient::where('user_id', $user->id)->first();
            });

            if (! $centralPatient) {
                return response()->json([
                    'success' => false,
                    'message' => 'Patient profile not found.',
                ], 403);
            }

            // Get all tenant IDs where this patient has appointments
            // We need to check all tenants for patient appointments
            $allTenants = Tenant::all();

            foreach ($allTenants as $tenant) {
                tenancy()->initialize($tenant);

                try {
                    // Get tenant patient using external_patient_id
                    $tenantPatient = TenantPatient::where('external_patient_id', $centralPatient->id)->first();

                    if (! $tenantPatient) {
                        tenancy()->end();

                        continue;
                    }

                    // Get encounter IDs for this patient's appointments
                    $encounterIds = Encounter::query()
                        ->join('appointments', 'encounters.appointment_id', '=', 'appointments.id')
                        ->where('appointments.patient_id', $tenantPatient->id)
                        ->pluck('encounters.id')
                        ->toArray();

                    // Get recordings for these encounters
                    if (! empty($encounterIds)) {
                        $tenantRecordings = EncounterRecording::whereIn('encounter_id', $encounterIds)
                            ->with('encounter:id,appointment_id,status')
                            ->get();

                        $recordings = $recordings->merge($tenantRecordings);
                    }

                    tenancy()->end();
                } catch (\Exception $e) {
                    Log::error('Error fetching recordings from tenant for patient', [
                        'tenant_id' => $tenant->id,
                        'error' => $e->getMessage(),
                    ]);

                    try {
                        tenancy()->end();
                    } catch (\Exception $endError) {
                        // Ignore end errors
                    }

                    continue;
                }
            }
        }

        // Transform recordings with signed URLs
        $recordingsData = $recordings->map(function ($recording) {
            $signedUrl = null;

            // Generate signed URL if s3_key exists
            if (! empty($recording->s3_key)) {
                try {
                    $signedUrl = $this->s3BucketService->temporaryUrl(
                        $recording->s3_key,
                        now()->addMinutes(60), // 60 minutes expiration
                        ['ResponseContentType' => $recording->mime_type]
                    );
                } catch (\Exception $e) {
                    Log::error('Failed to generate signed URL for recording', [
                        'recording_id' => $recording->id,
                        's3_key' => $recording->s3_key,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            return [
                'id' => $recording->id,
                'encounter_id' => $recording->encounter_id,
                'file_name' => $recording->file_name,
                'mime_type' => $recording->mime_type,
                'file_size' => $recording->file_size,
                'duration_seconds' => $recording->duration_seconds,
                'signed_url' => $signedUrl,
                'transcription_status' => $recording->transcription_status,
                'created_at' => $recording->created_at?->toISOString(),
                'updated_at' => $recording->updated_at?->toISOString(),
            ];
        })->sortByDesc('created_at')->values();

        return response()->json([
            'success' => true,
            'data' => [
                'recordings' => $recordingsData,
                'total' => $recordingsData->count(),
            ],
        ]);
    }
}
