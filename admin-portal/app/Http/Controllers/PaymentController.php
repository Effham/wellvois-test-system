<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;

class PaymentController extends Controller
{
    /**
     * Show payment success page
     * Displayed after user completes Stripe payment
     */
    public function success(Request $request)
    {
        $sessionId = $request->query('session_id');

        if (! $sessionId) {
            Log::error('Payment success page accessed without session_id');

            return redirect()->route('register')->with('error', 'Invalid payment session.');
        }

        try {
            Log::info('Payment success page accessed', [
                'session_id' => $sessionId,
            ]);

            // Retrieve Stripe checkout session
            Stripe::setApiKey(config('cashier.secret'));
            $session = \Stripe\Checkout\Session::retrieve($sessionId);

            Log::info('Payment success page - retrieved checkout session', [
                'session_id' => $sessionId,
                'client_reference_id' => $session->client_reference_id ?? null,
                'customer_id' => $session->customer ?? null,
                'subscription_id' => $session->subscription ?? null,
                'status' => $session->status ?? null,
            ]);

            // Get registration UUID from client_reference_id (Payment Links pass UUID here)
            // Fallback to metadata if client_reference_id not available
            $registrationUuid = $session->client_reference_id ?? $session->metadata->registration_uuid ?? null;

            if (! $registrationUuid) {
                Log::error('Session missing registration UUID in client_reference_id or metadata', [
                    'session_id' => $sessionId,
                    'client_reference_id' => $session->client_reference_id ?? null,
                    'metadata' => $session->metadata ? json_decode(json_encode($session->metadata), true) : null,
                ]);

                return redirect()->route('register')->with('error', 'Registration data not found.');
            }

            Log::info('Retrieved registration UUID from Stripe session', [
                'session_id' => $sessionId,
                'registration_uuid' => $registrationUuid,
                'source' => $session->client_reference_id ? 'client_reference_id' : 'metadata',
            ]);

            // Retrieve pending registration from database
            $pendingRegistration = \App\Models\PendingRegistration::where('id', $registrationUuid)
                ->where('expires_at', '>', now())
                ->first();

            if (! $pendingRegistration) {
                Log::error('Pending registration not found or expired', [
                    'registration_uuid' => $registrationUuid,
                ]);

                return redirect()->route('register')->with('error', 'Registration expired.');
            }

            // Get token from pending registration
            $token = $pendingRegistration->encrypted_token;

            // Validate and decrypt token
            $registrationData = \App\Services\RegistrationDataService::validateToken($token);

            if (! $registrationData) {
                Log::error('Invalid registration token', [
                    'registration_uuid' => $registrationUuid,
                ]);

                return redirect()->route('register')->with('error', 'Invalid registration data.');
            }

            // Check if tenant already exists and is complete
            $tenant = \App\Models\Tenant::where('id', $registrationData['tenant_id'])->first();

            if ($tenant) {
                // Check if tenant creation is complete from tenant_user table (central DB)
                $isComplete = \Illuminate\Support\Facades\DB::table('tenant_user')
                    ->where('tenant_id', $tenant->id)
                    ->value('is_tenant_creation_complete') ?? false;

                if ($isComplete) {
                    // Tenant is complete, redirect directly to onboarding
                    Log::info('Tenant creation already complete, redirecting to onboarding', [
                        'tenant_id' => $tenant->id,
                    ]);

                    return redirect()->route('onboarding.index');
                }
            }

            Log::info('Redirecting to tenant creation status page', [
                'session_id' => $sessionId,
                'registration_uuid' => $registrationUuid,
                'tenant_id' => $registrationData['tenant_id'],
            ]);

            // Redirect to tenant creation status page
            return redirect()->route('tenant-creation.status', [
                'tenant_id' => $registrationData['tenant_id'],
                'registration_uuid' => $registrationUuid,
            ]);

        } catch (\Exception $e) {
            Log::error('Payment success page error', [
                'error' => $e->getMessage(),
                'session_id' => $sessionId ?? 'unknown',
            ]);

            return redirect()->route('register')->with('error', 'An error occurred.');
        }
    }
}
