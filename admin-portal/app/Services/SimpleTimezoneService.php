<?php

namespace App\Services;

use App\Models\Location;
use Carbon\Carbon;

class SimpleTimezoneService
{
    /**
     * Convert local time to UTC for storage
     * Always store times in UTC in the database
     */
    public static function toUTC(string $localDateTime, int $locationId): Carbon
    {
        $location = Location::findOrFail($locationId);

        return Carbon::createFromFormat('Y-m-d H:i', $localDateTime, $location->timezone)->utc();
    }

    /**
     * Convert UTC time to local timezone for display
     * Always display times in location's timezone
     */
    public static function toLocal(Carbon $utcDateTime, int $locationId): Carbon
    {
        $location = Location::findOrFail($locationId);

        return $utcDateTime->copy()->setTimezone($location->timezone);
    }

    /**
     * Get location timezone
     */
    public static function getLocationTimezone(int $locationId): string
    {
        return Location::findOrFail($locationId)->timezone;
    }

    /**
     * Format UTC datetime for display in location timezone
     */
    public static function formatForLocation(Carbon $utcDateTime, int $locationId, string $format = 'Y-m-d H:i:s'): string
    {
        return self::toLocal($utcDateTime, $locationId)->format($format);
    }
}
