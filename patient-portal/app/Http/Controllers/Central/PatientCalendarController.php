<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PatientCalendarController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $patient = \App\Models\Patient::where('user_id', $user->id)->first();

        if (! $patient) {
            Log::info('No patient found for user', ['user_id' => $user->id]);
            abort(403, 'Access denied. You are not registered as a patient.');
        }

        // Get all tenants where this patient has accepted invitations
        try {
            $tenantPatients = \DB::connection('central')->table('tenant_patients')
                ->where('patient_id', $patient->id)
                ->where('invitation_status', 'ACCEPTED')
                ->get();

            Log::info('Patient tenants', [
                'patient_id' => $patient->id,
                'tenant_count' => $tenantPatients->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting patient tenants', [
                'patient_id' => $patient->id,
                'error' => $e->getMessage(),
            ]);
            $tenantPatients = collect();
        }

        $appointments = [];

        // Fetch appointments from all tenants for this patient
        foreach ($tenantPatients as $tenantPatient) {
            try {
                $tenant = \App\Models\Tenant::find($tenantPatient->tenant_id);
                if (! $tenant) {
                    continue;
                }

                // Get tenant company name
                $companyName = $tenant->company_name ?? 'Unknown Clinic';

                // Switch to tenant database and fetch appointments
                tenancy()->initialize($tenant);

                $tenantAppointments = \App\Models\Tenant\Appointment::with(['service', 'location'])
                    ->where('patient_id', $patient->id)
                    ->whereIn('status', ['confirmed', 'pending'])
                    ->whereNotNull('appointment_datetime')
                    ->orderBy('appointment_datetime', 'asc')
                    ->get();

                foreach ($tenantAppointments as $appointment) {
                    // Get practitioners from central database
                    $practitioners = $appointment->getPractitionerData();
                    $practitionerName = $practitioners->isNotEmpty()
                        ? 'Dr. '.$practitioners->first()->first_name.' '.$practitioners->first()->last_name
                        : 'TBD';

                    $service = $appointment->service;
                    $location = $appointment->location;

                    // Use appointment_datetime (stored in UTC)
                    $utcDateTime = Carbon::parse($appointment->appointment_datetime);
                    $durationMinutes = 60; // Default duration
                    $utcEndTime = $utcDateTime->copy()->addMinutes($durationMinutes);

                    $appointments[] = [
                        'id' => $appointment->id,
                        'tenant_id' => $tenantPatient->tenant_id,
                        'title' => ($service ? $service->name : 'Appointment').' with '.$practitionerName,
                        'date' => $utcDateTime->format('Y-m-d'),
                        'time' => $utcDateTime->format('H:i'),
                        'duration' => $durationMinutes,
                        'patient' => $patient->first_name.' '.$patient->last_name,
                        'practitioner' => $practitionerName,
                        'type' => $service ? $service->name : 'General Consultation',
                        'status' => $appointment->status,
                        'location' => $location ? $location->name : ($appointment->mode === 'virtual' ? 'Virtual' : 'Unknown Location'),
                        'clinic' => $companyName,
                        'source' => 'clinic',
                        'clickable' => true,
                        'mode' => $appointment->mode,
                        'appointment_datetime' => $utcDateTime->toISOString(),
                        'timezone' => 'UTC', // Times are in UTC, frontend will convert
                        'start_time' => $utcDateTime->toISOString(), // UTC time
                        'end_time' => $utcEndTime->toISOString(), // UTC time
                        'utc_start_time' => $utcDateTime->toISOString(), // Explicit UTC for frontend conversion
                        'utc_end_time' => $utcEndTime->toISOString(), // Explicit UTC for frontend conversion
                    ];
                }

            } catch (\Exception $e) {
                Log::warning('Error loading appointments from tenant: '.$tenantPatient->tenant_id, [
                    'error' => $e->getMessage(),
                    'patient_id' => $patient->id,
                ]);
            }
        }

        // Reset to central context
        tenancy()->end();

        // Sort appointments by date
        usort($appointments, function ($a, $b) {
            return strcmp($a['appointment_datetime'], $b['appointment_datetime']);
        });

        Log::info('Loaded patient appointments', [
            'patient_id' => $patient->id,
            'appointment_count' => count($appointments),
        ]);

        // Return the same Calendar/Index component used for practitioners
        // but with patient-specific data
        return Inertia::render('Calendar/Index', [
            'appointments' => $appointments,
            'currentDate' => now()->toDateString(),
            'userRole' => 'patient',
            'isCentral' => true,
            'practitioners' => [], // Patients don't need practitioner filter
        ]);
    }
}
