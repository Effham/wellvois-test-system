<?php

namespace App\Services;

use App\Models\OrganizationSetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Service for handling timezone conversions using the tenant's organization timezone setting
 * This replaces location-based timezone handling with organization-level timezone
 */
class TenantTimezoneService
{
    /**
     * Get the tenant's configured timezone from organization settings
     */
    public static function getTenantTimezone(): string
    {
        return OrganizationSetting::getValue('time_locale_timezone', 'America/Toronto');
    }

    /**
     * Convert UTC time to tenant's timezone for display
     * Always display times in the organization's configured timezone
     *
     * @param  Carbon  $utcDateTime  UTC datetime from database
     * @return Carbon Datetime converted to tenant timezone
     */
    public static function convertToTenantTime(Carbon $utcDateTime): Carbon
    {
        $tenantTimezone = self::getTenantTimezone();

        try {
            return $utcDateTime->copy()->setTimezone($tenantTimezone);
        } catch (\Exception $e) {
            Log::error('Failed to convert to tenant timezone', [
                'timezone' => $tenantTimezone,
                'error' => $e->getMessage(),
            ]);

            // Fallback to original time if conversion fails
            return $utcDateTime->copy();
        }
    }

    /**
     * Convert local time (in tenant timezone) to UTC for storage
     * Always store times in UTC in the database
     *
     * @param  string  $localDateTime  Local datetime string in format 'Y-m-d H:i'
     * @return Carbon UTC datetime for database storage
     */
    public static function convertToUTC(string $localDateTime): Carbon
    {
        $tenantTimezone = self::getTenantTimezone();

        try {
            return Carbon::createFromFormat('Y-m-d H:i', $localDateTime, $tenantTimezone)->utc();
        } catch (\Exception $e) {
            Log::error('Failed to convert to UTC from tenant timezone', [
                'timezone' => $tenantTimezone,
                'localDateTime' => $localDateTime,
                'error' => $e->getMessage(),
            ]);

            // Fallback to UTC parsing
            return Carbon::createFromFormat('Y-m-d H:i', $localDateTime, 'UTC');
        }
    }

    /**
     * Format UTC datetime for display in tenant timezone
     *
     * @param  Carbon  $utcDateTime  UTC datetime from database
     * @param  string  $format  Date format string
     * @return string Formatted datetime in tenant timezone
     */
    public static function formatForTenant(Carbon $utcDateTime, string $format = 'Y-m-d H:i:s'): string
    {
        return self::convertToTenantTime($utcDateTime)->format($format);
    }

    /**
     * Get timezone abbreviation for tenant timezone
     *
     * @return string Timezone abbreviation (e.g., 'EST', 'PST')
     */
    public static function getTenantTimezoneAbbreviation(): string
    {
        $timezone = self::getTenantTimezone();

        $abbreviations = [
            'America/Toronto' => 'EST/EDT',
            'America/New_York' => 'EST/EDT',
            'America/Chicago' => 'CST/CDT',
            'America/Denver' => 'MST/MDT',
            'America/Vancouver' => 'PST/PDT',
            'America/Los_Angeles' => 'PST/PDT',
            'America/Halifax' => 'AST/ADT',
            'America/St_Johns' => 'NST/NDT',
            'UTC' => 'UTC',
            'Europe/London' => 'GMT/BST',
            'Europe/Paris' => 'CET/CEST',
            'Asia/Tokyo' => 'JST',
            'Asia/Karachi' => 'PKT',
            'Australia/Sydney' => 'AEST/AEDT',
            'Pacific/Auckland' => 'NZST/NZDT',
        ];

        return $abbreviations[$timezone] ?? $timezone;
    }

    /**
     * Get timezone offset string for tenant timezone
     *
     * @return string Offset string (e.g., '+05:00', '-05:00')
     */
    public static function getTenantTimezoneOffset(): string
    {
        $tenantTimezone = self::getTenantTimezone();

        try {
            $dt = Carbon::now($tenantTimezone);

            return $dt->format('P');
        } catch (\Exception $e) {
            return '+00:00';
        }
    }

    /**
     * Get current time in tenant timezone
     *
     * @return Carbon Current time in tenant timezone
     */
    public static function now(): Carbon
    {
        return Carbon::now(self::getTenantTimezone());
    }

    /**
     * Parse datetime string in tenant timezone and convert to UTC
     *
     * @param  string  $datetimeString  Datetime string
     * @param  string|null  $format  Parse format (optional)
     * @return Carbon UTC datetime
     */
    public static function parseInTenantTimezone(string $datetimeString, ?string $format = null): Carbon
    {
        $tenantTimezone = self::getTenantTimezone();

        try {
            if ($format) {
                return Carbon::createFromFormat($format, $datetimeString, $tenantTimezone)->utc();
            }

            return Carbon::parse($datetimeString, $tenantTimezone)->utc();
        } catch (\Exception $e) {
            Log::error('Failed to parse datetime in tenant timezone', [
                'timezone' => $tenantTimezone,
                'datetime' => $datetimeString,
                'format' => $format,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
