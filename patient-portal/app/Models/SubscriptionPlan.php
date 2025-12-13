<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class SubscriptionPlan extends Model
{
    use CentralConnection;

    protected $fillable = [
        'name',
        'slug',
        'stripe_price_id',
        'stripe_payment_link',
        'stripe_product_id',
        'price',
        'currency',
        'billing_interval',
        'billing_interval_count',
        'description',
        'features',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'features' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'billing_interval_count' => 'integer',
        ];
    }

    /**
     * Scope to get only active plans
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    /**
     * Get display name for billing cycle
     */
    public function getBillingCycleAttribute(): string
    {
        if ($this->billing_interval_count === 6 && $this->billing_interval === 'month') {
            return 'Bi-Annually';
        }

        return $this->billing_interval_count > 1
            ? "{$this->billing_interval_count} {$this->billing_interval}s"
            : ucfirst($this->billing_interval).'ly';
    }

    /**
     * Get formatted price
     */
    public function getFormattedPriceAttribute(): string
    {
        return '$'.number_format($this->price, 2);
    }

    /**
     * Get the tenants that have this subscription plan
     */
    public function tenants()
    {
        return $this->hasMany(\App\Models\Tenant::class, 'subscription_plan_id');
    }
}
