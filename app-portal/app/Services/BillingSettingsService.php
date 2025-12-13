<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Cashier;
use Stripe\Stripe;

class BillingSettingsService
{
    /**
     * Get or create billing settings product in Stripe
     */
    public static function getBillingSettingsProduct()
    {
        Stripe::setApiKey(config('cashier.secret'));

        // Try to find existing billing settings product
        $products = Cashier::stripe()->products->all([
            'limit' => 100,
        ]);

        foreach ($products->data as $product) {
            if (isset($product->metadata['type']) && $product->metadata['type'] === 'billing_settings') {
                return $product;
            }
        }

        // Create new billing settings product if not found
        return Cashier::stripe()->products->create([
            'name' => 'Billing Settings',
            'description' => 'Application billing configuration',
            'metadata' => [
                'type' => 'billing_settings',
            ],
        ]);
    }

    /**
     * Fetch billing settings from Stripe
     */
    public static function fetchBillingSettingsFromStripe(): array
    {
        try {
            $product = self::getBillingSettingsProduct();
            $metadata = $product->metadata ?? [];

            return [
                'max_payment_attempts' => isset($metadata['max_payment_attempts'])
                    ? (int) $metadata['max_payment_attempts']
                    : config('billing.max_payment_attempts', 3),
                'trial_days' => isset($metadata['trial_days'])
                    ? (int) $metadata['trial_days']
                    : config('billing.trial_days', 30),
            ];
        } catch (\Exception $e) {
            Log::error('Failed to fetch billing settings from Stripe', [
                'error' => $e->getMessage(),
            ]);

            // Fallback to config defaults
            return [
                'max_payment_attempts' => config('billing.max_payment_attempts', 3),
                'trial_days' => config('billing.trial_days', 30),
            ];
        }
    }

    /**
     * Get trial days from Stripe (with fallback to config)
     */
    public static function getTrialDays(): int
    {
        $settings = self::fetchBillingSettingsFromStripe();

        return $settings['trial_days'];
    }

    /**
     * Get max payment attempts from Stripe (with fallback to config)
     */
    public static function getMaxPaymentAttempts(): int
    {
        $settings = self::fetchBillingSettingsFromStripe();

        return $settings['max_payment_attempts'];
    }
}
