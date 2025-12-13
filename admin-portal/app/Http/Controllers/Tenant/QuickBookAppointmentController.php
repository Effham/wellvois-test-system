<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Practitioner;
use App\Models\Service;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Patient;
use App\Services\TenantTimezoneService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class QuickBookAppointmentController extends Controller
{
    /**
     * Show the quick book appointment form
     */
    public function create(Request $request)
    {
        // Validate query parameters
        $validated = $request->validate([
            'practitioner_id' => 'required|integer',
            'date' => 'nullable|date',
            'time_slot' => 'nullable|string',
        ]);

        // Get practitioner
        $practitioner = Practitioner::where('is_active', true)
            ->findOrFail($validated['practitioner_id']);

        // Get practitioner services
        $serviceIds = DB::table('practitioner_services')
            ->where('practitioner_id', $practitioner->id)
            ->where('is_offered', true)
            ->pluck('service_id')
            ->toArray();

        $services = Service::where('is_active', true)
            ->whereIn('id', $serviceIds)
            ->select('id', 'name', 'category', 'delivery_modes')
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        // Get locations
        $locations = Location::where('is_active', true)
            ->select('id', 'name', 'street_address', 'city')
            ->orderBy('name')
            ->get()
            ->map(function ($location) {
                return [
                    'id' => $location->id,
                    'value' => $location->id,
                    'label' => $location->name,
                    'address' => $location->street_address.', '.$location->city,
                    'name' => $location->name,
                ];
            });

        // Get appointment settings
        $appointmentSettings = [
            'advanceBookingHours' => OrganizationSetting::getValue('appointment_advance_booking_hours', '2'),
            'maxAdvanceBookingDays' => OrganizationSetting::getValue('appointment_max_advance_booking_days', '90'),
            'allowSameDayBooking' => OrganizationSetting::getValue('appointment_allow_same_day_booking', '0') === '1',
        ];

        $appointmentSessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);

        // Prepare prefilled data
        $prefilledDate = $validated['date'] ?? null;
        $prefilledTimeSlot = $validated['time_slot'] ?? null;

        return Inertia::render('Appointments/QuickBook', [
            'practitioner' => [
                'id' => $practitioner->id,
                'first_name' => $practitioner->first_name,
                'last_name' => $practitioner->last_name,
                'title' => $practitioner->title ?? '',
                'full_name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                'display_name' => $practitioner->title
                    ? $practitioner->title.' '.$practitioner->first_name.' '.$practitioner->last_name
                    : trim($practitioner->first_name.' '.$practitioner->last_name),
            ],
            'prefilledDate' => $prefilledDate,
            'prefilledTimeSlot' => $prefilledTimeSlot,
            'locations' => $locations,
            'services' => $services,
            'appointmentSessionDuration' => $appointmentSessionDuration,
            'appointmentSettings' => $appointmentSettings,
        ]);
    }

    /**
     * Store a quick booked appointment
     */
    public function store(Request $request)
    {
        // Validate the request
        $validated = $request->validate([
            // Patient information
            'health_number' => 'nullable|string|max:255',
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'required|string|max:255',
            'preferred_name' => 'nullable|string|max:255',
            'date_of_birth' => 'required|date',
            'gender' => 'nullable|string|max:255',
            'gender_pronouns' => 'required|string|max:255',
            'phone_number' => 'required|string|max:255',
            'email_address' => 'required|email|max:255',
            'emergency_contact_name' => 'nullable|string|max:255',
            'emergency_contact_phone' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'preferred_language' => 'nullable|string|max:255',
            'client_type' => 'required|string|in:individual,couple,family,group',

            // Appointment details
            'service_id' => 'required|integer|exists:services,id',
            'practitioner_id' => 'required|integer|exists:practitioners,id',
            'location_id' => 'required|integer|exists:locations,id',
            'mode' => 'required|string|in:in-person,virtual',
            'date_time_preference' => 'required|string|regex:/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/',
            'notes' => 'nullable|string',
        ]);

        try {
            // Get the service
            $service = Service::findOrFail($validated['service_id']);

            // Check if patient already exists by email within this tenant (encrypted field)
            $existingPatient = Patient::whereBlind('email', 'email_index', $validated['email_address'])->first();

            if ($existingPatient) {
                // Use existing patient
                $patientId = $existingPatient->id;
                Log::info('Quick Book: Using existing patient', ['patient_id' => $patientId]);
            } else {
                // Check if patient exists by health_number as well (to avoid duplicates) - encrypted field
                $existingByHealthNumber = null;
                if (! empty($validated['health_number'])) {
                    $existingByHealthNumber = Patient::whereBlind('health_number', 'health_number_index', $validated['health_number'])->first();
                }

                if ($existingByHealthNumber) {
                    // Use existing patient found by health number within this tenant
                    $patientId = $existingByHealthNumber->id;
                    Log::info('Quick Book: Using existing patient found by health number', ['patient_id' => $patientId]);
                } else {
                    // Create new patient in tenant database
                    $healthNumber = ! empty($validated['health_number'])
                        ? $validated['health_number']
                        : 'TMP-'.time().'-'.rand(1000, 9999);

                    $patientData = [
                        'health_number' => $healthNumber,
                        'first_name' => $validated['first_name'],
                        'middle_name' => $validated['middle_name'] ?? null,
                        'last_name' => $validated['last_name'],
                        'preferred_name' => $validated['preferred_name'] ?? null,
                        'email' => $validated['email_address'],
                        'phone_number' => $validated['phone_number'],
                        'gender' => $validated['gender'] ?? $validated['gender_pronouns'],
                        'gender_pronouns' => $validated['gender_pronouns'],
                        'client_type' => $validated['client_type'],
                        'date_of_birth' => $validated['date_of_birth'],
                        'emergency_contact_name' => $validated['emergency_contact_name'] ?? null,
                        'emergency_contact_phone' => $validated['emergency_contact_phone'],
                        'contact_person' => $validated['contact_person'] ?? null,
                        'preferred_language' => $validated['preferred_language'] ?? null,
                        'meta_data' => ['is_onboarding' => 1],
                    ];

                    $patient = Patient::create($patientData);
                    $patientId = $patient->id;

                    // Create wallet for new patient in tenant database
                    \App\Models\Tenant\Wallet::getOrCreatePatientWallet($patientId);

                    Log::info('Quick Book: Created new patient', [
                        'patient_id' => $patientId,
                        'health_number' => $healthNumber,
                        'original_health_number' => $validated['health_number'] ?? 'none provided',
                    ]);
                }
            }

            // Get the patient
            $patient = Patient::findOrFail($patientId);

            // Parse and convert the datetime
            $dateTimeString = trim($validated['date_time_preference']);
            $tenantTimezone = TenantTimezoneService::getTenantTimezone();
            $utcDateTime = TenantTimezoneService::convertToUTC($dateTimeString);

            // Get session duration
            $sessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);
            $utcEndTime = $utcDateTime->copy()->addMinutes($sessionDuration);

            Log::info('Quick Book: Creating appointment', [
                'patient_id' => $patient->id,
                'service_id' => $service->id,
                'practitioner_id' => $validated['practitioner_id'],
                'location_id' => $validated['location_id'],
                'mode' => $validated['mode'],
                'input_datetime' => $dateTimeString,
                'tenant_timezone' => $tenantTimezone,
                'utc_datetime' => $utcDateTime->toISOString(),
                'utc_end_time' => $utcEndTime->toISOString(),
            ]);

            // Check for practitioner conflicts
            $this->checkPractitionerConflict($validated['practitioner_id'], $utcDateTime, $utcEndTime);

            // Create the appointment
            $appointment = Appointment::create([
                'patient_id' => $patient->id,
                'contact_person' => $patient->first_name.' '.$patient->last_name,
                'service_id' => $service->id,
                'location_id' => $validated['location_id'],
                'mode' => $validated['mode'],
                'appointment_datetime' => $utcDateTime,
                'start_time' => $utcDateTime,
                'end_time' => $utcEndTime,
                'stored_timezone' => $tenantTimezone,
                'needs_timezone_migration' => false,
                'status' => 'confirmed',
                'booking_source' => 'Internal - Quick Book',
                'admin_override' => true,
                'notes' => $validated['notes'] ?? null,
            ]);

            // Attach practitioner to appointment using direct DB insert
            // (practitioners() relationship returns empty collection due to cross-database limitations)
            DB::table('appointment_practitioner')->insert([
                'appointment_id' => $appointment->id,
                'practitioner_id' => $validated['practitioner_id'],
                'start_time' => $utcDateTime->format('Y-m-d H:i:s'),
                'end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                'is_primary' => true,
            ]);

            Log::info('Quick Book: Appointment created successfully', [
                'appointment_id' => $appointment->id,
            ]);

            return redirect()->route('calendar.index')
                ->with('success', 'Appointment booked successfully!');

        } catch (\Exception $e) {
            Log::error('Quick Book: Failed to create appointment', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()
                ->withErrors(['error' => 'Failed to book appointment: '.$e->getMessage()])
                ->withInput();
        }
    }

    /**
     * Check for practitioner scheduling conflicts
     */
    protected function checkPractitionerConflict($practitionerId, $startDateTime, $endDateTime)
    {
        // Check for conflicts by looking at the appointment_practitioner pivot table
        // This ensures we check against the actual practitioner times (including slot divisions)
        $conflictingAppointments = DB::table('appointment_practitioner')
            ->join('appointments', 'appointment_practitioner.appointment_id', '=', 'appointments.id')
            ->where('appointment_practitioner.practitioner_id', $practitionerId)
            ->whereNotNull('appointments.appointment_datetime')
            ->where('appointments.appointment_datetime', '>=', $startDateTime->copy()->startOfDay())
            ->where('appointments.appointment_datetime', '<', $startDateTime->copy()->addDay()->startOfDay())
            ->whereNotIn('appointments.status', ['cancelled', 'no-show'])
            ->where(function ($query) use ($startDateTime, $endDateTime) {
                $query->where(function ($q) use ($startDateTime) {
                    // New appointment starts during existing appointment
                    // Check if new start time is between existing start and end
                    $q->where('appointment_practitioner.start_time', '<=', $startDateTime)
                        ->where('appointment_practitioner.end_time', '>', $startDateTime);
                })->orWhere(function ($q) use ($endDateTime) {
                    // New appointment ends during existing appointment
                    // Check if new end time is between existing start and end
                    $q->where('appointment_practitioner.start_time', '<', $endDateTime)
                        ->where('appointment_practitioner.end_time', '>=', $endDateTime);
                })->orWhere(function ($q) use ($startDateTime, $endDateTime) {
                    // New appointment completely contains existing appointment
                    // Check if existing appointment is fully within new appointment time range
                    $q->where('appointment_practitioner.start_time', '>=', $startDateTime)
                        ->where('appointment_practitioner.end_time', '<=', $endDateTime);
                })->orWhere(function ($q) use ($startDateTime, $endDateTime) {
                    // Existing appointment completely contains new appointment
                    // Check if new appointment is fully within existing appointment time range
                    $q->where('appointment_practitioner.start_time', '<=', $startDateTime)
                        ->where('appointment_practitioner.end_time', '>=', $endDateTime);
                });
            })
            ->select('appointments.id', 'appointments.status', 'appointments.appointment_datetime',
                'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
            ->get();

        if ($conflictingAppointments->count() > 0) {
            Log::warning('Quick Book: Appointment conflict detected', [
                'practitioner_id' => $practitionerId,
                'requested_start_time' => $startDateTime->format('Y-m-d H:i:s'),
                'requested_end_time' => $endDateTime->format('Y-m-d H:i:s'),
                'conflicting_appointments' => $conflictingAppointments->map(function ($apt) {
                    return [
                        'id' => $apt->id,
                        'status' => $apt->status,
                        'appointment_datetime' => $apt->appointment_datetime,
                        'practitioner_start_time' => $apt->start_time,
                        'practitioner_end_time' => $apt->end_time,
                    ];
                })->toArray(),
            ]);

            throw new \Exception(
                'Time slot conflict: Practitioner already has an appointment at this time. '.
                'Conflicting appointment(s): '.
                $conflictingAppointments->map(function ($apt) {
                    return "ID {$apt->id} ({$apt->status})";
                })->join(', ')
            );
        }
    }
}
