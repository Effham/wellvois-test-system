// Global utility functions for time/locale operations
// These can be imported anywhere in the application

import {
    formatDate,
    formatTime,
    formatDateTime,
    convertToTenantTimezone,
    convertUTCToTenantTime,
    getTenantTimezone,
    getTenantDateFormat,
    getTenantTimeFormat
} from '@/hooks/use-time-locale';

// Export all utilities for easy access
export {
    formatDate,
    formatTime,
    formatDateTime,
    convertToTenantTimezone,
    convertUTCToTenantTime,
    getTenantTimezone,
    getTenantDateFormat,
    getTenantTimeFormat
};

// Smart datetime formatting that uses backend-provided location timezone conversion
export const smartFormatDateTime = (
    appointment: any,
    format: 'datetime' | 'date' | 'time' = 'datetime'
): string => {
    // Backend now provides pre-converted times based on location timezone
    // No client-side conversion needed - just format the provided values

    if (format === 'datetime' && appointment.formatted_datetime) {
        return appointment.formatted_datetime;
    }

    if (format === 'date' && appointment.formatted_date) {
        return appointment.formatted_date;
    }

    if (format === 'time' && appointment.formatted_time) {
        return appointment.formatted_time;
    }

    // Fallback: use the local datetime provided by backend
    if (appointment.appointment_datetime_local) {
        const localDate = new Date(appointment.appointment_datetime_local);
        if (!isNaN(localDate.getTime())) {
            switch (format) {
                case 'date':
                    return localDate.toLocaleDateString('en-CA');
                case 'time':
                    return localDate.toLocaleTimeString('en-CA', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                case 'datetime':
                default:
                    return localDate.toLocaleString('en-CA', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).replace(',', ' ');
            }
        }
    }

    return 'Invalid Date';
};

// Debug helper to log timezone conversion details
export const debugTimezoneConversion = (appointment: any) => {
    
};

// Additional helper functions for common use cases

/**
 * Format a date for display in tables or lists
 */
export const formatDateForTable = (date: Date | string): string => {
    return formatDate(date) || '-';
};

/**
 * Format a time for display in tables or lists
 */
export const formatTimeForTable = (time: Date | string): string => {
    return formatTime(time) || '-';
};

/**
 * Format a datetime for display in tables or lists
 */
export const formatDateTimeForTable = (datetime: Date | string): string => {
    return formatDateTime(datetime) || '-';
};

/**
 * Format a date range using tenant settings
 */
export const formatDateRange = (startDate: Date | string, endDate: Date | string, separator: string = ' - '): string => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    
    if (!start || !end) return '';
    
    return `${start}${separator}${end}`;
};

/**
 * Format a time range using tenant settings
 */
export const formatTimeRange = (startTime: Date | string, endTime: Date | string, separator: string = ' - '): string => {
    const start = formatTime(startTime);
    const end = formatTime(endTime);
    
    if (!start || !end) return '';
    
    return `${start}${separator}${end}`;
};

/**
 * Get current date formatted according to tenant settings
 */
export const getCurrentDateFormatted = (): string => {
    return formatDate(new Date());
};

/**
 * Get current time formatted according to tenant settings
 */
export const getCurrentTimeFormatted = (): string => {
    return formatTime(new Date());
};

/**
 * Get current datetime formatted according to tenant settings
 */
export const getCurrentDateTimeFormatted = (): string => {
    return formatDateTime(new Date());
};

/**
 * Parse a date string and format it according to tenant settings
 * Useful for API responses or database dates
 */
export const parseAndFormatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString; // Return original if invalid
        return formatDate(date);
    } catch (error) {
        return dateString; // Return original if parsing fails
    }
};

/**
 * Parse a time string and format it according to tenant settings
 */
export const parseAndFormatTime = (timeString: string): string => {
    try {
        // Handle various time formats
        let date: Date;
        
        if (timeString.includes('T')) {
            // ISO string
            date = new Date(timeString);
        } else if (timeString.includes(':')) {
            // Time only (HH:MM or HH:MM:SS)
            date = new Date(`2000-01-01T${timeString}`);
        } else {
            return timeString; // Unknown format
        }
        
        if (isNaN(date.getTime())) return timeString;
        return formatTime(date);
    } catch (error) {
        return timeString;
    }
};

/**
 * Parse a datetime string and format it according to tenant settings
 */
export const parseAndFormatDateTime = (datetimeString: string): string => {
    try {
        const date = new Date(datetimeString);
        if (isNaN(date.getTime())) return datetimeString;
        return formatDateTime(date);
    } catch (error) {
        return datetimeString;
    }
};

/**
 * Check if a date string matches tenant date format
 */
export const isValidTenantDateFormat = (dateString: string): boolean => {
    const tenantFormat = getTenantDateFormat();
    
    // Basic validation based on format
    switch (tenantFormat) {
        case 'DD/MM/YYYY':
            return /^\d{2}\/\d{2}\/\d{4}$/.test(dateString);
        case 'MM/DD/YYYY':
            return /^\d{2}\/\d{2}\/\d{4}$/.test(dateString);
        case 'YYYY-MM-DD':
            return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
        default:
            return false;
    }
};

/**
 * Convert a date to tenant timezone and format
 */
export const convertAndFormatDate = (date: Date | string): string => {
    try {
        const convertedDate = convertToTenantTimezone(date);
        return formatDate(convertedDate);
    } catch (error) {
        console.warn('Error converting and formatting date:', error);
        return formatDate(date); // Fallback to original
    }
};

/**
 * Convert a time to tenant timezone and format
 */
export const convertAndFormatTime = (datetime: Date | string): string => {
    try {
        const convertedDate = convertToTenantTimezone(datetime);
        return formatTime(convertedDate);
    } catch (error) {
        console.warn('Error converting and formatting time:', error);
        return formatTime(datetime); // Fallback to original
    }
};

/**
 * Convert a datetime to tenant timezone and format
 */
export const convertAndFormatDateTime = (datetime: Date | string): string => {
    try {
        const convertedDate = convertToTenantTimezone(datetime);
        return formatDateTime(convertedDate);
    } catch (error) {
        console.warn('Error converting and formatting datetime:', error);
        return formatDateTime(datetime); // Fallback to original
    }
};

/**
 * Get timezone display name
 */
export const getTenantTimezoneDisplay = (): string => {
    const timezone = getTenantTimezone();

    // Map timezone to display names
    const timezoneDisplayMap: Record<string, string> = {
        'America/Toronto': 'Eastern Time',
        'America/Vancouver': 'Pacific Time',
        'America/Chicago': 'Central Time',
        'America/Denver': 'Mountain Time',
        'America/Halifax': 'Atlantic Time',
        'America/New_York': 'Eastern Time',
        'America/Los_Angeles': 'Pacific Time',
        'UTC': 'UTC',
        'Europe/London': 'GMT',
        'Europe/Paris': 'CET',
        'Asia/Tokyo': 'JST',
        'Australia/Sydney': 'AEST',
        'Pacific/Auckland': 'NZST',
    };

    return timezoneDisplayMap[timezone] || timezone;
};

/**
 * Display appointment time with location timezone info
 * Backend provides all converted times, frontend just displays
 */
export const formatAppointmentDateTime = (appointment: any): string => {
    const datetime = smartFormatDateTime(appointment, 'datetime');
    const timezoneAbbr = appointment.location_timezone_abbr;

    return timezoneAbbr ? `${datetime} (${timezoneAbbr})` : datetime;
};

/**
 * Display appointment date only
 */
export const formatAppointmentDate = (appointment: any): string => {
    return smartFormatDateTime(appointment, 'date');
};

/**
 * Display appointment time only with timezone
 */
export const formatAppointmentTime = (appointment: any): string => {
    const time = smartFormatDateTime(appointment, 'time');
    const timezoneAbbr = appointment.location_timezone_abbr;

    return timezoneAbbr ? `${time} (${timezoneAbbr})` : time;
};

/**
 * Get location timezone display name from appointment
 */
export const getAppointmentLocationTimezone = (appointment: any): string => {
    if (appointment.location_timezone_abbr) {
        return appointment.location_timezone_abbr;
    }

    if (appointment.location_timezone) {
        const timezoneDisplayMap: Record<string, string> = {
            'America/Toronto': 'EST/EDT',
            'America/Vancouver': 'PST/PDT',
            'America/Chicago': 'CST/CDT',
            'America/Denver': 'MST/MDT',
            'America/Halifax': 'AST/ADT',
            'America/New_York': 'EST/EDT',
            'America/Los_Angeles': 'PST/PDT',
            'UTC': 'UTC',
            'Europe/London': 'GMT/BST',
            'Europe/Paris': 'CET/CEST',
            'Asia/Tokyo': 'JST',
            'Australia/Sydney': 'AEST/AEDT',
            'Pacific/Auckland': 'NZST/NZDT',
        };

        return timezoneDisplayMap[appointment.location_timezone] || appointment.location_timezone;
    }

    return '';
};
