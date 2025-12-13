<?php

namespace App\Console\Commands;

use App\Models\SubscriptionPlan;
use Illuminate\Console\Command;

class SyncPlansFromEnv extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'plans:sync
                            {--dry-run : Preview changes without making them}
                            {--force : Overwrite existing plans}';

    /**
     * The console command description.
     */
    protected $description = 'Sync subscription plans from ENV configuration to database';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $isDryRun = $this->option('dry-run');
        $isForce = $this->option('force');

        if ($isDryRun) {
            $this->info('🔍 DRY RUN MODE - No changes will be made');
            $this->newLine();
        }

        // Parse all PLAN_* env variables
        $plans = $this->parseEnvPlans();

        if (empty($plans)) {
            $this->error('No plans found in environment variables.');
            $this->info('Expected format: PLAN_1_NAME, PLAN_1_SLUG, etc.');

            return self::FAILURE;
        }

        $this->info("Found {$plans->count()} plan(s) in ENV configuration");
        $this->newLine();

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        foreach ($plans as $planNumber => $planData) {
            $this->info("Processing PLAN_{$planNumber}...");

            // Validate required fields
            $validation = $this->validatePlanData($planData, $planNumber);
            if ($validation !== true) {
                $this->error("  ✗ {$validation}");
                $errors[] = "PLAN_{$planNumber}: {$validation}";
                $skipped++;
                $this->newLine();

                continue;
            }

            // Check if plan already exists
            $existingPlan = SubscriptionPlan::where('slug', $planData['slug'])->first();

            if ($existingPlan && ! $isForce) {
                $this->warn("  ⊘ Plan '{$planData['name']}' already exists (use --force to overwrite)");
                $skipped++;
                $this->newLine();

                continue;
            }

            // Display plan details
            $this->line("  Name: {$planData['name']}");
            $this->line("  Slug: {$planData['slug']}");
            $this->line("  Price: \${$planData['price']} {$planData['currency']}");
            $this->line("  Interval: {$planData['billing_interval']}");
            $this->line("  Payment Link: {$planData['stripe_payment_link']}");

            if (! $isDryRun) {
                try {
                    if ($existingPlan) {
                        // Update existing plan
                        $existingPlan->update($planData);
                        $this->info('  ✓ Updated successfully');
                        $updated++;
                    } else {
                        // Create new plan
                        SubscriptionPlan::create($planData);
                        $this->info('  ✓ Created successfully');
                        $created++;
                    }
                } catch (\Exception $e) {
                    $this->error("  ✗ Error: {$e->getMessage()}");
                    $errors[] = "PLAN_{$planNumber}: {$e->getMessage()}";
                    $skipped++;
                }
            } else {
                if ($existingPlan) {
                    $this->comment('  → Would update');
                } else {
                    $this->comment('  → Would create');
                }
            }

            $this->newLine();
        }

        // Summary
        $this->newLine();
        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('Summary');
        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if ($isDryRun) {
            $this->line("Total plans: {$plans->count()}");
            $this->line("Would create: {$created}");
            $this->line("Would update: {$updated}");
            $this->line("Would skip: {$skipped}");
        } else {
            $this->line("Created: {$created}");
            $this->line("Updated: {$updated}");
            $this->line("Skipped: {$skipped}");
        }

        if (! empty($errors)) {
            $this->newLine();
            $this->error('Errors:');
            foreach ($errors as $error) {
                $this->error("  - {$error}");
            }
        }

        $this->newLine();

        return empty($errors) ? self::SUCCESS : self::FAILURE;
    }

    /**
     * Parse all PLAN_* env variables
     */
    private function parseEnvPlans(): \Illuminate\Support\Collection
    {
        $plans = collect();
        $planNumbers = [];

        // Find all plan numbers by looking for PLAN_*_NAME variables
        foreach ($_ENV as $key => $value) {
            if (preg_match('/^PLAN_(\d+)_NAME$/', $key, $matches)) {
                $planNumbers[] = $matches[1];
            }
        }

        // Sort plan numbers
        sort($planNumbers, SORT_NUMERIC);

        // If no PLAN_*_NAME keys found, try legacy STRIPE_* format
        if (empty($planNumbers)) {
            return $this->parseLegacyStripeKeys();
        }

        // Parse each plan
        foreach ($planNumbers as $planNumber) {
            $planData = [
                'name' => env("PLAN_{$planNumber}_NAME"),
                'slug' => env("PLAN_{$planNumber}_SLUG"),
                'stripe_product_id' => env("PLAN_{$planNumber}_STRIPE_PRODUCT_ID"),
                'stripe_price_id' => env("PLAN_{$planNumber}_STRIPE_PRICE_ID"),
                'stripe_payment_link' => env("PLAN_{$planNumber}_STRIPE_PAYMENT_LINK"),
                'price' => env("PLAN_{$planNumber}_PRICE"),
                'currency' => env("PLAN_{$planNumber}_CURRENCY", 'usd'),
                'billing_interval' => env("PLAN_{$planNumber}_BILLING_INTERVAL"),
                'billing_interval_count' => env("PLAN_{$planNumber}_BILLING_INTERVAL_COUNT", 1),
                'description' => env("PLAN_{$planNumber}_DESCRIPTION"),
                'features' => $this->parseFeatures(env("PLAN_{$planNumber}_FEATURES")),
                'is_active' => filter_var(env("PLAN_{$planNumber}_IS_ACTIVE", true), FILTER_VALIDATE_BOOLEAN),
                'sort_order' => env("PLAN_{$planNumber}_SORT_ORDER", $planNumber),
            ];

            $plans->put($planNumber, $planData);
        }

        return $plans;
    }

    /**
     * Parse comma-separated features string to array
     */
    private function parseFeatures(?string $featuresString): array
    {
        if (empty($featuresString)) {
            return [];
        }

        return array_map('trim', explode(',', $featuresString));
    }

    /**
     * Validate plan data
     */
    private function validatePlanData(array $planData, $planNumber): string|bool
    {
        // Required fields (stripe_product_id is optional - can be fetched from Stripe API)
        $required = [
            'name' => 'NAME',
            'slug' => 'SLUG',
            'stripe_price_id' => 'STRIPE_PRICE_ID',
            'stripe_payment_link' => 'STRIPE_PAYMENT_LINK',
            'price' => 'PRICE',
            'billing_interval' => 'BILLING_INTERVAL',
        ];

        foreach ($required as $field => $envKey) {
            if (empty($planData[$field])) {
                return "Missing required field: PLAN_{$planNumber}_{$envKey}";
            }
        }

        // Validate billing interval
        if (! in_array($planData['billing_interval'], ['month', 'year'])) {
            return "Invalid billing_interval. Must be 'month' or 'year'";
        }

        // Validate price is numeric
        if (! is_numeric($planData['price'])) {
            return 'Price must be numeric';
        }

        // Validate payment link is a URL
        if (! filter_var($planData['stripe_payment_link'], FILTER_VALIDATE_URL)) {
            return 'stripe_payment_link must be a valid URL';
        }

        return true;
    }

    /**
     * Parse legacy STRIPE_MONTHLY_* and STRIPE_YEARLY_* env variables
     */
    private function parseLegacyStripeKeys(): \Illuminate\Support\Collection
    {
        $plans = collect();
        $currency = env('CASHIER_CURRENCY', 'usd');

        // Check for monthly plan
        if (env('STRIPE_MONTHLY_PRICE_ID') && env('STRIPE_MONTHLY_PAYMENT_LINK')) {
            $this->info('Detected STRIPE_MONTHLY_* keys - auto-generating monthly plan...');

            $plans->put(1, [
                'name' => env('STRIPE_MONTHLY_NAME', 'Monthly Plan'),
                'slug' => env('STRIPE_MONTHLY_SLUG', 'monthly'),
                'stripe_price_id' => env('STRIPE_MONTHLY_PRICE_ID'),
                'stripe_payment_link' => env('STRIPE_MONTHLY_PAYMENT_LINK'),
                'stripe_product_id' => $this->getProductIdFromPriceId(env('STRIPE_MONTHLY_PRICE_ID')),
                'price' => $this->getPriceFromStripe(env('STRIPE_MONTHLY_PRICE_ID')),
                'currency' => $currency,
                'billing_interval' => 'month',
                'billing_interval_count' => 1,
                'description' => env('STRIPE_MONTHLY_DESCRIPTION', 'Monthly subscription plan'),
                'features' => $this->parseFeatures(env('STRIPE_MONTHLY_FEATURES')),
                'is_active' => true,
                'sort_order' => 1,
            ]);
        }

        // Check for yearly plan
        if (env('STRIPE_YEARLY_PRICE_ID') && env('STRIPE_YEARLY_PAYMENT_LINK')) {
            $this->info('Detected STRIPE_YEARLY_* keys - auto-generating yearly plan...');

            $plans->put(2, [
                'name' => env('STRIPE_YEARLY_NAME', 'Yearly Plan'),
                'slug' => env('STRIPE_YEARLY_SLUG', 'yearly'),
                'stripe_price_id' => env('STRIPE_YEARLY_PRICE_ID'),
                'stripe_payment_link' => env('STRIPE_YEARLY_PAYMENT_LINK'),
                'stripe_product_id' => $this->getProductIdFromPriceId(env('STRIPE_YEARLY_PRICE_ID')),
                'price' => $this->getPriceFromStripe(env('STRIPE_YEARLY_PRICE_ID')),
                'currency' => $currency,
                'billing_interval' => 'year',
                'billing_interval_count' => 1,
                'description' => env('STRIPE_YEARLY_DESCRIPTION', 'Yearly subscription plan'),
                'features' => $this->parseFeatures(env('STRIPE_YEARLY_FEATURES')),
                'is_active' => true,
                'sort_order' => 2,
            ]);
        }

        return $plans;
    }

    /**
     * Get Stripe product ID from price ID using Stripe API
     */
    private function getProductIdFromPriceId(string $priceId): string
    {
        try {
            $stripe = new \Stripe\StripeClient(env('STRIPE_SECRET'));
            $price = $stripe->prices->retrieve($priceId);

            return $price->product;
        } catch (\Exception $e) {
            $this->warn("  ⚠ Could not fetch product ID from Stripe: {$e->getMessage()}");

            return 'prod_unknown';
        }
    }

    /**
     * Get price amount from Stripe API using price ID
     */
    private function getPriceFromStripe(string $priceId): string
    {
        try {
            $stripe = new \Stripe\StripeClient(env('STRIPE_SECRET'));
            $price = $stripe->prices->retrieve($priceId);

            // Convert cents to dollars/currency unit
            return number_format($price->unit_amount / 100, 2, '.', '');
        } catch (\Exception $e) {
            $this->warn("  ⚠ Could not fetch price from Stripe: {$e->getMessage()}");

            return '0.00';
        }
    }
}