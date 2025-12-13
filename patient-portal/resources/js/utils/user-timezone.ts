/**
 * User Timezone Utility
 *
 * This utility detects and manages the user's browser/local timezone.
 * Used primarily in central modules where practitioners work across different timezones.
 *
 * For tenant modules, use the organization timezone from time-locale settings instead.
 */

/**
 * Detect the user's browser timezone using the Intl API
 * @returns Timezone string (e.g., 'America/Toronto', 'Asia/Karachi')
 */
export function detectUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        console.warn('Failed to detect user timezone, falling back to UTC:', error);
        return 'UTC';
    }
}

/**
 * Send the detected timezone to the backend to store in session
 * This should be called once when the user logs in or accesses central modules
 */
export async function setUserTimezoneInSession(): Promise<void> {
    const timezone = detectUserTimezone();

    try {
        const response = await fetch('/users/timezone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            },
            body: JSON.stringify({ timezone }),
        });

        if (!response.ok) {
            console.warn('Failed to set user timezone in session:', response.statusText);
        }
    } catch (error) {
        console.error('Failed to set user timezone in session:', error);
    }
}

/**
 * Convert UTC date string to user's local timezone
 * @param utcDateString - ISO 8601 date string in UTC (e.g., '2025-09-30T14:00:00Z')
 * @returns Date object in user's local timezone
 */
export function convertToUserTime(utcDateString: string): Date {
    return new Date(utcDateString);
}

/**
 * Format UTC date in user's local timezone
 * @param utcDateString - ISO 8601 date string in UTC
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in user's local timezone
 */
export function formatInUserTimezone(
    utcDateString: string,
    options?: Intl.DateTimeFormatOptions
): string {
    const date = new Date(utcDateString);
    const timezone = detectUserTimezone();

    const defaultOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        ...options,
    };

    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
}

/**
 * Get timezone abbreviation for user's timezone
 * @returns Timezone abbreviation (e.g., 'EST', 'PST', 'PKT')
 */
export function getUserTimezoneAbbreviation(): string {
    const timezone = detectUserTimezone();

    const abbreviations: Record<string, string> = {
        'America/Toronto': 'EST/EDT',
        'America/New_York': 'EST/EDT',
        'America/Chicago': 'CST/CDT',
        'America/Denver': 'MST/MDT',
        'America/Vancouver': 'PST/PDT',
        'America/Los_Angeles': 'PST/PDT',
        'America/Halifax': 'AST/ADT',
        'America/St_Johns': 'NST/NDT',
        'UTC': 'UTC',
        'Europe/London': 'GMT/BST',
        'Europe/Paris': 'CET/CEST',
        'Asia/Tokyo': 'JST',
        'Asia/Karachi': 'PKT',
        'Asia/Shanghai': 'CST',
        'Asia/Dubai': 'GST',
        'Asia/Kolkata': 'IST',
        'Australia/Sydney': 'AEST/AEDT',
        'Pacific/Auckland': 'NZST/NZDT',
    };

    return abbreviations[timezone] || timezone;
}

/**
 * Get timezone offset for user's timezone
 * @returns Offset string (e.g., '+05:00', '-05:00')
 */
export function getUserTimezoneOffset(): string {
    const date = new Date();
    const offsetMinutes = -date.getTimezoneOffset();
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const minutes = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';

    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert local datetime string to UTC for backend storage
 * @param localDateString - Date string in format 'YYYY-MM-DD HH:mm'
 * @returns ISO 8601 UTC date string
 */
export function convertToUTC(localDateString: string): string {
    // Parse the local date string assuming it's in the user's timezone
    const [datePart, timePart] = localDateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    // Create date in user's timezone
    const date = new Date(year, month - 1, day, hour, minute);

    // Return as ISO string (UTC)
    return date.toISOString();
}

/**
 * Check if a timezone string is valid
 * @param timezone - Timezone string to validate
 * @returns True if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Format date for display in user's timezone with custom format
 * @param utcDateString - ISO 8601 date string in UTC
 * @param format - Format string ('date' | 'time' | 'datetime' | 'full')
 * @returns Formatted date string
 */
export function formatDateInUserTimezone(
    utcDateString: string,
    format: 'date' | 'time' | 'datetime' | 'full' = 'datetime'
): string {
    const date = new Date(utcDateString);
    const timezone = detectUserTimezone();

    const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
        date: {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        },
        time: {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        },
        datetime: {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        },
        full: {
            timeZone: timezone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short',
        },
    };

    return new Intl.DateTimeFormat('en-US', formatOptions[format]).format(date);
}