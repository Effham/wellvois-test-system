<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AppointmentController extends Controller
{
    /**
     * Display all appointments for the authenticated practitioner across all tenants
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        // Verify user is a practitioner
        $practitioner = \App\Models\Practitioner::where('user_id', $user->id)->first();
        if (! $practitioner) {
            return redirect()->route('dashboard')->with('error', 'Access denied. Practitioner profile not found.');
        }

        // Get filter parameters
        $status = $request->get('status', '');
        $dateFrom = $request->get('date_from', '');
        $dateTo = $request->get('date_to', '');
        $search = $request->get('search', '');
        $perPage = $request->get('perPage', 10);

        // Get all tenant databases where this practitioner has appointments
        $tenantIds = DB::table('tenant_practitioners')
            ->where('practitioner_id', $practitioner->id)
            ->where('invitation_status', 'ACCEPTED')
            ->pluck('tenant_id');

        $allAppointments = collect();

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
                // After migration, appointment_practitioner.practitioner_id stores tenant practitioner IDs
                $tenantPractitioner = \App\Models\Practitioner::where('central_practitioner_id', $practitioner->id)->first();

                if (! $tenantPractitioner) {
                    // No tenant practitioner found for this tenant, skip
                    tenancy()->end();

                    continue;
                }

                // Query appointments for this practitioner in this tenant using direct join with appointment_practitioner table
                // Use tenant practitioner ID (not central ID)
                $query = \App\Models\Tenant\Appointment::select('appointments.*', 'appointment_practitioner.start_time as pivot_start_time', 'appointment_practitioner.end_time as pivot_end_time')
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
                    // Get patient IDs from central database that match search criteria (exact match - encrypted fields)
                    $matchingPatientIds = tenancy()->central(function () use ($search) {
                        return \App\Models\Patient::whereBlind('first_name', 'first_name_index', $search)
                            ->orWhereBlind('last_name', 'last_name_index', $search)
                            ->orWhereBlind('email', 'email_index', $search)
                            ->pluck('id')
                            ->toArray();
                    });

                    $query->where(function ($q) use ($search, $matchingPatientIds) {
                        // Search by patient IDs
                        if (! empty($matchingPatientIds)) {
                            $q->whereIn('patient_id', $matchingPatientIds);
                        }
                        // Or search by service name
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

            } catch (\Exception $e) {
                \Log::error("Error fetching appointments for tenant {$tenantId}: ".$e->getMessage());

                // Make sure to end tenancy even on error
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
        $currentPage = $request->get('page', 1);
        $offset = ($currentPage - 1) * $perPage;
        $paginatedAppointments = $allAppointments->slice($offset, $perPage)->values();
        $total = $allAppointments->count();

        return Inertia::render('Central/Appointments/Index', [
            'appointments' => $paginatedAppointments,
            'pagination' => [
                'current_page' => $currentPage,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => ceil($total / $perPage),
                'from' => $offset + 1,
                'to' => min($offset + $perPage, $total),
            ],
            'filters' => [
                'status' => $status,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'search' => $search,
                'perPage' => $perPage,
            ],
            'practitioner' => [
                'id' => $practitioner->id,
                'first_name' => $practitioner->first_name,
                'last_name' => $practitioner->last_name,
            ],
        ]);
    }
}
