<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class SubscriptionPlansSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Monthly Plan',
                'slug' => 'monthly',
                'price' => 29.99,
                'currency' => 'usd',
                'billing_interval' => 'month',
                'billing_interval_count' => 1,
                'description' => 'Perfect for small practices getting started',
                'features' => [
                    'Unlimited patients',
                    'Basic EMR features',
                    'Email support',
                    '10GB storage',
                    'Basic reporting',
                ],
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Bi-Annual Plan',
                'slug' => 'bi-annual',
                'price' => 149.99,
                'currency' => 'usd',
                'billing_interval' => 'month',
                'billing_interval_count' => 6,
                'description' => 'Save 17% with 6-month commitment',
                'features' => [
                    'Everything in Monthly',
                    'Priority support',
                    '50GB storage',
                    'Advanced reporting',
                    'Video consultations',
                ],
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'Yearly Plan',
                'slug' => 'yearly',
                'price' => 299.99,
                'currency' => 'usd',
                'billing_interval' => 'year',
                'billing_interval_count' => 1,
                'description' => 'Best value - Save 25% annually',
                'features' => [
                    'Everything in Bi-Annual',
                    '24/7 phone support',
                    'Unlimited storage',
                    'Custom integrations',
                    'Dedicated account manager',
                    'HIPAA compliance support',
                ],
                'is_active' => true,
                'sort_order' => 3,
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(
                ['slug' => $plan['slug']],
                $plan
            );
        }
    }
}
