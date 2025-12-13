<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientMaskedResource;
use App\Http\Resources\PatientMinimalResource;
use App\Http\Resources\PractitionerMinimalResource;
use App\Jobs\GenerateRecordingAISummary;
use App\Mail\AppointmentNotificationMail;
use App\Mail\AppointmentUpdatedMail;
use App\Mail\PatientAppointmentLinkMail;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Practitioner;
use App\Models\PractitionerAvailability;
use App\Models\Service;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Patient;
use App\Models\UserIntegration;
use App\Services\AppointmentSignedUrlService;
use App\Services\BedrockAIService;
use App\Services\ConsentTriggerService;
use App\Services\GoogleCalendarService;
use App\Services\TenantTimezoneService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class AppointmentController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-appointment')->only(['index', 'loadedData', 'show']);
        $this->middleware('permission:add-appointment')->only(['create', 'createLoaded', 'store']);
        $this->middleware('permission:update-appointment')->only(['edit', 'update', 'updateStatus']);
        $this->middleware('permission:delete-appointment')->only('destroy');
    }

    /**
     * Display a listing of appointments with filtering and pagination.
     */
    /**
     * Display a listing of appointments with filtering and pagination.
     * Supports deferred loading via Inertia partial reloads.
     */
    public function index(Request $request)
    {
        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // Get filters from request
        $status = $request->input('status');
        $practitionerId = $request->input('practitioner_id');
        $search = $request->input('search');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $perPage = $request->input('perPage', 10);

        $filters = [
            'status' => $status,
            'practitioner_id' => $practitionerId,
            'search' => $search,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'perPage' => $perPage,
        ];

        // On initial load, return minimal data
        // if (! $isPartialReload) {
        //     return Inertia::render('Appointments/Index', [
        //         'filters' => $filters,
        //         'user_role' => determineUserRole(),
        //         'appointments' => null,
        //         'statuses' => null,
        //         'practitioners' => null,
        //     ]);
        // }

        // Build the query (load relationships except patient which needs special handling)
        $query = Appointment::with([
            'service:id,name',
            'location:id,name,street_address,city,province',
        ])
            ->orderBy('appointment_datetime', 'desc');

        // Determine user role and apply appropriate filtering
        $userRole = determineUserRole();
        $user = Auth::user();

        // Apply role-based filtering
        if ($userRole === 'practitioner' && ! $practitionerId) {
            // Get practitioner ID for current user from tenant database
            $practitioner = Practitioner::where('user_id', $user->id)->first();

            if ($practitioner) {
                $practitionerId = $practitioner->id;
            }

        } elseif ($userRole === 'patient') {
            // For patients, only show their own appointments
            $patient = Patient::where('user_id', $user->id)->first();
            $patientId = $patient ? $patient->id : null;

            if ($patientId) {
                $query->where('patient_id', $patientId);
            } else {
                // If no patient record found, show no appointments
                $query->where('id', -1);
            }
        }

        // Apply filters
        if ($status) {
            // Use case-insensitive comparison to handle status variations
            $query->whereRaw('LOWER(status) = LOWER(?)', [$status]);
        }


        // if ($practitionerId) {
        //     // Use exists query to check the pivot table
        //     $query->whereExists(function ($exists) use ($practitionerId) {
        //         $exists->select(DB::raw(1))
        //             ->from('appointment_practitioner')
        //             ->whereColumn('appointment_practitioner.appointment_id', 'appointments.id')
        //             ->where('appointment_practitioner.practitioner_id', $practitionerId);
        //     });
        // }

        if ($practitionerId) {
            $query->whereIn('id', function ($subquery) use ($practitionerId) {
                $subquery->select('appointment_id')
                    ->from('appointment_practitioner')
                    ->where('practitioner_id', $practitionerId);
            });
        }

        if ($search) {
            // Get patient IDs from tenant database that match search criteria (exact match - encrypted fields)
            $matchingPatientIds = Patient::whereBlind('first_name', 'first_name_index', $search)
                ->orWhereBlind('last_name', 'last_name_index', $search)
                ->orWhereBlind('email', 'email_index', $search)
                ->pluck('id')
                ->toArray();

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

        // Date range filtering
        if ($dateFrom) {
            $query->whereDate('appointment_datetime', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('appointment_datetime', '<=', $dateTo);
        }

        // Paginate results
        $appointments = $query->paginate($perPage)->withQueryString();

        // Load patient data with custom resource (handles decryption)
        $patientIds = $appointments->pluck('patient_id')->unique()->filter();
        $patients = Patient::whereIn('id', $patientIds)->get()->keyBy('id');

        // Load all active practitioners for the resource
        $practitioners = Practitioner::where('is_active', true)->get();
        $practitionersResource = PractitionerMinimalResource::collection($practitioners);

        // Get timezone from location (primary) or organization setting (fallback)
        $location = \App\Models\Location::where('is_active', true)->first();
        $tenantTimezone = $location?->timezone ?? OrganizationSetting::getValue('time_locale_timezone', 'UTC');

        $appointments->getCollection()->transform(function ($appointment) use ($patients, $practitionersResource, $tenantTimezone) {
            $patient = $patients->get($appointment->patient_id);
            $appointment->patient = $patient ? (new PatientMinimalResource($patient))->resolve() : null;

            // Load practitioners for this appointment from pivot table
            $practitionerIds = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->pluck('practitioner_id');

            $appointmentPractitioners = $practitionersResource->whereIn('id', $practitionerIds);
            $appointment->practitioners_list = $appointmentPractitioners->map(function ($practitioner) {
                return [
                    'id' => $practitioner['id'],
                    'name' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                ];
            })->values()->toArray();

            // Load detailed practitioner information with individual start/end times
            $practitionerDetails = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->get(['practitioner_id', 'start_time', 'end_time', 'is_primary']);

            $appointment->practitioners_detail = $practitionerDetails->map(function ($detail) use ($practitionersResource, $tenantTimezone) {
                $practitioner = $practitionersResource->get($detail->practitioner_id);
                if (! $practitioner) {
                    return null;
                }

                // Convert UTC times to tenant timezone for display
                $startTime = $detail->start_time ? \Carbon\Carbon::parse($detail->start_time)->setTimezone($tenantTimezone) : null;
                $endTime = $detail->end_time ? \Carbon\Carbon::parse($detail->end_time)->setTimezone($tenantTimezone) : null;

                return [
                    'id' => $practitioner['id'],
                    'name' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                    'start_time' => $startTime ? $startTime->toISOString() : null,
                    'end_time' => $endTime ? $endTime->toISOString() : null,
                    'is_primary' => (bool) $detail->is_primary,
                ];
            })->filter()->values()->toArray();

            // Convert appointment times to tenant timezone for display
            if ($appointment->appointment_datetime) {
                try {
                    // Use the new appointment model methods for timezone conversion
                    $appointment->appointment_datetime_local = $appointment->getAppointmentDateTimeInTenantTimezone()?->toISOString();
                    $appointment->start_time_local = $appointment->getStartTimeInTenantTimezone()?->toISOString();
                    $appointment->end_time_local = $appointment->getEndTimeInTenantTimezone()?->toISOString();
                    $appointment->formatted_date = $appointment->getFormattedDate();
                    $appointment->formatted_time = $appointment->getFormattedTime();
                    $appointment->formatted_datetime = $appointment->getFormattedAppointmentDateTime();
                    $appointment->tenant_timezone = $appointment->getTenantTimezone();
                    $appointment->tenant_timezone_abbr = $appointment->getTenantTimezoneAbbreviation();
                } catch (\Exception $e) {
                    // Skip logging errors
                }
            }

            return $appointment;
        });

        // Get unique statuses for filter dropdown
        $statuses = Appointment::select('status')
            ->distinct()
            ->whereNotNull('status')
            ->pluck('status')
            ->sort()
            ->values();

        // Ensure 'Requested' is always in the statuses list
        if (! $statuses->contains('Requested')) {
            $statuses->push('Requested');
            $statuses = $statuses->sort()->values();
        }

        // Ensure 'pending' is always in the statuses list (case-insensitive check)
        $hasPending = $statuses->contains(function ($status) {
            return strtolower($status) === 'pending';
        });
        if (! $hasPending) {
            $statuses->push('pending');
            $statuses = $statuses->sort()->values();
        }

        // Get practitioners for filter dropdown from tenant database
        $practitioners = Practitioner::where('is_active', true)->get();

        $practitioners = PractitionerMinimalResource::collection($practitioners)
            ->map(function ($practitioner) {
                return [
                    'id' => $practitioner['id'],
                    'name' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                ];
            });

        // Return Inertia response to allow frontend to receive data via router.visit()
        return Inertia::render('Appointments/Index', [
            'filters' => $filters,
            'user_role' => determineUserRole(),
            'appointments' => $appointments,
            'statuses' => $statuses,
            'practitioners' => $practitioners,
        ]);
    }

    /**
     * Update appointment status.
     */
    public function updateStatus(Request $request, Appointment $appointment)
    {
        // Log start of the request
        Log::info('Attempting to update appointment status.', [
            'appointment_id' => $appointment->id,
            'current_status' => $appointment->status,
            'requested_status' => $request->input('status'),
            'user_id' => Auth::id(),
        ]);

        $request->validate([
            'status' => 'required|string|in:Requested,pending,confirmed,completed,cancelled,declined',
        ]);

        $oldStatus = $appointment->getOriginal('status');

        // If transitioning from 'Requested' to 'confirmed', auto-approve the patient
        if ($oldStatus === 'Requested' && $request->status === 'confirmed') {
            $patient = \App\Models\Tenant\Patient::find($appointment->patient_id);
            if ($patient && $patient->registration_status === 'Requested') {
                $patient->approve(Auth::id());
                Log::info('Patient auto-approved via appointment status change', [
                    'patient_id' => $patient->id,
                    'appointment_id' => $appointment->id,
                    'approved_by' => Auth::id(),
                ]);
            }
        }

        // Prevent cancel/decline if appointment is confirmed
        if ($appointment->status === 'confirmed' && in_array($request->status, ['cancelled', 'declined'])) {
            Log::warning('Attempted to cancel/decline a confirmed appointment.', [
                'appointment_id' => $appointment->id,
                'requested_status' => $request->status,
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Cannot cancel or decline a confirmed appointment.',
            ], 422);
        }

        // Handle completion with transaction creation
        if ($request->status === 'completed') {
            $transactions = $appointment->markAsCompleted();
            Log::info('Appointment completed with transactions', [
                'appointment_id' => $appointment->id,
                'transactions_created' => count($transactions),
            ]);
        } else {
            // Regular status update for non-completion statuses
            $appointment->update([
                'status' => $request->status,
            ]);
        }

        // Dispatch event for waiting list processing and other listeners
        Log::info('APPOINTMENT CONTROLLER: Dispatching AppointmentStatusChanged event', [
            'appointment_id' => $appointment->id,
            'old_status' => $oldStatus,
            'new_status' => $request->status,
        ]);
        \App\Events\AppointmentStatusChanged::dispatch($appointment, $oldStatus, $request->status);

        // Log the status change
        Log::info('Appointment status updated successfully.', [
            'appointment_id' => $appointment->id,
            'old_status' => $oldStatus,
            'new_status' => $request->status,
            'updated_by' => Auth::id(),
        ]);

        // Auto-accept patient invitation and create invoice when appointment is confirmed
        if ($request->status === 'confirmed') {
            // Create invoice for the appointment
            $this->createInvoiceForAppointment($appointment);

            // Get tenant ID BEFORE switching to central context
            $currentTenantId = tenant('id');

            tenancy()->central(function () use ($appointment, $currentTenantId) {
                try {
                    $patientId = $appointment->patient_id;

                    Log::info('Attempting to auto-accept patient invitation', [
                        'appointment_id' => $appointment->id,
                        'patient_id' => $patientId,
                        'tenant_id' => $currentTenantId,
                    ]);

                    // Check if patient invitation exists and is not already ACCEPTED
                    $invitation = DB::table('tenant_patients')
                        ->where('patient_id', $patientId)
                        ->where('tenant_id', $currentTenantId)
                        ->first();

                    if ($invitation && $invitation->invitation_status !== 'ACCEPTED') {
                        DB::table('tenant_patients')
                            ->where('patient_id', $patientId)
                            ->where('tenant_id', $currentTenantId)
                            ->update(['invitation_status' => 'ACCEPTED']);

                        Log::info('Patient invitation auto-accepted on appointment confirmation', [
                            'appointment_id' => $appointment->id,
                            'patient_id' => $patientId,
                            'tenant_id' => $currentTenantId,
                            'previous_status' => $invitation->invitation_status,
                        ]);
                    } elseif ($invitation && $invitation->invitation_status === 'ACCEPTED') {
                        Log::info('Patient invitation already accepted, no action needed.', [
                            'appointment_id' => $appointment->id,
                            'patient_id' => $patientId,
                            'tenant_id' => $currentTenantId,
                        ]);
                    } else {
                        Log::warning('Patient invitation not found for auto-acceptance.', [
                            'appointment_id' => $appointment->id,
                            'patient_id' => $patientId,
                            'tenant_id' => $currentTenantId,
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to auto-accept patient invitation on appointment confirmation', [
                        'appointment_id' => $appointment->id,
                        'patient_id' => $appointment->patient_id,
                        'tenant_id' => $currentTenantId,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                }
            });

            // SEND CONFIRMATION EMAILS WHEN STATUS CHANGES TO CONFIRMED

        }

        try {
            // Get patient data from tenant database
            $patient = Patient::find($appointment->patient_id);

            // Get practitioners data from tenant database
            $practitionerIds = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->pluck('practitioner_id');

            $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

            // Get appointment details with related data
            $appointmentDetails = $appointment->load(['service', 'location']);

            // Get tenant timezone
            $tenantTimezone = \App\Models\OrganizationSetting::getValue('time_locale_timezone', 'UTC');

            // Get practitioner details with times
            $practitionerDetails = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->get(['practitioner_id', 'start_time', 'end_time']);

            // Prepare appointment data for email
            $emailAppointmentData = (object) [
                'id' => $appointment->id,
                'date' => $appointment->start_date,
                'time' => $appointment->start_time,
                'patient_name' => $patient ? trim($patient->first_name.' '.$patient->last_name) : 'N/A',
                'patient_email' => $patient->email ?? $patient->email_address ?? 'N/A',
                'patient_phone' => $patient->phone_number ?? 'N/A',
                'practitioner_name' => $practitioners->isNotEmpty()
                    ? $practitioners->map(fn ($p) => ''.trim($p->first_name.' '.$p->last_name))->join(', ')
                    : 'N/A',
                'practitioner_email' => $practitioners->first()->email ?? 'N/A',
                'department' => $appointmentDetails->service->name ?? 'General',
                'location' => $appointmentDetails->location->name ?? 'Main Clinic',
                'appointment_type' => $appointmentDetails->service->name ?? 'Consultation',
                'notes' => $appointment->notes ?? '',
                'clinic_phone' => tenant('phone') ?? '+1 (555) 123-4567',
                'clinic_email' => tenant('email') ?? 'appointments@clinic.com',
                'status' => $request->status,
            ];

            // Send confirmation email to patient (if patient email exists)
            foreach ($practitioners as $practitioner) {
                if (! empty($practitioner->email)) {
                    // Create practitioner-specific appointment data
                    $practitionerAppointmentData = clone $emailAppointmentData;
                    $practitionerAppointmentData->practitioner_name = trim($practitioner->first_name.' '.$practitioner->last_name);
                    $practitionerAppointmentData->practitioner_email = $practitioner->email;
                    Mail::to($practitioner->email)
                        ->send(new AppointmentNotificationMail($practitionerAppointmentData, 'practitioner', $request->status));
                    sleep(10); // Slight delay to avoid overwhelming mail server

                    Log::info('Appointment confirmation email sent to practitioner', [
                        'appointment_id' => $appointment->id,
                        'practitioner_email' => $practitioner->email,
                        'practitioner_name' => $practitionerAppointmentData->practitioner_name,
                    ]);
                }
            }
            // Slight delay to avoid overwhelming mail server

            if ($patient && ! empty($patient->email)) {
                sleep(12);
                Mail::to($patient->email)
                    ->send(new AppointmentNotificationMail($emailAppointmentData, 'patient', $request->status));

                Log::info('Appointment confirmation email sent to patient', [
                    'appointment_id' => $appointment->id,
                    'patient_email' => $patient->email,
                    'patient_name' => $emailAppointmentData->patient_name,
                ]);
            }

            // Send confirmation email to each practitioner

        } catch (\Exception $e) {
            // Log email sending errors but don't fail the status update
            Log::error('Failed to send appointment confirmation emails', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // You might want to add a flash message or notification about email failure
            // but still proceed with the status update
        }

        if ($request->wantsJson()) {
            // Manually load patient and practitioner data for the response
            $freshAppointment = $appointment->fresh(['service', 'location']);

            $patient = Patient::find($appointment->patient_id);

            // Load practitioners from pivot table
            $practitionerIds = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->pluck('practitioner_id');

            $appointmentPractitioners = Practitioner::whereIn('id', $practitionerIds)->get()->keyBy('id');
            Log::debug('appointmentPractitioners ', [$appointmentPractitioners]);
            Log::debug('appointmentPractitioners ', [$patient]);

            $freshAppointment->practitioners_list = $appointmentPractitioners->map(function ($practitioner) {
                return [
                    'id' => $practitioner->id,
                    'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                ];
            })->toArray();

            // Load detailed practitioner information with individual start/end times
            $practitionerDetails = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->get(['practitioner_id', 'start_time', 'end_time']);

            $tenantTimezone = OrganizationSetting::getValue('time_locale_timezone', 'UTC');
            $freshAppointment->practitioners_detail = $practitionerDetails->map(function ($detail) use ($appointmentPractitioners, $tenantTimezone) {
                $practitioner = $appointmentPractitioners->get($detail->practitioner_id);

                if (! $practitioner) {
                    return null;
                }

                // Convert UTC times to tenant timezone for display
                $startTime = $detail->start_time ? \Carbon\Carbon::parse($detail->start_time)->setTimezone($tenantTimezone) : null;
                $endTime = $detail->end_time ? \Carbon\Carbon::parse($detail->end_time)->setTimezone($tenantTimezone) : null;

                return [
                    'id' => $practitioner->id,
                    'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                    'start_time' => $startTime ? $startTime->toISOString() : null,
                    'end_time' => $endTime ? $endTime->toISOString() : null,
                ];
            })->filter()->values()->toArray();

            $freshAppointment->patient = $patient;

            // Log a successful API response
            Log::info('Appointment status update API response sent.', [
                'appointment_id' => $freshAppointment->id,
                'success' => true,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Appointment status updated successfully.',
                'appointment' => $freshAppointment,
            ]);
        }

        // Log a successful redirect response
        Log::info('Appointment status update redirect response sent.', [
            'appointment_id' => $appointment->id,
        ]);

        return redirect()->back()->with('success', 'Appointment status updated successfully.');
    }

    /**
     * Approve patient and update appointment status (for 'Requested' appointments)
     */
    public function approveAndConfirm(Request $request, Appointment $appointment)
    {
        // Validate
        $request->validate([
            'new_status' => 'required|string|in:pending,confirmed',
        ]);

        $newStatus = $request->input('new_status');

        // Check if appointment is in 'Requested' status
        if ($appointment->status !== 'Requested') {
            return redirect()->back()->with('error', 'This appointment is not in requested status.');
        }

        DB::beginTransaction();

        try {
            // Get patient from tenant database
            $patient = Patient::find($appointment->patient_id);

            if (! $patient) {
                throw new \Exception('Patient not found');
            }

            // If patient is still in 'Requested' status, approve them
            if ($patient->registration_status === 'Requested') {
                $patient->approve(Auth::id());

                Log::info('Patient auto-approved via appointment confirmation', [
                    'patient_id' => $patient->id,
                    'appointment_id' => $appointment->id,
                    'approved_by' => Auth::id(),
                ]);
            }

            // Update appointment status
            $appointment->update(['status' => $newStatus]);

            Log::info('Appointment status updated via approve-and-confirm', [
                'appointment_id' => $appointment->id,
                'patient_id' => $patient->id,
                'new_status' => $newStatus,
                'updated_by' => Auth::id(),
            ]);

            // If confirming, create invoice and trigger confirmed appointment logic
            if ($newStatus === 'confirmed') {
                // Create invoice for confirmed appointment
                $this->createInvoiceForAppointment($appointment);

                // Dispatch appointment status changed event
                event(new \App\Events\AppointmentStatusChanged($appointment, 'Requested', 'confirmed'));

                // Auto-accept patient invitation in central database
                $currentTenantId = tenant('id');
                $patientId = $appointment->patient_id;

                tenancy()->central(function () use ($patientId, $currentTenantId) {
                    $invitation = DB::table('tenant_patients')
                        ->where('patient_id', $patientId)
                        ->where('tenant_id', $currentTenantId)
                        ->first();

                    if ($invitation && $invitation->invitation_status !== 'ACCEPTED') {
                        DB::table('tenant_patients')
                            ->where('patient_id', $patientId)
                            ->where('tenant_id', $currentTenantId)
                            ->update(['invitation_status' => 'ACCEPTED']);

                        Log::info('Patient invitation auto-accepted', [
                            'patient_id' => $patientId,
                            'tenant_id' => $currentTenantId,
                        ]);
                    }
                });
            }

            DB::commit();

            $message = 'Patient approved and appointment '.($newStatus === 'confirmed' ? 'confirmed' : 'set to pending').' successfully!';

            return redirect()->back()->with('success', $message);

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Failed to approve and confirm appointment', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->with('error', 'Failed to approve appointment. Please try again.');
        }
    }

    /**
     * Update appointment management details (date, practitioners, reason)
     */
    public function updateManageAppointment(Request $request, Appointment $appointment)
    {
        Log::info('AppointmentController: Update manage appointment request received', [
            'appointment_id' => $appointment->id,
            'user_id' => Auth::id(),
            'request_data' => $request->all(),
        ]);

        // Check if user is admin
        $userRole = determineUserRole();
        if ($userRole !== 'admin') {
            Log::warning('AppointmentController: Non-admin user attempted to update appointment', [
                'appointment_id' => $appointment->id,
                'user_id' => Auth::id(),
                'user_role' => $userRole,
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only administrators can update appointments.',
                ], 403);
            }

            return redirect()->back()->withErrors(['error' => 'Only administrators can update appointments.']);
        }

        // Check if appointment status is pending
        if ($appointment->status !== 'pending') {
            Log::warning('AppointmentController: Attempted to update non-pending appointment', [
                'appointment_id' => $appointment->id,
                'current_status' => $appointment->status,
                'user_id' => Auth::id(),
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending appointments can be updated.',
                ], 422);
            }

            return redirect()->back()->withErrors(['error' => 'Only pending appointments can be updated.']);
        }

        try {
            $validated = $request->validate([
                'appointment_date' => 'required|date|after_or_equal:today',
                'appointment_time' => 'required|date_format:H:i',
                'practitioner_ids' => 'required|array|min:1',
                'practitioner_ids.*' => 'integer',
                'primary_practitioner_id' => 'required|integer',
                'reason' => 'required|string|max:1000',
            ]);
            $oldStartUtc = optional($appointment->start_time)?->copy();
            $oldEndUtc = optional($appointment->end_time)?->copy();
            // (Optional) capture other old fields if you want to show a diff table
            $oldService = optional($appointment->service)->name;
            $oldLocation = optional($appointment->location)->name;
            $snap = \App\Mail\AppointmentUpdatedMail::snapshot($appointment);

            // Validate practitioners exist in tenant database
            $validPractitionerIds = Practitioner::whereIn('id', $validated['practitioner_ids'])
                ->pluck('id')->toArray();

            if (count($validPractitionerIds) !== count($validated['practitioner_ids'])) {
                $invalidIds = array_diff($validated['practitioner_ids'], $validPractitionerIds);
                Log::warning('AppointmentController: Invalid or unlinked practitioner IDs provided', [
                    'appointment_id' => $appointment->id,
                    'invalid_ids' => $invalidIds,
                    'valid_ids' => $validPractitionerIds,
                    'tenant_id' => tenant('id'),
                ]);

                if ($request->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'One or more selected practitioners are invalid or not linked to this tenant.',
                        'errors' => ['practitioner_ids' => ['Some selected practitioners do not exist or are not linked to your organization.']],
                    ], 422);
                }

                return redirect()->back()->withErrors(['practitioner_ids' => 'Some selected practitioners do not exist or are not linked to your organization.'])->withInput();
            }

            Log::info('AppointmentController: Validation passed', [
                'appointment_id' => $appointment->id,
                'validated_data' => $validated,
                'valid_practitioner_ids' => $validPractitionerIds,
            ]);

            // Get tenant timezone for proper UTC conversion
            $tenantTimezone = TenantTimezoneService::getTenantTimezone();

            // Combine date and time for conversion to UTC
            $dateTimeString = $validated['appointment_date'].' '.$validated['appointment_time'];

            // Convert from tenant timezone to UTC for storage
            $utcDateTime = TenantTimezoneService::convertToUTC($dateTimeString);

            // Calculate end time in UTC
            $sessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);
            $utcEndTime = $utcDateTime->copy()->addMinutes($sessionDuration);

            Log::info('AppointmentController: DateTime processing with tenant timezone', [
                'input_date_time' => $dateTimeString,
                'tenant_timezone' => $tenantTimezone,
                'utc_datetime' => $utcDateTime->toISOString(),
                'utc_end_time' => $utcEndTime->toISOString(),
                'session_duration' => $sessionDuration,
            ]);

            // Check for appointment conflicts before updating (exclude current appointment)
            foreach ($validated['practitioner_ids'] as $practitionerId) {
                $conflictingAppointments = Appointment::whereExists(function ($q) use ($practitionerId) {
                    $q->from('appointment_practitioner')
                        ->whereColumn('appointment_practitioner.appointment_id', 'appointments.id')
                        ->where('appointment_practitioner.practitioner_id', $practitionerId);
                })
                    ->where('id', '!=', $appointment->id) // Exclude current appointment
                    ->whereNotNull('appointment_datetime')
                    ->where('appointment_datetime', '>=', $utcDateTime->copy()->startOfDay())
                    ->where('appointment_datetime', '<', $utcDateTime->copy()->addDay()->startOfDay())
                    ->whereNotIn('status', ['cancelled', 'no-show'])
                    ->where(function ($query) use ($utcDateTime, $utcEndTime) {
                        $query->where(function ($q) use ($utcDateTime) {
                            // Updated appointment starts during existing appointment
                            $q->where('appointment_datetime', '<=', $utcDateTime)
                                ->where('end_time', '>', $utcDateTime);
                        })->orWhere(function ($q) use ($utcEndTime) {
                            // Updated appointment ends during existing appointment
                            $q->where('appointment_datetime', '<', $utcEndTime)
                                ->where('end_time', '>=', $utcEndTime);
                        })->orWhere(function ($q) use ($utcDateTime, $utcEndTime) {
                            // Updated appointment completely contains existing appointment
                            $q->where('appointment_datetime', '>=', $utcDateTime)
                                ->where('end_time', '<=', $utcEndTime);
                        });
                    })
                    ->get();

                if ($conflictingAppointments->count() > 0) {
                    Log::warning('🚫 APPOINTMENT UPDATE CONFLICT DETECTED', [
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $practitionerId,
                        'requested_time' => $utcDateTime->format('Y-m-d H:i:s'),
                        'requested_end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                        'conflicting_appointments' => $conflictingAppointments->map(function ($apt) {
                            return [
                                'id' => $apt->id,
                                'status' => $apt->status,
                                'time' => $apt->appointment_datetime,
                            ];
                        })->toArray(),
                    ]);

                    $errorMessage = "Time slot conflict: Practitioner {$practitionerId} already has an appointment at this time. ".
                        'Conflicting appointment(s): '.
                        $conflictingAppointments->map(function ($apt) {
                            return "ID {$apt->id} ({$apt->status})";
                        })->join(', ');

                    if ($request->wantsJson()) {
                        return response()->json([
                            'success' => false,
                            'message' => $errorMessage,
                            'errors' => ['appointment_time' => [$errorMessage]],
                        ], 422);
                    }

                    return redirect()->back()
                        ->withErrors(['appointment_time' => $errorMessage])
                        ->withInput();
                }
            }

            Log::info('APPOINTMENT_UPDATE: No conflicts detected, proceeding with update', [
                'appointment_id' => $appointment->id,
                'practitioner_ids' => $validated['practitioner_ids'],
                'utc_datetime' => $utcDateTime,
                'utc_end_time' => $utcEndTime,
            ]);

            DB::beginTransaction();

            // Update appointment with UTC times
            $appointment->update([
                'appointment_datetime' => $utcDateTime,
                'start_time' => $utcDateTime,
                'end_time' => $utcEndTime,
                'stored_timezone' => $tenantTimezone,
                'needs_timezone_migration' => false,
                'date_time_preference' => $dateTimeString,
                'reason_for_update' => $validated['reason'],
            ]);

            // Update practitioners - allow changing primary practitioner
            // Validate that primary_practitioner_id is in the practitioner_ids list
            if (! in_array($validated['primary_practitioner_id'], $validated['practitioner_ids'])) {
                Log::warning('Primary practitioner not in practitioner list', [
                    'appointment_id' => $appointment->id,
                    'primary_practitioner_id' => $validated['primary_practitioner_id'],
                    'practitioner_ids' => $validated['practitioner_ids'],
                ]);

                if ($request->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Primary practitioner must be one of the selected practitioners.',
                        'errors' => ['primary_practitioner_id' => ['Primary practitioner must be included in the practitioner list.']],
                    ], 422);
                }

                return redirect()->back()
                    ->withErrors(['primary_practitioner_id' => 'Primary practitioner must be included in the practitioner list.'])
                    ->withInput();
            }

            // Delete all practitioner relationships
            DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->delete();

            // Re-insert practitioners with new primary selection
            foreach ($validated['practitioner_ids'] as $practitionerId) {
                // Use the new primary_practitioner_id from the request
                $isPrimary = ($practitionerId == $validated['primary_practitioner_id']);

                DB::table('appointment_practitioner')->insert([
                    'appointment_id' => $appointment->id,
                    'practitioner_id' => $practitionerId,
                    'start_time' => $utcDateTime->format('Y-m-d H:i:s'),
                    'end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                    'is_primary' => $isPrimary,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            Log::info('Primary practitioner updated', [
                'appointment_id' => $appointment->id,
                'primary_practitioner_id' => $validated['primary_practitioner_id'],
                'all_practitioner_ids' => $validated['practitioner_ids'],
            ]);

            DB::commit();

            Log::info('AppointmentController: Appointment updated successfully', [
                'appointment_id' => $appointment->id,
                'new_datetime' => $utcDateTime->toISOString(),
                'new_end_time' => $utcEndTime->toISOString(),
                'tenant_timezone' => $tenantTimezone,
                'practitioner_ids' => $validated['practitioner_ids'],
                'reason' => $validated['reason'],
            ]);
            $orgName = \App\Models\OrganizationSetting::getValue('practice_details_name') ?? 'Organization';
            $organization = ['name' => $orgName];

            // Convert times for email display (tenant tz strings)
            $oldStartStr = $oldStartUtc ? $oldStartUtc->clone()->setTimezone($tenantTimezone)->format('Y-m-d H:i') : null;
            $oldEndStr = $oldEndUtc ? $oldEndUtc->clone()->setTimezone($tenantTimezone)->format('Y-m-d H:i') : null;
            $newStartStr = $utcDateTime->clone()->setTimezone($tenantTimezone)->format('Y-m-d H:i');
            $newEndStr = $utcEndTime->clone()->setTimezone($tenantTimezone)->format('Y-m-d H:i');

            // Compute a basic "changes" table (optional – add more as needed)
            $newService = optional($appointment->service)->name;
            $newLocation = optional($appointment->location)->name;

            $changes = [];
            if ($oldStartStr !== $newStartStr || $oldEndStr !== $newEndStr) {
                $changes['Date & Time'] = ['old' => trim(($oldStartStr ? "$oldStartStr → " : '').($oldEndStr ?? '')), 'new' => "$newStartStr → $newEndStr"];
            }
            if (($oldService ?? null) !== ($newService ?? null)) {
                $changes['Service'] = ['old' => $oldService ?? '—', 'new' => $newService ?? '—'];
            }
            if (($oldLocation ?? null) !== ($newLocation ?? null)) {
                $changes['Location'] = ['old' => $oldLocation ?? '—', 'new' => $newLocation ?? '—'];
            }

            // Patient (tenant database)
            $patient = Patient::find($appointment->patient_id);

            // Practitioners (tenant)
            $practitionerIds = \DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->pluck('practitioner_id')
                ->all();

            $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

            // Optional deep link
            $appointmentUrl = null;
            // if (function_exists('route')) {
            //     try {
            //         $appointmentUrl = route('appointments.show', ['appointment' => $appointment->id]);
            //     } catch (\Throwable $e) { /* ignore */ }
            // }

            // Build recipient list: patient + practitioners (unique, non-empty)
            $emails = [];
            if (! empty($patient?->email)) {
                $emails[] = $patient->email;
            }
            foreach ($practitioners as $p) {
                if (! empty($p->email)) {
                    $emails[] = $p->email;
                }
            }
            $emails = array_values(array_unique(array_filter($emails)));

            // Fallback to admin if somehow nobody has email
            if (empty($emails) && env('ADMIN_EMAIL')) {
                $emails = [env('ADMIN_EMAIL')];
            }

            // Send (queue if desired)
            try {
                // Mail::to($emails)->send(new AppointmentUpdatedMail(
                //     organization:   $organization,
                //     patient:        $patient,
                //     practitioners:  $practitioners,
                //     appointment:    $appointment->fresh(['service','location']),
                //     tenantTimezone: $tenantTimezone,
                //     oldStart:       $oldStartStr,
                //     oldEnd:         $oldEndStr,
                //     newStart:       $newStartStr,
                //     newEnd:         $newEndStr,
                //     reason:         $validated['reason'] ?? null,
                //     changes:        $changes,
                //     viewUrl:        $appointmentUrl,
                //     updatedBy:      \Auth::user()
                // ));
                \App\Mail\AppointmentUpdatedMail::sendForUpdate(
                    appointment: $appointment,
                    snapshot: $snap,
                    tenantTimezone: $tenantTimezone,
                    reason: $validated['reason'] ?? null,
                    updatedBy: \Auth::user()
                );

            } catch (\Throwable $e) {
                // \Log::error('AppointmentController: Failed to send AppointmentUpdatedMail', [
                //     'appointment_id' => $appointment->id,
                //     'to' => $emails,
                //     'error' => $e->getMessage(),
                // ]);
            }
            if ($request->wantsJson()) {
                // Reload appointment with fresh data for response
                $freshAppointment = $appointment->fresh(['service', 'location']);

                // Load patient and practitioners data
                $patient = Patient::find($appointment->patient_id);

                $practitionerIds = DB::table('appointment_practitioner')
                    ->where('appointment_id', $appointment->id)
                    ->pluck('practitioner_id');

                $practitioners = Practitioner::whereIn('id', $practitionerIds)->get()->keyBy('id');

                $freshAppointment->patient = $patient;
                $freshAppointment->practitioners_list = $practitioners->map(function ($practitioner) {
                    return [
                        'id' => $practitioner->id,
                        'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                    ];
                })->values()->toArray();

                // Check if fresh appointment needs timezone conversion
                if ($freshAppointment->appointment_datetime) {
                    // New appointments are already in tenant timezone, no conversion needed
                    if (isset($freshAppointment->stored_timezone) && $freshAppointment->stored_timezone === $tenantTimezone) {
                        $freshAppointment->appointment_datetime_local = $freshAppointment->appointment_datetime;
                    } else {
                        // Legacy or different timezone appointment
                        $freshAppointment->appointment_datetime_local = $freshAppointment->appointment_datetime->setTimezone(new \DateTimeZone($tenantTimezone));
                    }
                    $freshAppointment->tenant_timezone = $tenantTimezone;
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Appointment updated successfully.',
                    'appointment' => $freshAppointment,
                ]);
            }

            return redirect()->back()->with('success', 'Appointment updated successfully.');

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('AppointmentController: Validation failed', [
                'appointment_id' => $appointment->id,
                'errors' => $e->errors(),
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed.',
                    'errors' => $e->errors(),
                ], 422);
            }

            return redirect()->back()->withErrors($e->errors())->withInput();

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('AppointmentController: Failed to update appointment', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to update appointment: '.$e->getMessage(),
                ], 500);
            }

            return redirect()->back()->with('error', 'Failed to update appointment: '.$e->getMessage());
        }
    }

    /**
     * Show the form for creating a new appointment.
     */
    public function create(Request $request)
    {
        $currentTenantId = tenant('id');

        // Handle POST requests for session management
        if ($request->isMethod('post')) {
            // Store form data in session only when explicitly saving tab data
            if ($request->has('save_tab_data')) {
                session(['appointment_form_data' => $request->all()]);

                return redirect()->route('appointments.create', ['tab' => $request->tab, 'keep_data' => 'true']);
            }
        }

        // Handle clear form request
        if ($request->has('clear') && $request->get('clear') === 'true') {
            session()->forget('appointment_form_data');

            return redirect()->route('appointments.create')
                ->with('success', 'Form cleared successfully!');
        }

        // Clear form data on fresh page load (when no tab specified and no keep_data flag)
        if (! $request->has('tab') && ! $request->has('keep_data')) {
            session()->forget('appointment_form_data');
        }

        // Render the create form directly (no loading page for forms)
        $currentTenantId = tenant('id');

        // Get form data from session or request (always check session in loaded method)
        $sessionData = session('appointment_form_data', []);
        $formData = array_merge($sessionData, $request->only([
            'tab', 'service_type', 'service_name', 'service_id', 'practitioner_ids', 'location_id',
            'mode', 'date_time_preference', 'booking_source', 'admin_override',
            'first_name', 'last_name', 'preferred_name', 'health_number', 'phone_number',
            'email_address', 'gender_pronouns', 'client_type', 'date_of_birth', 'emergency_contact_phone',
            'contact_person',
        ]));

        // Load all services for the tenant (for client-side filtering)
        $allServices = Service::where('is_active', true)
            ->select('id', 'name', 'category', 'delivery_modes')
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(function ($service) {
                return [
                    'id' => $service->id,
                    'name' => $service->name,
                    'category' => $service->category,
                    'delivery_modes' => $service->delivery_modes ?? [],

                ];
            });

        // Get unique service categories for service type dropdown
        $serviceTypes = $allServices->pluck('category')->unique()->sort()->values();

        // Load all practitioners for the tenant (for client-side filtering)
        // Get all practitioners from tenant database
        $allPractitioners = Practitioner::where('is_active', true)->get();

        $allPractitioners = PractitionerMinimalResource::collection($allPractitioners)
            ->map(function ($practitioner) {
                return [
                    'id' => $practitioner['id'], // Use central_practitioner_id as the ID
                    'name' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                    'value' => $practitioner['id'], // Use central_practitioner_id as the value
                    'label' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                ];
            });

        // Get practitioners' Google Calendar integration status
        $practitionersCalendarStatus = [];
        if ($allPractitioners->isNotEmpty()) {
            $practitionerIds = $allPractitioners->pluck('id')->toArray();

            // Check calendar integration status for each practitioner
            foreach ($practitionerIds as $practitionerId) {
                $userIntegration = \App\Models\UserIntegration::where('user_id', $practitionerId)
                    ->where('provider', \App\Models\UserIntegration::PROVIDER_GOOGLE)
                    ->where('type', \App\Models\UserIntegration::TYPE_CALENDAR)
                    ->where('is_active', true)
                    ->where('is_configured', true)
                    ->where('status', \App\Models\UserIntegration::STATUS_ACTIVE)
                    ->first();

                $practitionersCalendarStatus[$practitionerId] = $userIntegration ? true : false;
            }
        }

        // Get practitioner-service relationships for client-side filtering
        // Note: practitioner_id in practitioner_services refers to central_practitioner_id
        $practitionerServiceRelations = DB::table('practitioner_services')
            ->where('is_offered', true)
            ->select('practitioner_id', 'service_id')
            ->get()
            ->groupBy('practitioner_id')
            ->map(function ($relations) {
                return $relations->pluck('service_id')->toArray();
            });

        $locations = Location::where('is_active', true)
            ->select('id', 'name', 'street_address', 'city', 'province')
            ->orderBy('name')
            ->get()
            ->map(function ($location) {
                return [
                    'id' => $location->id,
                    'value' => $location->id,
                    'label' => $location->name,
                    'address' => $location->street_address.', '.$location->city,
                ];
            });

        // Determine current tab and validate previous tabs
        $currentTab = $request->get('tab', 'client-info');
        $validationErrors = [];

        // Validate client info if moving beyond it
        if (in_array($currentTab, ['appointment-details', 'trigger-follow-up'])) {
            $clientValidation = $this->validateClientInfo($formData);
            if (! empty($clientValidation)) {
                $validationErrors = array_merge($validationErrors, $clientValidation);
                $currentTab = 'client-info'; // Force back to client info tab
            }
        }

        // Validate appointment details if moving to trigger follow-up
        if ($currentTab === 'trigger-follow-up') {
            $appointmentValidation = $this->validateAppointmentDetails($formData);
            if (! empty($appointmentValidation)) {
                $validationErrors = array_merge($validationErrors, $appointmentValidation);
                $currentTab = 'appointment-details'; // Force back to appointment details tab
            }
        }

        return Inertia::render('Appointments/Create', [
            'currentTab' => $currentTab,
            'appointmentSessionDuration' => (int) OrganizationSetting::getValue('appointment_session_duration', 30),
            'appointmentSettings' => [
                'advanceBookingHours' => OrganizationSetting::getValue('appointment_advance_booking_hours', '2'),
                'maxAdvanceBookingDays' => OrganizationSetting::getValue('appointment_max_advance_booking_days', '90'),
                'allowSameDayBooking' => OrganizationSetting::getValue('appointment_allow_same_day_booking', '0') === '1',
            ],
            'formData' => [
                'service_type' => $formData['service_type'] ?? '',
                'service_name' => $formData['service_name'] ?? '',
                'service_id' => $formData['service_id'] ?? '',
                'practitioner_ids' => $formData['practitioner_ids'] ?? [],
                'location_id' => $formData['location_id'] ?? '',
                'mode' => $formData['mode'] ?? '',
                'date_time_preference' => $formData['date_time_preference'] ?? '',
                'booking_source' => $formData['booking_source'] ?? '',
                'admin_override' => $formData['admin_override'] ?? '',
                'first_name' => $formData['first_name'] ?? '',
                'last_name' => $formData['last_name'] ?? '',
                'preferred_name' => $formData['preferred_name'] ?? '',
                'health_number' => $formData['health_number'] ?? '',
                'phone_number' => $formData['phone_number'] ?? '',
                'email_address' => $formData['email_address'] ?? '',
                'gender_pronouns' => $formData['gender_pronouns'] ?? '',
                'client_type' => $formData['client_type'] ?? '',
                'date_of_birth' => $formData['date_of_birth'] ?? '',
                'emergency_contact_phone' => $formData['emergency_contact_phone'] ?? '',
                'contact_person' => $formData['contact_person'] ?? '',
            ],
            'errors' => $validationErrors,
            'serviceTypes' => Inertia::defer(fn () => $serviceTypes),
            'allServices' => Inertia::defer(fn () => $allServices),
            'allPractitioners' => Inertia::defer(fn () => $allPractitioners),
            'practitionerServiceRelations' => Inertia::defer(fn () => $practitionerServiceRelations),
            'practitionersCalendarStatus' => Inertia::defer(fn () => $practitionersCalendarStatus),
            'locations' => Inertia::defer(fn () => $locations),
        ]);
    }

    /**
     * Search for existing patients by health number or name (compliance-focused with masking).
     */
    public function searchPatients(Request $request)
    {
        // Check if this is a simple health card validation (search parameter only)
        if ($request->has('search') && ! $request->has('first_name')) {
            $request->validate([
                'search' => ['required', 'string', 'min:1'],
            ]);

            $healthCardNumber = $request->search;
            $currentTenantId = tenant('id');

            // Search for patients linked to current tenant with exact health card number (encrypted field)
            $query = null;
            tenancy()->central(function () use (&$query, $healthCardNumber, $currentTenantId) {
                $query = Patient::whereBlind('health_number', 'health_number_index', $healthCardNumber)
                    ->whereHas('tenants', function ($query) use ($currentTenantId) {
                        $query->where('tenant_id', $currentTenantId);
                    });
            });
        } else {
            // Original patient search by name and health card
            $request->validate([
                'first_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
                'last_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
                'health_card_number' => ['nullable', 'string', 'min:2'],
            ], [
                'first_name.regex' => 'First name and last name can have letters only.',
                'last_name.regex' => 'First name and last name can have letters only.',
            ]);

            $firstName = $request->first_name;
            $lastName = $request->last_name;
            $healthCardNumber = $request->health_card_number;
            $currentTenantId = tenant('id');

            // Search for patients linked to current tenant with exact first and last name matching (encrypted fields)
            $query = null;
            tenancy()->central(function () use (&$query, $firstName, $lastName, $healthCardNumber, $currentTenantId) {
                $query = Patient::whereBlind('first_name', 'first_name_index', $firstName)
                    ->whereBlind('last_name', 'last_name_index', $lastName)
                    ->whereHas('tenants', function ($query) use ($currentTenantId) {
                        $query->where('tenant_id', $currentTenantId);
                    });

                // Add health card number filter if provided (encrypted field)
                if ($healthCardNumber) {
                    $query->whereBlind('health_number', 'health_number_index', $healthCardNumber);
                }
            });
        }

        $patients = $query->limit(10)->get();

        // Return masked patient data using resource
        $maskedPatients = PatientMaskedResource::collection($patients);

        return response()->json([
            'patients' => $maskedPatients,
        ]);
    }

    /**
     * Mask a string keeping first and last characters visible
     */
    private function maskString(string $str, int $start = 1, int $end = 1): string
    {
        $length = strlen($str);
        if ($length <= $start + $end) {
            return str_repeat('*', $length);
        }

        return substr($str, 0, $start).
               str_repeat('*', $length - $start - $end).
               substr($str, -$end);
    }

    /**
     * Mask an email address
     */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return $email;
        }

        $username = $parts[0];
        $domain = $parts[1];

        $maskedUsername = $this->maskString($username, 1, 1);

        return $maskedUsername.'@'.$domain;
    }

    /**
     * Mask a health card number
     */
    private function maskHealthNumber(?string $healthNumber): ?string
    {
        if (! $healthNumber) {
            return null;
        }

        return $this->maskString($healthNumber, 2, 2);
    }

    /**
     * Mask a phone number
     */
    private function maskPhoneNumber(?string $phoneNumber): ?string
    {
        if (! $phoneNumber) {
            return null;
        }

        return $this->maskString($phoneNumber, 3, 2);
    }

    /**
     * Mask a date (show only day)
     */
    private function maskDate(string $date): string
    {
        $dateObj = new \DateTime($date);

        return '****-**-'.$dateObj->format('d'); // Show only day, mask month and year
    }

    /**
     * Fill form with existing patient data.
     */
    public function fillPatientData(Request $request)
    {
        $request->validate([
            'patient_id' => ['required', 'integer'],
        ]);

        $patientId = $request->patient_id;
        $currentTenantId = tenant('id');

        // Find patient and verify they're linked to current tenant
        $patient = Patient::whereHas('tenants', function ($query) use ($currentTenantId) {
            $query->where('tenant_id', $currentTenantId);
        })->find($patientId);

        if (! $patient) {
            return response()->json(['error' => 'Patient not found or not linked to your organization'], 404);
        }

        // Debug: Log patient data to see what we have
        Log::info('Patient data for auto-fill:', [
            'patient_id' => $patient->id,
            'patient_attributes' => $patient->getAttributes(),
            'raw_date_of_birth' => $patient->date_of_birth,
            'date_of_birth_type' => gettype($patient->date_of_birth),
        ]);

        // Get current form data from session
        $currentFormData = session('appointment_form_data', []);

        // Format date of birth for HTML date input (YYYY-MM-DD)
        $formattedDateOfBirth = '';
        if ($patient->date_of_birth) {
            try {
                $date = Carbon::parse($patient->date_of_birth);
                $formattedDateOfBirth = $date->format('Y-m-d');
                Log::info('Date formatting successful:', [
                    'raw_date' => $patient->date_of_birth,
                    'formatted_date' => $formattedDateOfBirth,
                ]);
            } catch (\Exception $e) {
                Log::error('Date formatting failed:', [
                    'raw_date' => $patient->date_of_birth,
                    'error' => $e->getMessage(),
                ]);
            }
        } else {
            Log::warning('Patient date_of_birth is empty or null');
        }

        // Update form data with patient information
        $updatedFormData = array_merge($currentFormData, [
            'health_number' => $patient->health_number ?? '',
            'first_name' => $patient->first_name ?? '',
            'last_name' => $patient->last_name ?? '',
            'preferred_name' => $patient->preferred_name ?? '',
            'phone_number' => $patient->phone_number ?? '',
            'email_address' => $patient->email ?? '',
            'gender_pronouns' => $patient->gender_pronouns ?? $patient->gender ?? '',
            'client_type' => $patient->client_type ?? '',
            'date_of_birth' => $formattedDateOfBirth,
            'emergency_contact_phone' => $patient->emergency_contact_phone ?? '',
        ]);

        // Store updated form data in session
        session(['appointment_form_data' => $updatedFormData]);

        // Debug: Log what gets saved to session
        Log::info('Updated form data saved to session:', [
            'date_of_birth' => $updatedFormData['date_of_birth'],
            'client_type' => $updatedFormData['client_type'],
            'gender_pronouns' => $updatedFormData['gender_pronouns'],
        ]);

        // For AJAX requests, return JSON response
        if ($request->wantsJson()) {
            return response()->json([
                'success' => 'Patient data filled successfully',
                'patient_data' => [
                    'health_number' => $patient->health_number ?? '',
                    'first_name' => $patient->first_name ?? '',
                    'last_name' => $patient->last_name ?? '',
                    'preferred_name' => $patient->preferred_name ?? '',
                    'phone_number' => $patient->phone_number ?? '',
                    'email_address' => $patient->email ?? '',
                    'gender_pronouns' => $patient->gender_pronouns ?? $patient->gender ?? '',
                    'client_type' => $patient->client_type ?? '',
                    'date_of_birth' => $formattedDateOfBirth,
                    'emergency_contact_phone' => $patient->emergency_contact_phone ?? '',
                ],
            ]);
        }

        // For regular requests, redirect with success message
        return redirect()->route('appointments.create')->with('success', 'Patient data filled successfully!');
    }

    /**
     * Handle form data updates via POST to avoid long URLs
     */
    public function updateFormData(Request $request)
    {
        return $this->create($request);
    }

    /**
     * Validate client info fields
     */
    private function validateClientInfo($data)
    {
        $rules = [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'phone_number' => 'required|string|max:20',
            'email_address' => 'required|email|max:255',
            'gender_pronouns' => 'required|string|max:255',
            'client_type' => 'required|string|max:255',
            'date_of_birth' => 'required|date',
            'emergency_contact_phone' => 'required|string|max:20',
        ];

        $validator = Validator::make($data, $rules);

        return $validator->errors()->toArray();
    }

    /**
     * Validate appointment details fields
     */
    private function validateAppointmentDetails($data)
    {
        $rules = [
            'service_id' => 'required|integer',
            'practitioner_ids' => 'required|array',
            'practitioner_ids.*' => 'integer',
            'mode' => 'required|string|max:255',
            'date_time_preference' => 'required|string|max:255',
            'booking_source' => 'required|string|max:255',
            'admin_override' => 'required|string|max:255',
        ];

        // Add conditional location validation based on mode
        $mode = $data['mode'] ?? '';
        if ($mode === 'in-person') {
            $rules['location_id'] = 'required|integer';
        } else {
            // For virtual/hybrid, location_id is optional but must be integer if provided
            $rules['location_id'] = 'nullable|integer';
        }

        $validator = Validator::make($data, $rules);

        return $validator->errors()->toArray();
    }

    public function getPractitionerAvailability(Request $request)
    {
        // Support both single and multiple practitioners
        $request->validate([
            'practitioner_id' => ['nullable', 'integer'],
            'practitioner_ids' => ['nullable', 'array'],
            'practitioner_ids.*' => ['integer'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'mode' => ['required', 'string', 'in:in-person,virtual,hybrid'],
        ]);

        // Get practitioner IDs from either field
        $practitionerIds = $request->input('practitioner_ids', []);
        if ($request->has('practitioner_id') && $request->practitioner_id) {
            $practitionerIds = [$request->practitioner_id];
        }

        if (empty($practitionerIds)) {
            return response()->json(['error' => 'No practitioners specified'], 400);
        }

        $locationId = $request->input('location_id');
        $mode = $request->input('mode');

        // For multiple practitioners, we need to find common available slots
        if (count($practitionerIds) > 1) {
            return $this->getMultiplePractitionerAvailability($practitionerIds, $locationId, $mode);
        }

        // Single practitioner logic (existing code)
        $practitionerId = $practitionerIds[0];
        $availability = [];

        if ($mode === 'in-person' && $locationId) {
            // Fetch availability for a specific location and practitioner
            $availability = PractitionerAvailability::where('practitioner_id', $practitionerId)
                ->where('location_id', $locationId)
                ->orderBy('day')
                ->get();
        } elseif ($mode === 'virtual' || $mode === 'hybrid') {
            // For virtual or hybrid, location might not be relevant or could be primary location
            // For simplicity, let's fetch all availability for the practitioner if no specific location is required for virtual/hybrid
            $availability = PractitionerAvailability::where('practitioner_id', $practitionerId)
                ->orderBy('day')
                ->get();
        }

        // Convert to array grouped by day
        $availabilityByDay = [];
        foreach ($availability as $item) {
            $day = strtolower($item->day);
            if (! isset($availabilityByDay[$day])) {
                $availabilityByDay[$day] = [];
            }
            $availabilityByDay[$day][] = [
                'start_time' => $item->start_time,
                'end_time' => $item->end_time,
            ];
        }

        // Get organization settings to retrieve default session duration
        $organizationSettings = OrganizationSetting::first();
        $appointmentSessionDuration = $organizationSettings->appointment_session_duration ?? 30;

        // Get existing appointments for this practitioner to show conflicts
        $todayUtc = now()->utc()->startOfDay();

        // Get tenant timezone for debugging
        $tenantTimezone = TenantTimezoneService::getTenantTimezone();

        Log::info('🔍 AVAILABILITY DEBUG: Starting query for existing appointments', [
            'practitioner_id' => $practitionerId,
            'today_utc' => $todayUtc->format('Y-m-d H:i:s'),
            'mode' => $mode,
            'location_id' => $locationId,
            'tenant_timezone' => $tenantTimezone,
        ]);

        $existingAppointments = Appointment::whereExists(function ($exists) use ($practitionerId) {
            $exists->select(DB::raw(1))
                ->from('appointment_practitioner')
                ->whereColumn('appointment_practitioner.appointment_id', 'appointments.id')
                ->where('appointment_practitioner.practitioner_id', $practitionerId);
        })
            ->whereNotNull('appointment_datetime')
            ->where('appointment_datetime', '>=', $todayUtc)
            ->whereNotIn('status', ['cancelled', 'no-show'])
            // ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
            //     return $query->where('mode', 'in-person')->where('location_id', $locationId);
            // })
            ->select('appointment_datetime', 'start_time', 'end_time', 'status', 'mode', 'location_id', 'id')
            ->get()
            ->map(function ($appointment) use ($appointmentSessionDuration) {
                $actualDuration = $appointmentSessionDuration;

                if ($appointment->start_time && $appointment->end_time) {
                    $actualDuration = $appointment->start_time->diffInMinutes($appointment->end_time);
                }

                // Use appointment_datetime if available, fallback to start_time
                $dateTime = $appointment->appointment_datetime ?: $appointment->start_time;

                if (! $dateTime) {
                    // Skip appointments without valid datetime
                    return null;
                }

                // Convert UTC time to tenant timezone for frontend display
                $localDateTime = $dateTime;
                try {
                    $localDateTime = TenantTimezoneService::convertToTenantTime($dateTime);
                } catch (\Exception $e) {
                    Log::warning('Failed to convert appointment time to tenant timezone', [
                        'appointment_id' => $appointment->id,
                        'utc_datetime' => $dateTime->format('Y-m-d H:i:s'),
                        'error' => $e->getMessage(),
                    ]);
                    // Fallback to UTC if conversion fails
                    $localDateTime = $dateTime;
                }

                return [
                    'datetime' => $localDateTime->format('Y-m-d H:i:s'),
                    'date' => $localDateTime->format('Y-m-d'),
                    'time' => $localDateTime->format('H:i'),
                    'appointment_id' => $appointment->id,
                    'status' => $appointment->status,
                    'mode' => $appointment->mode,
                    'location_id' => $appointment->location_id,
                    'duration' => $actualDuration,
                    'timezone_converted' => true, // Always converted to tenant timezone
                    'original_utc' => $dateTime->format('Y-m-d H:i:s'), // Debug info
                ];
            })
            ->filter() // Remove null entries
            ->toArray();

        Log::info('🔍 AVAILABILITY DEBUG: Found existing appointments', [
            'practitioner_id' => $practitionerId,
            'location_id' => $locationId,
            'appointments_count' => count($existingAppointments),
            'sample_appointments' => array_slice($existingAppointments, 0, 3), // Show first 3 for debugging
            'timezone_conversion_applied' => $locationId ? true : false,
        ]);

        Log::info('🔍 AVAILABILITY DEBUG: Returning response', [
            'availability_days' => array_keys($availabilityByDay),
            'existing_appointments_count' => count($existingAppointments),
            'response_structure' => [
                'availability' => count($availabilityByDay),
                'existingAppointments' => count($existingAppointments),
            ],
        ]);

        return response()->json([
            'availability' => $availabilityByDay,
            'existingAppointments' => $existingAppointments,
        ]);
    }

    /**
     * Get availability for multiple practitioners - find common slots
     */
    private function getMultiplePractitionerAvailability($practitionerIds, $locationId, $mode)
    {
        $allPractitionerAvailability = [];
        $allExistingAppointments = [];

        // Define todayUtc for use in logging
        $todayUtc = now()->utc()->startOfDay();

        // Get availability and existing appointments for each practitioner
        foreach ($practitionerIds as $practitionerId) {
            $availability = [];

            if ($mode === 'in-person' && $locationId) {
                $availability = PractitionerAvailability::where('practitioner_id', $practitionerId)
                    ->where('location_id', $locationId)
                    ->orderBy('day')
                    ->get();
            } else {
                $availability = PractitionerAvailability::where('practitioner_id', $practitionerId)
                    ->orderBy('day')
                    ->get();
            }

            // Group by day for this practitioner
            $practitionerAvailability = [];
            foreach ($availability as $item) {
                $day = strtolower($item->day);
                if (! isset($practitionerAvailability[$day])) {
                    $practitionerAvailability[$day] = [];
                }
                $practitionerAvailability[$day][] = [
                    'start_time' => $item->start_time,
                    'end_time' => $item->end_time,
                ];
            }

            $allPractitionerAvailability[$practitionerId] = $practitionerAvailability;

            // Get existing appointments for this practitioner
            $organizationSettings = OrganizationSetting::first();
            $appointmentSessionDuration = $organizationSettings->appointment_session_duration ?? 30;

            $existingAppointments = Appointment::whereExists(function ($exists) use ($practitionerId) {
                $exists->select(DB::raw(1))
                    ->from('appointment_practitioner')
                    ->whereColumn('appointment_practitioner.appointment_id', 'appointments.id')
                    ->where('appointment_practitioner.practitioner_id', $practitionerId);
            })
                ->whereNotNull('appointment_datetime')
                ->where('appointment_datetime', '>=', $todayUtc)
                ->whereNotIn('status', ['cancelled', 'no-show'])
                ->when($mode === 'in-person' && $locationId, function ($query) use ($locationId) {
                    return $query->where('mode', 'in-person')->where('location_id', $locationId);
                })
                ->select('appointment_datetime', 'start_time', 'end_time', 'status', 'mode', 'location_id', 'id as appointment_id')
                ->get();

            Log::info('🔍 AVAILABILITY CHECK: Found existing appointments', [
                'practitioner_id' => $practitionerId,
                'today_utc' => $todayUtc->format('Y-m-d H:i:s'),
                'mode' => $mode,
                'location_id' => $locationId,
                'found_appointments' => $existingAppointments->count(),
                'appointment_details' => $existingAppointments->map(function ($apt) {
                    return [
                        'id' => $apt->appointment_id,
                        'start_time' => $apt->start_time,
                        'end_time' => $apt->end_time,
                        'status' => $apt->status,
                    ];
                })->toArray(),
            ]);

            $existingAppointments = $existingAppointments->map(function ($appointment) use ($appointmentSessionDuration) {
                $actualDuration = $appointmentSessionDuration;

                if ($appointment->start_time && $appointment->end_time) {
                    $actualDuration = Carbon::parse($appointment->start_time)->diffInMinutes(Carbon::parse($appointment->end_time));
                }

                // Use appointment_datetime if available, fallback to start_time
                $dateTime = $appointment->appointment_datetime ? Carbon::parse($appointment->appointment_datetime) : Carbon::parse($appointment->start_time);

                if (! $dateTime) {
                    // Skip appointments without valid datetime
                    return null;
                }

                // Convert UTC time to tenant timezone for frontend display
                $localDateTime = $dateTime;
                try {
                    $localDateTime = TenantTimezoneService::convertToTenantTime($dateTime);
                } catch (\Exception $e) {
                    Log::warning('Failed to convert appointment time to tenant timezone in multi-practitioner method', [
                        'appointment_id' => $appointment->appointment_id,
                        'utc_datetime' => $dateTime->format('Y-m-d H:i:s'),
                        'error' => $e->getMessage(),
                    ]);
                    // Fallback to UTC if conversion fails
                    $localDateTime = $dateTime;
                }

                return [
                    'datetime' => $localDateTime->format('Y-m-d H:i:s'),
                    'date' => $localDateTime->format('Y-m-d'),
                    'time' => $localDateTime->format('H:i'),
                    'appointment_id' => $appointment->appointment_id,
                    'status' => $appointment->status,
                    'mode' => $appointment->mode,
                    'location_id' => $appointment->location_id,
                    'duration' => $actualDuration,
                    'timezone_converted' => true, // Always converted to tenant timezone
                    'original_utc' => $dateTime->format('Y-m-d H:i:s'), // Debug info
                ];
            })
                ->filter()
                ->toArray();

            $allExistingAppointments = array_merge($allExistingAppointments, $existingAppointments);
        }

        // Calculate merged availability (intersection of all practitioners)
        $mergedAvailability = $this->calculateMergedAvailability($allPractitionerAvailability);

        return response()->json([
            'availability' => $mergedAvailability,
            'existingAppointments' => $allExistingAppointments,
        ]);
    }

    /**
     * Calculate merged availability by finding intersection of all practitioners' availability
     */
    private function calculateMergedAvailability($allPractitionerAvailability)
    {
        if (empty($allPractitionerAvailability)) {
            return [];
        }

        // Get all days that exist across practitioners
        $allDays = [];
        foreach ($allPractitionerAvailability as $practitionerAvailability) {
            $allDays = array_merge($allDays, array_keys($practitionerAvailability));
        }
        $allDays = array_unique($allDays);

        $mergedAvailability = [];

        foreach ($allDays as $day) {
            // Check if ALL practitioners have availability on this day
            $dayAvailabilityForAll = [];
            $allHaveThisDay = true;

            foreach ($allPractitionerAvailability as $practitionerId => $practitionerAvailability) {
                if (! isset($practitionerAvailability[$day])) {
                    $allHaveThisDay = false;
                    break;
                }
                $dayAvailabilityForAll[$practitionerId] = $practitionerAvailability[$day];
            }

            if (! $allHaveThisDay) {
                continue; // Skip this day if not all practitioners are available
            }

            // Find overlapping time slots for this day
            $overlappingSlots = $this->findOverlappingTimeSlots($dayAvailabilityForAll);

            if (! empty($overlappingSlots)) {
                $mergedAvailability[$day] = $overlappingSlots;
            }
        }

        return $mergedAvailability;
    }

    /**
     * Find overlapping time slots among multiple practitioners for a given day
     */
    private function findOverlappingTimeSlots($dayAvailabilityForAll)
    {
        $allSlots = [];

        // Get all time slots from all practitioners for this day
        foreach ($dayAvailabilityForAll as $practitionerId => $slots) {
            foreach ($slots as $slot) {
                $allSlots[] = [
                    'practitioner_id' => $practitionerId,
                    'start_time' => $slot['start_time'],
                    'end_time' => $slot['end_time'],
                ];
            }
        }

        // Find intersections
        $overlappingSlots = [];
        $totalPractitioners = count($dayAvailabilityForAll);

        // For each time slot, check if it overlaps with slots from ALL other practitioners
        foreach ($allSlots as $baseSlot) {
            $intersections = [$baseSlot];

            foreach ($dayAvailabilityForAll as $practitionerId => $slots) {
                if ($practitionerId == $baseSlot['practitioner_id']) {
                    continue; // Skip same practitioner
                }

                foreach ($slots as $slot) {
                    $intersection = $this->intersectTimeSlots($baseSlot, $slot);
                    if ($intersection) {
                        $intersections[] = array_merge($intersection, ['practitioner_id' => $practitionerId]);
                        break; // Found intersection with this practitioner, move to next
                    }
                }
            }

            // If we have intersections with ALL practitioners
            if (count($intersections) >= $totalPractitioners) {
                // Calculate the final intersection time range
                $finalIntersection = $this->calculateFinalIntersection($intersections);
                if ($finalIntersection) {
                    $overlappingSlots[] = $finalIntersection;
                }
            }
        }

        // Remove duplicates and merge overlapping slots
        return $this->mergeOverlappingSlots($overlappingSlots);
    }

    /**
     * Calculate intersection between two time slots
     */
    private function intersectTimeSlots($slot1, $slot2)
    {
        $start1 = Carbon::createFromFormat('H:i:s', $slot1['start_time']);
        $end1 = Carbon::createFromFormat('H:i:s', $slot1['end_time']);
        $start2 = Carbon::createFromFormat('H:i:s', $slot2['start_time']);
        $end2 = Carbon::createFromFormat('H:i:s', $slot2['end_time']);

        // Calculate intersection
        $intersectionStart = $start1->gt($start2) ? $start1 : $start2;
        $intersectionEnd = $end1->lt($end2) ? $end1 : $end2;

        // Check if intersection is valid (start < end)
        if ($intersectionStart->lt($intersectionEnd)) {
            return [
                'start_time' => $intersectionStart->format('H:i:s'),
                'end_time' => $intersectionEnd->format('H:i:s'),
            ];
        }

        return null; // No intersection
    }

    /**
     * Calculate final intersection from multiple overlapping slots
     */
    private function calculateFinalIntersection($intersections)
    {
        if (empty($intersections)) {
            return null;
        }

        $latestStart = null;
        $earliestEnd = null;

        foreach ($intersections as $intersection) {
            $start = Carbon::createFromFormat('H:i:s', $intersection['start_time']);
            $end = Carbon::createFromFormat('H:i:s', $intersection['end_time']);

            if ($latestStart === null || $start->gt($latestStart)) {
                $latestStart = $start;
            }

            if ($earliestEnd === null || $end->lt($earliestEnd)) {
                $earliestEnd = $end;
            }
        }

        // Check if final intersection is valid
        if ($latestStart && $earliestEnd && $latestStart->lt($earliestEnd)) {
            return [
                'start_time' => $latestStart->format('H:i:s'),
                'end_time' => $earliestEnd->format('H:i:s'),
            ];
        }

        return null;
    }

    /**
     * Merge overlapping slots and remove duplicates
     */
    private function mergeOverlappingSlots($slots)
    {
        if (empty($slots)) {
            return [];
        }

        // Sort slots by start time
        usort($slots, function ($a, $b) {
            return strcmp($a['start_time'], $b['start_time']);
        });

        $merged = [];
        $current = $slots[0];

        for ($i = 1; $i < count($slots); $i++) {
            $next = $slots[$i];

            // Check if current and next overlap or are adjacent
            $currentEnd = Carbon::createFromFormat('H:i:s', $current['end_time']);
            $nextStart = Carbon::createFromFormat('H:i:s', $next['start_time']);

            if ($currentEnd->gte($nextStart)) {
                // Merge the slots
                $nextEnd = Carbon::createFromFormat('H:i:s', $next['end_time']);
                if ($nextEnd->gt($currentEnd)) {
                    $current['end_time'] = $next['end_time'];
                }
            } else {
                // No overlap, add current to merged and update current
                $merged[] = $current;
                $current = $next;
            }
        }

        // Add the last slot
        $merged[] = $current;

        return $merged;
    }

    /**
     * Store a new appointment (and create patient if needed)
     */
    public function store(Request $request)
    {
        // First validate basic fields
        $basicValidation = [
            // Client Information (for patient creation)
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'preferred_name' => 'nullable|string|max:255',
            'health_number' => 'nullable|string|max:255',
            'phone_number' => 'required|string|max:255',
            'email_address' => 'required|email|max:255',
            'gender_pronouns' => 'required|string|max:255',
            'client_type' => 'required|string|max:255',
            'date_of_birth' => 'required|date',
            'emergency_contact_phone' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',

            // Appointment Details
            'service_id' => 'required|integer',
            'practitioner_ids' => 'sometimes|array',
            'practitioner_ids.*' => 'integer',
            'practitioner_id' => 'sometimes|integer',
            'primary_practitioner_id' => 'required|integer', // Primary practitioner (will be set as is_primary in pivot table)
            'mode' => 'required|string|max:255',
            'date_time_preference' => 'required|string|max:255|regex:/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/',
            'booking_source' => 'required|string|max:255',
            'admin_override' => 'required|string|max:255',

            // Advanced Appointment Settings
            'advanced_appointment_settings' => 'nullable|boolean',
            'slot_divisions' => 'nullable|string', // JSON string
        ];

        // Add conditional location validation based on mode
        $mode = $request->input('mode');
        if ($mode === 'in-person') {
            $basicValidation['location_id'] = 'required|integer';
        } else {
            // For virtual/hybrid, location_id is optional but must be integer if provided
            $basicValidation['location_id'] = 'nullable|integer';
        }

        $validated = $request->validate($basicValidation);

        // Custom validation to ensure at least one practitioner is provided
        $practitionerIds = $validated['practitioner_ids'] ?? [];
        $practitionerId = $validated['practitioner_id'] ?? null;

        if (empty($practitionerIds) && empty($practitionerId)) {
            return response()->json([
                'message' => 'At least one practitioner must be selected.',
                'errors' => [
                    'practitioner_ids' => ['At least one practitioner must be selected.'],
                ],
            ], 422);
        }

        // Validate health number uniqueness within this tenant - encrypted field
        if (! empty($validated['health_number'])) {
            $existingPatientByHealthNumber = Patient::whereBlind('health_number', 'health_number_index', $validated['health_number'])->first();
            if ($existingPatientByHealthNumber) {
                // Patient exists in current tenant with this health number - will be used for appointment
                Log::info('Patient with matching health number found in tenant', [
                    'patient_id' => $existingPatientByHealthNumber->id,
                    'health_number' => $validated['health_number'],
                ]);
            }
        }

        $currentTenantId = tenant('id');

        Log::info('APPOINTMENT_CREATION: Starting appointment creation process', [
            'validated_data' => $validated,
            'current_tenant_id' => $currentTenantId,
        ]);

        try {
            DB::beginTransaction();

            Log::info('APPOINTMENT_CREATION: Database transaction started');

            // Check for calendar conflicts if practitioner has Google Calendar connected
            Log::info('APPOINTMENT_CREATION: Checking calendar conflicts');
            $this->checkCalendarConflicts($validated);

            $patientId = null;

            // Check if patient already exists by email within this tenant (encrypted field)
            $existingPatient = Patient::whereBlind('email', 'email_index', $validated['email_address'])->first();

            if ($existingPatient) {
                // Use existing patient
                $patientId = $existingPatient->id;
                Log::info('Using existing patient:', ['patient_id' => $patientId]);
            } else {
                // Check if patient exists by health_number as well (to avoid duplicates) - encrypted field
                $existingByHealthNumber = null;
                if (! empty($validated['health_number'])) {
                    $existingByHealthNumber = Patient::whereBlind('health_number', 'health_number_index', $validated['health_number'])->first();
                }

                if ($existingByHealthNumber) {
                    // Use existing patient found by health number within this tenant
                    $patientId = $existingByHealthNumber->id;
                    Log::info('Using existing patient found by health number:', ['patient_id' => $patientId]);
                } else {
                    // Create new patient in tenant database
                    $healthNumber = ! empty($validated['health_number'])
                        ? $validated['health_number']
                        : 'TMP-'.time().'-'.rand(1000, 9999);

                    $patientData = [
                        'health_number' => $healthNumber,
                        'first_name' => $validated['first_name'],
                        'last_name' => $validated['last_name'],
                        'preferred_name' => $validated['preferred_name'] ?? '',
                        'email' => $validated['email_address'],
                        'phone_number' => $validated['phone_number'],
                        'gender' => $validated['gender_pronouns'],
                        'gender_pronouns' => $validated['gender_pronouns'],
                        'client_type' => $validated['client_type'],
                        'date_of_birth' => $validated['date_of_birth'],
                        'emergency_contact_phone' => $validated['emergency_contact_phone'],
                        'meta_data' => ['is_onboarding' => 1],
                    ];

                    $patient = Patient::create($patientData);
                    $patientId = $patient->id;

                    // Create wallet for new patient in tenant database
                    \App\Models\Tenant\Wallet::getOrCreatePatientWallet($patientId);

                    Log::info('Created new patient:', [
                        'patient_id' => $patientId,
                        'health_number' => $healthNumber,
                        'original_health_number' => $validated['health_number'] ?? 'none provided',
                    ]);
                }
            }

            // Parse the date_time_preference and convert from location timezone to UTC
            try {
                $dateTimeString = trim($validated['date_time_preference']);
                $locationId = $validated['location_id'];

                // Get tenant timezone for conversion
                $tenantTimezone = TenantTimezoneService::getTenantTimezone();

                // Convert from tenant timezone to UTC for storage
                $utcDateTime = TenantTimezoneService::convertToUTC($dateTimeString);

                // Get the current session duration to store with this appointment
                $currentSessionDuration = (int) OrganizationSetting::getValue('appointment_session_duration', 30);

                // Calculate end time in UTC
                $utcEndTime = $utcDateTime->copy()->addMinutes($currentSessionDuration);

                Log::info('Appointment datetime processed with tenant timezone:', [
                    'input' => $dateTimeString,
                    'location_id' => $locationId,
                    'tenant_timezone' => $tenantTimezone,
                    'utc_datetime' => $utcDateTime->toISOString(),
                    'utc_end_time' => $utcEndTime->toISOString(),
                    'session_duration' => $currentSessionDuration,
                ]);

            } catch (\Exception $e) {
                Log::error('Date parsing failed:', [
                    'date_time_preference' => $validated['date_time_preference'],
                    'location_id' => $validated['location_id'] ?? 'not provided',
                    'error' => $e->getMessage(),
                ]);
                throw new \Exception('Invalid date format or location: '.$e->getMessage());
            }

            // Get practitioner IDs from the request
            $practitionerIds = $validated['practitioner_ids'] ?? [];

            if (empty($practitionerIds)) {
                throw new \Exception('At least one practitioner must be selected.');
            }

            // Check for appointment conflicts before creating
            // Handle advanced appointments with slot divisions
            $isAdvancedAppointment = $validated['advanced_appointment_settings'] ?? false;
            $slotDivisions = [];

            if ($isAdvancedAppointment && ! empty($validated['slot_divisions'])) {
                try {
                    $slotDivisions = json_decode($validated['slot_divisions'], true);
                    if (! is_array($slotDivisions)) {
                        $slotDivisions = [];
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to decode slot_divisions JSON', [
                        'slot_divisions' => $validated['slot_divisions'],
                        'error' => $e->getMessage(),
                    ]);
                    $slotDivisions = [];
                }
            }

            // Check conflicts for each practitioner
            foreach ($practitionerIds as $practitionerId) {
                // For advanced appointments, check against individual practitioner times
                if ($isAdvancedAppointment && ! empty($slotDivisions)) {
                    $practitionerDivision = collect($slotDivisions)->firstWhere('practitionerId', $practitionerId);

                    if ($practitionerDivision) {
                        // Use individual start/end times from slot divisions
                        $selectedDate = explode(' ', $validated['date_time_preference'])[0];
                        $practitionerStartTimeLocal = $selectedDate.' '.$practitionerDivision['startTime'];
                        $practitionerEndTimeLocal = $selectedDate.' '.$practitionerDivision['endTime'];

                        // Convert from tenant timezone to UTC
                        $practitionerStartTime = TenantTimezoneService::convertToUTC($practitionerStartTimeLocal);
                        $practitionerEndTime = TenantTimezoneService::convertToUTC($practitionerEndTimeLocal);

                        $this->checkPractitionerConflict($practitionerId, $practitionerStartTime, $practitionerEndTime);
                    } else {
                        // Practitioner not in slot divisions, use main appointment time
                        $this->checkPractitionerConflict($practitionerId, $utcDateTime, $utcEndTime);
                    }
                } else {
                    // Standard appointment: use main appointment time
                    $this->checkPractitionerConflict($practitionerId, $utcDateTime, $utcEndTime);
                }
            }

            Log::info('APPOINTMENT_CREATION: Creating appointment record', [
                'patient_id' => $patientId,
                'service_id' => $validated['service_id'],
                'location_id' => $validated['location_id'] ?? null,
                'mode' => $validated['mode'],
                'utc_datetime' => $utcDateTime,
                'utc_end_time' => $utcEndTime,
                'tenant_timezone' => $tenantTimezone,
            ]);

            // Check if patient has accepted all required consents
            $patient = Patient::find($patientId);
            $hasAcceptedAllRequired = \App\Models\Tenant\Consent::patientHasAcceptedAllRequired($patient);

            // Determine initial appointment status based on patient registration status
            if ($patient && $patient->registration_status === 'Requested') {
                // Patient not yet approved - set appointment to Requested
                $initialStatus = 'Requested';
            } elseif ($hasAcceptedAllRequired) {
                // Patient approved and has consents - use default status (pending)
                $initialStatus = OrganizationSetting::getValue('appointment_default_appointment_status', 'pending');
            } else {
                // Patient approved but missing consents
                $initialStatus = 'pending-consent';
            }

            Log::info('APPOINTMENT_CREATION: Determined appointment status', [
                'patient_id' => $patientId,
                'patient_registration_status' => $patient?->registration_status,
                'has_accepted_all_required' => $hasAcceptedAllRequired,
                'initial_status' => $initialStatus,
            ]);

            // Create the appointment (only with appointment-specific data, patient data is linked via patient_id)
            // Note: No practitioner_id column - practitioners are stored in pivot table with is_primary flag
            $appointment = Appointment::create([
                'patient_id' => $patientId,
                'contact_person' => $validated['contact_person'],

                // Appointment Details (only service_id, no duplicated service data)
                'service_id' => $validated['service_id'],
                'location_id' => ! empty($validated['location_id']) ? $validated['location_id'] : null, // Convert empty string to null
                'mode' => $validated['mode'],
                'appointment_datetime' => $utcDateTime,
                'start_time' => $utcDateTime, // Store the UTC start time
                'end_time' => $utcEndTime, // Store the UTC end time
                'stored_timezone' => $tenantTimezone, // Track the tenant timezone this appointment was created in
                'needs_timezone_migration' => false, // New appointment, no migration needed
                'date_time_preference' => $validated['date_time_preference'],
                'booking_source' => $validated['booking_source'],
                'admin_override' => $validated['admin_override'],
                'status' => $initialStatus,

            ]);

            // Store practitioners in the pivot table with their individual times
            $isAdvancedAppointment = $validated['advanced_appointment_settings'] ?? false;
            $slotDivisions = [];

            if ($isAdvancedAppointment && ! empty($validated['slot_divisions'])) {
                try {
                    $slotDivisions = json_decode($validated['slot_divisions'], true);
                    if (! is_array($slotDivisions)) {
                        $slotDivisions = [];
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to decode slot_divisions JSON', [
                        'slot_divisions' => $validated['slot_divisions'],
                        'error' => $e->getMessage(),
                    ]);
                    $slotDivisions = [];
                }
            }

            // Get primary practitioner ID for setting is_primary flag
            $primaryPractitionerId = $validated['primary_practitioner_id'] ?? null;

            // Note: $practitionerIds contains central_practitioner_id values from the frontend
            // These IDs are used directly in appointment_practitioner table
            foreach ($practitionerIds as $centralPractitionerId) {
                // Check if this practitioner is the primary one
                $isPrimary = $primaryPractitionerId && $centralPractitionerId == $primaryPractitionerId;

                // Find individual practitioner times from slot divisions if available
                $practitionerDivision = collect($slotDivisions)->firstWhere('practitionerId', $centralPractitionerId);

                if ($practitionerDivision && $isAdvancedAppointment) {
                    // Use individual start/end times from slot divisions, convert to UTC
                    $selectedDate = explode(' ', $validated['date_time_preference'])[0]; // Get date part
                    $practitionerStartTimeLocal = $selectedDate.' '.$practitionerDivision['startTime'];
                    $practitionerEndTimeLocal = $selectedDate.' '.$practitionerDivision['endTime'];

                    // Convert from tenant timezone to UTC
                    $practitionerStartTime = TenantTimezoneService::convertToUTC($practitionerStartTimeLocal);
                    $practitionerEndTime = TenantTimezoneService::convertToUTC($practitionerEndTimeLocal);

                    DB::table('appointment_practitioner')->insert([
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $centralPractitionerId, // This is central_practitioner_id
                        'start_time' => $practitionerStartTime->format('Y-m-d H:i:s'),
                        'end_time' => $practitionerEndTime->format('Y-m-d H:i:s'),
                        'is_primary' => $isPrimary, // Set primary practitioner flag
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    Log::info('🔹 PIVOT INSERT (Advanced): Inserted practitioner record', [
                        'appointment_id' => $appointment->id,
                        'central_practitioner_id' => $centralPractitionerId,
                        'start_time' => $practitionerStartTime->format('Y-m-d H:i:s'),
                        'end_time' => $practitionerEndTime->format('Y-m-d H:i:s'),
                        'type' => 'advanced_appointment',
                    ]);

                    Log::info('Advanced appointment: Individual practitioner time saved', [
                        'appointment_id' => $appointment->id,
                        'central_practitioner_id' => $centralPractitionerId,
                        'local_start_time' => $practitionerStartTimeLocal,
                        'local_end_time' => $practitionerEndTimeLocal,
                        'utc_start_time' => $practitionerStartTime->format('Y-m-d H:i:s'),
                        'utc_end_time' => $practitionerEndTime->format('Y-m-d H:i:s'),
                        'tenant_timezone' => $tenantTimezone,
                    ]);
                } else {
                    // Standard appointment: all practitioners use same time (UTC)
                    DB::table('appointment_practitioner')->insert([
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $centralPractitionerId, // This is central_practitioner_id
                        'start_time' => $utcDateTime->format('Y-m-d H:i:s'),
                        'end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                        'is_primary' => $isPrimary, // Set primary practitioner flag
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    Log::info('🔹 PIVOT INSERT (Standard): Inserted practitioner record', [
                        'appointment_id' => $appointment->id,
                        'central_practitioner_id' => $centralPractitionerId,
                        'start_time' => $utcDateTime->format('Y-m-d H:i:s'),
                        'end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                        'type' => 'standard_appointment',
                        'is_primary' => $isPrimary,
                    ]);
                }
            }

            Log::info('Appointment created successfully:', [
                'appointment_id' => $appointment->id,
                'practitioner_ids' => $practitionerIds,
                'appointment_datetime' => $appointment->appointment_datetime,
                'raw_appointment_datetime' => $appointment->getAttributes()['appointment_datetime'] ?? 'NULL in attributes',
                'date_time_preference' => $appointment->date_time_preference,
                'status' => $appointment->status,
                'mode' => $appointment->mode,
                'location_id' => $appointment->location_id,
            ]);

            Log::info('APPOINTMENT_CREATION: All appointment data saved successfully, committing transaction', [
                'appointment_id' => $appointment->id,
                'practitioner_count' => count($practitionerIds),
            ]);

            DB::commit();

            Log::info('APPOINTMENT_CREATION: Transaction committed successfully');

            // Generate invoice for virtual appointments (after practitioners are attached)
            if ($appointment->mode === 'virtual') {
                try {
                    $invoiceService = new \App\Services\InvoiceGenerationService;
                    $invoiceService->generateInvoiceForAppointment($appointment);

                    Log::info('Invoice auto-created for virtual appointment', [
                        'appointment_id' => $appointment->id,
                    ]);
                } catch (\Throwable $e) {
                    Log::error('INVOICE_CREATION: Failed to create invoice for virtual appointment', [
                        'appointment_id' => $appointment->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Fire AdminOverrideUsed event if admin override was used
            if (! empty($validated['admin_override']) && $validated['admin_override'] !== 'no-override') {
                event(new \App\Events\AdminOverrideUsed(
                    Auth::user(),
                    $appointment,
                    $validated['admin_override'],
                    'appointment_creation',
                    [
                        'service_id' => $appointment->service_id,
                        'mode' => $appointment->mode,
                        'datetime' => $appointment->appointment_datetime,
                        'practitioner_ids' => $practitionerIds,
                    ]
                ));
            }

            // Create Google Calendar event if practitioner has calendar connected (after transaction commit)
            Log::info('APPOINTMENT_CREATION: Creating Google Calendar event');
            $this->createCalendarEvent($appointment, $validated, $practitionerIds, $slotDivisions);

            // Clear form data from session since appointment was created successfully
            session()->forget('appointment_form_data');

            Log::info('APPOINTMENT_CREATION: Process completed successfully', [
                'appointment_id' => $appointment->id,
                'request_wants_json' => $request->wantsJson(),
            ]);

            // Handle AJAX requests differently
            if ($request->wantsJson()) {
                Log::info('APPOINTMENT_CREATION: Returning JSON response');

                return response()->json([
                    'success' => true,
                    'message' => 'Appointment created successfully!',
                    'appointment_id' => $appointment->id,
                ]);
            }

            // Trigger consents for patient on appointment creation with smart fallback
            $patient = Patient::find($patientId);
            if ($patient) {
                app(\App\Services\ConsentTriggerService::class)->triggerConsentsWithFallback('PATIENT', 'appointment_creation', $patient, 'creation');
            }

            // Redirect to appointments index with success message
            Log::info('APPOINTMENT_CREATION: Redirecting to appointments index');

            return redirect()->route('appointments.index')
                ->with('success', 'Appointment created successfully!');

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Failed to create appointment - TRANSACTION ROLLED BACK:', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'validated_data' => $validated ?? [],
                'step' => 'This is why your appointment_datetime was NULL - transaction was rolled back',
            ]);

            // Handle AJAX requests differently
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to create appointment: '.$e->getMessage(),
                ], 500);
            }

            return redirect()->back()
                ->withInput()
                ->with('error', 'Failed to create appointment: '.$e->getMessage());
        }
    }

    /**
     * Helper method to get practitioners for a service
     */
    private function getPractitionersForService($serviceId, $tenantId)
    {
        // Note: practitioner_id in practitioner_services refers to central_practitioner_id
        $centralPractitionerIds = DB::table('practitioner_services')
            ->where('service_id', $serviceId)
            ->where('is_offered', true)
            ->pluck('practitioner_id');

        // Get practitioners from tenant database using central_practitioner_id
        $practitioners = Practitioner::whereIn('central_practitioner_id', $centralPractitionerIds)
            ->where('is_active', true)
            ->get();

        return PractitionerMinimalResource::collection($practitioners)
            ->map(function ($practitioner) {
                return [
                    'id' => $practitioner['central_practitioner_id'], // Use central_practitioner_id as the ID
                    'name' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                    'value' => $practitioner['central_practitioner_id'], // Use central_practitioner_id as the value
                    'label' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                ];
            });
    }

    /**
     * Check for appointment conflicts for a specific practitioner
     * This method checks against existing appointments in the appointment_practitioner pivot table
     *
     * @param  int  $practitionerId  The practitioner ID to check conflicts for
     * @param  Carbon  $startTime  UTC start time of the new appointment
     * @param  Carbon  $endTime  UTC end time of the new appointment
     *
     * @throws \Exception If conflicts are found
     */
    private function checkPractitionerConflict(int $practitionerId, Carbon $startTime, Carbon $endTime): void
    {
        // Check for conflicts by looking at the appointment_practitioner pivot table
        // This ensures we check against the actual practitioner times (including slot divisions)
        $conflictingAppointments = DB::table('appointment_practitioner')
            ->join('appointments', 'appointment_practitioner.appointment_id', '=', 'appointments.id')
            ->where('appointment_practitioner.practitioner_id', $practitionerId)
            ->whereNotNull('appointments.appointment_datetime')
            ->where('appointments.appointment_datetime', '>=', $startTime->copy()->startOfDay())
            ->where('appointments.appointment_datetime', '<', $startTime->copy()->addDay()->startOfDay())
            ->whereNotIn('appointments.status', ['cancelled', 'no-show'])
            ->where(function ($query) use ($startTime, $endTime) {
                $query->where(function ($q) use ($startTime) {
                    // New appointment starts during existing appointment
                    // Check if new start time is between existing start and end
                    $q->where('appointment_practitioner.start_time', '<=', $startTime)
                        ->where('appointment_practitioner.end_time', '>', $startTime);
                })->orWhere(function ($q) use ($endTime) {
                    // New appointment ends during existing appointment
                    // Check if new end time is between existing start and end
                    $q->where('appointment_practitioner.start_time', '<', $endTime)
                        ->where('appointment_practitioner.end_time', '>=', $endTime);
                })->orWhere(function ($q) use ($startTime, $endTime) {
                    // New appointment completely contains existing appointment
                    // Check if existing appointment is fully within new appointment time range
                    $q->where('appointment_practitioner.start_time', '>=', $startTime)
                        ->where('appointment_practitioner.end_time', '<=', $endTime);
                })->orWhere(function ($q) use ($startTime, $endTime) {
                    // Existing appointment completely contains new appointment
                    // Check if new appointment is fully within existing appointment time range
                    $q->where('appointment_practitioner.start_time', '<=', $startTime)
                        ->where('appointment_practitioner.end_time', '>=', $endTime);
                });
            })
            ->select('appointments.id', 'appointments.status', 'appointments.appointment_datetime',
                'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
            ->get();

        if ($conflictingAppointments->count() > 0) {
            Log::warning('🚫 APPOINTMENT CONFLICT DETECTED', [
                'practitioner_id' => $practitionerId,
                'requested_start_time' => $startTime->format('Y-m-d H:i:s'),
                'requested_end_time' => $endTime->format('Y-m-d H:i:s'),
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

    /**
     * Check for calendar conflicts before creating appointment
     */
    private function checkCalendarConflicts(array $appointmentData)
    {
        try {
            $practitionerIds = $appointmentData['practitioner_ids'];
            if (empty($practitionerIds)) {
                return;
            }

            // Check conflicts for the first practitioner (you may want to check all)
            $practitionerId = $practitionerIds[0];

            // Find the practitioner's Google Calendar integration
            $userIntegration = UserIntegration::where('user_id', $practitionerId)
                ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                ->where('type', UserIntegration::TYPE_CALENDAR)
                ->where('is_active', true)
                ->first();

            if (! $userIntegration) {
                // No calendar integration, skip conflict checking
                return;
            }

            // Parse the appointment time
            $appointmentTime = Carbon::parse($appointmentData['date_time_preference']);

            // Get service to determine duration (assuming 60 minutes if not specified)
            $service = Service::find($appointmentData['service_id']);
            $durationMinutes = $service->duration ?? 60;

            $startTime = $appointmentTime;
            $endTime = $appointmentTime->copy()->addMinutes($durationMinutes);

            $calendarService = new GoogleCalendarService($userIntegration);
            $conflicts = $calendarService->checkConflicts($startTime, $endTime);

            // If conflicts found, log warning but allow creation
            if (count($conflicts) > 0) {
                Log::warning('Calendar conflicts detected during appointment creation', [
                    'practitioner_id' => $practitionerId,
                    'appointment_time' => $appointmentTime->toISOString(),
                    'conflicts_count' => count($conflicts),
                    'conflicts' => $conflicts,
                ]);

                // You could throw an exception here to prevent creation
                // For now, we're just logging the warning
            }

        } catch (\Exception $e) {
            // Log error but don't fail appointment creation
            Log::error('Failed to check calendar conflicts', [
                'practitioner_id' => $appointmentData['practitioner_id'] ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Create Google Calendar event for the appointment
     */
    private function createCalendarEvent($appointment, array $appointmentData, array $practitionerIds, array $slotDivisions = [])
    {
        try {
            if (empty($practitionerIds)) {
                Log::info('No practitioners found for appointment', [
                    'appointment_id' => $appointment->id,
                ]);

                return;
            }

            // Create calendar event for each practitioner with their individual times
            foreach ($practitionerIds as $practitionerId) {

                // Convert practitioner_id to user_id (same as conflict check logic)
                $userId = tenancy()->central(function () use ($practitionerId) {
                    $practitioner = \App\Models\Practitioner::find($practitionerId);

                    return $practitioner ? $practitioner->user_id : null;
                });

                if (! $userId) {
                    Log::info('❌ Practitioner not found for appointment', [
                        'practitioner_id' => $practitionerId,
                        'appointment_id' => $appointment->id,
                    ]);

                    continue; // Skip this practitioner if not found
                }

                // Find the practitioner's Google Calendar integration using user_id
                $userIntegration = tenancy()->central(function () use ($userId) {
                    return UserIntegration::where('user_id', $userId)
                        ->where('provider', UserIntegration::PROVIDER_GOOGLE)
                        ->where('type', UserIntegration::TYPE_CALENDAR)
                        ->where('is_active', true)
                        ->first();
                });

                if (! $userIntegration) {
                    // No calendar integration, skip event creation
                    Log::info('ℹ️ Google Calendar Integration Not Found', [
                        'message' => 'Practitioner has not connected Google Calendar - skipping event creation',
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $practitionerId,
                        'user_id' => $userId,
                        'impact' => 'Appointment saved successfully but not added to practitioner calendar',
                        'recommendation' => 'Practitioner should connect Google Calendar via Integrations page',
                    ]);

                    continue; // Skip this practitioner if not found
                }

                // Check if saving appointments to calendar is enabled
                if (! $userIntegration->save_appointments_to_calendar) {
                    Log::info('ℹ️ Save appointments to calendar disabled', [
                        'message' => 'Practitioner has disabled saving appointments to Google Calendar - skipping event creation',
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $practitionerId,
                        'user_id' => $userId,
                        'setting' => 'save_appointments_to_calendar = false',
                    ]);

                    continue; // Skip this practitioner if save to calendar is disabled
                }

                Log::info('🔄 Creating Google Calendar Event for Appointment', [
                    'appointment_id' => $appointment->id,
                    'practitioner_id' => $practitionerId,
                    'user_id' => $userId,
                    'integration_found' => true,
                    'calendar_id' => $userIntegration->credentials['calendar_id'] ?? 'primary',
                ]);

                // Get related data (patient from central, others from tenant)
                $patient = tenancy()->central(function () use ($appointment) {
                    return Patient::find($appointment->patient_id);
                });
                $service = Service::find($appointment->service_id);
                $location = Location::find($appointment->location_id);

                // Check if this practitioner has individual time from slot divisions
                $practitionerDivision = collect($slotDivisions)->firstWhere('practitionerId', $practitionerId);

                if ($practitionerDivision && ! empty($slotDivisions)) {
                    // Use individual practitioner times from slot divisions
                    $selectedDate = explode(' ', $appointment->date_time_preference)[0]; // Get date part
                    $appointmentTime = Carbon::createFromFormat('Y-m-d H:i', $selectedDate.' '.$practitionerDivision['startTime'])->utc();
                    $endTime = Carbon::createFromFormat('Y-m-d H:i', $selectedDate.' '.$practitionerDivision['endTime'])->utc();
                    $durationMinutes = $practitionerDivision['durationMinutes'];
                } else {
                    // Use standard appointment datetime (already stored as UTC)
                    $appointmentTime = $appointment->appointment_datetime->utc();
                    $durationMinutes = $service->duration ?? 60;
                    $endTime = $appointmentTime->copy()->addMinutes($durationMinutes);
                }

                Log::info('📅 Appointment time conversion for Google Calendar', [
                    'original_date_time_preference' => $appointment->date_time_preference,
                    'converted_to_utc' => $appointmentTime->toISOString(),
                    'end_time_utc' => $endTime->toISOString(),
                    'appointment_id' => $appointment->id,
                ]);

                // Prepare event data
                $eventData = [
                    'title' => $service->name.' - '.$patient->first_name.' '.$patient->last_name,
                    'description' => "Appointment with {$patient->first_name} {$patient->last_name}\n".
                                  "Service: {$service->name}\n".
                                  "Mode: {$appointment->mode}\n".
                                  "Appointment ID: {$appointment->id}",
                    'start_time' => $appointmentTime->toISOString(),
                    'end_time' => $endTime->toISOString(),
                    'patient_email' => $patient->email,
                    'patient_name' => $patient->first_name.' '.$patient->last_name,
                    'location' => $location ? $location->name.', '.$location->address : null,
                    'source_url' => url("/appointments/{$appointment->id}"), // Link back to appointment
                ];

                $calendarService = new GoogleCalendarService($userIntegration);
                $eventId = $calendarService->createAppointmentEvent($eventData);

                if ($eventId) {
                    // Store the calendar event ID in the appointment for future updates/deletions
                    $appointment->update([
                        'google_calendar_event_id' => $eventId,
                    ]);

                    Log::info('🎉 SUCCESS: Google Calendar Event Created & Stored!', [
                        'message' => 'Appointment successfully added to practitioner\'s Google Calendar',
                        'appointment_id' => $appointment->id,
                        'calendar_event_id' => $eventId,
                        'practitioner_id' => $practitionerId,
                        'event_title' => $eventData['title'],
                        'event_start_time' => $eventData['start_time'],
                        'event_end_time' => $eventData['end_time'],
                        'patient_email_invited' => $eventData['patient_email'],
                        'storage_details' => [
                            'stored_in' => 'appointments.google_calendar_event_id',
                            'can_be_updated' => true,
                            'can_be_deleted' => true,
                            'bidirectional_sync' => true,
                        ],
                        'google_calendar_features' => [
                            'patient_invited_via_email' => ! empty($eventData['patient_email']),
                            'location_added' => ! empty($eventData['location']),
                            'appointment_link_included' => ! empty($eventData['source_url']),
                            'color_coded' => 'Blue (ID: 9) for appointments',
                        ],
                    ]);

                    Log::info('📊 Calendar Integration Summary', [
                        'practitioner_calendar' => 'Updated with new appointment',
                        'patient_notification' => 'Calendar invite sent to patient email',
                        'conflict_prevention' => 'Future conflict checks will detect this event',
                        'event_management' => 'Can update/delete event when appointment changes',
                        'emr_integration' => 'Event ID stored for full bidirectional sync',
                    ]);
                } else {
                    Log::warning('⚠️ Google Calendar event creation returned no event ID', [
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $practitionerId,
                        'possible_reasons' => [
                            'API quota exceeded',
                            'Calendar permission issues',
                            'Network connectivity problems',
                        ],
                    ]);
                }
            } // End foreach practitioner loop

        } catch (\Exception $e) {
            // Log error but don't fail appointment creation
            Log::error('Failed to create Google Calendar event', [
                'appointment_id' => $appointment->id ?? null,
                'practitioner_id' => $appointment->practitioner_id ?? null,
                'error' => $e->getMessage(),
            ]);

            // Optionally update the practitioner's integration status
            if (isset($userIntegration)) {
                $userIntegration->update([
                    'last_error' => 'Failed to create calendar event: '.$e->getMessage(),
                    'status' => UserIntegration::STATUS_ERROR,
                ]);
            }
        }
    }

    /**
     * Show appointment details page
     */
    public function show(Appointment $appointment)
    {
        // Check if user has permission to view this appointment
        $this->authorize('view', $appointment);

        // Load appointment with relationships
        $appointment = $appointment->load(['service', 'location']);

        // Load patient data from central database
        $patient = tenancy()->central(function () use ($appointment) {
            return Patient::find($appointment->patient_id);
        });

        // Assign patient to appointment
        $appointment->patient = $patient ? (new PatientMinimalResource($patient))->resolve() : null;

        // Load encounter/session data if exists
        $encounter = \App\Models\Tenant\Encounter::with(['documents', 'documentRequests', 'prescriptions'])
            ->where('appointment_id', $appointment->id)
            ->first();

        $appointment->encounter = $encounter ? [
            'id' => $encounter->id,
            'status' => $encounter->status,
            'session_started_at' => $encounter->session_started_at,
            'session_completed_at' => $encounter->session_completed_at,
            'session_duration_seconds' => $encounter->session_duration_seconds,
            'session_type' => $encounter->session_type,
            'note_type' => $encounter->note_type,
            'has_data' => $encounter->chief_complaint || $encounter->examination_notes ||
                          $encounter->clinical_assessment || $encounter->treatment_plan,
            // Clinical notes
            'chief_complaint' => $encounter->chief_complaint,
            'history_of_present_illness' => $encounter->history_of_present_illness,
            'examination_notes' => $encounter->examination_notes,
            'clinical_assessment' => $encounter->clinical_assessment,
            'treatment_plan' => $encounter->treatment_plan,
            'additional_notes' => $encounter->additional_notes,
            // AI fields
            'ai_note' => $encounter->ai_note,
            'ai_note_status' => $encounter->ai_note_status,
            'ai_summary' => $encounter->ai_summary,
            'report_sent_to_patient' => $encounter->report_sent_to_patient,
            // Vital signs
            'blood_pressure_systolic' => $encounter->blood_pressure_systolic,
            'blood_pressure_diastolic' => $encounter->blood_pressure_diastolic,
            'heart_rate' => $encounter->heart_rate,
            'temperature' => $encounter->temperature,
            'respiratory_rate' => $encounter->respiratory_rate,
            'oxygen_saturation' => $encounter->oxygen_saturation,
            'weight' => $encounter->weight,
            'height' => $encounter->height,
            'bmi' => $encounter->bmi,
            // Mental health fields
            'mental_state_exam' => $encounter->mental_state_exam,
            'mood_affect' => $encounter->mood_affect,
            'thought_process' => $encounter->thought_process,
            'cognitive_assessment' => $encounter->cognitive_assessment,
            'risk_assessment' => $encounter->risk_assessment,
            'therapeutic_interventions' => $encounter->therapeutic_interventions,
            'session_goals' => $encounter->session_goals,
            'homework_assignments' => $encounter->homework_assignments,
            // Relations
            'documents' => $encounter->documents,
            'document_requests' => $encounter->documentRequests,
            'prescriptions' => $encounter->prescriptions,
        ] : null;

        // Get AI summary status
        $appointment->ai_summary_status = $this->getAISummaryStatus($appointment->id);

        // Load practitioners from pivot table (these are now tenant practitioner IDs after migration)
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');

        // Get practitioners from tenant database (not central)
        $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

        // Get pivot data (is_primary, start_time, end_time)
        $pivotData = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->get()
            ->keyBy('practitioner_id');

        // Build practitioners_list and practitioners_detail using tenant practitioner IDs
        $appointment->practitioners_list = $practitioners->map(function ($practitioner) use ($pivotData) {
            $pivot = $pivotData->get($practitioner->id);

            return [
                'id' => $practitioner->id, // Tenant practitioner ID
                'name' => "{$practitioner->first_name} {$practitioner->last_name}",
                'is_primary' => $pivot ? (bool) $pivot->is_primary : false,
            ];
        })->values();

        $appointment->practitioners_detail = $practitioners->map(function ($practitioner) use ($pivotData) {
            $pivot = $pivotData->get($practitioner->id);

            return [
                'id' => $practitioner->id, // Tenant practitioner ID
                'name' => "{$practitioner->first_name} {$practitioner->last_name}",
                'start_time' => $pivot ? $pivot->start_time : null,
                'end_time' => $pivot ? $pivot->end_time : null,
                'is_primary' => $pivot ? (bool) $pivot->is_primary : false,
            ];
        })->values();

        // Get primary practitioner ID
        $primaryPractitioner = $pivotData->first(function ($pivot) {
            return $pivot->is_primary;
        });
        $appointment->primary_practitioner_id = $primaryPractitioner ? $primaryPractitioner->practitioner_id : null;

        // Apply timezone conversion
        $appointment->appointment_datetime_local = TenantTimezoneService::formatForTenant(
            Carbon::parse($appointment->appointment_datetime),
            'Y-m-d H:i:s'
        );
        $appointment->tenant_timezone = TenantTimezoneService::getTenantTimezone();

        // Determine user role
        $userRole = 'admin'; // Default
        if (Auth::user()->roles->contains('name', 'Patient')) {
            $userRole = 'patient';
        } elseif (Auth::user()->roles->contains('name', 'Practitioner')) {
            $userRole = 'practitioner';
        }

        return Inertia::render('Appointments/Show', [
            'appointment' => $appointment,
            'user_role' => $userRole,
        ]);
    }

    /**
     * Show manage appointment page (separate page instead of modal)
     */
    public function showManageAppointment(Appointment $appointment)
    {
        // Load appointment with relationships
        $appointment = $appointment->load(['service', 'location']);

        // Load practitioners from pivot table (these are now tenant practitioner IDs after migration)
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');

        // Get practitioners from tenant database (not central)
        $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

        // Get pivot data (is_primary)
        $pivotData = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->get()
            ->keyBy('practitioner_id');

        // Build practitioners_list and practitioners_detail using tenant practitioner IDs
        $appointment->practitioners_list = $practitioners->map(function ($practitioner) use ($pivotData) {
            $pivot = $pivotData->get($practitioner->id);

            return [
                'id' => $practitioner->id, // Tenant practitioner ID
                'name' => "{$practitioner->first_name} {$practitioner->last_name}",
                'is_primary' => $pivot ? (bool) $pivot->is_primary : false,
            ];
        })->values();

        $appointment->practitioners_detail = $practitioners->map(function ($practitioner) use ($pivotData) {
            $pivot = $pivotData->get($practitioner->id);

            return [
                'id' => $practitioner->id, // Tenant practitioner ID
                'name' => "{$practitioner->first_name} {$practitioner->last_name}",
                'is_primary' => $pivot ? (bool) $pivot->is_primary : false,
            ];
        })->values();

        // Get primary practitioner ID (tenant ID)
        $primaryPractitioner = $pivotData->first(function ($pivot) {
            return $pivot->is_primary;
        });
        $appointment->primary_practitioner_id = $primaryPractitioner ? $primaryPractitioner->practitioner_id : null;

        // Apply timezone conversion
        $appointment->appointment_datetime_local = TenantTimezoneService::formatForTenant(
            Carbon::parse($appointment->appointment_datetime),
            'Y-m-d H:i:s'
        );
        $appointment->tenant_timezone = TenantTimezoneService::getTenantTimezone();

        // Get all practitioners for filter dropdown - from tenant database
        $allPractitioners = Practitioner::where('is_active', true)->get();

        $allPractitioners = $allPractitioners->map(function ($practitioner) {
            return [
                'id' => $practitioner->id, // Tenant practitioner ID
                'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
            ];
        });

        return Inertia::render('Appointments/Manage', [
            'appointment' => $appointment,
            'practitioners' => $allPractitioners,
        ]);
    }

    /**
     * Show session details for an appointment
     * Allows starting a new session if no encounter exists yet
     */
    public function showSession(Appointment $appointment)
    {
        // Check if user has permission to view this appointment
        $this->authorize('view', $appointment);

        // Load encounter/session data (or null if not started yet)
        $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();

        // Allow null encounter - practitioners can start a new session
        // The EncounterController::save() will create it on first interaction

        // Load appointment with relationships
        $appointment = $appointment->load(['service', 'location']);

        // Load patient data from central database
        $patient = tenancy()->central(function () use ($appointment) {
            return Patient::find($appointment->patient_id);
        });

        // Load practitioners from tenant database (practitioner_ids in pivot table are tenant IDs after migration)
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');

        $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

        return Inertia::render('Appointments/SessionDetails', [
            'appointment' => $appointment,
            'encounter' => $encounter, // Can be null for new sessions
            'patient' => $patient,
            'practitioners' => $practitioners,
        ]);
    }

    /**
     * Show AI summary for an appointment with deferred loading support
     */
    public function showAISummary(Appointment $appointment, Request $request)
    {
        // Check if user has permission to view this appointment
        $this->authorize('view', $appointment);

        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('AISummary', [
                'appointment' => [
                    'id' => $appointment->id,
                ],
                'patient' => null,
                'aiSummary' => null,
                'encounter' => null,
                'practitioners' => null,
                'hasAIConsent' => null,
                'user_role' => null,
                'recordingAISummary' => null,
                'loadedData' => null,
            ]);
        }

        // Return full data for partial reload (heavy AI generation)

        // Determine user role
        $userRole = 'admin'; // Default
        if (Auth::user()->roles->contains('name', 'Patient')) {
            $userRole = 'patient';
        } elseif (Auth::user()->roles->contains('name', 'Practitioner')) {
            $userRole = 'practitioner';
        }

        // Load appointment with relationships
        $appointment = $appointment->load(['service', 'location']);

        // Load patient from tenant database
        $patient = null;
        if ($appointment->patient_id) {
            $patient = \App\Models\Tenant\Patient::find($appointment->patient_id);
        }

        // Return early with error if no patient
        if (! $patient) {
            Log::warning('AI Summary accessed for appointment with no patient', [
                'appointment_id' => $appointment->id,
                'patient_id' => $appointment->patient_id,
            ]);

            return redirect()->route('appointments.show', $appointment->id)
                ->with('error', 'Unable to load AI Summary: Patient data not found.');
        }

        // Load patient medical data
        $medicalHistoryService = app(\App\Services\PatientMedicalHistory::class);
        $medicalData = $medicalHistoryService->getPatientMedicalData($patient->id);

        $lastAppointment = \App\Models\Tenant\Appointment::where('patient_id', $patient->id)
            ->where('id', '!=', $appointment->id)
            ->where('status', 'completed')
            ->orderBy('appointment_datetime', 'desc')
            ->first();

        $patient->last_visit = $lastAppointment ? $lastAppointment->appointment_datetime->format('Y-m-d') : null;
        $patient->allergies = $medicalData['known_allergies']->pluck('allergens')->toArray();
        $patient->conditions = $medicalData['patient_medical_histories']->pluck('disease')->toArray();

        // Load encounter and practitioners
        $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();

        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');
        $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

        // Recording AI summary
        $recordingAISummary = null;
        if ($encounter) {
            $recordingAISummary = [
                'summary_text' => $encounter->recording_ai_summary,
                'summary_type' => $encounter->recording_ai_summary_type,
                'status' => $encounter->recording_ai_summary_status ?? 'pending',
            ];
        }

        // Check AI consent
        $hasAIConsent = $this->hasPatientAIConsent($patient->id);

        if (! $hasAIConsent) {
            $aiSummary = [
                'id' => $appointment->id,
                'summary_text' => '',
                'generated_at' => null,
                'status' => 'no_consent',
                'message' => 'This patient has not provided consent to use their information for AI summary generation.',
            ];
        } else {
            try {
                // HEAVY AI GENERATION HERE
                $bedrockService = new BedrockAIService;
                $customPrompt = $this->buildSessionSummaryPrompt($patient, $appointment);
                $summaryBulletPoints = $bedrockService->generateSummary(null, $customPrompt);

                $summaryText = implode("\n• ", $summaryBulletPoints);
                if (! empty($summaryText)) {
                    $summaryText = '• '.$summaryText;
                }

                $aiSummary = [
                    'id' => $appointment->id,
                    'summary_text' => $summaryText ?: 'No summary could be generated from the available data.',
                    'generated_at' => now()->toISOString(),
                    'status' => 'generated',
                    'bullet_points' => $summaryBulletPoints,
                ];

            } catch (\Exception $e) {
                Log::error('Failed to generate AI summary for appointment', [
                    'appointment_id' => $appointment->id,
                    'error' => $e->getMessage(),
                ]);

                $aiSummary = [
                    'id' => $appointment->id,
                    'summary_text' => 'Unable to generate AI summary at this time. Please try again later.',
                    'generated_at' => now()->toISOString(),
                    'status' => 'error',
                    'error_message' => $e->getMessage(),
                ];
            }
        }

        return Inertia::render('AISummary', [
            'appointment' => $appointment,
            'patient' => (new PatientMinimalResource($patient))->resolve(),
            'aiSummary' => $aiSummary,
            'encounter' => $encounter,
            'practitioners' => $practitioners,
            'hasAIConsent' => $hasAIConsent,
            'user_role' => $userRole,
            'recordingAISummary' => $recordingAISummary,
            'loadedData' => true,
        ]);
    }

    /**
     * Show recordings for an appointment
     */
    /**
     * Show recordings for an appointment with deferred loading support
     */
    public function showRecordings(Appointment $appointment, Request $request)
    {
        // Check if user has permission to view this appointment
        $this->authorize('view', $appointment);

        // Determine user role
        $userRole = 'admin'; // Default
        if (Auth::user()->roles->contains('name', 'Patient')) {
            $userRole = 'patient';
        } elseif (Auth::user()->roles->contains('name', 'Practitioner')) {
            $userRole = 'practitioner';
        }

        // Load appointment with relationships
        $appointment = $appointment->load(['service', 'location']);

        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('Appointments/Recordings', [
                'appointment' => $appointment,
                'user_role' => $userRole,
                'patient' => null,
                'encounter' => null,
                'recordings' => null,
                'practitioners' => null,
            ]);
        }

        // Return full data for partial reload (heavy data loading)

        // Load patient from tenant database
        $patient = null;
        if ($appointment->patient_id) {
            $patient = \App\Models\Tenant\Patient::find($appointment->patient_id);
        }

        // Load patient medical data
        if ($patient) {
            $medicalHistoryService = app(\App\Services\PatientMedicalHistory::class);
            $medicalData = $medicalHistoryService->getPatientMedicalData($patient->id);

            // Calculate last visit date
            $lastAppointment = \App\Models\Tenant\Appointment::where('patient_id', $patient->id)
                ->where('id', '!=', $appointment->id)
                ->where('status', 'completed')
                ->orderBy('appointment_datetime', 'desc')
                ->first();

            $patient->last_visit = $lastAppointment ? $lastAppointment->appointment_datetime->format('Y-m-d') : null;
            $patient->allergies = $medicalData['known_allergies']->pluck('allergens')->toArray();
            $patient->conditions = $medicalData['patient_medical_histories']->pluck('disease')->toArray();
        }

        // Load encounter with recordings
        $encounter = \App\Models\Tenant\Encounter::with('recordings')
            ->where('appointment_id', $appointment->id)
            ->first();

        // Load practitioners for this appointment
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');

        $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

        // Prepare recordings with playback URLs
        $recordings = [];
        if ($encounter && $encounter->recordings) {
            $recordings = $encounter->recordings->map(function ($recording) use ($encounter) {
                $playbackUrl = null;
                if ($recording->s3_key) {
                    try {
                        $playbackUrl = route('encounters.recordings.play', [
                            'encounter' => $encounter->id,
                            'recording' => $recording->id,
                        ]);
                        Log::info('Generated playback URL for recording', [
                            'recording_id' => $recording->id,
                            'playback_url' => $playbackUrl,
                        ]);
                    } catch (\Exception $e) {
                        Log::error('Exception generating playback URL for recording', [
                            'recording_id' => $recording->id,
                            's3_key' => $recording->s3_key,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                return [
                    'id' => $recording->id,
                    'file_name' => $recording->file_name,
                    'mime_type' => $recording->mime_type,
                    'file_size' => $recording->file_size,
                    'duration_seconds' => $recording->duration_seconds,
                    'signed_url' => $playbackUrl,
                    'created_at' => $recording->created_at,
                    'transcription_status' => $recording->transcription_status,
                    'transcription' => $recording->transcription,
                    'transcription_timestamps' => $recording->transcription_timestamps,
                    'transcription_speaker_segments' => $recording->transcription_speaker_segments,
                    'speaker_names' => $recording->metadata['speaker_names'] ?? null,
                ];
            })->toArray();
        }

        return Inertia::render('Appointments/Recordings', [
            'appointment' => $appointment,
            'patient' => $patient ? (new PatientMinimalResource($patient))->resolve() : null,
            'encounter' => $encounter,
            'recordings' => $recordings,
            'practitioners' => $practitioners,
            'user_role' => $userRole,
        ]);
    }

    /**
     * Build custom prompt for current session AI summary
     */
    private function buildSessionSummaryPrompt($patient, Appointment $appointment): string
    {
        // Load current session/encounter data
        $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();

        // Load practitioners for this appointment (tenant IDs after migration)
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');

        $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

        $prompt = "Generate a comprehensive medical summary for this appointment session:\n\n";

        // Patient Basic Information
        $prompt .= "PATIENT INFORMATION:\n";
        $prompt .= 'Name: '.($patient ? trim($patient->first_name.' '.$patient->last_name) : 'Unknown')."\n";

        if ($patient && $patient->date_of_birth) {
            $prompt .= 'Age: '.Carbon::parse($patient->date_of_birth)->age."\n";
        }

        $prompt .= 'Gender: '.($patient ? ($patient->gender_pronouns ?: $patient->gender ?: 'Unknown') : 'Unknown')."\n";
        $prompt .= 'Client Type: '.($patient ? ($patient->client_type ?: 'Unknown') : 'Unknown')."\n\n";

        // Current Appointment/Session Details
        $prompt .= "CURRENT SESSION:\n";
        $prompt .= 'Date: '.($appointment->appointment_datetime ? $appointment->appointment_datetime->format('Y-m-d H:i') : 'Unknown')."\n";
        $prompt .= 'Service: '.($appointment->service ? $appointment->service->name : 'Unknown')."\n";
        $prompt .= 'Mode: '.($appointment->mode ?: 'Unknown')."\n";
        $prompt .= 'Status: '.($appointment->status ?: 'Unknown')."\n";

        if ($practitioners->isNotEmpty()) {
            $practitionerNames = $practitioners->map(function ($practitioner) {
                return trim($practitioner->first_name.' '.$practitioner->last_name);
            })->join(', ');
            $prompt .= 'Practitioners: '.$practitionerNames."\n";
        }

        // Session/Encounter Details
        if ($encounter) {
            $prompt .= "\nSESSION DETAILS:\n";

            if ($encounter->chief_complaint) {
                $prompt .= 'Chief Complaint: '.$encounter->chief_complaint."\n";
            }

            if ($encounter->examination_notes) {
                $prompt .= 'Examination Notes: '.$encounter->examination_notes."\n";
            }

            if ($encounter->clinical_assessment) {
                $prompt .= 'Clinical Assessment: '.$encounter->clinical_assessment."\n";
            }

            if ($encounter->treatment_plan) {
                $prompt .= 'Treatment Plan: '.$encounter->treatment_plan."\n";
            }

            // Vital Signs
            $vitalSigns = [];
            if ($encounter->blood_pressure) {
                $vitalSigns[] = 'BP: '.$encounter->blood_pressure;
            }
            if ($encounter->heart_rate) {
                $vitalSigns[] = 'HR: '.$encounter->heart_rate;
            }
            if ($encounter->temperature) {
                $vitalSigns[] = 'Temp: '.$encounter->temperature;
            }
            if ($encounter->weight) {
                $vitalSigns[] = 'Weight: '.$encounter->weight;
            }
            if ($encounter->height) {
                $vitalSigns[] = 'Height: '.$encounter->height;
            }

            if (! empty($vitalSigns)) {
                $prompt .= 'Vital Signs: '.implode(', ', $vitalSigns)."\n";
            }

            // Session timing
            if ($encounter->session_started_at && $encounter->session_completed_at) {
                $prompt .= 'Session Duration: '.$encounter->session_started_at->format('H:i').' - '.$encounter->session_completed_at->format('H:i')."\n";
            }

            if ($encounter->session_duration_seconds) {
                $minutes = round($encounter->session_duration_seconds / 60);
                $prompt .= 'Total Duration: '.$minutes." minutes\n";
            }
        } else {
            $prompt .= "\nSESSION DETAILS:\n";
            $prompt .= "No encounter data recorded for this session.\n";
        }

        $prompt .= "\nPlease provide a comprehensive summary of this appointment session in bullet points covering:\n";
        $prompt .= "• Key findings and observations from this session\n";
        $prompt .= "• Primary concerns or complaints addressed\n";
        $prompt .= "• Clinical assessment and diagnosis (if applicable)\n";
        $prompt .= "• Treatment plans or interventions discussed\n";
        $prompt .= "• Follow-up recommendations or next steps\n";
        $prompt .= "• Any significant vital signs or measurements\n";
        $prompt .= "• Overall session outcomes and patient status\n\n";
        $prompt .= 'Focus on actionable insights specific to this session that would help healthcare providers understand what occurred during this appointment.';

        return $prompt;
    }

    /**
     * Check if patient has given consent for AI summary generation
     */
    private function hasPatientAIConsent(int $patientId): bool
    {
        $consent = \App\Models\Tenant\Consent::where('key', 'patient_consent_third_party_sharing')
            ->where('entity_type', 'PATIENT')
            ->first();

        if (! $consent) {
            return false;
        }

        $activeVersion = $consent->activeVersion;
        if (! $activeVersion) {
            return false;
        }

        $entityConsent = \App\Models\Tenant\EntityConsent::where('consentable_type', Patient::class)
            ->where('consentable_id', $patientId)
            ->where('consent_version_id', $activeVersion->id)
            ->first();

        return $entityConsent !== null;
    }

    /**
     * Get AI summary status for an appointment
     */
    private function getAISummaryStatus(int $appointmentId): string
    {
        // For now, return a simple status based on whether the appointment has an encounter
        // In the future, this could check a dedicated AI summary table
        $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointmentId)->first();

        if (! $encounter) {
            return 'no_session';
        }

        // Check if encounter has sufficient data for AI summary
        $hasData = $encounter->chief_complaint ||
                   $encounter->examination_notes ||
                   $encounter->clinical_assessment ||
                   $encounter->treatment_plan;

        if (! $hasData) {
            return 'insufficient_data';
        }

        // For now, assume AI summary can be generated
        // In the future, this could check if AI summary was actually generated
        return 'can_generate';
    }

    /**
     * Send AI summary to patient via email
     */
    public function sendAISummaryToPatient(Appointment $appointment)
    {
        try {
            // Check if user has permission to view this appointment
            $this->authorize('view', $appointment);

            // Load patient data from central database
            $patient = Patient::find($appointment->patient_id);

            if (! $patient || ! $patient->email) {
                return response()->json([
                    'success' => false,
                    'message' => 'Patient email not found.',
                ], 400);
            }

            // Generate AI summary if not already generated
            $bedrockService = new BedrockAIService;
            $customPrompt = $this->buildSessionSummaryPrompt($patient, $appointment);
            $summaryBulletPoints = $bedrockService->generateSummary(null, $customPrompt);

            // Convert bullet points to formatted summary text
            $summaryText = implode("\n• ", $summaryBulletPoints);
            if (! empty($summaryText)) {
                $summaryText = '• '.$summaryText;
            }

            // Load appointment relationships for email
            $appointment->load(['service', 'location']);

            // Get practitioner names (tenant IDs after migration)
            $practitionerIds = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->pluck('practitioner_id');

            $practitioners = Practitioner::whereIn('id', $practitionerIds)->get();

            $practitionerNames = $practitioners->map(function ($practitioner) {
                return trim($practitioner->first_name.' '.$practitioner->last_name);
            })->join(', ');

            // Prepare email data
            $emailData = [
                'patient_name' => trim($patient->first_name.' '.$patient->last_name),
                'appointment_date' => $appointment->appointment_datetime ? $appointment->appointment_datetime->format('F j, Y \a\t g:i A') : 'Date not available',
                'service_name' => $appointment->service ? $appointment->service->name : 'Service not available',
                'practitioner_names' => $practitionerNames ?: 'Practitioner not available',
                'ai_summary' => $summaryText ?: 'No summary could be generated from the available data.',
                'organization_name' => config('app.name'),
            ];

            // Send email using Laravel's Mail facade
            Mail::send('emails.ai-summary', $emailData, function ($message) use ($patient) {
                $message->to($patient->email, trim($patient->first_name.' '.$patient->last_name))
                    ->subject('Your Appointment Summary');
            });

            // Mark report as sent in the encounter
            $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();
            if ($encounter) {
                $encounter->update(['report_sent_to_patient' => true]);
            }

            Log::info('AI summary sent to patient', [
                'appointment_id' => $appointment->id,
                'patient_email' => $patient->email,
                'patient_name' => trim($patient->first_name.' '.$patient->last_name),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'AI summary sent to patient successfully!',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send AI summary to patient', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send AI summary. Please try again later.',
            ], 500);
        }
    }

    /**
     * Update AI summary for an appointment
     */
    public function updateAISummary(Request $request, Appointment $appointment)
    {
        try {
            $validated = $request->validate([
                'summary_text' => 'required|string',
            ]);

            // Find the encounter for this appointment
            $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();

            if (! $encounter) {
                return response()->json([
                    'success' => false,
                    'message' => 'No encounter found for this appointment.',
                ], 404);
            }

            // Update the AI summary
            $encounter->update([
                'ai_summary' => $validated['summary_text'],
            ]);

            Log::info('AI summary updated', [
                'appointment_id' => $appointment->id,
                'encounter_id' => $encounter->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'AI summary updated successfully!',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update AI summary', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update AI summary. Please try again later.',
            ], 500);
        }
    }

    /**
     * Regenerate AI summary for an appointment
     */
    public function regenerateAISummary(Appointment $appointment)
    {
        try {
            // Load patient data from central database
            $patient = Patient::find($appointment->patient_id);

            if (! $patient) {
                return response()->json([
                    'success' => false,
                    'message' => 'Patient not found.',
                ], 404);
            }

            // Check AI consent
            if (! $this->hasPatientAIConsent($patient->id)) {
                return response()->json([
                    'success' => false,
                    'message' => "{$patient->first_name} {$patient->last_name} has not provided consent to use their information for AI summary generation.",
                ], 403);
            }

            // Generate new AI summary
            $bedrockService = new BedrockAIService;
            $customPrompt = $this->buildSessionSummaryPrompt($patient, $appointment);
            $summaryBulletPoints = $bedrockService->generateSummary(null, $customPrompt);

            // Convert bullet points to formatted summary text
            $summaryText = implode("\n• ", $summaryBulletPoints);
            if (! empty($summaryText)) {
                $summaryText = '• '.$summaryText;
            }

            // Find the encounter for this appointment
            $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();

            if ($encounter) {
                // Update the AI summary in the encounter
                $encounter->update([
                    'ai_summary' => $summaryText,
                ]);
            }

            Log::info('AI summary regenerated', [
                'appointment_id' => $appointment->id,
                'encounter_id' => $encounter ? $encounter->id : null,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'AI summary regenerated successfully!',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to regenerate AI summary', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to regenerate AI summary. Please try again later.',
            ], 500);
        }
    }

    /**
     * Generate AI summary from encounter recordings
     */
    public function generateRecordingAISummary(Request $request, Appointment $appointment)
    {
        try {
            $validated = $request->validate([
                'summary_type' => 'required|string|in:plain_summary,soap_note,history_and_physical,medical_encounter_summary,progress_note,discharge_summary,operative_note,procedure_note,emergency_encounter,prescription_summary,lab_and_imaging_summary,chronic_disease_followup,pediatric_visit,antenatal_visit,psychiatry_summary,telemedicine_summary',
            ]);

            // Find the encounter for this appointment
            $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();

            if (! $encounter) {
                return response()->json([
                    'success' => false,
                    'message' => 'No encounter found for this appointment.',
                ], 404);
            }

            // Check if there are any recordings with completed transcriptions
            $hasRecordings = $encounter->recordings()
                ->where('transcription_status', 'completed')
                ->whereNotNull('transcription_speaker_segments')
                ->exists();

            if (! $hasRecordings) {
                return response()->json([
                    'success' => false,
                    'message' => 'No completed transcriptions found for this encounter. Please ensure recordings have been transcribed.',
                ], 400);
            }

            // Dispatch the job to generate the summary
            GenerateRecordingAISummary::dispatch($encounter->id, $validated['summary_type']);

            Log::info('Recording AI summary generation job dispatched', [
                'appointment_id' => $appointment->id,
                'encounter_id' => $encounter->id,
                'summary_type' => $validated['summary_type'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'AI summary generation started. This may take a few minutes.',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to start recording AI summary generation', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to start AI summary generation. Please try again later.',
            ], 500);
        }
    }

    /**
     * Regenerate AI summary from encounter recordings
     */
    public function regenerateRecordingAISummary(Request $request, Appointment $appointment)
    {
        try {
            $validated = $request->validate([
                'summary_type' => 'required|string|in:plain_summary,soap_note,history_and_physical,medical_encounter_summary,progress_note,discharge_summary,operative_note,procedure_note,emergency_encounter,prescription_summary,lab_and_imaging_summary,chronic_disease_followup,pediatric_visit,antenatal_visit,psychiatry_summary,telemedicine_summary',
            ]);

            // Find the encounter for this appointment
            $encounter = \App\Models\Tenant\Encounter::where('appointment_id', $appointment->id)->first();

            if (! $encounter) {
                return response()->json([
                    'success' => false,
                    'message' => 'No encounter found for this appointment.',
                ], 404);
            }

            // Check if there are any recordings with completed transcriptions
            $hasRecordings = $encounter->recordings()
                ->where('transcription_status', 'completed')
                ->whereNotNull('transcription_speaker_segments')
                ->exists();

            if (! $hasRecordings) {
                return response()->json([
                    'success' => false,
                    'message' => 'No completed transcriptions found for this encounter. Please ensure recordings have been transcribed.',
                ], 400);
            }

            // Dispatch the job to regenerate the summary
            GenerateRecordingAISummary::dispatch($encounter->id, $validated['summary_type']);

            Log::info('Recording AI summary regeneration job dispatched', [
                'appointment_id' => $appointment->id,
                'encounter_id' => $encounter->id,
                'summary_type' => $validated['summary_type'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'AI summary regeneration started. This may take a few minutes.',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to start recording AI summary regeneration', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to start AI summary regeneration. Please try again later.',
            ], 500);
        }
    }

    /**
     * Show appointment feedback form
     */
    public function showFeedback(Appointment $appointment)
    {
        // Check if user has permission to provide feedback for this appointment
        $user = Auth::user();
        $userRole = determineUserRole();

        // Only patients can provide feedback and only for their own appointments
        if ($userRole !== 'patient') {
            abort(403, 'Only patients can provide appointment feedback.');
        }

        // Check if the patient owns this appointment
        $patientId = tenancy()->central(function () use ($user) {
            $patient = Patient::where('user_id', $user->id)->first();

            return $patient ? $patient->id : null;
        });

        if (! $patientId || $appointment->patient_id !== $patientId) {
            abort(403, 'You can only provide feedback for your own appointments.');
        }

        // Only allow feedback for completed appointments
        if ($appointment->status !== 'completed') {
            abort(403, 'You can only provide feedback for completed appointments.');
        }

        // Load appointment relationships
        $appointment->load(['service', 'location']);

        // Get patient data
        $patient = tenancy()->central(function () use ($appointment) {
            return Patient::find($appointment->patient_id);
        });

        // Get practitioners for this appointment (tenant IDs after migration)
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');

        // NOTE: No select() clause - CipherSweet needs all fields to decrypt properly
        $practitionersModels = Practitioner::whereIn('id', $practitionerIds)->get();

        $practitioners = PractitionerMinimalResource::collection($practitionersModels)
            ->map(function ($practitioner) {
                return [
                    'id' => $practitioner['id'],
                    'name' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                    'title' => $practitioner['title'],
                ];
            });

        // Check if feedback already exists and if it can be edited
        $feedbackService = new \App\Services\FeedbackRatingService;
        $feedbackStatus = $feedbackService->canEditFeedback($appointment->id);

        // Get existing feedback data if it exists
        $existingFeedback = null;
        if ($feedbackStatus['exists']) {
            $existingFeedback = [
                'visit_rating' => $feedbackStatus['feedback']->visit_rating,
                'visit_led_by_id' => $feedbackStatus['feedback']->visit_led_by_id,
                'call_out_person_id' => $feedbackStatus['feedback']->call_out_person_id,
                'additional_feedback' => $feedbackStatus['feedback']->additional_feedback,
                'submitted_at' => $feedbackStatus['feedback']->submitted_at,
                'last_edited_at' => $feedbackStatus['feedback']->last_edited_at,
            ];

            // Debug: Log existing feedback data
            Log::info('Existing feedback data being passed to frontend', [
                'appointment_id' => $appointment->id,
                'existing_feedback' => $existingFeedback,
                'can_edit' => $feedbackStatus['can_edit'],
            ]);
        }

        return Inertia::render('Appointments/Feedback', [
            'appointment' => $appointment,
            'patient' => $patient,
            'practitioners' => $practitioners,
            'existingFeedback' => $existingFeedback,
            'canEdit' => $feedbackStatus['can_edit'],
            'feedbackExists' => $feedbackStatus['exists'],
        ]);
    }

    /**
     * Store appointment feedback
     */
    public function storeFeedback(Request $request, Appointment $appointment)
    {
        // Check if user has permission to provide feedback for this appointment
        $user = Auth::user();
        $userRole = determineUserRole();

        // Only patients can provide feedback and only for their own appointments
        if ($userRole !== 'patient') {
            abort(403, 'Only patients can provide appointment feedback.');
        }

        // Check if the patient owns this appointment
        $patientId = tenancy()->central(function () use ($user) {
            $patient = Patient::where('user_id', $user->id)->first();

            return $patient ? $patient->id : null;
        });

        if (! $patientId || $appointment->patient_id !== $patientId) {
            abort(403, 'You can only provide feedback for your own appointments.');
        }

        // Only allow feedback for completed appointments
        if ($appointment->status !== 'completed') {
            abort(403, 'You can only provide feedback for completed appointments.');
        }

        // Validate the feedback data
        $validated = $request->validate([
            'visit_rating' => 'required|integer|min:1|max:5',
            'visit_led_by_id' => 'nullable|integer',
            'call_out_person_id' => 'nullable|integer',
            'additional_feedback' => 'nullable|string|max:1000',
        ]);

        // Check if feedback can be edited
        $feedbackService = new \App\Services\FeedbackRatingService;
        $feedbackStatus = $feedbackService->canEditFeedback($appointment->id);

        if ($feedbackStatus['exists'] && ! $feedbackStatus['can_edit']) {
            return redirect()->back()->with('error', 'This feedback can no longer be edited. The 24-hour editing window has expired.');
        }

        try {
            // Store feedback and distribute ratings among practitioners
            $feedback = $feedbackService->storeFeedback(
                $appointment->id,
                $patientId,
                $validated
            );

            // Return back to the feedback page without flash message (frontend handles success)
            return redirect()->back();

        } catch (\Exception $e) {
            Log::error('Failed to store appointment feedback', [
                'appointment_id' => $appointment->id,
                'patient_id' => $patientId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->with('error', 'Failed to save feedback. Please try again.');
        }
    }

    /**
     * Lookup patients for appointment creation (similar to intake search).
     */
    public function lookupPatients(Request $request)
    {
        $request->validate([
            'first_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
            'last_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
            'health_card_number' => ['nullable', 'string', 'min:2'],
        ], [
            'first_name.regex' => 'First name and last name can have letters only.',
            'last_name.regex' => 'First name and last name can have letters only.',
        ]);

        $firstName = $request->first_name;
        $lastName = $request->last_name;
        $healthCardNumber = $request->health_card_number;
        $currentTenantId = tenant('id');

        // Search with exact first and last name matching (and optional health card) - encrypted fields
        $query = Patient::whereBlind('first_name', 'first_name_index', $firstName)
            ->whereBlind('last_name', 'last_name_index', $lastName);

        // If health card number is provided, add it to the search (encrypted field)
        if ($healthCardNumber) {
            $query->whereBlind('health_number', 'health_number_index', $healthCardNumber);
        }

        $patients = $query->limit(10)->get();

        // Return masked data for privacy compliance using resource
        $maskedPatients = PatientMaskedResource::collection($patients);

        return response()->json([
            'patients' => $maskedPatients,
        ]);
    }

    /**
     * Link existing patient to the current tenant for appointment creation.
     * NOTE: With tenant-scoped patients, this method finds patients within the tenant only.
     */
    public function linkPatient(Request $request)
    {
        $request->validate([
            'patient_id' => ['required', 'integer'],
            'redirect_source' => ['nullable', 'string', 'max:255'],
        ]);

        $patientId = $request->patient_id;

        // Check patient existence in tenant database
        $patient = Patient::find($patientId);
        if (! $patient) {
            return response()->json(['error' => 'Patient not found'], 404);
        }

        // Patient already exists in tenant database
        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Patient found successfully.',
                'type' => 'success',
            ], 200);
        }

        return redirect()->route('appointments.create')
            ->with('flash', [
                'type' => 'success',
                'message' => 'Patient found successfully.',
            ]);
    }

    /**
     * Kept for logging compatibility - method signature unchanged
     */
    private function logPatientLinking($patientId, $currentTenantId, $redirectSource)
    {
        // Log the linking activity
        Log::info('Patient found in tenant for appointment', [
            'patient_id' => $patientId,
            'tenant_id' => $currentTenantId,
            'user_id' => Auth::id(),
            'redirect_source' => $redirectSource,
        ]);

        // For AJAX requests, return JSON response
        if ($request->wantsJson()) {
            return response()->json(['success' => 'Patient linked successfully']);
        }

        return redirect()->route('appointments.create')
            ->with('success', 'Patient linked successfully! The existing patient has been added to your organization.');
    }

    /**
     * Get appointment history for a given appointment
     * Returns all appointments in the same chain (using root_appointment_id)
     */
    public function getAppointmentHistory(Appointment $appointment)
    {
        try {
            Log::info('APPOINTMENT HISTORY: Starting history fetch', [
                'appointment_id' => $appointment->id,
                'root_appointment_id' => $appointment->root_appointment_id,
            ]);

            // Determine the root appointment ID
            $rootAppointmentId = $appointment->root_appointment_id ?: $appointment->id;

            Log::info('APPOINTMENT HISTORY: Using root appointment ID', [
                'root_appointment_id' => $rootAppointmentId,
            ]);

            // Get all appointments in the same chain
            // Use a more explicit query to ensure we get all related appointments
            $appointmentHistory = Appointment::where(function ($query) use ($rootAppointmentId) {
                $query->where('root_appointment_id', $rootAppointmentId)
                    ->orWhere('id', $rootAppointmentId); // Include the root appointment itself
            })
                ->with(['service'])
                ->orderBy('created_at', 'asc')
                ->get();

            Log::info('APPOINTMENT HISTORY: Found appointments', [
                'count' => $appointmentHistory->count(),
                'appointment_ids' => $appointmentHistory->pluck('id')->toArray(),
            ]);

            // Load patient data for each appointment
            $appointmentHistoryWithPatients = $appointmentHistory->map(function ($appointment) {
                // Get patient data from central database
                $patientData = tenancy()->central(function () use ($appointment) {
                    return Patient::find($appointment->patient_id);
                });

                // Load practitioners data - appointment_practitioner is in tenant DB, practitioner data is in central DB
                $practitionerIds = DB::table('appointment_practitioner')
                    ->where('appointment_id', $appointment->id)
                    ->pluck('practitioner_id')
                    ->toArray();

                $practitionersData = [];
                if (! empty($practitionerIds)) {
                    // Load practitioners from tenant database (tenant IDs after migration)
                    $practitionersData = Practitioner::whereIn('id', $practitionerIds)
                        ->get(['id', 'first_name', 'last_name', 'title'])
                        ->map(function ($practitioner) {
                            return [
                                'id' => $practitioner->id,
                                'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                            ];
                        })
                        ->toArray();
                }

                // Convert appointment datetime to local timezone for display
                $locationName = 'Not specified';

                if ($appointment->location_id) {
                    // Get location data directly (not from central database)
                    $locationData = Location::find($appointment->location_id);

                    if ($locationData) {
                        $locationName = $locationData->name;
                    }
                }

                // Get tenant timezone
                $tenantTimezone = TenantTimezoneService::getTenantTimezone();

                $appointmentDatetimeLocal = null;
                if ($appointment->appointment_datetime) {
                    try {
                        $appointmentDatetimeLocal = TenantTimezoneService::convertToTenantTime(
                            $appointment->appointment_datetime
                        )->format('Y-m-d H:i:s');
                    } catch (\Exception $e) {
                        // Fallback to original datetime if timezone conversion fails
                        $appointmentDatetimeLocal = $appointment->appointment_datetime->format('Y-m-d H:i:s');
                        Log::warning('APPOINTMENT HISTORY: Timezone conversion failed', [
                            'appointment_id' => $appointment->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                return [
                    'id' => $appointment->id,
                    'status' => $appointment->status,
                    'appointment_datetime' => $appointment->appointment_datetime ? $appointment->appointment_datetime->format('Y-m-d H:i:s') : null,
                    'appointment_datetime_local' => $appointmentDatetimeLocal,
                    'tenant_timezone' => $tenantTimezone,
                    'mode' => $appointment->mode,
                    'booking_source' => $appointment->booking_source,
                    'notes' => $appointment->notes,
                    'created_at' => $appointment->created_at->format('Y-m-d H:i:s'),
                    'patient' => [
                        'id' => $patientData->id ?? 0,
                        'first_name' => $patientData->first_name ?? 'Unknown',
                        'last_name' => $patientData->last_name ?? 'Patient',
                        'email' => $patientData->email ?? 'No email',
                    ],
                    'service' => $appointment->service ? [
                        'id' => $appointment->service->id,
                        'name' => $appointment->service->name,
                    ] : [
                        'id' => null,
                        'name' => 'Unknown Service',
                    ],
                    'location' => $appointment->location_id ? [
                        'id' => $appointment->location_id,
                        'name' => $locationName,
                    ] : null,
                    'practitioners_list' => $practitionersData,
                ];
            });

            return response()->json([
                'success' => true,
                'appointments' => $appointmentHistoryWithPatients,
                'total_count' => $appointmentHistoryWithPatients->count(),
                'root_appointment_id' => $rootAppointmentId,
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching appointment history', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load appointment history',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send patient appointment link via email with signed URL
     */
    public function sendPatientAppointmentLink(Request $request, Appointment $appointment)
    {
        try {
            // Get patient data from tenant database
            $patient = Patient::find($appointment->patient_id);

            if (! $patient || ! $patient->email) {
                return back()->with('error', 'Patient not found or email not available');
            }

            // Generate signed URL for patient access
            $signedUrlService = app(AppointmentSignedUrlService::class);
            $appointmentUrl = $signedUrlService->generatePatientAppointmentUrl($appointment->id, 60); // 1 hour expiry
            $roomId = 'room_'.$appointment->id;
            // Get tenant info for email data
            $tenant = tenant();

            // Send email to patient
            $emailData = [
                'patient_name' => $patient->first_name.' '.$patient->last_name,
                'appointment_url' => $appointmentUrl,
                'room_id' => $roomId,
                'appointment_date' => $appointment->appointment_datetime->format('F j, Y'),
                'appointment_time' => $appointment->appointment_datetime->format('g:i A'),
                'clinic_name' => $tenant->company_name ?? 'Clinic',
            ];

            // Send email using the dedicated Mailable class
            Mail::to($patient->email, $emailData['patient_name'])
                ->send(new PatientAppointmentLinkMail($emailData));

            // Log the patient link sent activity
            \App\Services\VideoSessionActivityService::logPatientLinkSent($appointment, $patient->email, $request);

            return back()->with('success', 'Appointment link sent successfully to '.$patient->email);

        } catch (\Exception $e) {
            Log::error('Failed to send patient appointment link', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to send appointment link. Please try again.');
        }
    }

    /**
     * Send invitation link to additional participants
     */
    public function sendInvitationLink(Request $request, Appointment $appointment)
    {
        $request->validate([
            'email' => 'required|email',
            'name' => 'nullable|string|max:255',
        ]);

        try {
            $email = $request->input('email');
            $name = $request->input('name', $email);

            // Generate signed URL for invited participant access
            $signedUrlService = app(\App\Services\AppointmentSignedUrlService::class);
            $appointmentUrl = $signedUrlService->generateInvitedParticipantUrl($appointment->id, $email, 60); // 1 hour expiry

            // Get tenant info for email data
            $tenant = tenant();

            // Send email to invited participant
            $emailData = [
                'participant_name' => $name,
                'appointment_url' => $appointmentUrl,
                'appointment_date' => $appointment->appointment_datetime->format('F j, Y'),
                'appointment_time' => $appointment->appointment_datetime->format('g:i A'),
                'clinic_name' => $tenant->company_name ?? 'Clinic',
            ];

            // Send email using a new Mailable class for invited participants
            Mail::to($email, $name)
                ->send(new \App\Mail\InvitedParticipantLinkMail($emailData));

            // Log the invitation link sent activity
            \App\Services\VideoSessionActivityService::logInvitationLinkSent($appointment, $email, $name, $request);

            return back()->with('success', 'Invitation sent successfully to '.$email);

        } catch (\Exception $e) {
            Log::error('Failed to send invitation link', [
                'appointment_id' => $appointment->id,
                'email' => $request->input('email'),
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to send invitation. Please try again.');
        }
    }

    /**
     * Show patient booking form (simplified for patient self-booking)
     */
    public function patientBook(Request $request)
    {
        $currentTenantId = tenant('id');
        $user = Auth::user();

        // Only allow patients to access this
        if (! $user->hasRole('Patient')) {
            return redirect()->route('appointments.index')
                ->with('error', 'Only patients can access this booking form.');
        }

        // Get patient info from central database
        $patientInfo = tenancy()->central(function () use ($user) {
            $patient = Patient::where('user_id', $user->id)->first();

            if (! $patient) {
                return null;
            }

            return [
                'id' => $patient->id,
                'first_name' => $patient->first_name,
                'last_name' => $patient->last_name,
                'email' => $patient->email,
                'phone_number' => $patient->phone_number,
            ];
        });

        if (! $patientInfo) {
            return redirect()->route('appointments.index')
                ->with('error', 'Patient profile not found.');
        }

        // Get form data from session if exists
        $formData = session('patient_appointment_form_data', []);

        // Get all services from tenant database (same as create method)
        $allServices = \App\Models\Service::where('is_active', true)
            ->select('id', 'name', 'category', 'delivery_modes')
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(function ($service) {
                return [
                    'id' => $service->id,
                    'name' => $service->name,
                    'category' => $service->category,
                    'delivery_modes' => $service->delivery_modes ?? [],
                ];
            });

        // Get unique service categories for service type dropdown
        $serviceTypes = $allServices->pluck('category')->unique()->sort()->values();

        // Load all practitioners for the tenant (same as create method)
        // Get all practitioners from tenant database
        $allPractitioners = Practitioner::where('is_active', true)->get();

        $allPractitioners = PractitionerMinimalResource::collection($allPractitioners)
            ->map(function ($practitioner) {
                return [
                    'id' => $practitioner['id'], // Use central_practitioner_id as the ID
                    'name' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                    'value' => $practitioner['id'], // Use central_practitioner_id as the value
                    'label' => trim($practitioner['first_name'].' '.$practitioner['last_name']),
                ];
            });

        // Get practitioner-service relationships for client-side filtering (from tenant database)
        // Note: practitioner_id in practitioner_services refers to central_practitioner_id
        $practitionerServiceRelations = DB::table('practitioner_services')
            ->where('is_offered', true)
            ->select('practitioner_id', 'service_id')
            ->get()
            ->groupBy('practitioner_id')
            ->map(function ($relations) {
                return $relations->pluck('service_id')->toArray();
            });

        // Get locations from tenant database
        $locations = \App\Models\Location::where('is_active', true)
            ->select('id', 'name', 'street_address', 'city', 'province')
            ->orderBy('name')
            ->get()
            ->map(function ($location) {
                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'label' => $location->name,
                    'value' => $location->id,
                ];
            });

        // Get appointment settings from tenant database
        $appointmentSessionDuration = \App\Models\OrganizationSetting::getValue('appointment_session_duration_minutes', 60);
        $appointmentSettings = [
            'advanceBookingHours' => \App\Models\OrganizationSetting::getValue('appointment_advance_booking_hours', '1'),
            'maxAdvanceBookingDays' => \App\Models\OrganizationSetting::getValue('appointment_max_advance_booking_days', '90'),
            'allowSameDayBooking' => \App\Models\OrganizationSetting::getValue('appointment_allow_same_day_booking', true),
        ];

        // Get pending consents based on trigger points using ConsentTriggerService
        $patient = tenancy()->central(function () use ($patientInfo) {
            return Patient::find($patientInfo['id']);
        });

        $pendingConsents = collect();

        if ($patient) {
            // Since patient exists in tenant database, they are automatically linked to this tenant
            // Always use appointment_creation trigger for consent checks
            $triggerEvent = 'appointment_creation';

            // Get triggered consents using ConsentTriggerService
            $consentService = new ConsentTriggerService;

            if (! $patientTenant) {
                // New patient to this tenant - get both creation + appointment_creation consents
                $appointmentConsents = $consentService->getTriggeredConsents('PATIENT', 'appointment_creation');
                $creationConsents = $consentService->getTriggeredConsents('PATIENT', 'creation');

                // Merge and get unique consents
                $triggeredConsents = $appointmentConsents->merge($creationConsents)->unique('id');
            } else {
                // Existing patient - only get appointment_creation consents
                $triggeredConsents = $consentService->getTriggeredConsents('PATIENT', $triggerEvent);
            }

            // Filter out already accepted consents and format for frontend
            foreach ($triggeredConsents as $consent) {
                if ($consent->activeVersion) {
                    $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', Patient::class)
                        ->where('consentable_id', $patient->id)
                        ->where('consent_version_id', $consent->activeVersion->id)
                        ->exists();

                    if (! $hasAccepted) {
                        $pendingConsents->push([
                            'key' => $consent->key,
                            'title' => $consent->title,
                            'version_id' => $consent->activeVersion->id,
                            'body' => $consent->activeVersion->consent_body,
                        ]);
                    }
                }
            }
        }

        return Inertia::render('Appointments/PatientBook', [
            'serviceTypes' => $serviceTypes,
            'allServices' => $allServices,
            'allPractitioners' => $allPractitioners,
            'practitionerServiceRelations' => $practitionerServiceRelations,
            'locations' => $locations,
            'currentTab' => $request->get('tab', 'appointment-details'),
            'formData' => $formData,
            'appointmentSessionDuration' => $appointmentSessionDuration,
            'appointmentSettings' => $appointmentSettings,
            'patientInfo' => $patientInfo,
            'pendingConsents' => $pendingConsents,
            'consentsRequired' => $pendingConsents->isNotEmpty(),
        ]);
    }

    /**
     * Store patient self-booked appointment
     */
    public function patientStore(Request $request)
    {
        $user = Auth::user();

        // Only allow patients to access this
        if (! $user->hasRole('Patient')) {
            return redirect()->route('appointments.index')
                ->with('error', 'Only patients can book appointments through this form.');
        }

        // Get patient info
        $patient = tenancy()->central(function () use ($user) {
            return Patient::where('user_id', $user->id)->first();
        });

        if (! $patient) {
            return back()->with('error', 'Patient profile not found.');
        }

        // Get consents_shown flag to determine if consent checkboxes were displayed
        $consentsShown = $request->input('consents_shown', false);

        // Build validation rules
        $validationRules = [
            'service_id' => 'required|integer',
            'practitioner_ids' => 'required|array|min:1|max:1', // Only one practitioner allowed
            'practitioner_ids.*' => 'required|integer',
            'location_id' => 'nullable|integer',
            'mode' => 'required|in:in-person,virtual,hybrid',
            'date_time_preference' => 'required|string',
        ];

        // Add conditional validation for consents only if they were shown
        if ($consentsShown) {
            $validationRules['consent_checkboxes'] = 'required|array|min:1';
            $validationRules['consent_checkboxes.*'] = 'required|integer';
        }

        $validated = $request->validate($validationRules);

        try {
            DB::beginTransaction();

            // Get tenant timezone
            $tenantTimezone = TenantTimezoneService::getTenantTimezone();

            // Parse and convert the appointment datetime to UTC
            $localDateTime = $validated['date_time_preference'];
            $utcDateTime = TenantTimezoneService::parseInTenantTimezone($localDateTime, 'Y-m-d H:i');

            // Get service duration from tenant database
            $service = Service::find($validated['service_id']);
            $durationMinutes = $service->default_duration_minutes ?? 60;
            $utcEndTime = $utcDateTime->copy()->addMinutes($durationMinutes);

            // Check for appointment conflicts before creating
            foreach ($validated['practitioner_ids'] as $practitionerId) {
                $this->checkPractitionerConflict($practitionerId, $utcDateTime, $utcEndTime);
            }

            // Create the appointment with pending status
            // Single practitioner automatically becomes primary (set in pivot table)
            $appointment = Appointment::create([
                'patient_id' => $patient->id,
                'contact_person' => $patient->first_name.' '.$patient->last_name,
                'service_id' => $validated['service_id'],
                'location_id' => ! empty($validated['location_id']) ? $validated['location_id'] : null,
                'mode' => $validated['mode'],
                'appointment_datetime' => $utcDateTime,
                'start_time' => $utcDateTime,
                'end_time' => $utcEndTime,
                'stored_timezone' => $tenantTimezone,
                'needs_timezone_migration' => false,
                'date_time_preference' => $validated['date_time_preference'],
                'booking_source' => 'Patient Portal',
                'admin_override' => 'no-override',
                'status' => 'pending', // Always pending for patient bookings
            ]);

            // Attach practitioner using DB::table
            // For patient bookings, only ONE practitioner allowed - automatically set as primary
            // Note: practitioner_ids contains central_practitioner_id values from the frontend
            foreach ($validated['practitioner_ids'] as $centralPractitionerId) {
                DB::table('appointment_practitioner')->insert([
                    'appointment_id' => $appointment->id,
                    'practitioner_id' => $centralPractitionerId, // This is central_practitioner_id
                    'start_time' => $utcDateTime->format('Y-m-d H:i:s'),
                    'end_time' => $utcEndTime->format('Y-m-d H:i:s'),
                    'is_primary' => true, // Patient bookings always have single practitioner as primary
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::commit();

            // Accept consents if they were shown and provided
            if ($consentsShown && $request->has('consent_checkboxes')) {
                $consentVersionIds = $request->input('consent_checkboxes', []);

                foreach ($consentVersionIds as $versionId) {
                    try {
                        $patient->acceptConsent((int) $versionId);
                    } catch (\Exception $e) {
                        Log::warning('Failed to accept consent for patient', [
                            'patient_id' => $patient->id,
                            'consent_version_id' => $versionId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                Log::info('Patient consents accepted during appointment booking', [
                    'patient_id' => $patient->id,
                    'appointment_id' => $appointment->id,
                    'accepted_consent_versions' => $consentVersionIds,
                ]);
            }

            // Clear session data
            session()->forget('patient_appointment_form_data');

            // Send confirmation email to patient
            try {
                Mail::to($patient->email)
                    ->send(new \App\Mail\AppointmentNotificationMail($appointment));
            } catch (\Exception $e) {
                Log::error('Failed to send patient appointment confirmation email', [
                    'appointment_id' => $appointment->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return redirect()->route('appointments.index')
                ->with('success', 'Appointment booked successfully! Your appointment is pending confirmation from the clinic.');

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Failed to create patient appointment', [
                'error' => $e->getMessage(),
                'user_id' => $user->id,
                'patient_id' => $patient->id ?? null,
            ]);

            return back()
                ->withInput()
                ->with('error', 'Failed to book appointment: '.$e->getMessage());
        }
    }

    /**
     * Create invoice for appointment when it's confirmed
     */
    protected function createInvoiceForAppointment(\App\Models\Tenant\Appointment $appointment): void
    {
        try {
            // Use the InvoiceGenerationService for in-person appointments when confirmed
            $invoiceService = new \App\Services\InvoiceGenerationService;
            $invoice = $invoiceService->generateInvoiceForAppointment($appointment);

            if ($invoice) {
                Log::info('Invoice auto-created for confirmed in-person appointment', [
                    'appointment_id' => $appointment->id,
                    'invoice_id' => $invoice->id,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to create invoice for appointment', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Resend consent email to patient for a pending-consent appointment
     */
    public function resendConsent(Appointment $appointment)
    {
        try {
            // Verify appointment is in pending-consent status
            if ($appointment->status !== 'pending-consent') {
                return back()->with('error', 'Consent email can only be resent for appointments with pending-consent status.');
            }

            // Get patient from central database
            $patient = Patient::find($appointment->patient_id);

            if (! $patient) {
                return back()->with('error', 'Patient not found.');
            }

            // Generate consent URL
            $consentUrl = route('consents.show', ['token' => 'public']).'?patient_id='.$patient->id;
            $consentUrl .= '&appointment_id='.$appointment->id;

            // Send consent email (automatically queued because PatientConsentMail implements ShouldQueue)
            Mail::to($patient->email)->send(
                new \App\Mail\Tenant\PatientConsentMail($patient, tenant(), $consentUrl)
            );

            Log::info('Consent email resent for appointment', [
                'appointment_id' => $appointment->id,
                'patient_id' => $appointment->patient_id,
            ]);

            return back()->with('success', 'Consent email has been resent successfully.');
        } catch (\Exception $e) {
            Log::error('Failed to resend consent email', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to resend consent email. Please try again.');
        }
    }
}
