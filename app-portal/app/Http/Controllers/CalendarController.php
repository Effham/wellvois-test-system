<?php

namespace App\Http\Controllers;

use App\Http\Resources\PractitionerMinimalResource;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Practitioner;
use App\Models\PractitionerAvailability;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Invoices;
use App\Models\Tenant\Patient;
use App\Services\TenantTimezoneService;
use Inertia\Inertia;

class CalendarController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-practitioner-personal-calendar');
    }

    public function index()
    {
        // Check if user is an Admin - if so, use IndexV2
        // $user = auth()->user();
        // if ($user && $user->hasRole('Admin')) {
        //     return $this->indexV2();
        // }

        // Get all practitioners in this tenant for the filter dropdown
        // NOTE: No select() clause - CipherSweet needs all fields to decrypt properly
        $practitioners = Practitioner::where('is_active', true)
            ->orderBy('first_name')
            ->get();

        $practitioners = PractitionerMinimalResource::collection($practitioners)
            ->map(function ($practitioner) {
                return [
                    'id' => $practitioner['id'],
                    'name' => $practitioner['first_name'].' '.$practitioner['last_name'],
                ];
            });

        // First, get appointments with practitioner pivot data from tenant database
        $appointmentData = Appointment::with(['service', 'location'])
            ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
            // ->where('appointments.status', 'confirmed')
            ->whereNotNull('appointment_practitioner.start_time')
            ->select([
                'appointments.*',
                'appointment_practitioner.practitioner_id',
                'appointment_practitioner.start_time as pivot_start_time',
                'appointment_practitioner.end_time as pivot_end_time',
            ])
            ->orderBy('appointment_practitioner.start_time', 'asc')
            ->get();

        // Get all unique practitioner IDs and patient IDs
        $practitionerIds = $appointmentData->pluck('practitioner_id')->unique()->filter();
        $patientIds = $appointmentData->pluck('patient_id')->unique()->filter();

        // Query practitioners from central database
        $practitionersById = collect();
        if ($practitionerIds->isNotEmpty()) {
            $practitionersById = Practitioner::whereIn('id', $practitionerIds)
                ->get()
                ->keyBy('id');
        }

        // Query patients from central database
        $patientsById = collect();
        if ($patientIds->isNotEmpty()) {
            $patientsById = Patient::whereIn('id', $patientIds)
                ->get()
                ->keyBy('id');
        }

        // Process and map the data
        $appointments = $appointmentData
            ->groupBy('id')
            ->map(function ($appointmentGroup) use ($practitionersById, $patientsById) {
                $appointment = $appointmentGroup->first();

                // Use pivot start_time from the join, fallback to appointment datetime
                $utcStartTime = $appointment->pivot_start_time ?? $appointment->appointment_datetime ?? $appointment->created_at;

                // Convert UTC time to tenant timezone for display
                $startTime = TenantTimezoneService::convertToTenantTime(\Carbon\Carbon::parse($utcStartTime));

                // Get practitioner names from the central database data
                $practitionerNames = $appointmentGroup->map(function ($app) use ($practitionersById) {
                    $practitioner = $practitionersById->get($app->practitioner_id);

                    return $practitioner ? trim($practitioner->first_name.' '.$practitioner->last_name) : null;
                })->filter()->unique()->implode(', ');

                // Get patient name from central database data
                $patient = $patientsById->get($appointment->patient_id);
                $patientName = $patient
                    ? trim($patient->first_name.' '.$patient->last_name)
                    : 'Unknown Patient';

                return [
                    'id' => $appointment->id,
                    'title' => $appointment->service->name ?? 'Appointment',
                    'date' => $startTime->format('Y-m-d'),
                    'time' => $startTime->format('H:i'),
                    'duration' => $appointment->service->default_duration_minutes ?? 60,
                    'patient' => $patientName,
                    'practitioner' => $practitionerNames ?: 'Unknown Practitioner',
                    'type' => $appointment->service->name ?? 'General Consultation',
                    'status' => $appointment->status,
                    'location' => $appointment->location->name ?? 'TBD',
                    'clinic' => config('app.name', 'EMR System'),
                    'source' => 'clinic',
                    'clickable' => true,
                    'notes' => $appointment->notes,
                ];
            })
            ->values();

        return Inertia::render('Calendar/Index', [
            'appointments' => $appointments,
            'currentDate' => now()->toDateString(),
            'isCentral' => false, // This is tenant calendar
            'practitioners' => $practitioners, // For practitioner filter dropdown
        ]);
    }

    public function indexV2()
    {
        // Get all practitioners in this tenant for the columns
        $practitioners = Practitioner::where('is_active', true)
            ->orderBy('first_name')
            ->get();

        $practitionersFormatted = PractitionerMinimalResource::collection($practitioners)
            ->map(function ($practitioner) {
                return [
                    'id' => $practitioner['id'],
                    'name' => $practitioner['first_name'].' '.$practitioner['last_name'],
                    'first_name' => $practitioner['first_name'],
                    'last_name' => $practitioner['last_name'],
                ];
            });

        // Get all active locations for the filter dropdown
        $locations = Location::where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn ($location) => [
                'id' => $location->id,
                'name' => $location->name,
            ]);

        // Get appointments with practitioner pivot data from tenant database
        $appointmentData = Appointment::with(['service', 'location'])
            ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
            ->whereNotNull('appointment_practitioner.start_time')
            ->select([
                'appointments.*',
                'appointment_practitioner.practitioner_id',
                'appointment_practitioner.start_time as pivot_start_time',
                'appointment_practitioner.end_time as pivot_end_time',
            ])
            ->orderBy('appointment_practitioner.start_time', 'asc')
            ->get();

        // Get all unique practitioner IDs and patient IDs
        $practitionerIds = $appointmentData->pluck('practitioner_id')->unique()->filter();
        $patientIds = $appointmentData->pluck('patient_id')->unique()->filter();

        // Query practitioners from central database
        $practitionersById = collect();
        if ($practitionerIds->isNotEmpty()) {
            $practitionersById = Practitioner::whereIn('id', $practitionerIds)
                ->get()
                ->keyBy('id');
        }

        // Query patients from central database
        $patientsById = collect();
        if ($patientIds->isNotEmpty()) {
            $patientsById = Patient::whereIn('id', $patientIds)
                ->get()
                ->keyBy('id');
        }

        // Get organization settings for appointment session duration
        $appointmentSessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);

        // Get practitioner availability grouped by practitioner, location, and day
        $availabilityData = PractitionerAvailability::whereIn('practitioner_id', $practitionersFormatted->pluck('id'))
            ->get();

        // Structure: [practitioner_id][location_id][day] = [time ranges]
        $practitionerAvailability = [];
        foreach ($availabilityData as $availability) {
            $practitionerId = $availability->practitioner_id;
            $locationId = $availability->location_id;
            $day = strtolower($availability->day);

            if (! isset($practitionerAvailability[$practitionerId][$locationId][$day])) {
                $practitionerAvailability[$practitionerId][$locationId][$day] = [];
            }

            $practitionerAvailability[$practitionerId][$locationId][$day][] = [
                'start' => substr($availability->start_time, 0, 5), // HH:MM format
                'end' => substr($availability->end_time, 0, 5),
            ];
        }

        // Get all appointment IDs to check invoices in bulk
        $appointmentIds = $appointmentData->pluck('id')->unique()->toArray();

        // Query invoices for all appointments at once
        $invoicesByAppointment = [];
        if (! empty($appointmentIds)) {
            $invoices = Invoices::where('invoiceable_type', 'App\Models\Tenant\Appointment')
                ->whereIn('invoiceable_id', $appointmentIds)
                ->get()
                ->keyBy('invoiceable_id');

            foreach ($invoices as $invoice) {
                $invoicesByAppointment[$invoice->invoiceable_id] = $invoice;
            }
        }

        // Process appointments and group by practitioner
        $appointmentsByPractitioner = [];

        foreach ($appointmentData as $appointment) {
            $practitionerId = $appointment->practitioner_id;

            // Use pivot start_time from the join, fallback to appointment datetime
            $utcStartTime = $appointment->pivot_start_time ?? $appointment->appointment_datetime ?? $appointment->created_at;
            $utcEndTime = $appointment->pivot_end_time;

            // Convert UTC time to tenant timezone for display
            $startTime = TenantTimezoneService::convertToTenantTime(\Carbon\Carbon::parse($utcStartTime));
            $endTime = $utcEndTime ? TenantTimezoneService::convertToTenantTime(\Carbon\Carbon::parse($utcEndTime)) : null;

            // Get patient name from central database data
            $patient = $patientsById->get($appointment->patient_id);
            $patientName = $patient
                ? trim($patient->first_name.' '.$patient->last_name)
                : 'Unknown Patient';

            // Calculate duration
            $durationMinutes = $appointment->service->default_duration_minutes ?? 60;
            if ($endTime) {
                $durationMinutes = $startTime->diffInMinutes($endTime);
            }

            // Calculate end_time - clone startTime to avoid mutation
            $calculatedEndTime = $endTime ?: $startTime->copy()->addMinutes($durationMinutes);

            // Check invoice status
            $invoice = $invoicesByAppointment[$appointment->id] ?? null;
            $paymentStatus = 'none';
            $invoiceStatus = null;

            if ($appointment->status === 'cancelled') {
                $paymentStatus = 'cancelled';
            } elseif ($invoice) {
                $invoiceStatus = $invoice->status;
                if (in_array($invoice->status, ['paid', 'paid_manual'])) {
                    $paymentStatus = 'paid';
                } else {
                    $paymentStatus = 'billed';
                }
            }

            $appointmentItem = [
                'id' => $appointment->id,
                'practitioner_id' => $practitionerId,
                'title' => $appointment->service->name ?? 'Appointment',
                'patient' => $patientName,
                'type' => $appointment->service->name ?? 'General Consultation',
                'status' => $appointment->status,
                'mode' => $appointment->mode,
                'location' => $appointment->location->name ?? 'TBD',
                'location_id' => $appointment->location_id ?? null,
                'date' => $startTime->format('Y-m-d'),
                'time' => $startTime->format('H:i'),
                'start_time' => $startTime->format('H:i'),
                'end_time' => $calculatedEndTime->format('H:i'),
                'duration' => $durationMinutes,
                'notes' => $appointment->notes,
                'clickable' => true,
                'payment_status' => $paymentStatus,
                'invoice_status' => $invoiceStatus,
            ];

            if (! isset($appointmentsByPractitioner[$practitionerId])) {
                $appointmentsByPractitioner[$practitionerId] = [];
            }

            $appointmentsByPractitioner[$practitionerId][] = $appointmentItem;
        }

        return Inertia::render('Calendar/IndexV2', [
            'appointments' => $appointmentsByPractitioner,
            'practitioners' => $practitionersFormatted,
            'currentDate' => now()->toDateString(),
            'isCentral' => false,
            'appointmentSessionDuration' => $appointmentSessionDuration,
            'locations' => $locations,
            'practitionerAvailability' => $practitionerAvailability,
        ]);
    }
}
