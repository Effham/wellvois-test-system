import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, MapPin, Calendar, Plus, X, CalendarClock, ArrowRight, ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import OnboardingLayout from '@/components/onboarding-layout';
import axios from 'axios';

interface Location {
    id: number;
    name: string;
    address: string;
    city: string;
    province: string;
    timezone: string;
}

interface TimeSlot {
    startTime: string;
    endTime: string;
}

interface DaySchedule {
    day: string;
    isAvailable: boolean;
    timeSlots: TimeSlot[];
}

interface LocationSchedule {
    location: Location;
    schedule: DaySchedule[];
    hasSchedule: boolean;
}

interface PageProps {
    locations?: Array<{
        id: number;
        name: string;
        address: string;
        city: string;
        province: string;
        timezone: string;
        schedule?: DaySchedule[];
        hasSchedule?: boolean;
        hasAvailability?: boolean;
    }>;
    practitionerId?: number;
    practitioner?: {
        id: number;
    };
    appointmentType?: string;
    nextRoute?: string;
    shouldCompleteOnboarding?: boolean;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREVIATIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function LocationServiceIndex() {
    const { props } = usePage<PageProps>();
    const pageProps = props as PageProps;

    // Get locations from props or use empty array as fallback
    const propsLocations = pageProps?.locations || [];
    
    // Transform locations to LocationSchedule format
    const initialLocations: LocationSchedule[] = propsLocations.length > 0
        ? propsLocations.map(loc => ({
            location: {
                id: loc.id,
                name: loc.name,
                address: loc.address || '',
                city: loc.city || '',
                province: loc.province || '',
                timezone: loc.timezone || 'America/Toronto',
            },
            schedule: loc.schedule || [],
            hasSchedule: loc.hasSchedule || loc.hasAvailability || false,
        }))
        : []; // Empty array if no locations provided

    const [locations, setLocations] = useState<LocationSchedule[]>(initialLocations);
    const [currentLocationIndex, setCurrentLocationIndex] = useState(0);
    const [openDialogLocationId, setOpenDialogLocationId] = useState<number | null>(null);
    const [scheduleForm, setScheduleForm] = useState<Record<string, DaySchedule>>({});
    const [activeDayTab, setActiveDayTab] = useState('Monday');

    const currentLocation = locations[currentLocationIndex];
    const locationsWithSchedule = locations.filter(loc => loc.hasSchedule).length;
    const totalLocations = locations.length;
    const allSchedulesComplete = locationsWithSchedule === totalLocations && totalLocations > 0;

    const handleOpenDialog = (locationId: number) => {
        const locationSchedule = locations.find(l => l.location.id === locationId);
        if (locationSchedule) {
            const formData: Record<string, DaySchedule> = {};
            DAYS_OF_WEEK.forEach(day => {
                const existingDay = locationSchedule.schedule.find(s => s.day === day);
                formData[day] = existingDay || {
                    day,
                    isAvailable: false,
                    timeSlots: [],
                };
            });
            setScheduleForm(formData);
            setOpenDialogLocationId(locationId);
            setActiveDayTab('Monday');
        }
    };

    const handleCloseDialog = () => {
        setOpenDialogLocationId(null);
        setScheduleForm({});
    };

    const handleDayAvailabilityChange = (day: string, isAvailable: boolean) => {
        setScheduleForm(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                day,
                isAvailable,
                timeSlots: isAvailable && prev[day]?.timeSlots.length === 0 
                    ? [{ startTime: '09:00', endTime: '17:00' }] 
                    : prev[day]?.timeSlots || [],
            },
        }));
    };

    const handleAddTimeSlot = (day: string) => {
        setScheduleForm(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                day,
                timeSlots: [...(prev[day]?.timeSlots || []), { startTime: '09:00', endTime: '17:00' }],
            },
        }));
    };

    const handleRemoveTimeSlot = (day: string, index: number) => {
        setScheduleForm(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                day,
                timeSlots: prev[day]?.timeSlots.filter((_, i) => i !== index) || [],
            },
        }));
    };

    const handleTimeSlotChange = (day: string, index: number, field: 'startTime' | 'endTime', value: string) => {
        setScheduleForm(prev => {
            const daySchedule = prev[day];
            const updatedTimeSlots = [...(daySchedule?.timeSlots || [])];
            updatedTimeSlots[index] = {
                ...updatedTimeSlots[index],
                [field]: value,
            };
            return {
                ...prev,
                [day]: {
                    ...prev[day],
                    day,
                    timeSlots: updatedTimeSlots,
                },
            };
        });
    };

    const handleSaveSchedule = async () => {
        if (openDialogLocationId === null) return;

        const updatedSchedule: DaySchedule[] = DAYS_OF_WEEK.map(day => ({
            day,
            isAvailable: scheduleForm[day]?.isAvailable || false,
            timeSlots: scheduleForm[day]?.isAvailable ? (scheduleForm[day]?.timeSlots || []) : [],
        }));

        const hasAnySchedule = updatedSchedule.some(day => day.isAvailable && day.timeSlots.length > 0);

        try {
            // Save to API - prioritize practitionerId prop, fallback to practitioner.id
            const practitionerId = pageProps?.practitionerId || pageProps?.practitioner?.id;
            if (!practitionerId) {
                console.error('Practitioner ID not found. Cannot save availability.');
                alert('Error: Practitioner ID not found. Please refresh the page and try again.');
                return;
            }
            
            await axios.post(route('onboarding.practitioner-availability.store'), {
                practitioner_id: practitionerId,
                location_id: openDialogLocationId,
                schedule: updatedSchedule,
            });

            // Update local state
            setLocations(prev => prev.map(locationSchedule => {
                if (locationSchedule.location.id === openDialogLocationId) {
                    return {
                        ...locationSchedule,
                        schedule: updatedSchedule,
                        hasSchedule: hasAnySchedule,
                    };
                }
                return locationSchedule;
            }));

            handleCloseDialog();
        } catch (error) {
            console.error('Failed to save schedule:', error);
            // Optionally show error message to user
        }
    };

    const handleNext = () => {
        if (currentLocationIndex < locations.length - 1) {
            setCurrentLocationIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentLocationIndex > 0) {
            setCurrentLocationIndex(prev => prev - 1);
        }
    };

    const handleContinue = () => {
        const nextRoute = pageProps?.nextRoute || '/dashboard';
        
        // If all schedules are complete and services exist, complete onboarding
        if (allSchedulesComplete && pageProps?.shouldCompleteOnboarding) {
            // Mark onboarding as complete and redirect to dashboard
            router.post(route('complete-onboarding'));
        } else {
            router.visit(nextRoute);
        }
    };

    const handleGoToLocation = (index: number) => {
        setCurrentLocationIndex(index);
    };

    const selectedLocation = locations.find(l => l.location.id === openDialogLocationId);

    // Check if practitioner ID is available
    const practitionerId = pageProps?.practitionerId || pageProps?.practitioner?.id;
    if (!practitionerId && locations.length > 0) {
        return (
            <OnboardingLayout title="Location & Service Schedule">
                <Head title="Location & Service Schedule" />
                <div className="w-full max-w-5xl mx-auto px-4 py-6">
                    <div className="text-center py-12">
                        <CalendarClock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Practitioner Not Found
                        </h2>
                        <p className="text-gray-600 mb-4">
                            Unable to find your practitioner profile. Please complete practitioner registration first.
                        </p>
                        <Button onClick={() => router.visit('/onboarding/practitioner/create')}>
                            Go to Practitioner Registration
                        </Button>
                    </div>
                </div>
            </OnboardingLayout>
        );
    }

    // Show message if no locations
    if (locations.length === 0) {
        return (
            <OnboardingLayout title="Location & Service Schedule">
                <Head title="Location & Service Schedule" />
                <div className="w-full max-w-5xl mx-auto px-4 py-6">
                    <div className="text-center py-12">
                        <CalendarClock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            No Locations Found
                        </h2>
                        <p className="text-gray-600">
                            Please create locations before setting availability.
                        </p>
                    </div>
                </div>
            </OnboardingLayout>
        );
    }

    return (
        <OnboardingLayout title="Location & Service Schedule">
            <Head title="Location & Service Schedule" />
            <div className="w-full max-w-5xl mx-auto px-4 py-6">
                <div className="mb-4">
                    <div className="flex items-center gap-3 mb-1">
                        <CalendarClock className="h-6 w-6 text-primary" />
                        <h1 className="text-3xl font-bold text-gray-900">
                            Manage Your Availability
                        </h1>
                    </div>
                    <p className="text-gray-600 text-sm">
                        Set your working hours and availability for all of your locations.
                    </p>
                </div>

                {/* Combined Progress and Location Card */}
                {currentLocation && (
                    <Card className="border-2 border-gray-200 shadow-sm">
                        {/* Progress Indicator Section */}
                        <CardContent className="py-3 px-6 border-b">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-700">
                                        {locationsWithSchedule} of {totalLocations} locations completed
                                    </span>
                                    {locationsWithSchedule > 0 && (
                                        <span className="text-xs text-gray-600">
                                            ({locations.filter(l => l.hasSchedule).map(l => l.location.name).join(', ')})
                                        </span>
                                    )}
                                </div>
                                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                                    {Math.round((locationsWithSchedule / totalLocations) * 100)}%
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div 
                                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${(locationsWithSchedule / totalLocations) * 100}%` }}
                                    />
                                </div>
                                <div className="flex gap-1">
                                    {locations.map((locationSchedule, index) => (
                                        <TooltipProvider key={locationSchedule.location.id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => handleGoToLocation(index)}
                                                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                            index === currentLocationIndex
                                                                ? 'border-primary bg-primary text-white'
                                                                : locationSchedule.hasSchedule
                                                                ? 'border-green-500 bg-green-500 text-white'
                                                                : 'border-gray-300 bg-white text-gray-400'
                                                        }`}
                                                    >
                                                        {locationSchedule.hasSchedule ? (
                                                            <CheckCircle2 className="h-3 w-3" />
                                                        ) : (
                                                            <span className="text-xs font-bold">{index + 1}</span>
                                                        )}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="text-xs">
                                                        {locationSchedule.location.name} - {locationSchedule.hasSchedule ? 'Completed' : 'Pending'}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                </div>
                            </div>
                        </CardContent>

                        {/* Location Header */}
                        <CardHeader className="pb-3">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentLocation.location.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-start justify-between"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CardTitle className="text-xl font-bold text-gray-900">
                                                {currentLocation.location.name}
                                            </CardTitle>
                                            {currentLocation.hasSchedule && (
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            )}
                                        </div>
                                        <CardDescription className="text-sm flex items-center gap-2">
                                            <MapPin className="h-3 w-3 text-gray-500" />
                                            <span>
                                                {currentLocation.location.address}, {currentLocation.location.city}
                                            </span>
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleOpenDialog(currentLocation.location.id)}
                                        className="flex items-center gap-2 shrink-0"
                                    >
                                        {currentLocation.hasSchedule ? (
                                            <>
                                                <Calendar className="h-4 w-4" />
                                                Edit Schedule
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4" />
                                                Add Schedule
                                            </>
                                        )}
                                    </Button>
                                </motion.div>
                            </AnimatePresence>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentLocation.location.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {currentLocation.hasSchedule && currentLocation.schedule.length > 0 ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-7 gap-2">
                                                {currentLocation.schedule.map((daySchedule, index) => {
                                                    const hasMoreSlots = daySchedule.timeSlots.length > 2;
                                                    return (
                                                        <TooltipProvider key={index}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        className={`p-2 rounded-lg border text-center cursor-pointer transition-all hover:shadow-md ${
                                                                            daySchedule.isAvailable && daySchedule.timeSlots.length > 0
                                                                                ? 'border-green-300 bg-green-50 hover:border-green-400'
                                                                                : 'border-gray-200 bg-gray-50'
                                                                        }`}
                                                                        onClick={() => handleOpenDialog(currentLocation.location.id)}
                                                                    >
                                                                        <div className="text-xs font-semibold text-gray-900 mb-1">
                                                                            {DAY_ABBREVIATIONS[index]}
                                                                        </div>
                                                                        {daySchedule.isAvailable && daySchedule.timeSlots.length > 0 ? (
                                                                            <div className="space-y-0.5">
                                                                                {daySchedule.timeSlots.slice(0, 2).map((slot, slotIndex) => (
                                                                                    <div key={slotIndex} className="text-[10px] text-gray-700 leading-tight">
                                                                                        {slot.startTime}-{slot.endTime}
                                                                                    </div>
                                                                                ))}
                                                                                {hasMoreSlots && (
                                                                                    <div className="text-[10px] text-primary font-medium">
                                                                                        +{daySchedule.timeSlots.length - 2} more
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[10px] text-gray-500">Closed</div>
                                                                        )}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                {hasMoreSlots && (
                                                                    <TooltipContent>
                                                                        <p className="text-xs max-w-xs">
                                                                            Click to see all {daySchedule.timeSlots.length} time slots for {daySchedule.day}. 
                                                                            Click "Edit Schedule" to modify.
                                                                        </p>
                                                                    </TooltipContent>
                                                                )}
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                            <p className="text-sm text-gray-600">
                                                No schedule set. Click "Add Schedule" to set your availability.
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </CardContent>

                        {/* Navigation Buttons - Inside Card */}
                        <div className="border-t pt-3 mt-3 px-6 pb-4">
                            <div className="flex items-center justify-between">
                                <Button
                                    variant="outline"
                                    onClick={handlePrevious}
                                    disabled={currentLocationIndex === 0}
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Previous
                                </Button>

                                {currentLocationIndex < locations.length - 1 ? (
                                    <Button
                                        variant="outline"
                                        onClick={handleNext}
                                        disabled={!currentLocation?.hasSchedule}
                                        size="sm"
                                        className="flex items-center gap-2"
                                    >
                                        Next
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="default"
                                        onClick={handleContinue}
                                        disabled={!allSchedulesComplete}
                                        size="sm"
                                        className="flex items-center gap-2"
                                    >
                                        Continue
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {locations.length === 0 && (
                    <Card className="border-2 border-dashed border-gray-300 mt-4">
                        <CardContent className="py-12">
                            <div className="text-center">
                                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    No Locations Assigned
                                </h3>
                                <p className="text-gray-600 mb-4">
                                    You haven't been assigned to any locations yet.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Schedule Dialog - Tabbed by Day */}
            <Dialog open={openDialogLocationId !== null} onOpenChange={(open) => !open && handleCloseDialog()}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader className="shrink-0 pb-3">
                        <DialogTitle className="text-xl font-bold">
                            Set Schedule for {selectedLocation?.location.name}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                            Configure availability for each day. You can add multiple time slots per day.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs value={activeDayTab} onValueChange={setActiveDayTab} className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid grid-cols-7 w-full shrink-0">
                            {DAYS_OF_WEEK.map((day) => {
                                const daySchedule = scheduleForm[day];
                                const isCompleted = daySchedule?.isAvailable && daySchedule?.timeSlots.length > 0;
                                return (
                                    <TabsTrigger 
                                        key={day} 
                                        value={day}
                                        className={`text-xs px-1 py-1.5 ${
                                            isCompleted ? 'data-[state=active]:bg-green-100 data-[state=active]:text-green-700' : ''
                                        }`}
                                    >
                                        {DAY_ABBREVIATIONS[DAYS_OF_WEEK.indexOf(day)]}
                                        {isCompleted && <CheckCircle2 className="h-3 w-3 ml-1" />}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>

                        <div className="flex-1 overflow-hidden">
                            {DAYS_OF_WEEK.map((day) => {
                                const daySchedule = scheduleForm[day] || { day, isAvailable: false, timeSlots: [] };
                                
                                return (
                                    <TabsContent key={day} value={day} className="mt-4 h-full overflow-y-auto">
                                        <div className="space-y-4 pb-2">
                                            <div className="flex items-center justify-between pb-2 border-b">
                                                <Label className="text-base font-semibold text-gray-900">
                                                    {day}
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`${day}-available`}
                                                        checked={daySchedule.isAvailable}
                                                        onCheckedChange={(checked) => 
                                                            handleDayAvailabilityChange(day, checked === true)
                                                        }
                                                    />
                                                    <Label 
                                                        htmlFor={`${day}-available`} 
                                                        className="text-sm font-normal cursor-pointer"
                                                    >
                                                        Available
                                                    </Label>
                                                </div>
                                            </div>

                                            {daySchedule.isAvailable && (
                                                <div className="space-y-3">
                                                    {daySchedule.timeSlots.map((slot, slotIndex) => (
                                                        <div key={slotIndex} className="flex items-center gap-3">
                                                            <div className="grid grid-cols-2 gap-3 flex-1">
                                                                <div className="space-y-1">
                                                                    <Label htmlFor={`${day}-start-${slotIndex}`} className="text-xs text-gray-700">
                                                                        Start Time
                                                                    </Label>
                                                                    <Input
                                                                        id={`${day}-start-${slotIndex}`}
                                                                        type="time"
                                                                        value={slot.startTime}
                                                                        onChange={(e) => 
                                                                            handleTimeSlotChange(day, slotIndex, 'startTime', e.target.value)
                                                                        }
                                                                        className="h-9 text-sm"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label htmlFor={`${day}-end-${slotIndex}`} className="text-xs text-gray-700">
                                                                        End Time
                                                                    </Label>
                                                                    <Input
                                                                        id={`${day}-end-${slotIndex}`}
                                                                        type="time"
                                                                        value={slot.endTime}
                                                                        onChange={(e) => 
                                                                            handleTimeSlotChange(day, slotIndex, 'endTime', e.target.value)
                                                                        }
                                                                        className="h-9 text-sm"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {daySchedule.timeSlots.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveTimeSlot(day, slotIndex)}
                                                                    className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleAddTimeSlot(day)}
                                                        className="w-full"
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Add Another Time Slot
                                                    </Button>
                                                </div>
                                            )}

                                            {!daySchedule.isAvailable && (
                                                <div className="text-sm text-gray-500 italic py-4">
                                                    This day is marked as closed
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                );
                            })}
                        </div>
                    </Tabs>

                    <DialogFooter className="shrink-0 border-t pt-3 mt-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCloseDialog}
                            size="sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveSchedule}
                            size="sm"
                        >
                            Save Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OnboardingLayout>
    );
}
