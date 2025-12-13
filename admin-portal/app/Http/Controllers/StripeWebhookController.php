<?php

namespace App\Http\Controllers;

use App\Services\RegistrationDataService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    /**
     * Handle incoming Stripe webhook events
     */
    public function handle(Request $request)
    {
        // Set Stripe API key
        Stripe::setApiKey(config('cashier.secret'));

        // Get webhook secret from config
        $webhookSecret = config('cashier.webhook.secret');

        // Verify webhook signature
        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                $request->header('Stripe-Signature'),
                $webhookSecret
            );
        } catch (\UnexpectedValueException $e) {
            Log::error('Stripe webhook: Invalid payload', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'Invalid payload'], 400);
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            Log::error('Stripe webhook: Invalid signature', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'Invalid signature'], 400);
        }

        // Log the event with full details
        Log::info('Stripe webhook received', [
            'type' => $event->type,
            'id' => $event->id,
            'object_type' => $event->data->object->object ?? 'unknown',
            'object_id' => $event->data->object->id ?? null,
            'created' => $event->created ?? null,
            'livemode' => $event->livemode ?? false,
        ]);

        // Handle different event types
        try {
            switch ($event->type) {
                case 'checkout.session.completed':
                    $this->handleCheckoutSessionCompleted($event->data->object);
                    break;

                case 'payment_intent.succeeded':
                    $this->handlePaymentIntentSucceeded($event->data->object);
                    break;

                case 'customer.subscription.created':
                    $this->handleSubscriptionCreated($event->data->object);
                    break;

                case 'customer.subscription.updated':
                    $this->handleSubscriptionUpdated($event->data->object);
                    break;

                case 'customer.subscription.deleted':
                    $this->handleSubscriptionDeleted($event->data->object);
                    break;

                case 'invoice.payment_succeeded':
                    $this->handleInvoicePaymentSucceeded($event->data->object);
                    break;

                case 'invoice.payment_failed':
                    $this->handleInvoicePaymentFailed($event->data->object);
                    break;

                default:
                    Log::info('Stripe webhook: Unhandled event type', ['type' => $event->type]);
            }

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            Log::error('Stripe webhook processing error', [
                'type' => $event->type,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['error' => 'Processing failed'], 500);
        }
    }

    /**
     * Handle checkout.session.completed event
     * This is the primary event for processing new registrations
     */
    private function handleCheckoutSessionCompleted($session)
    {
        Log::info('Processing checkout.session.completed', [
            'session_id' => $session->id,
            'customer_id' => $session->customer ?? null,
            'subscription_id' => $session->subscription ?? null,
            'payment_intent_id' => $session->payment_intent ?? null,
            'payment_status' => $session->payment_status ?? null,
            'status' => $session->status ?? null,
            'amount_total' => $session->amount_total ?? null,
            'currency' => $session->currency ?? null,
            'metadata' => $session->metadata ? json_decode(json_encode($session->metadata), true) : null,
        ]);

        // Get client_reference_id (which will be registration UUID, not full token)
        // We use UUID because full token (1180 chars) exceeds Stripe's 200 char limit
        $registrationUuid = $session->client_reference_id ?? null;
        $tokenSource = 'client_reference_id';

        // Fallback: Check metadata if client_reference_id is not available
        // This handles Payment Links created via API where metadata is passed
        if (! $registrationUuid && $session->metadata) {
            $metadata = json_decode(json_encode($session->metadata), true);
            if (isset($metadata['registration_uuid'])) {
                $registrationUuid = $metadata['registration_uuid'];
                $tokenSource = 'metadata.registration_uuid';
            } elseif (isset($metadata['registration_token'])) {
                // Legacy: if full token is in metadata, use it directly
                $token = $metadata['registration_token'];
                $tokenSource = 'metadata.registration_token';
            }
        }

        Log::info('Registration UUID extraction attempt', [
            'session_id' => $session->id,
            'client_reference_id' => $session->client_reference_id ?? null,
            'registration_uuid' => $registrationUuid,
            'token_source' => $tokenSource,
            'has_uuid' => ! empty($registrationUuid),
            'has_token' => isset($token) && ! empty($token),
            'metadata' => $session->metadata ? json_decode(json_encode($session->metadata), true) : null,
        ]);

        // If we have UUID, look up the full token from database
        if ($registrationUuid && ! isset($token)) {
            Log::info('Looking up registration token by UUID', [
                'session_id' => $session->id,
                'registration_uuid' => $registrationUuid,
            ]);

            $pendingRegistration = \App\Models\PendingRegistration::where('id', $registrationUuid)
                ->where('expires_at', '>', now())
                ->first();

            if (! $pendingRegistration) {
                Log::error('Pending registration not found or expired', [
                    'session_id' => $session->id,
                    'registration_uuid' => $registrationUuid,
                ]);

                return;
            }

            $token = $pendingRegistration->encrypted_token;

            Log::info('Registration token retrieved from database', [
                'session_id' => $session->id,
                'registration_uuid' => $registrationUuid,
                'token_length' => strlen($token),
            ]);
        }

        // If still no token, log warning and return
        if (! isset($token) || empty($token)) {
            Log::warning('Checkout session completed without registration token or UUID', [
                'session_id' => $session->id,
                'client_reference_id' => $session->client_reference_id ?? null,
                'registration_uuid' => $registrationUuid,
                'metadata_keys' => $session->metadata ? array_keys(json_decode(json_encode($session->metadata), true)) : [],
            ]);

            return;
        }

        // Decrypt registration data
        Log::info('Validating registration token', [
            'session_id' => $session->id,
            'registration_uuid' => $registrationUuid,
            'token_length' => strlen($token),
            'token_prefix' => substr($token, 0, 20),
            'token_source' => $tokenSource,
        ]);

        $registrationData = RegistrationDataService::validateToken($token);

        if (! $registrationData) {
            Log::error('Invalid or expired registration token', [
                'session_id' => $session->id,
                'registration_uuid' => $registrationUuid,
                'token_length' => strlen($token),
            ]);

            return;
        }

        Log::info('Registration token validated successfully', [
            'session_id' => $session->id,
            'tenant_id' => $registrationData['tenant_id'] ?? null,
            'admin_email' => $registrationData['admin_email'] ?? null,
            'plan_id' => $registrationData['plan_id'] ?? null,
        ]);

        // Extract payment metadata
        $customerId = $session->customer;
        $subscriptionId = $session->subscription;

        if (! $customerId || ! $subscriptionId) {
            Log::error('Missing customer or subscription ID in session', [
                'session_id' => $session->id,
                'customer_id' => $customerId,
                'subscription_id' => $subscriptionId,
            ]);

            return;
        }

        // Retrieve subscription to get quantity and other details
        try {
            $subscription = \Stripe\Subscription::retrieve($subscriptionId);
            $lineItem = $subscription->items->data[0] ?? null;
            $quantity = $lineItem ? $lineItem->quantity : 1;
            $amount = ($session->amount_total ?? 0) / 100; // Convert from cents
            $currency = $session->currency ?? 'usd';

            Log::info('Subscription retrieved successfully', [
                'subscription_id' => $subscriptionId,
                'subscription_status' => $subscription->status ?? null,
                'quantity' => $quantity,
                'amount' => $amount,
                'currency' => $currency,
                'trial_end' => $subscription->trial_end ?? null,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve subscription', [
                'subscription_id' => $subscriptionId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }

        // Registration UUID is already extracted from client_reference_id above
        // If we don't have it yet, try to find it by token as fallback
        if (! $registrationUuid && $token) {
            Log::info('Looking up pending registration by token (fallback)', [
                'token_length' => strlen($token),
            ]);

            $pendingRegistrationByToken = \App\Models\PendingRegistration::where('encrypted_token', $token)
                ->where('expires_at', '>', now())
                ->first();

            if ($pendingRegistrationByToken) {
                $registrationUuid = $pendingRegistrationByToken->id;
                Log::info('Found pending registration by token (fallback)', [
                    'registration_uuid' => $registrationUuid,
                    'email' => $pendingRegistrationByToken->email,
                ]);
            } else {
                Log::warning('Pending registration not found by token (fallback)', [
                    'token_length' => strlen($token),
                ]);
            }
        }

        // Dispatch tenant creation job - job handles everything (user creation, tenant creation, setup)
        Log::info('Dispatching tenant creation job', [
            'tenant_id' => $registrationData['tenant_id'],
            'company_name' => $registrationData['company_name'] ?? null,
            'stripe_customer_id' => $customerId,
            'subscription_id' => $subscriptionId,
        ]);

        \App\Jobs\CreateTenantJob::dispatch(
            $registrationData,
            $customerId,
            $subscriptionId,
            $session->payment_intent ?? null,
            $session->id,
            $quantity,
            $amount,
            $currency,
            $subscription->trial_end ?? null,
            $registrationUuid
        );

        Log::info('Tenant creation job dispatched successfully', [
            'tenant_id' => $registrationData['tenant_id'],
        ]);
    }

    /**
     * Handle payment_intent.succeeded event (for Payment Links)
     */
    private function handlePaymentIntentSucceeded($paymentIntent)
    {
        Log::info('Processing payment_intent.succeeded', [
            'payment_intent_id' => $paymentIntent->id,
            'status' => $paymentIntent->status ?? null,
            'amount' => $paymentIntent->amount ?? null,
            'currency' => $paymentIntent->currency ?? null,
            'customer_id' => $paymentIntent->customer ?? null,
            'created' => $paymentIntent->created ?? null,
            'metadata' => $paymentIntent->metadata ? json_decode(json_encode($paymentIntent->metadata), true) : null,
            'description' => $paymentIntent->description ?? null,
        ]);

        // Get registration UUID or token from metadata or description
        // Payment Intents from Payment Links may have UUID in client_reference_id
        $registrationUuid = null;
        $token = null;
        $tokenSource = null;

        if (isset($paymentIntent->metadata->client_reference_id)) {
            $clientRefId = $paymentIntent->metadata->client_reference_id;
            // Check if it's a UUID (36 chars) or full token (1180 chars)
            if (strlen($clientRefId) <= 200) {
                // Likely a UUID - look up token from database
                $registrationUuid = $clientRefId;
                $tokenSource = 'metadata.client_reference_id (UUID)';
            } else {
                // Full token (legacy)
                $token = $clientRefId;
                $tokenSource = 'metadata.client_reference_id (token)';
            }
        } elseif (isset($paymentIntent->metadata->registration_uuid)) {
            $registrationUuid = $paymentIntent->metadata->registration_uuid;
            $tokenSource = 'metadata.registration_uuid';
        } elseif (isset($paymentIntent->metadata->registration_token)) {
            $token = $paymentIntent->metadata->registration_token;
            $tokenSource = 'metadata.registration_token';
        } elseif ($paymentIntent->description) {
            $desc = $paymentIntent->description;
            // Check if description is UUID or token
            if (strlen($desc) <= 200 && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $desc)) {
                $registrationUuid = $desc;
                $tokenSource = 'description (UUID)';
            } else {
                $token = $desc;
                $tokenSource = 'description (token)';
            }
        }

        Log::info('Registration UUID/Token extraction attempt', [
            'payment_intent_id' => $paymentIntent->id,
            'registration_uuid' => $registrationUuid,
            'token_source' => $tokenSource,
            'has_uuid' => ! empty($registrationUuid),
            'has_token' => ! empty($token),
            'token_length' => $token ? strlen($token) : 0,
            'metadata_keys' => $paymentIntent->metadata ? array_keys(json_decode(json_encode($paymentIntent->metadata), true)) : [],
        ]);

        // If we have UUID but no token, look up token from database
        if ($registrationUuid && ! $token) {
            Log::info('Looking up registration token by UUID from payment intent', [
                'payment_intent_id' => $paymentIntent->id,
                'registration_uuid' => $registrationUuid,
            ]);

            $pendingRegistration = \App\Models\PendingRegistration::where('id', $registrationUuid)
                ->where('expires_at', '>', now())
                ->first();

            if (! $pendingRegistration) {
                Log::error('Pending registration not found or expired (payment intent)', [
                    'payment_intent_id' => $paymentIntent->id,
                    'registration_uuid' => $registrationUuid,
                ]);

                return;
            }

            $token = $pendingRegistration->encrypted_token;

            Log::info('Registration token retrieved from database (payment intent)', [
                'payment_intent_id' => $paymentIntent->id,
                'registration_uuid' => $registrationUuid,
                'token_length' => strlen($token),
            ]);
        }

        if (! $token) {
            Log::warning('Payment intent succeeded without registration token or UUID', [
                'payment_intent_id' => $paymentIntent->id,
                'metadata' => $paymentIntent->metadata ? json_decode(json_encode($paymentIntent->metadata), true) : null,
                'description' => $paymentIntent->description ?? null,
            ]);

            return;
        }

        // Decrypt registration data
        Log::info('Validating registration token', [
            'payment_intent_id' => $paymentIntent->id,
            'registration_uuid' => $registrationUuid,
            'token_source' => $tokenSource,
            'token_length' => strlen($token),
            'token_prefix' => substr($token, 0, 20),
        ]);

        $registrationData = RegistrationDataService::validateToken($token);

        if (! $registrationData) {
            Log::error('Invalid or expired registration token in payment intent', [
                'payment_intent_id' => $paymentIntent->id,
                'registration_uuid' => $registrationUuid,
                'token_source' => $tokenSource,
                'token_length' => strlen($token),
            ]);

            return;
        }

        Log::info('Registration token validated successfully', [
            'payment_intent_id' => $paymentIntent->id,
            'tenant_id' => $registrationData['tenant_id'] ?? null,
            'admin_email' => $registrationData['admin_email'] ?? null,
            'plan_id' => $registrationData['plan_id'] ?? null,
        ]);

        // Extract customer ID from payment intent
        $customerId = $paymentIntent->customer;

        if (! $customerId) {
            Log::error('Missing customer ID in payment intent', [
                'payment_intent_id' => $paymentIntent->id,
            ]);

            return;
        }

        Log::info('Customer ID found', [
            'payment_intent_id' => $paymentIntent->id,
            'customer_id' => $customerId,
        ]);

        // For Payment Links, we need to check if there's a subscription
        // Payment Links might create subscriptions, so check for that
        $subscriptionId = null;
        $subscription = null;
        $quantity = 1;
        $amount = ($paymentIntent->amount ?? 0) / 100; // Convert from cents
        $currency = $paymentIntent->currency ?? 'usd';

        try {
            Log::info('Checking for customer subscriptions', [
                'payment_intent_id' => $paymentIntent->id,
                'customer_id' => $customerId,
            ]);

            // Check if customer has subscriptions
            $subscriptions = \Stripe\Subscription::all([
                'customer' => $customerId,
                'status' => 'active',
                'limit' => 1,
            ]);

            Log::info('Subscription lookup result', [
                'payment_intent_id' => $paymentIntent->id,
                'customer_id' => $customerId,
                'subscription_count' => count($subscriptions->data),
            ]);

            if (count($subscriptions->data) > 0) {
                $subscription = $subscriptions->data[0];
                $subscriptionId = $subscription->id;
                $lineItem = $subscription->items->data[0] ?? null;
                $quantity = $lineItem ? $lineItem->quantity : 1;

                Log::info('Subscription found', [
                    'payment_intent_id' => $paymentIntent->id,
                    'subscription_id' => $subscriptionId,
                    'subscription_status' => $subscription->status ?? null,
                    'quantity' => $quantity,
                    'trial_end' => $subscription->trial_end ?? null,
                ]);
            } else {
                Log::info('No active subscriptions found for customer', [
                    'payment_intent_id' => $paymentIntent->id,
                    'customer_id' => $customerId,
                ]);
            }
        } catch (\Exception $e) {
            Log::warning('Could not retrieve subscription for payment intent', [
                'payment_intent_id' => $paymentIntent->id,
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // Continue without subscription - might be a one-time payment
        }

        // Registration UUID should already be extracted from client_reference_id above
        // If we don't have it yet, try to find it by token as fallback
        if (! isset($registrationUuid) && $token) {
            Log::info('Looking up pending registration by token (fallback)', [
                'token_length' => strlen($token),
                'token_source' => $tokenSource,
            ]);

            $pendingRegistrationByToken = \App\Models\PendingRegistration::where('encrypted_token', $token)
                ->where('expires_at', '>', now())
                ->first();

            if ($pendingRegistrationByToken) {
                $registrationUuid = $pendingRegistrationByToken->id;
                Log::info('Found pending registration by token (fallback)', [
                    'registration_uuid' => $registrationUuid,
                    'email' => $pendingRegistrationByToken->email,
                ]);
            } else {
                Log::warning('Pending registration not found by token (fallback)', [
                    'token_length' => strlen($token),
                    'token_source' => $tokenSource,
                ]);
            }
        }

        // Dispatch tenant creation job - job handles everything (user creation, tenant creation, setup)
        Log::info('Dispatching tenant creation job from payment intent', [
            'tenant_id' => $registrationData['tenant_id'],
            'company_name' => $registrationData['company_name'] ?? null,
            'stripe_customer_id' => $customerId,
            'subscription_id' => $subscriptionId,
            'payment_intent_id' => $paymentIntent->id,
        ]);

        \App\Jobs\CreateTenantJob::dispatch(
            $registrationData,
            $customerId,
            $subscriptionId,
            $paymentIntent->id,
            null, // sessionId not available for payment intent
            $quantity,
            $amount,
            $currency,
            $subscription && $subscription->trial_end ? $subscription->trial_end : null,
            $registrationUuid
        );

        Log::info('Tenant creation job dispatched successfully from payment intent', [
            'tenant_id' => $registrationData['tenant_id'],
            'payment_intent_id' => $paymentIntent->id,
        ]);
    }

    /**
     * Handle customer.subscription.created event
     */
    private function handleSubscriptionCreated($subscription)
    {
        Log::info('Subscription created', [
            'subscription_id' => $subscription->id,
            'customer_id' => $subscription->customer,
        ]);

        // Update tenant subscription details if exists
        $tenant = Tenant::where('stripe_id', $subscription->customer)->first();

        if ($tenant) {
            // Get quantity from subscription items
            $quantity = 1;
            if (isset($subscription->items->data) && count($subscription->items->data) > 0) {
                $lineItem = $subscription->items->data[0];
                $quantity = $lineItem->quantity ?? 1;
            }

            $tenant->update([
                'number_of_seats' => $quantity,
                'on_trial' => $subscription->trial_end ? true : false,
                'trial_ends_at' => $subscription->trial_end ?
                    Carbon::createFromTimestamp($subscription->trial_end) : null,
            ]);

            // Create licenses based on number_of_seats
            $this->createLicensesForTenant($tenant);
        }
    }

    /**
     * Handle customer.subscription.updated event
     */
    private function handleSubscriptionUpdated($subscription)
    {
        Log::info('Subscription updated', [
            'subscription_id' => $subscription->id,
            'customer_id' => $subscription->customer,
            'status' => $subscription->status,
        ]);

        // Update tenant subscription status
        $tenant = Tenant::where('stripe_id', $subscription->customer)->first();

        if ($tenant) {
            // Get quantity from subscription items
            $quantity = 1;
            if (isset($subscription->items->data) && count($subscription->items->data) > 0) {
                $lineItem = $subscription->items->data[0];
                $quantity = $lineItem->quantity ?? 1;
            }

            $oldSeats = $tenant->number_of_seats;

            $tenant->update([
                'number_of_seats' => $quantity,
                'billing_status' => $this->mapSubscriptionStatus($subscription->status),
                'on_trial' => $subscription->trial_end && $subscription->trial_end > time(),
                'trial_ends_at' => $subscription->trial_end ?
                    Carbon::createFromTimestamp($subscription->trial_end) : null,
            ]);

            // Create licenses based on number_of_seats (handles increases and decreases)
            $this->createLicensesForTenant($tenant);
        }
    }

    /**
     * Create licenses for tenant based on number_of_seats
     */
    private function createLicensesForTenant($tenant): void
    {
        try {
            $licenseService = new \App\Services\LicenseService;
            $licenseService->createLicensesForTenantSeats($tenant);
        } catch (\Exception $e) {
            Log::error('Failed to create licenses for tenant', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle customer.subscription.deleted event
     */
    private function handleSubscriptionDeleted($subscription)
    {
        Log::info('Subscription deleted', [
            'subscription_id' => $subscription->id,
            'customer_id' => $subscription->customer,
        ]);

        // Update tenant billing status
        $tenant = Tenant::where('stripe_id', $subscription->customer)->first();

        if ($tenant) {
            $tenant->update([
                'billing_status' => 'canceled',
                'subscription_ends_at' => now(),
            ]);
        }
    }

    /**
     * Handle invoice.payment_succeeded event
     */
    private function handleInvoicePaymentSucceeded($invoice)
    {
        Log::info('Invoice payment succeeded', [
            'invoice_id' => $invoice->id,
            'customer_id' => $invoice->customer,
            'amount' => $invoice->amount_paid / 100,
        ]);

        // Update tenant billing status if needed
        $tenant = Tenant::where('stripe_id', $invoice->customer)->first();

        if ($tenant) {
            $tenant->update([
                'billing_status' => 'active',
                'total_amount_paid' => $invoice->amount_paid / 100,
            ]);
        }
    }

    /**
     * Handle invoice.payment_failed event
     */
    private function handleInvoicePaymentFailed($invoice)
    {
        Log::warning('Invoice payment failed', [
            'invoice_id' => $invoice->id,
            'customer_id' => $invoice->customer,
        ]);

        // Update tenant billing status
        $tenant = Tenant::where('stripe_id', $invoice->customer)->first();

        if ($tenant) {
            $tenant->update([
                'billing_status' => 'past_due',
            ]);
        }
    }

    /**
     * Map Stripe subscription status to internal billing status
     */
    private function mapSubscriptionStatus(string $stripeStatus): string
    {
        return match ($stripeStatus) {
            'active', 'trialing' => 'active',
            'past_due' => 'past_due',
            'canceled', 'unpaid' => 'canceled',
            'incomplete', 'incomplete_expired' => 'incomplete',
            default => 'pending',
        };
    }
}
