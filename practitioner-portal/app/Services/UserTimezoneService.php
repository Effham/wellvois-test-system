<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Service for handling timezone conversions using the user's browser/local timezone
 * Used primarily in central modules where practitioners work across different timezones
 */
class UserTimezoneService
{
    /**
     * Get user's browser timezone from session/request
     * This should be set by frontend when user logs in
     */
    public static function getUserTimezone(): string
    {
        // Try to get from session first
        $userTimezone = session('user_timezone');

        if ($userTimezone && self::isValidTimezone($userTimezone)) {
            return $userTimezone;
        }

        // Fallback to UTC if not set
        return 'UTC';
    }

    /**
     * Set user's timezone in session
     * This should be called by frontend after detecting browser timezone
     */
    public static function setUserTimezone(string $timezone): void
    {
        if (self::isValidTimezone($timezone)) {
            session(['user_timezone' => $timezone]);
            Log::info('User timezone set', ['timezone' => $timezone]);
        } else {
            Log::warning('Invalid timezone provided', ['timezone' => $timezone]);
        }
    }

    /**
     * Convert UTC time to user's local timezone for display
     *
     * @param  Carbon  $utcDateTime  UTC datetime from database
     * @param  string|null  $userTimezone  Optional override timezone
     * @return Carbon Datetime converted to user timezone
     */
    public static function convertToUserTime(Carbon $utcDateTime, ?string $userTimezone = null): Carbon
    {
        $timezone = $userTimezone ?? self::getUserTimezone();

        try {
            return $utcDateTime->copy()->setTimezone($timezone);
        } catch (\Exception $e) {
            Log::error('Failed to convert to user timezone', [
                'timezone' => $timezone,
                'error' => $e->getMessage(),
            ]);

            // Fallback to original time if conversion fails
            return $utcDateTime->copy();
        }
    }

    /**
     * Convert local time (in user timezone) to UTC for storage
     *
     * @param  string  $localDateTime  Local datetime string in format 'Y-m-d H:i'
     * @param  string|null  $userTimezone  Optional override timezone
     * @return Carbon UTC datetime for database storage
     */
    public static function convertToUTC(string $localDateTime, ?string $userTimezone = null): Carbon
    {
        $timezone = $userTimezone ?? self::getUserTimezone();

        try {
            return Carbon::createFromFormat('Y-m-d H:i', $localDateTime, $timezone)->utc();
        } catch (\Exception $e) {
            Log::error('Failed to convert to UTC from user timezone', [
                'timezone' => $timezone,
                'localDateTime' => $localDateTime,
                'error' => $e->getMessage(),
            ]);

            // Fallback to UTC parsing
            return Carbon::createFromFormat('Y-m-d H:i', $localDateTime, 'UTC');
        }
    }

    /**
     * Format UTC datetime for display in user timezone
     *
     * @param  Carbon  $utcDateTime  UTC datetime from database
     * @param  string  $format  Date format string
     * @param  string|null  $userTimezone  Optional override timezone
     * @return string Formatted datetime in user timezone
     */
    public static function formatForUser(Carbon $utcDateTime, string $format = 'Y-m-d H:i:s', ?string $userTimezone = null): string
    {
        return self::convertToUserTime($utcDateTime, $userTimezone)->format($format);
    }

    /**
     * Get timezone abbreviation for user timezone
     *
     * @param  string|null  $userTimezone  Optional override timezone
     * @return string Timezone abbreviation (e.g., 'EST', 'PST', 'PKT')
     */
    public static function getUserTimezoneAbbreviation(?string $userTimezone = null): string
    {
        $timezone = $userTimezone ?? self::getUserTimezone();

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
            'Asia/Shanghai' => 'CST',
            'Asia/Dubai' => 'GST',
            'Asia/Kolkata' => 'IST',
            'Australia/Sydney' => 'AEST/AEDT',
            'Pacific/Auckland' => 'NZST/NZDT',
        ];

        return $abbreviations[$timezone] ?? $timezone;
    }

    /**
     * Get timezone offset string for user timezone
     *
     * @param  string|null  $userTimezone  Optional override timezone
     * @return string Offset string (e.g., '+05:00', '-05:00')
     */
    public static function getUserTimezoneOffset(?string $userTimezone = null): string
    {
        $timezone = $userTimezone ?? self::getUserTimezone();

        try {
            $dt = Carbon::now($timezone);

            return $dt->format('P');
        } catch (\Exception $e) {
            return '+00:00';
        }
    }

    /**
     * Get current time in user timezone
     *
     * @param  string|null  $userTimezone  Optional override timezone
     * @return Carbon Current time in user timezone
     */
    public static function now(?string $userTimezone = null): Carbon
    {
        $timezone = $userTimezone ?? self::getUserTimezone();

        return Carbon::now($timezone);
    }

    /**
     * Validate if a timezone string is valid
     *
     * @param  string  $timezone  Timezone string to validate
     * @return bool True if valid, false otherwise
     */
    protected static function isValidTimezone(string $timezone): bool
    {
        try {
            new \DateTimeZone($timezone);

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Parse datetime string in user timezone and convert to UTC
     *
     * @param  string  $datetimeString  Datetime string
     * @param  string|null  $format  Parse format (optional)
     * @param  string|null  $userTimezone  Optional override timezone
     * @return Carbon UTC datetime
     */
    public static function parseInUserTimezone(string $datetimeString, ?string $format = null, ?string $userTimezone = null): Carbon
    {
        $timezone = $userTimezone ?? self::getUserTimezone();

        try {
            if ($format) {
                return Carbon::createFromFormat($format, $datetimeString, $timezone)->utc();
            }

            return Carbon::parse($datetimeString, $timezone)->utc();
        } catch (\Exception $e) {
            Log::error('Failed to parse datetime in user timezone', [
                'timezone' => $timezone,
                'datetime' => $datetimeString,
                'format' => $format,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
