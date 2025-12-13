// Global components for displaying dates and times using tenant settings
import React from 'react';
import { formatDate, formatTime, formatDateTime } from '@/hooks/use-time-locale';

interface DateDisplayProps {
    date: Date | string;
    format?: string;
    className?: string;
}

interface TimeDisplayProps {
    time: Date | string;
    format?: string;
    className?: string;
}

interface DateTimeDisplayProps {
    datetime: Date | string;
    dateFormat?: string;
    timeFormat?: string;
    className?: string;
    separator?: string;
}

// Component to display dates using tenant date format
export const DateDisplay: React.FC<DateDisplayProps> = ({ 
    date, 
    format, 
    className = '' 
}) => {
    const formattedDate = formatDate(date, format);
    
    if (!formattedDate) return null;
    
    return (
        <span className={className} title={`Date: ${formattedDate}`}>
            {formattedDate}
        </span>
    );
};

// Component to display times using tenant time format
export const TimeDisplay: React.FC<TimeDisplayProps> = ({ 
    time, 
    format, 
    className = '' 
}) => {
    const formattedTime = formatTime(time, format);
    
    if (!formattedTime) return null;
    
    return (
        <span className={className} title={`Time: ${formattedTime}`}>
            {formattedTime}
        </span>
    );
};

// Component to display date and time using tenant formats
export const DateTimeDisplay: React.FC<DateTimeDisplayProps> = ({ 
    datetime, 
    dateFormat, 
    timeFormat, 
    className = '',
    separator = ' '
}) => {
    const formattedDateTime = formatDateTime(datetime, dateFormat, timeFormat);
    
    if (!formattedDateTime) return null;
    
    // Split the formatted datetime if separator is different
    let displayText = formattedDateTime;
    if (separator !== ' ') {
        const parts = formattedDateTime.split(' ');
        if (parts.length === 2) {
            displayText = `${parts[0]}${separator}${parts[1]}`;
        }
    }
    
    return (
        <span className={className} title={`DateTime: ${formattedDateTime}`}>
            {displayText}
        </span>
    );
};

// Component specifically for displaying relative dates with tenant formatting
export const RelativeDateDisplay: React.FC<DateDisplayProps & { showRelative?: boolean }> = ({ 
    date, 
    format, 
    className = '',
    showRelative = true
}) => {
    const formattedDate = formatDate(date, format);
    
    if (!formattedDate) return null;
    
    // Calculate relative time if requested
    let relativeText = '';
    if (showRelative) {
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            const now = new Date();
            const diffMs = now.getTime() - dateObj.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                relativeText = ' (Today)';
            } else if (diffDays === 1) {
                relativeText = ' (Yesterday)';
            } else if (diffDays === -1) {
                relativeText = ' (Tomorrow)';
            } else if (diffDays > 0) {
                relativeText = ` (${diffDays} days ago)`;
            } else {
                relativeText = ` (in ${Math.abs(diffDays)} days)`;
            }
        } catch (error) {
            // Ignore relative calculation errors
        }
    }
    
    return (
        <span className={className} title={`Date: ${formattedDate}${relativeText}`}>
            {formattedDate}{relativeText}
        </span>
    );
};

// Utility component for inline date/time formatting in text
export const InlineDateTimeText: React.FC<{
    datetime: Date | string;
    type: 'date' | 'time' | 'datetime';
    format?: string;
    dateFormat?: string;
    timeFormat?: string;
}> = ({ datetime, type, format, dateFormat, timeFormat }) => {
    switch (type) {
        case 'date':
            return <>{formatDate(datetime, format || dateFormat)}</>;
        case 'time':
            return <>{formatTime(datetime, format || timeFormat)}</>;
        case 'datetime':
            return <>{formatDateTime(datetime, dateFormat, timeFormat)}</>;
        default:
            return <>{datetime.toString()}</>;
    }
};
