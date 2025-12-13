<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Integration extends Model
{
    use HasFactory;

    protected $fillable = [
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
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_configured' => 'boolean',
        'configuration' => 'array',
        'credentials' => 'array',
        'response_data' => 'array',
        'settings' => 'array',
        'last_sync_at' => 'datetime',
    ];

    // Integration types
    const TYPE_CALENDAR = 'calendar';

    const TYPE_PAYMENT = 'payment';

    const TYPE_COMMUNICATION = 'communication';

    const TYPE_STORAGE = 'storage';

    const TYPE_ANALYTICS = 'analytics';

    // Integration levels
    const LEVEL_TENANT = 'tenant';

    const LEVEL_USER = 'user';

    // Integration providers
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
     * Get default tenant-level integrations data
     */
    public static function getDefaultTenantIntegrations(): array
    {
        return [
            [
                'name' => 'PayPal',
                'type' => self::TYPE_PAYMENT,
                'provider' => self::PROVIDER_PAYPAL,
                'description' => 'Accept payments through PayPal for your clinic',
                'icon_url' => null,
                'color' => '#00457C',
                'level' => self::LEVEL_TENANT,
            ],
            [
                'name' => 'Stripe',
                'type' => self::TYPE_PAYMENT,
                'provider' => self::PROVIDER_STRIPE,
                'description' => 'Accept credit card payments with Stripe for your clinic',
                'icon_url' => null,
                'color' => '#635BFF',
                'level' => self::LEVEL_TENANT,
            ],
            [
                'name' => 'Moneris',
                'type' => self::TYPE_PAYMENT,
                'provider' => self::PROVIDER_MONERIS,
                'description' => 'Accept payments through Moneris payment gateway for your clinic',
                'icon_url' => null,
                'color' => '#D32F2F',
                'level' => self::LEVEL_TENANT,
            ],
            [
                'name' => 'Zoom',
                'type' => self::TYPE_COMMUNICATION,
                'provider' => self::PROVIDER_ZOOM,
                'description' => 'Enable video consultations with Zoom for your clinic',
                'icon_url' => null,
                'color' => '#2D8CFF',
                'level' => self::LEVEL_TENANT,
            ],
            [
                'name' => 'Slack',
                'type' => self::TYPE_COMMUNICATION,
                'provider' => self::PROVIDER_SLACK,
                'description' => 'Get notifications in your Slack workspace for clinic updates',
                'icon_url' => null,
                'color' => '#4A154B',
                'level' => self::LEVEL_TENANT,
            ],
        ];
    }

    /**
     * Get default user-level integrations data
     */
    public static function getDefaultUserIntegrations(): array
    {
        return [
            [
                'name' => 'Google Calendar',
                'type' => self::TYPE_CALENDAR,
                'provider' => self::PROVIDER_GOOGLE,
                'description' => 'Sync your personal appointments with Google Calendar',
                'icon_url' => null,
                'color' => '#4285F4',
                'level' => self::LEVEL_USER,
            ],
            // [
            //     'name' => 'Outlook Calendar',
            //     'type' => self::TYPE_CALENDAR,
            //     'provider' => self::PROVIDER_MICROSOFT,
            //     'description' => 'Sync your personal appointments with Outlook Calendar',
            //     'icon_url' => null,
            //     'color' => '#0078D4',
            //     'level' => self::LEVEL_USER,
            // ],
        ];
    }

    /**
     * Get default integrations data (backward compatibility)
     */
    public static function getDefaultIntegrations(): array
    {
        return array_merge(
            self::getDefaultTenantIntegrations(),
            self::getDefaultUserIntegrations()
        );
    }
}
