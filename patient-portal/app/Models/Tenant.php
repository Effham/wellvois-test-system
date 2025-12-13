<?php

namespace App\Models;

use Laravel\Cashier\Billable;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\CentralConnection;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use Billable, CentralConnection, HasDatabase, HasDomains, LogsActivity;

    /**
     * Define actual database columns (not stored in data JSON)
     * Only Stripe/Billing columns that exist in the database schema
     */
    public static function getCustomColumns(): array
    {
        return [
            'id',
            // Cashier columns (added by create_customer_columns migration)
            'stripe_id',
            'stripe_payment_intent_id',
            'pm_type',
            'pm_last_four',
            'trial_ends_at',
            // Billing columns (added by add_billing_columns_to_tenants_table migration)
            'subscription_plan_id',
            'billing_status',
            'requires_billing_setup',
            'billing_completed_at',
            'on_trial',
            'subscribed_at',
            'subscription_ends_at',
            // Payment metadata columns (for tracking payment details)
            'number_of_seats',
            'total_amount_paid',
            'payment_currency',
            'payment_metadata',
            // Stripe Connect columns (for marketplace functionality)
            'stripe_account_id',
            'stripe_onboarding_complete',
            'stripe_requirements',
            'stripe_verified_at',
        ];
    }

    protected function casts(): array
    {
        return [
            'is_onboarding' => 'boolean',
            'requires_billing_setup' => 'boolean',
            'on_trial' => 'boolean',
            'billing_completed_at' => 'datetime',
            'trial_ends_at' => 'datetime',
            'subscribed_at' => 'datetime',
            'subscription_ends_at' => 'datetime',
            'stripe_onboarding_complete' => 'boolean',
            'stripe_requirements' => 'array',
            'stripe_verified_at' => 'datetime',
            // Payment metadata casts
            'number_of_seats' => 'integer',
            'total_amount_paid' => 'decimal:2',
            'payment_metadata' => 'array',
        ];
    }

    /**
     * Get the subscription plan for this tenant
     */
    public function subscriptionPlan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty();
    }

    public function getActivitylogDescription(): string
    {
        $tenantName = $this->id;

        $action = activity()->description();

        switch ($action) {
            case 'created':
                return "Tenant '{$tenantName}' was created.";
            case 'updated':
                return "Tenant '{$tenantName}' was updated.";
            case 'deleted':
                return "Tenant '{$tenantName}' was deleted.";
            default:
                return "Tenant '{$tenantName}' was modified.";
        }
    }

    public function users()
    {
        return $this->belongsToMany(\App\Models\User::class, 'tenant_user', 'tenant_id', 'user_id');
    }

    /**
     * Check if tenant is currently on an active trial period
     * Uses Cashier's subscription trial management per Laravel Cashier docs
     * Reference: https://laravel.com/docs/12.x/billing#subscription-trials
     */
    public function isOnTrial(): bool
    {
        // First check Cashier's subscription trial status
        $subscription = $this->subscription('default');
        if ($subscription && $subscription->onTrial()) {
            return true;
        }

        // Fallback to tenant's trial_ends_at (synced by Cashier)
        return $this->on_trial
            && $this->trial_ends_at
            && $this->trial_ends_at->isFuture();
    }

    /**
     * Check if trial has expired
     * Uses Cashier's subscription trial management per Laravel Cashier docs
     * Reference: https://laravel.com/docs/12.x/billing#subscription-trials
     */
    public function hasTrialExpired(): bool
    {
        // First check Cashier's subscription trial status
        $subscription = $this->subscription('default');
        if ($subscription) {
            // If subscription exists and trial has ended
            if ($subscription->trial_ends_at && $subscription->trial_ends_at->isPast()) {
                return true;
            }
            // If subscription is active (not on trial), trial has expired
            if ($subscription->valid() && ! $subscription->onTrial()) {
                return $this->on_trial; // Was on trial but now active
            }
        }

        // Fallback to tenant's trial_ends_at (synced by Cashier)
        return $this->on_trial
            && $this->trial_ends_at
            && $this->trial_ends_at->isPast();
    }

    /**
     * Check if tenant requires billing setup (either no payment or trial expired)
     */
    public function requiresBilling(): bool
    {
        // If trial is active, don't require billing
        if ($this->isOnTrial()) {
            return false;
        }

        // Otherwise, check the normal billing requirements
        return $this->requires_billing_setup && $this->billing_status === 'pending';
    }

    /**
     * Check if subscription has ended (canceled, past_due, or no active subscription)
     */
    public function hasSubscriptionEnded(): bool
    {
        $subscription = $this->subscription('default');

        // If no subscription exists, check billing status
        if (! $subscription) {
            return in_array($this->billing_status, ['canceled', 'past_due', 'unpaid']);
        }

        // Check if subscription is canceled or ended
        if ($subscription->canceled() || $subscription->ended()) {
            return true;
        }

        // Check if subscription status indicates it's ended
        $endedStatuses = ['canceled', 'unpaid', 'past_due', 'incomplete_expired'];
        if (in_array($subscription->stripe_status, $endedStatuses)) {
            return true;
        }

        // Check if subscription has an ends_at date that has passed
        if ($subscription->ends_at && $subscription->ends_at->isPast()) {
            return true;
        }

        return false;
    }

    /**
     * Check if user is admin in this tenant
     */
    public function isUserAdmin(\App\Models\User $user): bool
    {
        // Initialize tenant context
        tenancy()->initialize($this);

        try {
            // Find user in tenant database
            $tenantUser = \App\Models\User::where('email', $user->email)->first();

            if (! $tenantUser) {
                return false;
            }

            // Check if user has Admin role
            return $tenantUser->hasRole('Admin');
        } finally {
            tenancy()->end();
        }
    }
}
