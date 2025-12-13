<?php

namespace App\Models;

use App\Mail\OrganizationSettingsUpdatedMail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Mail;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class OrganizationSetting extends Model
{
    use LogsActivity;

    protected $table = 'organization_settings';

    protected $fillable = [
        'key',
        'value',
        'setting_type',
        'description',
        's3_key',
        'original_filename',
        'mime_type',
        'file_size',
    ];

    /**
     * Get a setting value by key
     */
    public static function getValue(string $key, $default = null)
    {
        try {
            $setting = static::where('key', $key)->first();

            return $setting ? $setting->value : $default;
        } catch (QueryException $e) {
            // Gracefully handle missing central table to avoid 500s during setup/misconfig
            if (str_contains($e->getMessage(), 'Base table or view not found')) {
                return $default;
            }
            throw $e;
        }
    }

    /**
     * Set a setting value by key
     */
    public static function setValue(string $key, $value): void
    {
        $currentDb = \DB::connection()->getDatabaseName();
        $tenantId = tenant('id');
        $isTenantContext = tenancy()->initialized;

        \Log::info('OrganizationSetting::setValue called', [
            'key' => $key,
            'value_type' => gettype($value),
            'value_length' => is_string($value) ? strlen($value) : 'N/A',
            'tenant_id' => $tenantId,
            'database' => $currentDb,
            'tenancy_initialized' => $isTenantContext,
        ]);

        // FAIL-FAST: Prevent setting is_tenant_creation_complete via OrganizationSetting
        // This field has been moved to tenant_user table (central DB)
        if ($key === 'is_tenant_creation_complete' || $key === 'IsTenantCreationComplete') {
            \Log::error('OrganizationSetting::setValue - DEPRECATED KEY DETECTED', [
                'key' => $key,
                'message' => 'is_tenant_creation_complete has been moved to tenant_user table. Use DB::table(\'tenant_user\')->update() instead.',
                'caller' => debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 5),
            ]);
            throw new \Exception("OrganizationSetting::setValue called for deprecated key '{$key}'. This field has been moved to tenant_user table (central DB). Use DB::table('tenant_user')->where('tenant_id', \$tenantId)->where('user_id', \$userId)->update(['is_tenant_creation_complete' => true]) instead.");
        }

        // FAIL-FAST: For tenant-specific settings like is_onboarding_complete, verify we're in tenant context
        // The central database doesn't have organization_settings table
        $expectedDbPrefix = config('tenancy.database.prefix', 'pms_');
        $isTenantSpecificKey = in_array($key, ['is_onboarding_complete']);

        if ($isTenantSpecificKey) {
            // For tenant-specific keys, we MUST be in tenant database
            if (! str_starts_with($currentDb, $expectedDbPrefix)) {
                \Log::error('OrganizationSetting::setValue - FAIL-FAST: Tenant-specific key in wrong database', [
                    'key' => $key,
                    'current_db' => $currentDb,
                    'expected_prefix' => $expectedDbPrefix,
                    'tenancy_initialized' => $isTenantContext,
                    'tenant_id' => $tenantId,
                ]);
                throw new \Exception("OrganizationSetting::setValue called for tenant-specific key '{$key}' but database '{$currentDb}' is not a tenant database. Expected database prefix: {$expectedDbPrefix}");
            }

            // Also verify tenant ID matches
            if (! $tenantId) {
                \Log::error('OrganizationSetting::setValue - FAIL-FAST: Tenant-specific key but no tenant ID', [
                    'key' => $key,
                    'current_db' => $currentDb,
                    'tenancy_initialized' => $isTenantContext,
                ]);
                throw new \Exception("OrganizationSetting::setValue called for tenant-specific key '{$key}' but tenant('id') returned null. Database: {$currentDb}");
            }
        } elseif ($isTenantContext && $tenantId) {
            // For other keys in tenant context, verify database matches expected pattern
            if (! str_starts_with($currentDb, $expectedDbPrefix)) {
                \Log::error('OrganizationSetting::setValue - Tenant context mismatch', [
                    'key' => $key,
                    'tenant_id' => $tenantId,
                    'current_db' => $currentDb,
                    'expected_prefix' => $expectedDbPrefix,
                    'tenancy_initialized' => $isTenantContext,
                ]);
                throw new \Exception("OrganizationSetting::setValue called in tenant context but database '{$currentDb}' doesn't match expected tenant database pattern. Tenant ID: {$tenantId}");
            }
        } elseif (! $isTenantContext && str_contains($currentDb, $expectedDbPrefix)) {
            // We're in what looks like a tenant database but tenancy()->initialized is false
            \Log::warning('OrganizationSetting::setValue - Potential context issue', [
                'key' => $key,
                'current_db' => $currentDb,
                'tenancy_initialized' => $isTenantContext,
                'tenant_id' => $tenantId,
            ]);
        }

        try {
            $setting = static::where('key', $key)->first();

            if ($setting) {
                \Log::info('OrganizationSetting::setValue updating existing setting', [
                    'setting_id' => $setting->id,
                    'old_value' => $setting->value,
                    'new_value' => $value,
                ]);
                // Update existing setting - this will trigger model events
                $result = $setting->update(['value' => $value]);
                \Log::info('OrganizationSetting::setValue update result', ['success' => $result]);
            } else {
                \Log::info('OrganizationSetting::setValue creating new setting', [
                    'key' => $key,
                    'value' => $value,
                ]);
                // Create new setting - this will trigger model events
                $newSetting = static::create([
                    'key' => $key,
                    'value' => $value,
                ]);
                \Log::info('OrganizationSetting::setValue create result', [
                    'setting_id' => $newSetting->id ?? 'FAILED',
                    'success' => ! is_null($newSetting),
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('OrganizationSetting::setValue failed', [
                'key' => $key,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            throw $e;
        }
    }

    /**
     * Get multiple settings by key prefix
     */
    public static function getByPrefix(string $prefix): array
    {
        try {
            return static::where('key', 'like', $prefix.'%')
                ->pluck('value', 'key')
                ->toArray();
        } catch (QueryException $e) {
            if (str_contains($e->getMessage(), 'Base table or view not found')) {
                return [];
            }
            throw $e;
        }
    }

    /**
     * Get accounting settings with safe defaults to prevent crashes
     */
    public static function getAccountingSettings(): array
    {
        $defaults = [
            'accounting_invoice_prefix' => 'INV',
            'accounting_currency' => 'CAD',
            'accounting_tax_enabled' => '0',
            'accounting_tax_rate' => '0.00',
            'accounting_tax_name' => '',
        ];

        try {
            $settings = static::getByPrefix('accounting_');

            // Merge with defaults, preferring database values
            return array_merge($defaults, $settings);
        } catch (\Exception $e) {
            \Log::warning('Failed to load accounting settings, using defaults', [
                'error' => $e->getMessage(),
            ]);

            return $defaults;
        }
    }

    /**
     * Set multiple settings at once
     */
    public static function setMultiple(array $settings, ?string $type = null): void
    {
        // $allowed = [
        //     'appearance',
        //     'practice-details',
        //     'time-locale',
        //     'business-compliance-details',
        //     'appointment-settings',
        // ];
        \Log::info('OrganizationSetting::setMultiple called', [
            'settings_count' => count($settings),
            'settings_keys' => array_keys($settings),
            'tenant_id' => tenant('id'),
            'database' => \DB::connection()->getDatabaseName(),
        ]);

        // 1) capture "before" values for diff
        $before = [];
        foreach (array_keys($settings) as $key) {
            $before[$key] = static::getValue($key); // assumes getValue($key) exists
        }

        // 2) write new values
        foreach ($settings as $key => $value) {
            \Log::info('OrganizationSetting::setMultiple processing', ['key' => $key, 'value' => $value]);
            static::setValue($key, $value);
        }

        \Log::info('OrganizationSetting::setMultiple completed');

        // 3) build diff (only changed keys)
        $changes = [];
        foreach ($settings as $key => $new) {
            $old = $before[$key] ?? null;
            if ($old !== $new) {
                $changes[$key] = ['old' => $old, 'new' => $new];
            }
        }

        // If nothing changed, stop here.
        if (empty($changes)) {
            \Log::info('OrganizationSetting::setMultiple no changes detected; skipping email');

            return;
        }

        // If type is null, do NOT email (per your requirement).
        if ($type === null) {
            \Log::info('OrganizationSetting::setMultiple $type is null; skipping email notification');

            return;
        }

        // 4) validate provided (non-null) type
        $allowed = [
            'appearance',
            'practice-details',
            'time-locale',
            'business-compliance-details',
            'appointment-settings',
            'accounting-settings',
        ];
        if (! in_array($type, $allowed, true)) {
            \Log::warning('OrganizationSetting::setMultiple invalid $type; skipping email', ['type' => $type]);
            throw new \InvalidArgumentException('Invalid settings type: '.$type);
        }

        // 5) org display name (from practice_details_name)
        $orgName = $settings['practice_details_name']
            ?? static::getValue('practice_details_name')
            ?? 'Organization';
        $organization = ['name' => $orgName];

        // 6) recipients: users with Admin role in the current tenant (via tenants pivot)
        $recipients = \App\Models\User::role('Admin')
            ->whereNotNull('email')
            ->pluck('email')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($recipients) && env('ADMIN_EMAIL')) {
            $recipients = [env('ADMIN_EMAIL')];
        }
        if (empty($recipients)) {
            \Log::warning('OrganizationSetting::setMultiple found no admin recipients; skipping email');

            return;
        }

        // 7) optional deep link to settings page
        $settingsUrl = null;
        if (function_exists('route')) {
            try {
                $settingsUrl = route('admin.settings', ['section' => $type]);
            } catch (\Throwable $e) {
                // route may not exist; ignore
            }
        }

        // 8) send the mailable
        try {
            Mail::to($recipients)->send(new OrganizationSettingsUpdatedMail(
                organization: $organization,
                sectionKey: $type,
                updatedBy: auth()->user(),
                changes: $changes,
                settingsUrl: $settingsUrl,
                changedAt: now(),
            ));
        } catch (\Throwable $e) {
            \Log::error('OrganizationSetting::setMultiple failed to send OrganizationSettingsUpdatedMail', [
                'to' => $recipients,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Set a file setting with S3 metadata
     */
    public static function setFileSetting(string $key, string $s3Key, ?string $originalFilename = null, ?string $mimeType = null, ?int $fileSize = null): void
    {
        \Log::info('OrganizationSetting::setFileSetting called', [
            'key' => $key,
            's3_key' => $s3Key,
            'original_filename' => $originalFilename,
            'mime_type' => $mimeType,
            'file_size' => $fileSize,
            'tenant_id' => tenant('id'),
            'database' => \DB::connection()->getDatabaseName(),
        ]);

        try {
            $setting = static::where('key', $key)->first();

            $data = [
                'key' => $key,
                'value' => $s3Key, // Store S3 key in value for backward compatibility
                'setting_type' => 'file',
                's3_key' => $s3Key,
                'original_filename' => $originalFilename,
                'mime_type' => $mimeType,
                'file_size' => $fileSize,
            ];

            if ($setting) {
                \Log::info('OrganizationSetting::setFileSetting updating existing setting', [
                    'setting_id' => $setting->id,
                    'old_s3_key' => $setting->s3_key,
                    'new_s3_key' => $s3Key,
                ]);
                $result = $setting->update($data);
                \Log::info('OrganizationSetting::setFileSetting update result', ['success' => $result]);
            } else {
                \Log::info('OrganizationSetting::setFileSetting creating new setting');
                $newSetting = static::create($data);
                \Log::info('OrganizationSetting::setFileSetting create result', [
                    'setting_id' => $newSetting->id ?? 'FAILED',
                    'success' => ! is_null($newSetting),
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('OrganizationSetting::setFileSetting failed', [
                'key' => $key,
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            throw $e;
        }
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Organization setting '{$this->key}' was {$eventName}");
    }
}
