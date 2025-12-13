<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\StripeConnectService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Stripe\Exception\ApiErrorException;

class MarketplacePaymentController extends Controller
{
    public function __construct(
        protected StripeConnectService $stripeConnectService
    ) {}

    /**
     * Show the public payment page
     * 
     * @param Request $request
     * @param string|null $appointmentId Optional appointment ID for context
     */
    public function show(Request $request, ?string $appointmentId = null)
    {
        $tenant = tenancy()->tenant;

        // Check if tenant can accept payments
        if (! $tenant->stripe_account_id || ! $this->stripeConnectService->canAcceptPayments($tenant)) {
            return Inertia::render('Payment/Unavailable', [
                'message' => 'This organization is not set up to accept payments yet.',
            ]);
        }

        // Get appointment details if provided
        $appointment = null;
        $amount = null;
        $description = null;

        if ($appointmentId) {
            $appointment = \App\Models\Tenant\Appointment::find($appointmentId);
            
            if ($appointment) {
                // You can customize this based on your appointment structure
                $amount = $appointment->amount ?? null; // in cents
                $description = "Appointment with {$appointment->practitioner->user->name}";
            }
        }

        // Get platform fee percentage from config (default 10%)
        $platformFeePercentage = config('services.stripe.platform_fee_percentage', 10);

        return Inertia::render('Payment/Show', [
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->data['company_name'] ?? $tenant->id,
                'stripe_account_id' => $tenant->stripe_account_id,
            ],
            'appointment' => $appointment,
            'amount' => $amount,
            'description' => $description,
            'platformFeePercentage' => $platformFeePercentage,
            'stripePublishableKey' => config('cashier.key'),
        ]);
    }

    /**
     * Create a payment intent
     */
    public function createPaymentIntent(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|integer|min:100', // Minimum $1.00
            'description' => 'nullable|string|max:255',
            'appointment_id' => 'nullable|string',
        ]);

        $tenant = tenancy()->tenant;

        if (! $tenant->stripe_account_id) {
            return response()->json([
                'error' => 'Payment setup incomplete',
            ], 400);
        }

        // Calculate platform fee (e.g., 10% of the total amount)
        $platformFeePercentage = config('services.stripe.platform_fee_percentage', 10);
        $applicationFeeAmount = (int) ($validated['amount'] * ($platformFeePercentage / 100));

        $metadata = [
            'tenant_id' => $tenant->id,
            'description' => $validated['description'] ?? 'Payment',
        ];

        if (isset($validated['appointment_id'])) {
            $metadata['appointment_id'] = $validated['appointment_id'];
        }

        $paymentIntent = $this->stripeConnectService->createPaymentIntent(
            $tenant,
            $validated['amount'],
            $applicationFeeAmount,
            $metadata
        );

        if (! $paymentIntent) {
            return response()->json([
                'error' => 'Failed to create payment intent',
            ], 500);
        }

        return response()->json([
            'clientSecret' => $paymentIntent->client_secret,
            'amount' => $validated['amount'],
            'applicationFeeAmount' => $applicationFeeAmount,
        ]);
    }

    /**
     * Handle successful payment
     */
    public function success(Request $request)
    {
        $paymentIntentId = $request->query('payment_intent');
        
        return Inertia::render('Payment/Success', [
            'paymentIntentId' => $paymentIntentId,
            'message' => 'Payment successful! Thank you for your payment.',
        ]);
    }

    /**
     * Handle canceled payment
     */
    public function cancel(Request $request)
    {
        return Inertia::render('Payment/Cancel', [
            'message' => 'Payment was canceled.',
        ]);
    }

    /**
     * Get payment status
     */
    public function status(Request $request, string $paymentIntentId)
    {
        try {
            $tenant = tenancy()->tenant;
            
            \Stripe\Stripe::setApiKey(config('cashier.secret'));
            $paymentIntent = \Stripe\PaymentIntent::retrieve(
                $paymentIntentId,
                ['stripe_account' => $tenant->stripe_account_id]
            );

            return response()->json([
                'status' => $paymentIntent->status,
                'amount' => $paymentIntent->amount,
                'currency' => $paymentIntent->currency,
                'metadata' => $paymentIntent->metadata,
            ]);
        } catch (ApiErrorException $e) {
            return response()->json([
                'error' => 'Failed to retrieve payment status',
            ], 400);
        }
    }
}
