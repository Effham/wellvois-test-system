import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Calendar, Info, Save } from 'lucide-react';
import { router, usePage } from '@inertiajs/react';

interface AppointmentSettingsProps {
    appointmentSettings?: {
        sessionDuration?: string;
        advanceBookingHours?: string;
        allowSameDayBooking?: boolean;
        maxAdvanceBookingDays?: string;
        bufferTimeBetweenAppointments?: string;
        allowBackToBackAppointments?: boolean;
        autoConfirmAppointments?: boolean;
        defaultAppointmentStatus?: string;
    };
}

export default function AppointmentSettings({ appointmentSettings = {} }: AppointmentSettingsProps) {
    const { errors } = usePage().props as any;
    
    const [formData, setFormData] = useState({
        sessionDuration: appointmentSettings.appointment_session_duration || '',
        advanceBookingHours: appointmentSettings.appointment_advance_booking_hours || '',
        allowSameDayBooking: appointmentSettings.appointment_allow_same_day_booking === '1' ? true : appointmentSettings.appointment_allow_same_day_booking === '0' ? false : false,
        maxAdvanceBookingDays: appointmentSettings.appointment_max_advance_booking_days || '',
        bufferTimeBetweenAppointments: appointmentSettings.appointment_buffer_time_between_appointments || '',
        allowBackToBackAppointments: appointmentSettings.appointment_allow_back_to_back_appointments === '1' ? true : appointmentSettings.appointment_allow_back_to_back_appointments === '0' ? false : true,
        autoConfirmAppointments: appointmentSettings.appointment_auto_confirm_appointments === '1' ? true : appointmentSettings.appointment_auto_confirm_appointments === '0' ? false : false,
        defaultAppointmentStatus: appointmentSettings.appointment_default_appointment_status || '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (key: string, value: string | boolean) => {
        setFormData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        
        router.post(route('organization.appointment-settings.update'), formData, {
            onSuccess: () => {
                // Success handled by Inertia
            },
            onError: () => {
                // Error handled by Inertia
            },
            onFinish: () => {
                setIsSubmitting(false);
            }
        });
    };

    const sessionDurationOptions = [
        { value: '15', label: '15 minutes' },
        { value: '30', label: '30 minutes' },
        { value: '45', label: '45 minutes' },
        { value: '60', label: '1 hour' },
        { value: '90', label: '1.5 hours' },
        { value: '120', label: '2 hours' },
    ];

    const advanceBookingOptions = [
        { value: '1', label: '1 hour' },
        { value: '2', label: '2 hours' },
        { value: '4', label: '4 hours' },
        { value: '12', label: '12 hours' },
        { value: '24', label: '24 hours' },
        { value: '48', label: '48 hours' },
        { value: '72', label: '72 hours' },
    ];

    const bufferTimeOptions = [
        { value: '0', label: 'No buffer' },
        { value: '5', label: '5 minutes' },
        { value: '10', label: '10 minutes' },
        { value: '15', label: '15 minutes' },
        { value: '30', label: '30 minutes' },
    ];

    const statusOptions = [
        { value: 'pending', label: 'Pending Confirmation' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'tentative', label: 'Tentative' },
    ];

    return (
        <div className="space-y-6 px-6 py-4">
            {/* Session Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Session Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="sessionDuration" className="font-normal">Default Session Duration <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.sessionDuration}
                                onValueChange={(value) => handleInputChange('sessionDuration', value)}
                                required
                            >
                                <SelectTrigger className={`text-muted-foreground ${errors.sessionDuration ? 'border-red-500' : ''}`}>
                                    <SelectValue placeholder="Select duration (Required)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sessionDurationOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.sessionDuration && (
                                <p className="text-sm text-red-500">{errors.sessionDuration}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bufferTime" className="font-normal">Buffer Time Between Appointments <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.bufferTimeBetweenAppointments}
                                onValueChange={(value) => handleInputChange('bufferTimeBetweenAppointments', value)}
                                required
                            >
                                <SelectTrigger className={`text-muted-foreground ${errors.bufferTimeBetweenAppointments ? 'border-red-500' : ''}`}>
                                    <SelectValue placeholder="Select buffer time (Required)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {bufferTimeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.bufferTimeBetweenAppointments && (
                                <p className="text-sm text-red-500">{errors.bufferTimeBetweenAppointments}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="font-normal">Allow Back-to-Back Appointments</Label>
                            <div className="text-sm text-muted-foreground">
                                Allow appointments to be scheduled consecutively without buffer time
                            </div>
                        </div>
                        <Switch
                            checked={formData.allowBackToBackAppointments}
                            onCheckedChange={(checked) => handleInputChange('allowBackToBackAppointments', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Booking Restrictions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Booking Restrictions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="advanceBooking" className="font-normal">Minimum Advance Booking Time <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.advanceBookingHours}
                                onValueChange={(value) => handleInputChange('advanceBookingHours', value)}
                                required
                            >
                                <SelectTrigger className={`text-muted-foreground ${errors.advanceBookingHours ? 'border-red-500' : ''}`}>
                                    <SelectValue placeholder="Select advance time (Required)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {advanceBookingOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.advanceBookingHours && (
                                <p className="text-sm text-red-500">{errors.advanceBookingHours}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxAdvanceBooking" className="font-normal">Maximum Advance Booking (Days) <span className="text-red-500">*</span></Label>
                            <Input
                                id="maxAdvanceBooking"
                                type="number"
                                min="1"
                                max="365"
                                value={formData.maxAdvanceBookingDays}
                                onChange={(e) => handleInputChange('maxAdvanceBookingDays', e.target.value)}
                                placeholder="90 (Required)"
                                required
                                className={`text-muted-foreground ${errors.maxAdvanceBookingDays ? 'border-red-500' : ''}`}
                            />
                            {errors.maxAdvanceBookingDays && (
                                <p className="text-sm text-red-500">{errors.maxAdvanceBookingDays}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="font-normal">Restrict Same-Day Booking</Label>
                            <div className="text-sm text-muted-foreground">
                                Prevent patients from booking appointments for today.                            </div>
                        </div>
                        <Switch
                            checked={formData.allowSameDayBooking}
                            onCheckedChange={(checked) => handleInputChange('allowSameDayBooking', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Appointment Management */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Appointment Management
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="defaultStatus" className="font-normal">Default Appointment Status <span className="text-red-500">*</span></Label>
                        <Select
                            value={formData.defaultAppointmentStatus}
                            onValueChange={(value) => handleInputChange('defaultAppointmentStatus', value)}
                            required
                        >
                            <SelectTrigger className={`text-muted-foreground ${errors.defaultAppointmentStatus ? 'border-red-500' : ''}`}>
                                <SelectValue placeholder="Select default status (Required)" />
                            </SelectTrigger>
                            <SelectContent>
                                {statusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.defaultAppointmentStatus && (
                            <p className="text-sm text-red-500">{errors.defaultAppointmentStatus}</p>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="font-normal">Auto-Confirm Appointments</Label>
                            <div className="text-sm text-muted-foreground">
                                Automatically confirm appointments when booked (overrides default status)
                            </div>
                        </div>
                        <Switch
                            checked={formData.autoConfirmAppointments}
                            onCheckedChange={(checked) => handleInputChange('autoConfirmAppointments', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                    <strong>All fields are required.</strong> These settings will apply to all new appointments. Existing appointments will not be affected.
                    Changes may take a few minutes to reflect across all booking interfaces.
                </AlertDescription>
            </Alert>

            <div className="flex justify-end">
                <Button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                >
                    <Save className="h-4 w-4" />
                    {isSubmitting ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
} 