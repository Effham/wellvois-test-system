// Time and Locale utility functions for tenant-level settings
// Similar to use-appearance.tsx but for time/date formatting and timezone handling

// Available timezone options (matching backend)
export const timezones = [
    { value: 'America/Toronto', label: 'Eastern Time (US & Canada)' },
    { value: 'America/Vancouver', label: 'Pacific Time (US & Canada)' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
    { value: 'America/Halifax', label: 'Atlantic Time (Canada)' },
    { value: 'America/New_York', label: 'Eastern Time (US & Canada) - New York' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada) - Los Angeles' },
    { value: 'UTC', label: 'UTC (GMT+0) - Coordinated Universal Time' },
    { value: 'Europe/London', label: 'GMT (GMT+0) - London' },
    { value: 'Europe/Paris', label: 'CET (GMT+1) - Paris, Berlin' },
    { value: 'Asia/Tokyo', label: 'JST (GMT+9) - Tokyo' },
    { value: 'Australia/Sydney', label: 'AEST (GMT+10) - Sydney' },
    { value: 'Pacific/Auckland', label: 'NZST (GMT+12) - Auckland' },
];

export const dateFormats = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

export const timeFormats = [
    { value: '12-hour', label: '12-hour' },
    { value: '24-hour', label: '24-hour' },
];

// Global time/locale settings storage
let globalTimeLocaleSettings: {
    timezone?: string;
    dateFormat?: string;
    timeFormat?: string;
    isAuthenticated?: boolean;
} = {
    timezone: 'America/Toronto',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12-hour',
    isAuthenticated: false,
};

// Set database time/locale settings (called from app initialization)
export const setDatabaseTimeLocale = (
    timezone?: string,
    dateFormat?: string,
    timeFormat?: string,
    isAuthenticated: boolean = false
) => {
    // Validate timezone exists
    const validTimezone = timezone && timezones.find(tz => tz.value === timezone)
        ? timezone
        : 'America/Toronto';

    globalTimeLocaleSettings = {
        timezone: validTimezone,
        dateFormat: dateFormat || 'DD/MM/YYYY',
        timeFormat: timeFormat || '12-hour',
        isAuthenticated,
    };

    console.log('Set database time/locale settings for authenticated user:', {
        timezone: globalTimeLocaleSettings.timezone,
        dateFormat: globalTimeLocaleSettings.dateFormat,
        timeFormat: globalTimeLocaleSettings.timeFormat,
        originalTimezone: timezone,
        wasValidated: validTimezone !== timezone
    });
};

// Format date according to tenant settings
export const formatDate = (date: Date | string, customFormat?: string): string => {
    if (!date) return '';
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return '';
        
        const format = customFormat || globalTimeLocaleSettings.dateFormat || 'DD/MM/YYYY';
        
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const year = dateObj.getFullYear().toString();
        
        switch (format) {
            case 'MM/DD/YYYY':
                return `${month}/${day}/${year}`;
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'DD/MM/YYYY':
            default:
                return `${day}/${month}/${year}`;
        }
    } catch (error) {
        console.warn('Error formatting date:', date, error);
        return date.toString();
    }
};

// Format time according to tenant settings
export const formatTime = (time: Date | string, customFormat?: string): string => {
    if (!time) return '';
    
    try {
        let dateObj: Date;
        
        // Handle different time input formats
        if (typeof time === 'string') {
            // Clean the time string - remove any UTC timestamp parts
            let cleanTime = time;
            
            // If it looks like a UTC timestamp, extract just the time part
            if (time.includes('T')) {
                const timePart = time.split('T')[1];
                if (timePart) {
                    cleanTime = timePart.split('.')[0]; // Remove milliseconds if present
                }
            }
            
            // Ensure we have HH:MM format
            const timeParts = cleanTime.split(':');
            if (timeParts.length >= 2) {
                const hours = timeParts[0].padStart(2, '0');
                const minutes = timeParts[1].padStart(2, '0');
                cleanTime = `${hours}:${minutes}`;
            }
            
            // Create a date object with the clean time
            dateObj = new Date(`2000-01-01T${cleanTime}:00`);
        } else {
            dateObj = time;
        }
        
        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            return time.toString(); // Return original string if parsing fails
        }
        
        const format = customFormat || globalTimeLocaleSettings.timeFormat || '12-hour';
        
        if (format === '24-hour') {
            return dateObj.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        } else {
            return dateObj.toLocaleTimeString([], { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        }
    } catch (error) {
        console.warn('Error formatting time:', time, error);
        return time.toString(); // Return original string if there's an error
    }
};

// Format datetime according to tenant settings
export const formatDateTime = (datetime: Date | string, customDateFormat?: string, customTimeFormat?: string): string => {
    if (!datetime) return '';
    
    try {
        const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;
        if (isNaN(dateObj.getTime())) return '';
        
        const formattedDate = formatDate(dateObj, customDateFormat);
        const formattedTime = formatTime(dateObj, customTimeFormat);
        
        return `${formattedDate} ${formattedTime}`;
    } catch (error) {
        console.warn('Error formatting datetime:', datetime, error);
        return datetime.toString();
    }
};

// Convert time to tenant timezone (for display purposes)
export const convertToTenantTimezone = (datetime: Date | string, customTimezone?: string): Date => {
    if (!datetime) return new Date();

    try {
        const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;
        if (isNaN(dateObj.getTime())) return new Date();

        const timezone = customTimezone || globalTimeLocaleSettings.timezone || 'America/Toronto';

        // FIXED: Properly convert timezone using toLocaleString with timezone option
        // This maintains the actual moment in time but displays it in the target timezone
        const convertedString = dateObj.toLocaleString('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        // Parse the converted string back to a Date object
        // Format: "YYYY-MM-DD, HH:mm:ss"
        const [datePart, timePart] = convertedString.split(', ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);

        // Create new Date object with the converted time components
        // This represents the same visual time as would be seen in the target timezone
        const convertedDate = new Date(year, month - 1, day, hour, minute, second);

        return convertedDate;
    } catch (error) {
        console.warn('Error converting to tenant timezone:', datetime, error);
        return dateObj instanceof Date ? dateObj : new Date(datetime);
    }
};

// Get current tenant timezone
export const getTenantTimezone = (): string => {
    return globalTimeLocaleSettings.timezone || 'America/Toronto';
};

// Get current tenant date format
export const getTenantDateFormat = (): string => {
    return globalTimeLocaleSettings.dateFormat || 'DD/MM/YYYY';
};

// Get current tenant time format
export const getTenantTimeFormat = (): string => {
    return globalTimeLocaleSettings.timeFormat || '12-hour';
};

// Preview time/locale settings (for real-time preview in settings)
export const previewTimeLocaleSettings = (timezone: string, dateFormat: string, timeFormat: string) => {
    // Get current time for preview
    const now = new Date();
    const nowInTenantTz = convertToTenantTimezone(now, timezone);

    console.log('Previewing time/locale settings:', {
        timezone,
        dateFormat,
        timeFormat,
        localTime: new Date().toISOString(),
        tenantTime: nowInTenantTz.toISOString(),
        sampleDate: formatDate(nowInTenantTz, dateFormat),
        sampleTime: formatTime(nowInTenantTz, timeFormat),
        sampleDateTime: formatDateTime(nowInTenantTz, dateFormat, timeFormat),
    });
    
    // Temporarily update global settings for preview
    const originalSettings = { ...globalTimeLocaleSettings };
    globalTimeLocaleSettings.timezone = timezone;
    globalTimeLocaleSettings.dateFormat = dateFormat;
    globalTimeLocaleSettings.timeFormat = timeFormat;
    
    // Dispatch custom event for components that need to update
    const event = new CustomEvent('time-locale-changed', { 
        detail: { 
            timezone, 
            dateFormat, 
            timeFormat,
            isPreview: true 
        } 
    });
    window.dispatchEvent(event);
    
    return {
        sampleDate: formatDate(nowInTenantTz, dateFormat),
        sampleTime: formatTime(nowInTenantTz, timeFormat),
        sampleDateTime: formatDateTime(nowInTenantTz, dateFormat, timeFormat),
        restore: () => {
            globalTimeLocaleSettings = originalSettings;
        }
    };
};

// Apply time/locale settings permanently (called after successful save)
export const applyTimeLocaleSettings = (timezone: string, dateFormat: string, timeFormat: string) => {
    globalTimeLocaleSettings.timezone = timezone;
    globalTimeLocaleSettings.dateFormat = dateFormat;
    globalTimeLocaleSettings.timeFormat = timeFormat;
    
    console.log('Applied permanent time/locale settings:', {
        timezone,
        dateFormat,
        timeFormat,
    });
    
    // Dispatch custom event for components that need to update
    const event = new CustomEvent('time-locale-changed', { 
        detail: { 
            timezone, 
            dateFormat, 
            timeFormat,
            isPreview: false 
        } 
    });
    window.dispatchEvent(event);
};

// Convert UTC datetime to tenant timezone (for appointments from backend)
export const convertUTCToTenantTime = (utcDatetime: Date | string, customTimezone?: string): Date => {
    if (!utcDatetime) return new Date();

    try {
        // Ensure we have a valid UTC date object
        const utcDate = typeof utcDatetime === 'string' ? new Date(utcDatetime) : utcDatetime;
        if (isNaN(utcDate.getTime())) return new Date();

        const timezone = customTimezone || globalTimeLocaleSettings.timezone || 'America/Toronto';

        // Convert UTC to target timezone for display
        const convertedString = utcDate.toLocaleString('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        // Parse back to Date object for consistent handling
        const [datePart, timePart] = convertedString.split(', ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        const localDate = new Date(year, month - 1, day, hour, minute, second);

        console.log('UTC to tenant conversion:', {
            utc: utcDate.toISOString(),
            timezone,
            converted: localDate.toString(),
            display: convertedString
        });

        return localDate;
    } catch (error) {
        console.warn('Error converting UTC to tenant timezone:', utcDatetime, error);
        return new Date(utcDatetime);
    }
};

// Initialize time/locale settings (called on app start)
export const initializeTimeLocale = (timezone?: string, dateFormat?: string, timeFormat?: string) => {
    if (typeof window === 'undefined') return;

    console.log('Initializing time/locale settings:', { timezone, dateFormat, timeFormat });

    // Validate timezone
    const validTimezone = timezone && timezones.find(tz => tz.value === timezone)
        ? timezone
        : 'America/Toronto';

    globalTimeLocaleSettings = {
        timezone: validTimezone,
        dateFormat: dateFormat || 'DD/MM/YYYY',
        timeFormat: timeFormat || '12-hour',
        isAuthenticated: !!timezone, // If timezone is provided, user is authenticated
    };

    console.log('Time/locale initialization completed:', {
        ...globalTimeLocaleSettings,
        originalTimezone: timezone,
        wasValidated: validTimezone !== timezone
    });
};
