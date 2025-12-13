'use client';

import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Clock, Plus, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { getNextOnboardingStep, getOnboardingStatusFromProps } from '@/utils/onboarding-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import AppLogoIcon from '@/components/app-logo-icon';
import { Head } from '@inertiajs/react';

interface VirtualOperatingHoursProps {
    appointmentType?: 'virtual' | 'hybrid' | null;
}

interface DayOperatingHours {
    day_of_week: string;
    is_enabled: boolean;
    time_slots: Array<{
        start_time: string;
        end_time: string;
    }>;
}

const daysOfWeek = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
];

export default function VirtualOperatingHours({ appointmentType = 'virtual' }: VirtualOperatingHoursProps) {
    const [daysData, setDaysData] = useState<DayOperatingHours[]>(() => {
        return daysOfWeek.map(day => ({
            day_of_week: day.key,
            is_enabled: false,
            time_slots: []
        }));
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const updateDayEnabled = (dayIndex: number, enabled: boolean) => {
        setDaysData(prev => {
            const newData = [...prev];
            newData[dayIndex] = {
                ...newData[dayIndex],
                is_enabled: enabled,
                time_slots: enabled && newData[dayIndex].time_slots.length === 0 
                    ? [{ start_time: '09:00', end_time: '17:00' }]
                    : newData[dayIndex].time_slots
            };
            return newData;
        });
    };

    const addTimeSlot = (dayIndex: number) => {
        setDaysData(prev => {
            const newData = [...prev];
            const lastSlot = newData[dayIndex].time_slots[newData[dayIndex].time_slots.length - 1];
            const defaultStart = lastSlot ? lastSlot.end_time : '09:00';
            const defaultEnd = lastSlot ? '17:00' : '17:00';
            
            newData[dayIndex] = {
                ...newData[dayIndex],
                time_slots: [
                    ...newData[dayIndex].time_slots,
                    { start_time: defaultStart, end_time: defaultEnd }
                ]
            };
            return newData;
        });
    };

    const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
        setDaysData(prev => {
            const newData = [...prev];
            newData[dayIndex] = {
                ...newData[dayIndex],
                time_slots: newData[dayIndex].time_slots.filter((_, i) => i !== slotIndex)
            };
            // If no time slots left, disable the day
            if (newData[dayIndex].time_slots.length === 0) {
                newData[dayIndex].is_enabled = false;
            }
            return newData;
        });
    };

    const updateTimeSlot = (dayIndex: number, slotIndex: number, field: 'start_time' | 'end_time', value: string) => {
        setDaysData(prev => {
            const newData = [...prev];
            newData[dayIndex].time_slots[slotIndex][field] = value;
            return newData;
        });
    };

    const handleSubmit = () => {
        // Validate that at least one day is enabled with time slots
        const hasEnabledDays = daysData.some(day => day.is_enabled && day.time_slots.length > 0);
        
        if (!hasEnabledDays) {
            alert('Please enable at least one day and set operating hours.');
            return;
        }

        setIsSubmitting(true);

        // Send operating hours data to backend to create virtual location
        router.post('/create-virtual-location', {
            operating_hours: daysData
        }, {
            onSuccess: (page) => {
                // Determine next step based on practice type and appointment type
                const pageProps = page.props as any;
                const practiceType = pageProps.practiceType || null;
                const appointmentType = pageProps.appointmentType || null;
                const onboardingStatus = getOnboardingStatusFromProps(pageProps);
                
                // After creating virtual location, location is complete, so check next step
                const nextStep = getNextOnboardingStep(practiceType, appointmentType, {
                    ...onboardingStatus,
                    hasLocation: true, // Virtual location was just created
                });
                
                if (nextStep) {
                    router.visit(nextStep);
                } else {
                    // Complete onboarding
                    router.visit('/dashboard');
                }
            },
            onError: (errors) => {
                console.error('Failed to create virtual location:', errors);
                setIsSubmitting(false);
            },
        });
    };

    return (
        <>
            <Head title="Set Your Operating Hours" />
            {/* Logo - Fixed at top */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-br from-gray-50 to-gray-100 py-4 flex justify-center">
                <AppLogoIcon className="h-7 w-auto" />
            </div>
            
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-3 pt-20">
                <div className="w-full max-w-2xl">
                    <Card className="border-2 shadow-xl">
                        <CardHeader className="text-center pb-3 pt-4">
                            <CardTitle className="text-xl font-bold text-gray-900 mb-1">
                                Set Your Operating Hours
                            </CardTitle>
                            <CardDescription className="text-xs text-gray-600 mb-2">
                                Tell us when you&apos;re available for virtual appointments
                            </CardDescription>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                                <p className="text-xs text-blue-800">
                                    <strong>Note:</strong> These operating hours are specifically for your virtual appointments. If you want to add physical locations, you can always add them later from the settings page.
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2 px-4 pb-4">
                            <div className="grid grid-cols-1 gap-2">
                                {daysOfWeek.map((day, dayIndex) => {
                                    const dayData = daysData[dayIndex];
                                    
                                    return (
                                        <div key={day.key} className="border rounded-md p-2 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`day-${day.key}`}
                                                        checked={dayData.is_enabled}
                                                        onCheckedChange={(checked) => updateDayEnabled(dayIndex, checked as boolean)}
                                                        className="h-4 w-4"
                                                    />
                                                    <Label htmlFor={`day-${day.key}`} className="text-xs font-semibold text-gray-900 cursor-pointer">
                                                        {day.label}
                                                    </Label>
                                                </div>
                                                {dayData.is_enabled && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addTimeSlot(dayIndex)}
                                                        className="h-6 text-xs px-2"
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Add
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            {dayData.is_enabled && (
                                                <div className="space-y-1 pl-6">
                                                    {dayData.time_slots.map((slot, slotIndex) => (
                                                        <div key={slotIndex} className="flex items-center gap-1.5">
                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                <Input
                                                                    type="time"
                                                                    value={slot.start_time}
                                                                    onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'start_time', e.target.value)}
                                                                    className="w-24 h-7 text-xs"
                                                                />
                                                                <span className="text-xs text-gray-400">-</span>
                                                                <Input
                                                                    type="time"
                                                                    value={slot.end_time}
                                                                    onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'end_time', e.target.value)}
                                                                    className="w-24 h-7 text-xs"
                                                                />
                                                            </div>
                                                            {dayData.time_slots.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="pt-2 flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.visit('/dashboard?onboarding=true')}
                                    className="flex-1 h-9 text-sm"
                                    disabled={isSubmitting}
                                >
                                    <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                                    Back
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold"
                                >
                                    {isSubmitting ? 'Creating...' : 'Continue to Setup'}
                                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

