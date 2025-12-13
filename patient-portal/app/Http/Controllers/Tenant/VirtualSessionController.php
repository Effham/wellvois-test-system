<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientMinimalResource;
use App\Models\OrganizationSetting;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class VirtualSessionController extends Controller
{
    /**
     * Display the virtual session interface for patients
     */
    public function show(Request $request, $appointmentId)
    {
        // Get the appointment with relationships
        $appointment = Appointment::with(['service', 'location'])
            ->where('id', $appointmentId)
            ->first();

        // Security check: Appointment must exist
        if (! $appointment) {
            abort(404, 'Appointment not found');
        }

        // Security check: Appointment must be virtual
        if (! in_array($appointment->mode, ['virtual', 'hybrid'])) {
            abort(403, 'This appointment is not available for virtual access.');
        }

        // Security check: Appointment must be today or future
        $appointmentDate = Carbon::parse($appointment->appointment_datetime)->toDateString();
        $today = now()->toDateString();
        if ($appointmentDate < $today) {
            abort(403, 'This appointment has already passed.');
        }

        // Get patient from central database
        $patient = null;
        if ($appointment->patient_id) {
            tenancy()->central(function () use (&$patient, $appointment) {
                $patient = Patient::find($appointment->patient_id);
            });
        }

        // Get practitioners assigned to this appointment
        $practitioners = [];
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id');

        if ($practitionerIds->isNotEmpty()) {
            tenancy()->central(function () use (&$practitioners, $practitionerIds) {
                $practitioners = Practitioner::whereIn('id', $practitionerIds)
                    ->get()
                    ->map(function ($practitioner) {
                        return [
                            'id' => $practitioner->id,
                            'first_name' => $practitioner->first_name,
                            'last_name' => $practitioner->last_name,
                            'designation' => $practitioner->designation,
                            'profile_picture_s3_key' => $practitioner->profile_picture_s3_key,
                        ];
                    });
            });
        }

        // Check if the appointment is currently active
        $isActive = false;
        $canJoin = false;
        $sessionStatus = 'upcoming';

        if ($appointment->appointment_datetime) {
            $appointmentTime = Carbon::parse($appointment->appointment_datetime);
            $now = now();

            // Allow joining 15 minutes before and up to 2 hours after appointment time
            $joinStartTime = $appointmentTime->copy()->subMinutes(15);
            $joinEndTime = $appointmentTime->copy()->addHours(2);

            if ($now->between($joinStartTime, $joinEndTime)) {
                $canJoin = true;

                // Session is active if current time is within appointment window
                if ($now->between($appointmentTime, $appointmentTime->copy()->addMinutes(60))) {
                    $isActive = true;
                    $sessionStatus = 'active';
                } elseif ($now < $appointmentTime) {
                    $sessionStatus = 'starting_soon';
                } else {
                    $sessionStatus = 'ending_soon';
                }
            } elseif ($now < $joinStartTime) {
                $sessionStatus = 'upcoming';
            } else {
                $sessionStatus = 'ended';
            }
        }

        // Get organization settings for theming and branding
        $organizationSettings = [
            'practiceDetails' => OrganizationSetting::getByPrefix('practice_details_'),
            'appearance' => $this->getAppearanceSettingsWithSignedUrl(),
        ];

        // Get tenant information
        $tenantInfo = [
            'id' => tenant('id'),
            'company_name' => tenant('company_name'),
        ];
        $antMediaUrl = config('services.antmedia.url');

        return Inertia::render('VirtualSession', [
            'antMediaUrl' => $antMediaUrl,
            'appointment' => array_merge($appointment->toArray(), [
                'appointment_datetime_formatted' => $appointment->appointment_datetime
                    ? Carbon::parse($appointment->appointment_datetime)->format('l, F j, Y \a\t g:i A')
                    : null,
                'appointment_date' => $appointment->appointment_datetime
                    ? Carbon::parse($appointment->appointment_datetime)->format('Y-m-d')
                    : null,
                'appointment_time' => $appointment->appointment_datetime
                    ? Carbon::parse($appointment->appointment_datetime)->format('g:i A')
                    : null,

            ]),
            'patient' => $patient ? (new PatientMinimalResource($patient))->resolve() : null,
            'practitioners' => $practitioners,
            'sessionStatus' => [
                'is_active' => $isActive,
                'can_join' => $canJoin,
                'status' => $sessionStatus,
            ],
            'organizationSettings' => $organizationSettings,
            'tenant' => $tenantInfo,
            'isAuthenticated' => Auth::check(),
            'currentUser' => Auth::check() ? [
                'id' => Auth::user()->id,
                'name' => Auth::user()->name,
                'email' => Auth::user()->email,
                'roles' => Auth::user()->roles->pluck('name')->toArray(),
            ] : null,
        ]);
    }

    /**
     * Get appearance settings with signed URL generated for logo
     */
    private function getAppearanceSettingsWithSignedUrl(): array
    {
        $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');

        if (isset($appearanceSettings['appearance_logo_s3_key']) && ! empty($appearanceSettings['appearance_logo_s3_key'])) {
            try {
                $logoUrl = route('logo.proxy', ['tenant_id' => tenant('id')]);
                $appearanceSettings['appearance_logo_url'] = $logoUrl;
            } catch (\Exception $e) {
                Log::warning('Could not generate logo URL', ['error' => $e->getMessage()]);
            }
        }

        return $appearanceSettings;
    }

    /**
     * Handle patient login for virtual session
     */
    public function login(Request $request, $appointmentId)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Get the appointment to verify it exists and belongs to this patient
        $appointment = Appointment::where('id', $appointmentId)->first();

        if (! $appointment) {
            return back()->withErrors([
                'email' => 'Appointment not found.',
            ]);
        }

        // Attempt to authenticate the user
        $authUser = null;
        $patient = null;
        $isLinkedToAppointment = false;

        tenancy()->central(function () use (
            $validated,
            $appointment,
            &$authUser,
            &$patient,
            &$isLinkedToAppointment
        ) {
            $authUser = \App\Models\User::where('email', $validated['email'])->first();

            if (! $authUser) {
                return;
            }

            // Check password
            if (! Hash::check($validated['password'], $authUser->password)) {
                return;
            }

            // Find the patient record associated with this user
            $patient = Patient::where('user_id', $authUser->id)->first();
            if (! $patient) {
                return;
            }

            // Check if this patient is linked to this appointment
            $isLinkedToAppointment = $appointment->patient_id == $patient->id;
        });

        if (! $authUser || ! $patient) {
            return back()->withErrors([
                'email' => 'Invalid credentials.',
            ]);
        }

        if (! $isLinkedToAppointment) {
            return back()->withErrors([
                'email' => 'You are not authorized to access this appointment.',
            ]);
        }

        // Create or get user in tenant database and log them in
        $user = User::firstOrCreate(
            ['email' => $validated['email']],
            [
                'name' => $authUser->name,
                'email' => $authUser->email,
                'email_verified_at' => $authUser->email_verified_at,
                'password' => $authUser->password, // Copy password hash
            ]
        );

        // Ensure they have the Patient role in the tenant
        if (! $user->hasRole('Patient')) {
            $user->assignRole('Patient');
        }

        // Log the user in
        Auth::login($user);

        // Store login timestamp for absolute session timeout enforcement
        session(['login_time' => now()->timestamp]);

        // Redirect back to the virtual session page
        return redirect()->route('virtual-session.show', $appointmentId)
            ->with('success', 'Successfully logged in!');
    }
}
