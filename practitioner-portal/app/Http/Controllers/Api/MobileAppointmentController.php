<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MobileAppointmentController extends Controller
{
    /**
     * Display all appointments for the authenticated practitioner across all tenants
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Verify user is a practitioner
        $practitioner = \App\Models\CentralPractitioner::where('user_id', $user->id)->first();
        if (! $practitioner) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Practitioner profile not found.',
            ], 403);
        }

        // Get filter parameters
        $status = $request->get('status', '');
        $dateFrom = $request->get('date_from', '');
        $dateTo = $request->get('date_to', '');
        $search = $request->get('search', '');
        $perPage = (int) $request->get('perPage', 10);

        // Get all tenant databases where this practitioner has appointments
        $tenantIds = $practitioner->tenants()
            ->wherePivot('invitation_status', 'ACCEPTED')
            ->when($request->tenant_id, function ($query, $tenantId) {
                return $query->where('tenants.id', $tenantId);
            })
            ->pluck('tenant_id')
            ->toArray();

        $allAppointments = collect();
        $stats = [
            'appointments_this_week' => 0,
            'todays_recordings' => 0,
            'upcoming_appointments' => 0,
        ];

        foreach ($tenantIds as $tenantId) {
            // Get tenant info
            $tenant = \App\Models\Tenant::find($tenantId);
            if (! $tenant) {
                continue;
            }

            // Switch to tenant database
            tenancy()->initialize($tenant);

            try {
                // Get tenant practitioner using central_practitioner_id
                $tenantPractitioner = \App\Models\Practitioner::where('central_practitioner_id', $practitioner->id)->first();

                if (! $tenantPractitioner) {
                    tenancy()->end();

                    continue;
                }

                // Query appointments for this practitioner in this tenant
                $query = \App\Models\Tenant\Appointment::select(
                    'appointments.*',
                    'appointment_practitioner.start_time as pivot_start_time',
                    'appointment_practitioner.end_time as pivot_end_time'
                )
                    ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                    ->where('appointment_practitioner.practitioner_id', $tenantPractitioner->id)
                    ->with(['service', 'location']);

                // Apply filters
                if ($status) {
                    $query->where('status', $status);
                }

                if ($dateFrom && $dateTo) {
                    $query->whereBetween('appointment_datetime', [$dateFrom, $dateTo]);
                } elseif ($dateFrom) {
                    $query->where('appointment_datetime', '>=', $dateFrom);
                } elseif ($dateTo) {
                    $query->where('appointment_datetime', '<=', $dateTo);
                }

                if ($search) {
                    // Get patient IDs from central database that match search criteria
                    $matchingPatientIds = tenancy()->central(function () use ($search) {
                        return \App\Models\Patient::whereBlind('first_name', 'first_name_index', $search)
                            ->orWhereBlind('last_name', 'last_name_index', $search)
                            ->orWhereBlind('email', 'email_index', $search)
                            ->pluck('id')
                            ->toArray();
                    });

                    $query->where(function ($q) use ($search, $matchingPatientIds) {
                        if (! empty($matchingPatientIds)) {
                            $q->whereIn('patient_id', $matchingPatientIds);
                        }
                        $q->orWhereHas('service', function ($serviceQuery) use ($search) {
                            $serviceQuery->where('name', 'like', "%{$search}%");
                        });
                    });
                }

                $appointments = $query->orderBy('appointment_datetime', 'desc')
                    ->get()
                    ->map(function ($appointment) use ($tenant) {
                        // Get patient info from central database
                        $patientInfo = tenancy()->central(function () use ($appointment) {
                            return \App\Models\Patient::find($appointment->patient_id);
                        });

                        // For central appointments, use location timezone for display
                        $location = $appointment->location;
                        $appointmentDatetimeLocal = $appointment->appointment_datetime;

                        if ($location && $location->timezone) {
                            $appointmentDatetimeLocal = \App\Services\SimpleTimezoneService::toLocal($appointment->appointment_datetime, $location->id);
                        }

                        return [
                            'id' => $appointment->id,
                            'tenant_id' => $tenant->id,
                            'tenant_name' => $tenant->company_name ?? $tenant->id,
                            'appointment_datetime' => $appointment->appointment_datetime,
                            'appointment_datetime_local' => $appointmentDatetimeLocal,
                            'tenant_timezone' => $location ? $location->timezone : null,
                            'start_time' => $appointment->pivot_start_time ?? $appointment->start_time,
                            'end_time' => $appointment->pivot_end_time ?? $appointment->end_time,
                            'status' => $appointment->status,
                            'notes' => $appointment->notes,
                            'service' => $appointment->service ? [
                                'id' => $appointment->service->id,
                                'name' => $appointment->service->name,
                                'duration' => $appointment->service->duration,
                            ] : null,
                            'patient' => $patientInfo ? [
                                'id' => $patientInfo->id,
                                'first_name' => $patientInfo->first_name,
                                'last_name' => $patientInfo->last_name,
                                'email' => $patientInfo->email,
                                'phone_number' => $patientInfo->phone_number,
                            ] : null,
                            'booking_source' => $appointment->booking_source,
                            'date_time_preference' => $appointment->date_time_preference,
                            'created_at' => $appointment->created_at,
                            'updated_at' => $appointment->updated_at,
                        ];
                    });

                $allAppointments = $allAppointments->merge($appointments);

                // Calculate stats for this tenant
                $now = \Carbon\Carbon::now();
                $startOfWeek = $now->copy()->startOfWeek();
                $endOfWeek = $now->copy()->endOfWeek();

                // 1. Appointments this week (confirmed)
                $weekCount = \App\Models\Tenant\Appointment::join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                    ->where('appointment_practitioner.practitioner_id', $tenantPractitioner->id)
                    ->where('status', 'confirmed')
                    ->whereBetween('appointment_datetime', [$startOfWeek, $endOfWeek])
                    ->count();
                $stats['appointments_this_week'] += $weekCount;

                // 2. Upcoming appointments (confirmed)
                $upcomingCount = \App\Models\Tenant\Appointment::join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                    ->where('appointment_practitioner.practitioner_id', $tenantPractitioner->id)
                    ->where('status', 'confirmed')
                    ->where('appointment_datetime', '>', $now)
                    ->count();
                $stats['upcoming_appointments'] += $upcomingCount;

                // 3. Today's recordings
                $todayRecordingsCount = \App\Models\Tenant\EncounterRecording::whereDate('created_at', \Carbon\Carbon::today())
                    ->join('encounters', 'encounter_recordings.encounter_id', '=', 'encounters.id')
                    ->join('appointments', 'encounters.appointment_id', '=', 'appointments.id')
                    ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                    ->where('appointment_practitioner.practitioner_id', $tenantPractitioner->id)
                    ->count();
                $stats['todays_recordings'] += $todayRecordingsCount;

            } catch (\Exception $e) {
                // Log error but continue to next tenant
                \Illuminate\Support\Facades\Log::error("Error fetching appointments for tenant {$tenantId}: ".$e->getMessage());

                try {
                    tenancy()->end();
                } catch (\Exception $endError) {
                    // Ignore end errors
                }

                continue;
            }

            // Reset to central context after processing each tenant
            tenancy()->end();
        }

        // Sort all appointments by date descending
        $allAppointments = $allAppointments->sortByDesc('appointment_datetime');

        // Paginate the results
        $currentPage = (int) $request->get('page', 1);
        $offset = ($currentPage - 1) * $perPage;
        $paginatedAppointments = $allAppointments->slice($offset, $perPage)->values();
        $total = $allAppointments->count();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'appointments' => $paginatedAppointments,
                'pagination' => [
                    'current_page' => $currentPage,
                    'per_page' => $perPage,
                    'total' => $total,
                    'last_page' => ceil($total / $perPage),
                    'from' => $offset + 1,
                    'to' => min($offset + $perPage, $total),
                ],
                'practitioner' => [
                    'id' => $practitioner->id,
                    'first_name' => $practitioner->first_name,
                    'last_name' => $practitioner->last_name,
                ],
            ],
        ]);
    }

    /**
     * Display the specified appointment details.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $tenantId = $request->query('tenant_id');

        if (! $tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant ID is required.',
            ], 400);
        }

        // Verify user is a practitioner
        $practitioner = \App\Models\CentralPractitioner::where('user_id', $user->id)->first();
        if (! $practitioner) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Practitioner profile not found.',
            ], 403);
        }

        // Verify practitioner belongs to the tenant
        $hasAccess = $practitioner->tenants()
            ->where('tenants.id', $tenantId)
            ->wherePivot('invitation_status', 'ACCEPTED')
            ->exists();

        if (! $hasAccess) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. You do not have access to this clinic.',
            ], 403);
        }

        $tenant = \App\Models\Tenant::find($tenantId);
        if (! $tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found.',
            ], 404);
        }

        tenancy()->initialize($tenant);

        try {
            $appointment = \App\Models\Tenant\Appointment::with([
                'service',
                'location',
                // 'encounter' relationship is broken in model (uses belongsTo instead of hasOne), so we fetch manually below
            ])->find($id);

            if (! $appointment) {
                tenancy()->end();

                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found.',
                ], 404);
            }

            // Manually fetch encounter due to model issue
            $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)
                ->with(['recordings', 'documents', 'prescriptions'])
                ->first();

            // Get patient info from central database
            $patientInfo = tenancy()->central(function () use ($appointment) {
                return \App\Models\Patient::find($appointment->patient_id);
            });

            // Format dates
            $location = $appointment->location;
            $appointmentDatetimeLocal = $appointment->appointment_datetime;
            if ($location && $location->timezone) {
                $appointmentDatetimeLocal = \App\Services\SimpleTimezoneService::toLocal($appointment->appointment_datetime, $location->id);
            }

            // Prepare encounter details
            $encounterData = null;
            if ($encounter) {
                $s3Service = app(\App\Services\S3BucketService::class);

                $recordings = $encounter->recordings->map(function ($recording) use ($s3Service) {
                    $url = null;
                    if ($recording->s3_key) {
                        try {
                            $url = $s3Service->temporaryUrl($recording->s3_key, now()->addMinutes(60));
                        } catch (\Exception $e) {
                            \Log::error("Failed to generate signed URL for recording {$recording->id}: ".$e->getMessage());
                        }
                    }

                    return [
                        'id' => $recording->id,
                        'file_name' => $recording->file_name,
                        'duration_seconds' => $recording->duration_seconds,
                        'url' => $url,
                        'transcription_speaker_segments' => $recording->transcription_speaker_segments,
                        'created_at' => $recording->created_at,
                    ];
                });

                $documents = $encounter->documents->map(function ($document) use ($s3Service) {
                    $url = null;
                    if ($document->s3_key) {
                        try {
                            $url = $s3Service->temporaryUrl($document->s3_key, now()->addMinutes(60));
                        } catch (\Exception $e) {
                            \Log::error("Failed to generate signed URL for document {$document->id}: ".$e->getMessage());
                        }
                    } else {
                        $url = asset($document->file_path);
                    }

                    return [
                        'id' => $document->id,
                        'original_name' => $document->original_name,
                        'document_type' => $document->document_type,
                        'url' => $url,
                        'created_at' => $document->created_at,
                    ];
                });

                $prescriptions = $encounter->prescriptions->map(function ($prescription) {
                    return [
                        'id' => $prescription->id,
                        'medicine_name' => $prescription->medicine_name,
                        'dosage' => $prescription->dosage,
                        'frequency' => $prescription->frequency,
                        'duration' => $prescription->duration,
                        'instructions' => $prescription->instructions,
                    ];
                });

                $encounterData = array_merge(
                    $encounter->toArray(),
                    [
                        'recordings' => $recordings,
                        'documents' => $documents,
                        'prescriptions' => $prescriptions,
                    ]
                );
            }

            $data = [
                'id' => $appointment->id,
                'tenant_id' => $tenant->id,
                'tenant_name' => $tenant->company_name ?? $tenant->id,
                'appointment_datetime' => $appointment->appointment_datetime,
                'appointment_datetime_local' => $appointmentDatetimeLocal,
                'tenant_timezone' => $location ? $location->timezone : null,
                'status' => $appointment->status,
                'notes' => $appointment->notes,
                'service' => $appointment->service ? [
                    'id' => $appointment->service->id,
                    'name' => $appointment->service->name,
                    'duration' => $appointment->service->duration,
                ] : null,
                'patient' => $patientInfo ? [
                    'id' => $patientInfo->id,
                    'first_name' => $patientInfo->first_name,
                    'last_name' => $patientInfo->last_name,
                    'email' => $patientInfo->email,
                    'phone_number' => $patientInfo->phone_number,
                ] : null,
                'encounter' => $encounterData,
            ];

            tenancy()->end();

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching appointment details: '.$e->getMessage());
            try {
                tenancy()->end();
            } catch (\Exception $endError) {
            }

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while fetching appointment details.',
            ], 500);
        }
    }
}
