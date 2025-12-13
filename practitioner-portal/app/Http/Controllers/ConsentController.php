<?php

namespace App\Http\Controllers;

use App\Models\Practitioner;
use App\Models\Tenant;
use App\Models\Tenant\Consent;
use App\Models\Tenant\EntityConsent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ConsentController extends Controller
{
    public function showAdministrativeAccess(Request $request, string $token)
    {
        try {
            // Decode and validate token
            $tokenData = $this->decodeConsentToken($token);

            if (! $tokenData) {
                return redirect()->route('login')->withErrors(['error' => 'Invalid or expired consent link.']);
            }

            // Initialize tenant context
            tenancy()->initialize(Tenant::find($tokenData['tenant_id']));

            // Get practitioner
            $practitioner = Practitioner::find($tokenData['practitioner_id']);

            if (! $practitioner) {
                tenancy()->end();

                return redirect()->route('login')->withErrors(['error' => 'Practitioner not found.']);
            }

            $tenant = Tenant::find($tokenData['tenant_id']);

            tenancy()->end();

            return inertia('consent/administrative-access', [
                'practitioner' => $practitioner,
                'tenant' => $tenant,
                'token' => $token,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to show administrative access consent', [
                'token' => $token,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->route('login')->withErrors(['error' => 'An error occurred while loading the consent page.']);
        }
    }

    public function acceptAdministrativeAccess(Request $request, string $token)
    {
        $request->validate([
            'administrative_consent' => 'required|accepted',
        ]);

        try {
            // Decode and validate token
            $tokenData = $this->decodeConsentToken($token);

            if (! $tokenData) {
                return back()->withErrors(['error' => 'Invalid or expired consent link.']);
            }

            // Initialize tenant context
            tenancy()->initialize(Tenant::find($tokenData['tenant_id']));

            // Get practitioner
            $practitioner = Practitioner::find($tokenData['practitioner_id']);

            if (! $practitioner) {
                tenancy()->end();

                return back()->withErrors(['error' => 'Practitioner not found.']);
            }

            // Check if already consented
            $hasConsented = EntityConsent::whereHas('consentVersion.consent', function ($q) {
                $q->where('key', 'administrative_access');
            })
                ->where('consentable_type', 'App\\Models\\Practitioner')
                ->where('consentable_id', $practitioner->id)
                ->exists();

            if ($hasConsented) {
                tenancy()->end();

                return redirect()->route('login')->with('success', 'You have already accepted this consent. You can now log in to the platform.');
            }

            // Get or create administrative access consent
            $consent = Consent::firstOrCreate(
                ['key' => 'administrative_access'],
                [
                    'title' => 'Administrative Access Consent',
                    'entity_type' => 'PRACTITIONER',
                ]
            );

            // Create active version if it doesn't exist
            if (! $consent->activeVersion) {
                $consent->versions()->create([
                    'consent_body' => [
                        'heading' => 'Administrative Access Consent',
                        'description' => 'Required for platform access and support',
                        'content' => 'I consent to the limited, necessary administrative access to my professional profile and data by Wellovis personnel.',
                        'full_text' => 'By checking this box, I acknowledge and agree that authorized administrative staff of Wellovis may view and manage my availability, locations, and appointment metadata (date, time, service) for the exclusive purposes of platform maintenance, technical support, and operational management. This access adheres to the legal principle of "Minimum Necessary" use of health information and is required for my use of the Wellovis EMR platform.',
                    ],
                    'status' => 'ACTIVE',
                ]);
            }

            // Create entity consent record
            EntityConsent::create([
                'consent_version_id' => $consent->activeVersion->id,
                'consentable_type' => 'App\\Models\\Practitioner',
                'consentable_id' => $practitioner->id,
                'consented_at' => now(),
            ]);

            Log::info('Administrative access consent accepted', [
                'practitioner_id' => $practitioner->id,
                'tenant_id' => $tokenData['tenant_id'],
                'consent_key' => 'administrative_access',
            ]);

            tenancy()->end();

            return redirect()->route('login')->with('success', 'Consent accepted successfully! You can now log in to the platform.');

        } catch (\Exception $e) {
            Log::error('Failed to accept administrative access consent', [
                'token' => $token,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            tenancy()->end();

            return back()->withErrors(['error' => 'An error occurred while processing your consent. Please try again.']);
        }
    }

    public function showStaffPermissions(Request $request, string $token)
    {
        Log::info('=== showStaffPermissions Called ===', [
            'token' => $token,
            'has_flash_consentAccepted' => session()->has('consentAccepted'),
            'flash_consentAccepted_value' => session('consentAccepted'),
            'all_flash_data' => session()->all(),
        ]);

        try {
            // Decode and validate token
            $tokenData = $this->decodeConsentToken($token);

            if (! $tokenData) {
                return redirect()->route('login')->withErrors(['error' => 'Invalid or expired consent link.']);
            }

            // Get practitioner and tenant (static implementation)
            $practitioner = Practitioner::find($tokenData['practitioner_id']);
            $tenant = Tenant::find($tokenData['tenant_id']);

            if (! $practitioner || ! $tenant) {
                return redirect()->route('login')->withErrors(['error' => 'Practitioner or tenant not found.']);
            }

            $consentAccepted = session('consentAccepted', false);

            Log::info('Rendering staff permissions page', [
                'practitioner_id' => $practitioner->id,
                'tenant_id' => $tenant->id,
                'consentAccepted' => $consentAccepted,
            ]);

            return inertia('consent/staff-permissions', [
                'practitioner' => $practitioner,
                'tenant' => $tenant,
                'token' => $token,
                'consentAccepted' => $consentAccepted,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to show staff permissions consent', [
                'token' => $token,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->route('login')->withErrors(['error' => 'An error occurred while loading the consent page.']);
        }
    }

    public function acceptStaffPermissions(Request $request, string $token)
    {
        $request->validate([
            'invitation_permission' => 'required|accepted',
            'location_assignment_permission' => 'required|accepted',
            'location_modification_permission' => 'required|accepted',
        ]);

        try {
            // Decode and validate token
            $tokenData = $this->decodeConsentToken($token);

            if (! $tokenData) {
                return back()->withErrors(['error' => 'Invalid or expired consent link.']);
            }

            // Get tenant and practitioner
            $tenant = Tenant::find($tokenData['tenant_id']);
            $practitioner = Practitioner::find($tokenData['practitioner_id']);

            if (! $tenant || ! $practitioner) {
                return back()->withErrors(['error' => 'Tenant or practitioner not found.']);
            }

            // Initialize tenant context
            tenancy()->initialize($tenant);

            // Get or create staff permissions consent
            $consent = \App\Models\Tenant\Consent::firstOrCreate(
                ['key' => 'staff_permissions'],
                [
                    'title' => 'Staff Permissions Consent',
                    'entity_type' => 'PRACTITIONER',
                ]
            );

            // Create active version if it doesn't exist
            if (! $consent->activeVersion) {
                $consent->versions()->create([
                    'consent_body' => [
                        'heading' => 'Staff Permissions Consent',
                        'description' => 'Required for platform access and staff management',
                        'permissions' => [
                            'invitation_permission' => 'The staff can invite you to join as a practitioner',
                            'location_assignment_permission' => 'The staff can assign you locations and time slots',
                            'location_modification_permission' => 'The staff can change your locations and time slots',
                        ],
                    ],
                    'status' => 'ACTIVE',
                ]);
            }

            // Check if practitioner has already accepted this consent
            $hasAccepted = \App\Models\Tenant\EntityConsent::where('consent_version_id', $consent->activeVersion->id)
                ->where('consentable_type', 'App\\Models\\Practitioner')
                ->where('consentable_id', $practitioner->id)
                ->exists();

            if (! $hasAccepted) {
                // Create entity consent record
                $entityConsent = \App\Models\Tenant\EntityConsent::create([
                    'consent_version_id' => $consent->activeVersion->id,
                    'consentable_type' => 'App\\Models\\Practitioner',
                    'consentable_id' => $practitioner->id,
                    'consented_at' => now(),
                ]);

                Log::info('Staff permissions consent record created for practitioner', [
                    'practitioner_id' => $practitioner->id,
                    'tenant_id' => $tokenData['tenant_id'],
                    'consent_key' => 'staff_permissions',
                    'entity_consent_id' => $entityConsent->id,
                ]);
            } else {
                Log::info('Staff permissions consent already accepted by practitioner', [
                    'practitioner_id' => $practitioner->id,
                    'tenant_id' => $tokenData['tenant_id'],
                    'consent_key' => 'staff_permissions',
                ]);
            }

            Log::info('Staff permissions consent accepted', [
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
                'tenant_id' => $tokenData['tenant_id'],
                'tenant_name' => $tenant->company_name,
                'consent_key' => 'staff_permissions',
                'permissions_accepted' => [
                    'invitation_permission' => $request->input('invitation_permission'),
                    'location_assignment_permission' => $request->input('location_assignment_permission'),
                    'location_modification_permission' => $request->input('location_modification_permission'),
                ],
            ]);

            tenancy()->end();

            $redirectRoute = route('consent.staff-permissions.show', $token);
            Log::info('=== Staff Permissions: Redirecting with success ===', [
                'token' => $token,
                'redirect_route' => $redirectRoute,
                'redirect_to' => 'consent.staff-permissions.show',
                'flash_key' => 'consentAccepted',
                'flash_value' => true,
            ]);

            return redirect()->route('consent.staff-permissions.show', $token)
                ->with('consentAccepted', true);

        } catch (\Exception $e) {
            Log::error('Failed to accept staff permissions consent', [
                'token' => $token,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => 'An error occurred while processing your consent. Please try again.']);
        }
    }

    private function decodeConsentToken(string $token): ?array
    {
        try {
            $decoded = base64_decode($token);
            $data = json_decode($decoded, true);

            // Validate required fields
            if (! isset($data['practitioner_id']) || ! isset($data['tenant_id']) || ! isset($data['expires_at'])) {
                return null;
            }

            // Check if token is expired
            if (now()->isAfter($data['expires_at'])) {
                return null;
            }

            return $data;
        } catch (\Exception $e) {
            Log::error('Failed to decode consent token', [
                'token' => $token,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public static function generateConsentToken(int $practitionerId, string $tenantId): string
    {
        $data = [
            'practitioner_id' => $practitionerId,
            'tenant_id' => $tenantId,
            'expires_at' => now()->addDays(7)->toISOString(),
        ];

        return base64_encode(json_encode($data));
    }
}
