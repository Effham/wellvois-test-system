import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useState } from 'react';
import { timezones, dateFormats, timeFormats, previewTimeLocaleSettings, applyTimeLocaleSettings } from '@/hooks/use-time-locale';

// Note: timezones, dateFormats, and timeFormats are now imported from use-time-locale hook

const weekStartDays = [
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
];

interface Props {
    timeLocaleSettings: Record<string, string>;
}

export default function TimeLocale({ timeLocaleSettings }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        time_locale_timezone: timeLocaleSettings.time_locale_timezone || 'America/Toronto',
        time_locale_date_format: timeLocaleSettings.time_locale_date_format || 'DD/MM/YYYY',
        time_locale_time_format: timeLocaleSettings.time_locale_time_format || '12-hour',
        time_locale_week_start_day: timeLocaleSettings.time_locale_week_start_day || 'sunday',
    });

    // State for real-time preview
    const [previewData, setPreviewData] = useState<{
        sampleDate: string;
        sampleTime: string;
        sampleDateTime: string;
    } | null>(null);

    // Apply database settings on component mount
    useEffect(() => {
        const databaseTimezone = timeLocaleSettings.time_locale_timezone;
        const databaseDateFormat = timeLocaleSettings.time_locale_date_format;
        const databaseTimeFormat = timeLocaleSettings.time_locale_time_format;
        
        if (databaseTimezone && databaseDateFormat && databaseTimeFormat) {
            applyTimeLocaleSettings(databaseTimezone, databaseDateFormat, databaseTimeFormat);
            console.log('Applied database time/locale settings on Settings mount');
        }
    }, [timeLocaleSettings]);

    // Real-time preview when tenant-level settings change
    useEffect(() => {
        // Only preview tenant-level settings (timezone, date_format, time_format)
        const preview = previewTimeLocaleSettings(
            data.time_locale_timezone,
            data.time_locale_date_format,
            data.time_locale_time_format
        );
        setPreviewData(preview);
        
        // Cleanup function to restore original settings if component unmounts
        return () => {
            if (preview.restore) {
                preview.restore();
            }
        };
    }, [data.time_locale_timezone, data.time_locale_date_format, data.time_locale_time_format]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('organization.time-locale.update'), {
            onSuccess: () => {
                console.log('Time/locale settings successfully saved to database - all authenticated users will receive the update');
                
                // Apply the settings permanently after successful save
                applyTimeLocaleSettings(
                    data.time_locale_timezone,
                    data.time_locale_date_format,
                    data.time_locale_time_format
                );
            }
        });
    };

    const handleTenantSettingChange = (field: string, value: string) => {
        setData(field as any, value);
        
        // Show immediate feedback for tenant-level settings only
        if (['time_locale_timezone', 'time_locale_date_format', 'time_locale_time_format'].includes(field)) {
            const event = new CustomEvent('time-locale-preview-changed', { 
                detail: { field, value } 
            });
            window.dispatchEvent(event);
        }
    };

    return (
        <form onSubmit={submit}>
            <div className="px-6 py-4">
                {/* Preview Section */}
                {previewData && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-green-700">Live Preview</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Date: </span>
                                <span className="font-medium">{previewData.sampleDate}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Time: </span>
                                <span className="font-medium">{previewData.sampleTime}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">DateTime: </span>
                                <span className="font-medium">{previewData.sampleDateTime}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Top Left */}
                    <div className="space-y-2">
                        <Label htmlFor="timezone" className="font-normal">
                            Default Timezone <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={data.time_locale_timezone}
                            onValueChange={(value) => handleTenantSettingChange('time_locale_timezone', value)}
                        >
                            <SelectTrigger className={`text-muted-foreground ${errors.time_locale_timezone ? 'border-red-500' : ''}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {timezones.map((timezone) => (
                                    <SelectItem key={timezone.value} value={timezone.value}>
                                        {timezone.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.time_locale_timezone && (
                            <p className="text-sm text-red-500">{errors.time_locale_timezone}</p>
                        )}
                    </div>

                    {/* Top Right */}
                    <div className="space-y-2">
                        <Label htmlFor="date-format" className="font-normal">
                            Date Format <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={data.time_locale_date_format}
                            onValueChange={(value) => handleTenantSettingChange('time_locale_date_format', value)}
                        >
                            <SelectTrigger className={`text-muted-foreground ${errors.time_locale_date_format ? 'border-red-500' : ''}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {dateFormats.map((format) => (
                                    <SelectItem key={format.value} value={format.value}>
                                        {format.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.time_locale_date_format && (
                            <p className="text-sm text-red-500">{errors.time_locale_date_format}</p>
                        )}
                    </div>

                    {/* Bottom Left */}
                    <div className="space-y-2">
                        <Label htmlFor="time-format" className="font-normal">
                            Time Format <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={data.time_locale_time_format}
                            onValueChange={(value) => handleTenantSettingChange('time_locale_time_format', value)}
                        >
                            <SelectTrigger className={`text-muted-foreground ${errors.time_locale_time_format ? 'border-red-500' : ''}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {timeFormats.map((format) => (
                                    <SelectItem key={format.value} value={format.value}>
                                        {format.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.time_locale_time_format && (
                            <p className="text-sm text-red-500">{errors.time_locale_time_format}</p>
                        )}
                    </div>

                    {/* Bottom Right */}
                    <div className="space-y-2">
                        <Label htmlFor="week-start" className="font-normal">
                            Week Start Day <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={data.time_locale_week_start_day}
                            onValueChange={(value) => setData('time_locale_week_start_day', value)}
                        >
                            <SelectTrigger className={`text-muted-foreground ${errors.time_locale_week_start_day ? 'border-red-500' : ''}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {weekStartDays.map((day) => (
                                    <SelectItem key={day.value} value={day.value}>
                                        {day.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.time_locale_week_start_day && (
                            <p className="text-sm text-red-500">{errors.time_locale_week_start_day}</p>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end mt-8">
                    <Button type="submit" disabled={processing} size="save">
                        {processing ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>
        </form>
    );
}