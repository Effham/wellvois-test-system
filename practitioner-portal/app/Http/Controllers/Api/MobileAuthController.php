<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\MobileLoginRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MobileAuthController extends Controller
{
    /**
     * Handle a mobile login request and issue an API token.
     * Only practitioners are allowed to login through the mobile API.
     */
    public function login(MobileLoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Check if user is a practitioner - mobile API is restricted to practitioners only
        if (! $user->isPractitioner()) {
            throw ValidationException::withMessages([
                'email' => ['Mobile login is restricted to practitioners only.'],
            ]);
        }

        // Generate device name if not provided
        $deviceName = $request->device_name ?? $this->generateDefaultDeviceName($request);

        // Revoke all existing tokens for this device (optional - for single device login)
        // $user->tokens()->where('name', $deviceName)->delete();

        // Create a new token for this device
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
            ],
        ]);
    }

    /**
     * Handle a mobile logout request and revoke the current token.
     */
    public function logout(Request $request): JsonResponse
    {
        // Revoke the current access token
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout successful',
        ]);
    }

    /**
     * Get the authenticated user.
     */
    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                ],
            ],
        ]);
    }

    /**
     * Get practitioner dashboard data including appointments, clinics, and next appointment.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        // Fetch practitioner from central database
        $practitioner = \App\Models\CentralPractitioner::where('user_id', $user->id)->first();

        if (! $practitioner) {
            return response()->json([
                'success' => false,
                'message' => 'Practitioner profile not found.',
            ], 404);
        }

        // Get all tenants where this practitioner works (only accepted invitations)
        $tenantIds = $practitioner->tenants()
            ->wherePivot('invitation_status', 'ACCEPTED')
            ->pluck('tenant_id')
            ->toArray();

        $appointments = [];
        $clinics = [];
        $nextAppointment = null;
        $now = Carbon::now()->utc();

        // Fetch appointments and clinic details from all tenants
        foreach ($tenantIds as $tenantId) {
            try {
                $tenant = \App\Models\Tenant::find($tenantId);
                if (! $tenant) {
                    continue;
                }

                // Get clinic details
                $companyName = $tenant->company_name ?? 'Unknown Clinic';

                // Switch to tenant database
                tenancy()->initialize($tenant);

                // Get tenant practitioner
                $tenantPractitioner = \App\Models\Practitioner::where('central_practitioner_id', $practitioner->id)->first();

                if (! $tenantPractitioner) {
                    tenancy()->end();

                    continue;
                }

                // Get organization settings for logo and business details
                $appearanceSettings = \App\Models\OrganizationSetting::getByPrefix('appearance_');
                $practiceDetails = \App\Models\OrganizationSetting::getByPrefix('practice_details_');

                // Generate logo URL if available
                $logoUrl = null;
                $logoS3Key = $appearanceSettings['appearance_logo_s3_key'] ?? null;
                if (! empty($logoS3Key)) {
                    $cacheBuster = substr(md5($logoS3Key), 0, 8);
                    $logoUrl = url("/logo-proxy/{$tenantId}?v={$cacheBuster}");
                }

                // Build clinic information
                $clinicInfo = [
                    'id' => $tenantId,
                    'name' => $companyName,
                    'practice_name' => $practiceDetails['practice_details_name'] ?? $companyName,
                    'legal_name' => $practiceDetails['practice_details_legal_name'] ?? null,
                    'industry_type' => $practiceDetails['practice_details_industry_type'] ?? null,
                    'contact_email' => $practiceDetails['practice_details_contact_email'] ?? null,
                    'phone_number' => $practiceDetails['practice_details_phone_number'] ?? null,
                    'website_url' => $practiceDetails['practice_details_website_url'] ?? null,
                    'logo_url' => $logoUrl,
                ];

                $clinics[] = $clinicInfo;

                // Fetch appointments for this tenant
                $tenantAppointments = \App\Models\Tenant\Appointment::with(['service', 'location'])
                    ->select('appointments.*', 'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
                    ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                    ->where('appointment_practitioner.practitioner_id', $tenantPractitioner->id)
                    ->whereNotNull('appointment_practitioner.start_time')
                    ->where('appointment_practitioner.start_time', '>=', $now->copy()->startOfDay())
                    ->orderBy('appointment_practitioner.start_time', 'asc')
                    ->get();

                foreach ($tenantAppointments as $appointment) {
                    // Get patient from tenant database
                    $patient = null;
                    if ($appointment->patient_id) {
                        $patient = \App\Models\Tenant\Patient::find($appointment->patient_id);
                    }

                    $service = $appointment->service;
                    $location = $appointment->location;

                    $patientName = $patient
                        ? trim($patient->first_name.' '.$patient->last_name)
                        : 'Unknown Patient';

                    $utcStartTime = Carbon::parse($appointment->start_time);
                    $utcEndTime = Carbon::parse($appointment->end_time);
                    $durationMinutes = $utcStartTime->diffInMinutes($utcEndTime);

                    $appointmentData = [
                        'id' => $appointment->id,
                        'tenant_id' => $tenantId,
                        'clinic_name' => $companyName,
                        'patient' => [
                            'id' => $patient ? $patient->id : null,
                            'name' => $patientName,
                            'email' => $patient ? ($patient->email ?? null) : null,
                        ],
                        'service' => [
                            'id' => $service ? $service->id : null,
                            'name' => $service ? $service->name : 'General Consultation',
                        ],
                        'location' => [
                            'id' => $location ? $location->id : null,
                            'name' => $location ? $location->name : ($appointment->mode === 'virtual' ? 'Virtual' : 'Unknown Location'),
                            'address' => $location ? ($location->street_address ?? null) : null,
                        ],
                        'status' => $appointment->status,
                        'mode' => $appointment->mode,
                        'start_time' => $utcStartTime->toISOString(),
                        'end_time' => $utcEndTime->toISOString(),
                        'date' => $utcStartTime->format('Y-m-d'),
                        'time' => $utcStartTime->format('H:i'),
                        'duration_minutes' => $durationMinutes,
                        'notes' => $appointment->notes ?? null,
                    ];

                    $appointments[] = $appointmentData;

                    // Track next appointment (earliest upcoming appointment)
                    if (! $nextAppointment || $utcStartTime->lt(Carbon::parse($nextAppointment['start_time']))) {
                        $nextAppointment = $appointmentData;
                    }
                }

                // Return to central database
                tenancy()->end();

            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Error fetching data from tenant: '.$tenantId, [
                    'error' => $e->getMessage(),
                    'practitioner_id' => $practitioner->id,
                ]);

                // Make sure we return to central context even if there's an error
                try {
                    tenancy()->end();
                } catch (\Exception $endError) {
                    // Ignore end errors
                }

                continue;
            }
        }

        // Sort appointments by start time
        usort($appointments, function ($a, $b) {
            return strtotime($a['start_time']) <=> strtotime($b['start_time']);
        });

        return response()->json([
            'success' => true,
            'data' => [
                'practitioner' => [
                    'id' => $practitioner->id,
                    'name' => trim($practitioner->first_name.' '.$practitioner->last_name),
                    'email' => $user->email,
                ],
                'appointments' => $appointments,
                'next_appointment' => $nextAppointment,
                'clinics' => $clinics,
                'total_appointments' => count($appointments),
                'total_clinics' => count($clinics),
            ],
        ]);
    }

    /**
     * Generate a default device name based on user agent or timestamp.
     */
    private function generateDefaultDeviceName(Request $request): string
    {
        $userAgent = $request->userAgent() ?? 'Unknown';

        // Extract iOS device info
        if (preg_match('/iPhone/i', $userAgent)) {
            if (preg_match('/iPhone OS (\d+)_(\d+)/', $userAgent, $matches)) {
                return "iPhone iOS {$matches[1]}.{$matches[2]}";
            }

            return 'iPhone';
        }

        if (preg_match('/iPad/i', $userAgent)) {
            if (preg_match('/OS (\d+)_(\d+)/', $userAgent, $matches)) {
                return "iPad iOS {$matches[1]}.{$matches[2]}";
            }

            return 'iPad';
        }

        if (preg_match('/iPod/i', $userAgent)) {
            if (preg_match('/OS (\d+)_(\d+)/', $userAgent, $matches)) {
                return "iPod iOS {$matches[1]}.{$matches[2]}";
            }

            return 'iPod';
        }

        // Extract Android device info
        if (preg_match('/Android/i', $userAgent)) {
            // Try to extract device model (e.g., SM-S918B for Samsung Galaxy S23)
            if (preg_match('/Android [\d.]+; ([^)]+)\)/', $userAgent, $deviceMatches)) {
                $deviceModel = trim($deviceMatches[1]);
                // Limit length to avoid exceeding database column limit
                $deviceModel = substr($deviceModel, 0, 200);

                // Extract Android version if available
                if (preg_match('/Android ([\d.]+)/', $userAgent, $versionMatches)) {
                    return "Android {$versionMatches[1]} - {$deviceModel}";
                }

                return "Android {$deviceModel}";
            }

            // Extract Android version only
            if (preg_match('/Android ([\d.]+)/', $userAgent, $versionMatches)) {
                return "Android {$versionMatches[1]}";
            }

            return 'Android Device';
        }

        // Extract browser/app name for other platforms
        if (preg_match('/(Chrome|Firefox|Safari|Edge|Opera)\/([\d.]+)/', $userAgent, $browserMatches)) {
            $browser = $browserMatches[1];
            $version = $browserMatches[2];

            if (preg_match('/Windows NT ([\d.]+)/', $userAgent, $osMatches)) {
                $windowsVersion = $this->getWindowsVersionName($osMatches[1]);

                return "Windows {$windowsVersion} - {$browser} {$version}";
            }

            if (preg_match('/Mac OS X ([\d_]+)/', $userAgent, $osMatches)) {
                $macVersion = str_replace('_', '.', $osMatches[1]);

                return "macOS {$macVersion} - {$browser} {$version}";
            }

            if (preg_match('/Linux/i', $userAgent)) {
                return "Linux - {$browser} {$version}";
            }

            return "{$browser} {$version}";
        }

        // Extract Windows version without browser
        if (preg_match('/Windows NT ([\d.]+)/', $userAgent, $osMatches)) {
            $windowsVersion = $this->getWindowsVersionName($osMatches[1]);

            return "Windows {$windowsVersion}";
        }

        // Extract macOS version without browser
        if (preg_match('/Mac OS X ([\d_]+)/', $userAgent, $osMatches)) {
            $macVersion = str_replace('_', '.', $osMatches[1]);

            return "macOS {$macVersion}";
        }

        // Fallback: use sanitized User-Agent (truncated to fit database limit)
        $sanitized = substr($userAgent, 0, 200);

        return $sanitized !== 'Unknown' ? $sanitized : 'Device '.now()->format('Y-m-d H:i:s');
    }

    /**
     * Get human-readable Windows version name from version number.
     */
    private function getWindowsVersionName(string $version): string
    {
        return match ($version) {
            '10.0' => '10/11',
            '6.3' => '8.1',
            '6.2' => '8',
            '6.1' => '7',
            '6.0' => 'Vista',
            default => $version,
        };
    }
}
