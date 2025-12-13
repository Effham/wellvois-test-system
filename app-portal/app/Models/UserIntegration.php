<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserIntegration extends Model
{
    use HasFactory;

    /**
     * The database connection that should be used by the model.
     */
    protected $connection = 'landlord';

    protected $fillable = [
        'user_id',
        'name',
        'type',
        'provider',
        'is_active',
        'is_configured',
        'status',
        'description',
        'icon_url',
        'color',
        'configuration',
        'credentials',
        'response_data',
        'settings',
        'last_sync_at',
        'last_error',
        'enable_calendar_conflicts',
        'save_appointments_to_calendar',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_configured' => 'boolean',
        'configuration' => 'array',
        'credentials' => 'array',
        'response_data' => 'array',
        'settings' => 'array',
        'last_sync_at' => 'datetime',
        'enable_calendar_conflicts' => 'boolean',
        'save_appointments_to_calendar' => 'boolean',
    ];

    // Integration types (same as tenant integrations)
    const TYPE_CALENDAR = 'calendar';

    const TYPE_PAYMENT = 'payment';

    const TYPE_COMMUNICATION = 'communication';

    const TYPE_STORAGE = 'storage';

    const TYPE_ANALYTICS = 'analytics';

    // Integration providers (same as tenant integrations)
    const PROVIDER_GOOGLE = 'google';

    const PROVIDER_MICROSOFT = 'microsoft';

    const PROVIDER_PAYPAL = 'paypal';

    const PROVIDER_STRIPE = 'stripe';

    const PROVIDER_MONERIS = 'moneris';

    const PROVIDER_ZOOM = 'zoom';

    const PROVIDER_SLACK = 'slack';

    // Status types
    const STATUS_INACTIVE = 'inactive';

    const STATUS_ACTIVE = 'active';

    const STATUS_ERROR = 'error';

    const STATUS_PENDING = 'pending';

    /**
     * Relationship with User
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get integrations by type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Get active integrations
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get configured integrations
     */
    public function scopeConfigured($query)
    {
        return $query->where('is_configured', true);
    }

    /**
     * Get integrations for a specific user
     */
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Check if integration is connected
     */
    public function isConnected(): bool
    {
        return $this->is_active && $this->is_configured && $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Get the display status
     */
    protected function displayStatus(): Attribute
    {
        return Attribute::make(
            get: function () {
                if ($this->isConnected()) {
                    return 'Connected';
                }

                if ($this->status === self::STATUS_ERROR) {
                    return 'Error';
                }

                if ($this->status === self::STATUS_PENDING) {
                    return 'Connecting...';
                }

                return 'Not Connected';
            }
        );
    }

    /**
     * Get the status color
     */
    protected function statusColor(): Attribute
    {
        return Attribute::make(
            get: function () {
                if ($this->isConnected()) {
                    return 'green';
                }

                if ($this->status === self::STATUS_ERROR) {
                    return 'red';
                }

                if ($this->status === self::STATUS_PENDING) {
                    return 'yellow';
                }

                return 'gray';
            }
        );
    }

    /**
     * Get default user integrations for a user
     */
    public static function getDefaultUserIntegrationsForUser($userId): array
    {
        $existingIntegrations = self::forUser($userId)->get()->keyBy('provider');
        $defaultIntegrations = Integration::getDefaultUserIntegrations();

        return collect($defaultIntegrations)->map(function ($integration) use ($existingIntegrations, $userId) {
            $existing = $existingIntegrations->get($integration['provider']);

            if ($existing) {
                return array_merge($integration, [
                    'id' => $existing->id,
                    'user_id' => $userId,
                    'is_active' => $existing->is_active,
                    'is_configured' => $existing->is_configured,
                    'status' => $existing->status,
                    'display_status' => $existing->display_status,
                    'status_color' => $existing->status_color,
                    'last_sync_at' => $existing->last_sync_at,
                    'last_error' => $existing->last_error,
                    'enable_calendar_conflicts' => $existing->enable_calendar_conflicts ?? true, // Use database field
                    'save_appointments_to_calendar' => $existing->save_appointments_to_calendar ?? true, // Default enabled
                ]);
            }

            return array_merge($integration, [
                'id' => null,
                'user_id' => $userId,
                'is_active' => false,
                'is_configured' => false,
                'status' => self::STATUS_INACTIVE,
                'display_status' => 'Not Connected',
                'status_color' => 'gray',
                'last_sync_at' => null,
                'last_error' => null,
                'enable_calendar_conflicts' => true, // Default to enabled for new connections
                'save_appointments_to_calendar' => true, // Default to enabled for new connections
            ]);
        })->values()->toArray();
    }
}
