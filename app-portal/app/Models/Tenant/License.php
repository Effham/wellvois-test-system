<?php

namespace App\Models\Tenant;

use App\Models\Practitioner;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class License extends Model
{
    protected $fillable = [
        'subscription_item_id',
        'license_key',
        'status',
        'assigned_at',
        'revoked_at',
        'notes',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    /**
     * Generate a unique license key
     */
    public static function generateLicenseKey(): string
    {
        do {
            $key = 'LIC-' . strtoupper(Str::random(8)) . '-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4));
        } while (self::where('license_key', $key)->exists());

        return $key;
    }

    /**
     * Get the subscription item this license belongs to
     * Uses Laravel Cashier's SubscriptionItem model
     */
    public function subscriptionItem(): BelongsTo
    {
        return $this->belongsTo(\Laravel\Cashier\Subscription\SubscriptionItem::class, 'subscription_item_id');
    }

    /**
     * Get the practitioners this license is assigned to
     */
    public function practitioners(): BelongsToMany
    {
        return $this->belongsToMany(Practitioner::class, 'practitioner_license')
            ->withPivot('assigned_at', 'assigned_by', 'notes')
            ->withTimestamps();
    }

    /**
     * Check if license is available
     */
    public function isAvailable(): bool
    {
        return $this->status === 'available';
    }

    /**
     * Check if license is assigned
     */
    public function isAssigned(): bool
    {
        return $this->status === 'assigned';
    }

    /**
     * Scope to get available licenses
     */
    public function scopeAvailable($query)
    {
        return $query->where('status', 'available');
    }

    /**
     * Scope to get assigned licenses
     */
    public function scopeAssigned($query)
    {
        return $query->where('status', 'assigned');
    }
}
