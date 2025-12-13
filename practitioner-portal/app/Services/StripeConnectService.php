<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\Log;
use Stripe\Account;
use Stripe\AccountLink;
use Stripe\Exception\ApiErrorException;
use Stripe\Stripe;

class StripeConnectService
{
    public function __construct()
    {
        Stripe::setApiKey(config('cashier.secret'));
    }

    /**
     * Create a Stripe Custom Connected Account for a tenant
     */
    public function createConnectedAccount(Tenant $tenant): ?string
    {
        try {
            // Don't create if already exists
            if ($tenant->stripe_account_id) {
                return $tenant->stripe_account_id;
            }

            // Build business profile
            $businessProfile = [
                'name' => $tenant->data['company_name'] ?? $tenant->id,
            ];

            // Only add URL if domain is valid (not localhost)
            $domain = $tenant->domains->first()?->domain;
            if ($domain && ! str_ends_with($domain, '.localhost') && ! str_ends_with($domain, '.local')) {
                $businessProfile['url'] = 'https://'.$domain;
            }

            // Create Custom (fully managed) account
            $account = Account::create([
                'type' => 'custom',
                'country' => 'CA', // You can make this dynamic based on tenant
                'email' => $tenant->data['admin_email'] ?? null,
                'capabilities' => [
                    'card_payments' => ['requested' => true],
                    'transfers' => ['requested' => true],
                ],
                'business_type' => 'company', // or 'individual'
                'business_profile' => $businessProfile,
                'settings' => [
                    'payouts' => [
                        'schedule' => [
                            'interval' => 'daily', // or 'weekly', 'monthly'
                        ],
                    ],
                ],
            ]);

            // Update tenant with account ID
            $tenant->update([
                'stripe_account_id' => $account->id,
                'stripe_onboarding_complete' => false,
            ]);

            return $account->id;
        } catch (ApiErrorException $e) {
            Log::error('Failed to create Stripe connected account', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get connected account details
     */
    public function getAccount(string $accountId): ?Account
    {
        try {
            return Account::retrieve($accountId);
        } catch (ApiErrorException $e) {
            Log::error('Failed to retrieve Stripe account', [
                'account_id' => $accountId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Update connected account with business information
     *
     * @return array{success: bool, error?: string, stripe_error?: array}
     */
    public function updateAccountInformation(Tenant $tenant, array $data): array
    {
        try {
            if (! $tenant->stripe_account_id) {
                throw new \Exception('Tenant does not have a connected account');
            }

            $updateData = [];

            // Business information
            if (isset($data['business_type'])) {
                $updateData['business_type'] = $data['business_type'];
            }

            // Company information (if business_type is company)
            if (isset($data['company'])) {
                $updateData['company'] = $data['company'];
            }

            // Individual information (if business_type is individual or for representative)
            if (isset($data['individual'])) {
                $updateData['individual'] = $data['individual'];
            }

            // Business profile
            if (isset($data['business_profile'])) {
                $updateData['business_profile'] = $data['business_profile'];
            }

            // External account (bank account)
            if (isset($data['external_account'])) {
                $updateData['external_account'] = $data['external_account'];
            }

            // Terms of service acceptance
            if (isset($data['tos_acceptance'])) {
                $updateData['tos_acceptance'] = $data['tos_acceptance'];
            }

            Account::update($tenant->stripe_account_id, $updateData);

            // Refresh account requirements
            $this->refreshAccountRequirements($tenant);

            return ['success' => true];
        } catch (ApiErrorException $e) {
            Log::error('Failed to update Stripe account', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'stripe_error' => $e->getJsonBody() ?? null,
            ]);

            // Extract Stripe error details
            $stripeError = [
                'message' => $e->getMessage(),
                'type' => $e->getStripeCode() ?? null,
                'code' => $e->getCode() ?? null,
            ];

            // Try to get more detailed error information
            if ($e->getJsonBody() && isset($e->getJsonBody()['error'])) {
                $errorBody = $e->getJsonBody()['error'];
                $stripeError['message'] = $errorBody['message'] ?? $e->getMessage();
                $stripeError['type'] = $errorBody['type'] ?? $stripeError['type'];
                $stripeError['code'] = $errorBody['code'] ?? $stripeError['code'];
                $stripeError['param'] = $errorBody['param'] ?? null;
            }

            return [
                'success' => false,
                'error' => $stripeError['message'],
                'stripe_error' => $stripeError,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to update Stripe account', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Refresh and store account requirements
     */
    public function refreshAccountRequirements(Tenant $tenant): void
    {
        try {
            if (! $tenant->stripe_account_id) {
                return;
            }

            $account = $this->getAccount($tenant->stripe_account_id);

            if (! $account) {
                return;
            }

            // Check if account is fully onboarded
            $isComplete = empty($account->requirements->currently_due) &&
                         empty($account->requirements->eventually_due) &&
                         $account->charges_enabled &&
                         $account->payouts_enabled;

            $tenant->update([
                'stripe_requirements' => [
                    'currently_due' => $account->requirements->currently_due,
                    'eventually_due' => $account->requirements->eventually_due,
                    'past_due' => $account->requirements->past_due,
                    'disabled_reason' => $account->requirements->disabled_reason,
                    'charges_enabled' => $account->charges_enabled,
                    'payouts_enabled' => $account->payouts_enabled,
                ],
                'stripe_onboarding_complete' => $isComplete,
                'stripe_verified_at' => $isComplete ? now() : null,
            ]);
        } catch (ApiErrorException $e) {
            Log::error('Failed to refresh account requirements', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Check if account can accept payments
     */
    public function canAcceptPayments(Tenant $tenant): bool
    {
        if (! $tenant->stripe_account_id) {
            return false;
        }

        $account = $this->getAccount($tenant->stripe_account_id);

        return $account && $account->charges_enabled;
    }

    /**
     * Check if account can receive payouts
     */
    public function canReceivePayouts(Tenant $tenant): bool
    {
        if (! $tenant->stripe_account_id) {
            return false;
        }

        $account = $this->getAccount($tenant->stripe_account_id);

        return $account && $account->payouts_enabled;
    }

    /**
     * Get missing requirements for account
     */
    public function getMissingRequirements(Tenant $tenant): array
    {
        if (! $tenant->stripe_requirements) {
            $this->refreshAccountRequirements($tenant);
            $tenant->refresh();
        }

        return $tenant->stripe_requirements ?? [];
    }

    /**
     * Create a payment intent with application fee (platform cut)
     *
     * @param  Tenant  $tenant  The tenant receiving the payment
     * @param  int  $amount  Amount in cents
     * @param  int  $applicationFeeAmount  Platform fee in cents
     * @param  array  $metadata  Additional metadata
     */
    public function createPaymentIntent(
        Tenant $tenant,
        int $amount,
        int $applicationFeeAmount,
        array $metadata = []
    ): ?\Stripe\PaymentIntent {
        try {
            if (! $tenant->stripe_account_id) {
                throw new \Exception('Tenant does not have a connected account');
            }

            if (! $this->canAcceptPayments($tenant)) {
                throw new \Exception('Tenant account cannot accept payments yet');
            }

            return \Stripe\PaymentIntent::create([
                'amount' => $amount,
                'currency' => config('cashier.currency'),
                'application_fee_amount' => $applicationFeeAmount,
                'metadata' => array_merge([
                    'tenant_id' => $tenant->id,
                ], $metadata),
            ], [
                'stripe_account' => $tenant->stripe_account_id,
            ]);
        } catch (ApiErrorException $e) {
            Log::error('Failed to create payment intent', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Create an AccountLink for onboarding or updating account information
     * This redirects users to Stripe's hosted onboarding/update page
     *
     * @param  Tenant  $tenant  The tenant
     * @param  string  $returnUrl  URL to return to after completion
     * @param  bool  $isUpdate  If true, creates account_update link; otherwise account_onboarding
     * @return string|null  The AccountLink URL or null on failure
     */
    public function createAccountLink(Tenant $tenant, string $returnUrl, bool $isUpdate = false): ?string
    {
        try {
            if (! $tenant->stripe_account_id) {
                throw new \Exception('Tenant does not have a connected account');
            }

            $accountLink = AccountLink::create([
                'account' => $tenant->stripe_account_id,
                'refresh_url' => $returnUrl,
                'return_url' => $returnUrl,
                'type' => $isUpdate ? 'account_update' : 'account_onboarding',
            ]);

            return $accountLink->url;
        } catch (ApiErrorException $e) {
            Log::error('Failed to create AccountLink', [
                'tenant_id' => $tenant->id,
                'is_update' => $isUpdate,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Create an AccountLink for identity verification (deprecated - use createAccountLink instead)
     * @deprecated Use createAccountLink() instead
     */
    public function createIdentityVerificationLink(Tenant $tenant, string $returnUrl): ?string
    {
        return $this->createAccountLink($tenant, $returnUrl, false);
    }
}
