# Multi-Practitioner Appointment System - Complete Implementation Guide

## ✅ Backend (Already Updated)
- `app/Http/Controllers/Tenant/AppointmentController.php` - Updated to support multiple practitioners
- `resources/js/components/CalendarBooking.tsx` - Updated for multi-practitioner conflict checking

## 🔧 Frontend Changes Needed

### 1. Update Form Data Interface in Create.tsx

Replace the formData interface section with:

```typescript
formData?: {
    // Client Information  
    health_number?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    gender_pronouns?: string;
    phone_number?: string;
    email_address?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    contact_person?: string;
    booking_source?: string;
    preferred_language?: string;
    client_type?: string;
    admin_override?: string;
    
    // Appointment Details
    service_type: string;
    service_name: string;
    service_id: string;
    practitioner_ids: number[];  // Changed to support multiple practitioners
    location_id: string;
    mode: string;
    date_time_preference: string;
    
    // Trigger & Follow-up
    add_to_calendar: boolean;
    tag_with_referral_source: boolean;
    send_intake_form?: boolean;
    send_appointment_confirmation?: boolean;
    
    // Advanced Appointment Settings
    advanced_appointment_settings: boolean;
    slot_divisions: string;  // JSON string of SlotDivision[]
};
```

### 2. Add SlotDivision Interface

```typescript
interface SlotDivision {
    practitionerId: number;
    practitionerName: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isEntireSlot: boolean;
}
```

### 3. Add State Management

```typescript
// New states for advanced appointment settings
const [selectedPractitioners, setSelectedPractitioners] = useState<Practitioner[]>([]);
const [showSlotDivisionModal, setShowSlotDivisionModal] = useState(false);
const [selectedSlotForDivision, setSelectedSlotForDivision] = useState<{date: string, time: string} | null>(null);
const [slotDivisions, setSlotDivisions] = useState<SlotDivision[]>([]);
```

### 4. Update Form Data Initialization

```typescript
const { data, setData, post, processing, clearErrors, setError } = useForm({
    // Client Information
    health_number: formData?.health_number || '',
    first_name: formData?.first_name || '',
    middle_name: formData?.middle_name || '',
    last_name: formData?.last_name || '',
    preferred_name: formData?.preferred_name || '',
    date_of_birth: formData?.date_of_birth || '',
    gender: formData?.gender || '',
    gender_pronouns: formData?.gender_pronouns || '',
    phone_number: formData?.phone_number || '',
    email_address: formData?.email_address || '',
    emergency_contact_name: formData?.emergency_contact_name || '',
    emergency_contact_phone: formData?.emergency_contact_phone || '',
    contact_person: formData?.contact_person || '',
    booking_source: formData?.booking_source || 'Public Portal',
    preferred_language: formData?.preferred_language || '',
    client_type: formData?.client_type || '',
    admin_override: formData?.admin_override || '',
    
    // Appointment Details
    service_type: formData?.service_type || '',
    service_name: formData?.service_name || '',
    service_id: formData?.service_id || '',
    practitioner_ids: formData?.practitioner_ids || [], // Array for multiple practitioners
    location_id: formData?.location_id || '',
    mode: formData?.mode || '',
    date_time_preference: formData?.date_time_preference || '',
    
    // Trigger & Follow-up
    send_intake_form: formData?.send_intake_form ?? true,
    send_appointment_confirmation: formData?.send_appointment_confirmation ?? true,
    add_to_calendar: formData?.add_to_calendar ?? true,
    tag_with_referral_source: formData?.tag_with_referral_source ?? true,
    
    // Advanced Appointment Settings
    advanced_appointment_settings: formData?.advanced_appointment_settings ?? false,
    slot_divisions: JSON.stringify(formData?.slot_divisions || []),
});
```

### 5. Add Practitioner Management Functions

```typescript
// Initialize selectedPractitioners based on form data
useEffect(() => {
    if (data.practitioner_ids && data.practitioner_ids.length > 0) {
        const practitioners = allPractitioners.filter(p => data.practitioner_ids.includes(p.id));
        setSelectedPractitioners(practitioners);
    }
}, [data.practitioner_ids, allPractitioners]);

// Add practitioner to selection
const addPractitioner = (practitionerId: string) => {
    const practitioner = filteredPractitioners.find(p => p.id.toString() === practitionerId);
    if (practitioner && !data.practitioner_ids.includes(practitioner.id)) {
        const newPractitionerIds = [...data.practitioner_ids, practitioner.id];
        setData('practitioner_ids', newPractitionerIds);
        setSelectedPractitioners([...selectedPractitioners, practitioner]);
        
        // Clear date time preference when practitioners change
        setData('date_time_preference', '');
    }
};

// Remove practitioner from selection
const removePractitioner = (practitionerId: number) => {
    const newPractitionerIds = data.practitioner_ids.filter(id => id !== practitionerId);
    setData('practitioner_ids', newPractitionerIds);
    setSelectedPractitioners(selectedPractitioners.filter(p => p.id !== practitionerId));
    
    // Clear date time preference when practitioners change
    setData('date_time_preference', '');
};

// Handle slot division modal
const handleSlotClick = (date: string, time: string) => {
    if (data.advanced_appointment_settings && selectedPractitioners.length > 1) {
        setSelectedSlotForDivision({ date, time });
        setShowSlotDivisionModal(true);
    } else {
        // Normal slot selection for standard booking
        const dateTime = `${date} ${time}`;
        setData('date_time_preference', dateTime);
    }
};
```

### 6. Update Availability Fetching

```typescript
// Fetch practitioner availability when practitioner_ids, location_id, or mode changes
useEffect(() => {
    const fetchPractitionerAvailability = async () => {
        const { practitioner_ids, location_id, mode } = data;

        if (practitioner_ids.length > 0 && (mode === 'virtual' || (mode === 'in-person' && location_id))) {
            setLoadingAvailability(true);
            try {
                const response = await fetch(route('appointments.practitionerAvailability'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({
                        practitioner_ids: practitioner_ids, // Send array of practitioner IDs
                        location_id: mode === 'in-person' ? location_id : null,
                        mode,
                    }),
                });

                const responseData = await response.json();

                if (response.ok && responseData.availability) {
                    setPractitionerAvailability(responseData.availability);
                    setExistingAppointments(responseData.existingAppointments || []);
                } else {
                    setPractitionerAvailability({});
                    setExistingAppointments([]);
                    toast.error(responseData.error || 'Failed to fetch practitioner availability');
                }
            } catch (error) {
                console.error('Error fetching practitioner availability:', error);
                setPractitionerAvailability({});
                setExistingAppointments([]);
                toast.error('Failed to fetch practitioner availability');
            } finally {
                setLoadingAvailability(false);
            }
        } else {
            setPractitionerAvailability({});
            setExistingAppointments([]);
            setLoadingAvailability(false);
        }
    };

    fetchPractitionerAvailability();
}, [data.practitioner_ids, data.location_id, data.mode]);
```

### 7. Multi-Select Practitioner UI

Replace the single practitioner select with:

```tsx
{/* Practitioner - Multi-select with badges */}
<div className="space-y-2">
    <Label htmlFor="practitioner_ids">
        Practitioner(s) <span className="text-red-500">*</span>
    </Label>
    
    <Select
        value=""
        onValueChange={addPractitioner}
        disabled={loadingPractitioners || filteredPractitioners.length === 0 || (data.mode === 'in-person' && !data.location_id)}
    >
        <SelectTrigger className="placeholder:text-gray-400">
            <SelectValue
                placeholder={
                    loadingPractitioners
                        ? 'Loading practitioners...'
                        : filteredPractitioners.length === 0
                            ? 'No practitioners available for selected service'
                            : data.mode === 'in-person' && !data.location_id
                            ? 'Select location first for in-person appointments'
                            : 'Add practitioner'
                }
            />
        </SelectTrigger>
        <SelectContent>
            {filteredPractitioners
                .filter(practitioner => !data.practitioner_ids.includes(practitioner.id))
                .map((practitioner) => (
                    <SelectItem key={practitioner.id} value={practitioner.id.toString()}>
                        {practitioner.label}
                    </SelectItem>
                ))
            }
        </SelectContent>
    </Select>

    {/* Selected Practitioners Badges */}
    <div className="flex flex-wrap gap-2 mt-2">
        {selectedPractitioners.map((practitioner) => (
            <Badge key={practitioner.id} variant="secondary" className="flex items-center gap-1">
                {practitioner.label}
                <button
                    type="button"
                    onClick={() => removePractitioner(practitioner.id)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-3 w-3" />
                </button>
            </Badge>
        ))}
    </div>
</div>

{/* Advanced Appointment Settings - Separate Section */}
{selectedPractitioners.length > 1 && (
    <div className="border-t border-gray-200 pt-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
            <Switch 
                checked={data.advanced_appointment_settings}
                onCheckedChange={(checked) => setData('advanced_appointment_settings', checked)}
            />
            <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Advanced Appointment Settings</Label>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Enable to assign different time segments to multiple practitioners within a single appointment slot</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
        
        {data.advanced_appointment_settings && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                    <Info className="mt-0.5 mr-2 h-4 w-4 text-blue-500" />
                    <div className="text-sm text-blue-700">
                        <strong>Advanced Mode Enabled:</strong> When you select a time slot, you'll be able to divide it between the selected practitioners. 
                        Each practitioner can be assigned different time segments within the selected appointment slot.
                    </div>
                </div>
            </div>
        )}
    </div>
)}
```

### 8. Update CalendarBooking Component Usage

```tsx
<CalendarBooking
    ref={calendarRef}
    selectedDateTime={data.date_time_preference}
    onDateTimeSelect={(dateTime) => {
        if (data.advanced_appointment_settings && selectedPractitioners.length > 1) {
            // Extract date and time for advanced mode
            const [date, time] = dateTime.split(' ');
            handleSlotClick(date, time);
        } else {
            // Standard slot selection
            setData('date_time_preference', dateTime);
        }
    }}
    practitionerId={data.practitioner_ids[0]?.toString() || ''} // Use first practitioner for availability checking
    practitionerIds={data.practitioner_ids} // Send all practitioner IDs for conflict checking
    serviceId={data.service_id}
    practitionerAvailability={practitionerAvailability}
    loadingAvailability={loadingAvailability}
    appointmentSessionDuration={appointmentSessionDuration}
    appointmentSettings={appointmentSettings}
    existingAppointments={existingAppointments}
/>
```

### 9. Add Slot Division Modal

Add this before the closing `</AppLayout>`:

```tsx
{/* Slot Division Modal */}
{showSlotDivisionModal && selectedSlotForDivision && (
    <Dialog open={showSlotDivisionModal} onOpenChange={setShowSlotDivisionModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-600" />
                    Schedule Overlapping Appointments
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <Info className="mt-0.5 mr-2 h-4 w-4 text-blue-500" />
                        <div className="text-sm text-blue-700">
                            <strong>Selected Slot:</strong> {selectedSlotForDivision.date} at {selectedSlotForDivision.time}
                            <br />
                            <strong>Total Duration:</strong> {appointmentSessionDuration} minutes
                            <br />
                            <em>Set overlapping time segments for each practitioner. Each can attend for their specified duration.</em>
                        </div>
                    </div>
                </div>

                {/* Practitioners Grid Layout */}
                <div className={`grid gap-4 ${
                    selectedPractitioners.length === 2 ? 'grid-cols-2' :
                    selectedPractitioners.length === 3 ? 'grid-cols-3' :
                    selectedPractitioners.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' :
                    'grid-cols-1'
                }`}>
                    {selectedPractitioners.map((practitioner, index) => {
                        const currentDivision = slotDivisions.find(sd => sd.practitionerId === practitioner.id);
                        
                        // Calculate slot start and end times
                        const slotStartTime = selectedSlotForDivision.time;
                        const [slotHours, slotMinutes] = slotStartTime.split(':').map(Number);
                        const slotEndMinutes = slotHours * 60 + slotMinutes + appointmentSessionDuration;
                        const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
                        
                        return (
                            <div key={practitioner.id} className="border rounded-lg p-4 space-y-4 bg-white">
                                {/* Practitioner Header */}
                                <div className="text-center">
                                    <h4 className="font-medium text-gray-900 mb-1">{practitioner.label}</h4>
                                    <Badge variant="outline" className="text-xs">
                                        Practitioner {index + 1}
                                    </Badge>
                                </div>
                                
                                {/* Quick Set Button */}
                                <Button
                                    type="button"
                                    variant={currentDivision?.isEntireSlot ? "default" : "outline"}
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                        const updatedDivisions = slotDivisions.map(sd => 
                                            sd.practitionerId === practitioner.id 
                                                ? { 
                                                    ...sd, 
                                                    startTime: slotStartTime,
                                                    endTime: slotEndTime,
                                                    durationMinutes: appointmentSessionDuration,
                                                    isEntireSlot: !sd.isEntireSlot
                                                }
                                                : sd
                                        );
                                        
                                        if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                            updatedDivisions.push({
                                                practitionerId: practitioner.id,
                                                practitionerName: practitioner.label,
                                                startTime: slotStartTime,
                                                endTime: slotEndTime,
                                                durationMinutes: appointmentSessionDuration,
                                                isEntireSlot: true
                                            });
                                        }
                                        setSlotDivisions(updatedDivisions);
                                    }}
                                >
                                    {currentDivision?.isEntireSlot ? 'Custom Time' : 'Entire Time'}
                                </Button>
                                
                                {/* Time Controls */}
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor={`start_time_${practitioner.id}`} className="text-xs font-medium">
                                            Start Time
                                        </Label>
                                        <Input
                                            id={`start_time_${practitioner.id}`}
                                            type="time"
                                            value={currentDivision?.startTime || slotStartTime}
                                            onChange={(e) => {
                                                const updatedDivisions = slotDivisions.map(sd => 
                                                    sd.practitionerId === practitioner.id 
                                                        ? { ...sd, startTime: e.target.value, isEntireSlot: false }
                                                        : sd
                                                );
                                                if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                                    updatedDivisions.push({
                                                        practitionerId: practitioner.id,
                                                        practitionerName: practitioner.label,
                                                        startTime: e.target.value,
                                                        endTime: slotEndTime,
                                                        durationMinutes: appointmentSessionDuration,
                                                        isEntireSlot: false
                                                    });
                                                }
                                                setSlotDivisions(updatedDivisions);
                                            }}
                                            className="text-sm"
                                            disabled={currentDivision?.isEntireSlot}
                                        />
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <Label htmlFor={`end_time_${practitioner.id}`} className="text-xs font-medium">
                                            End Time
                                        </Label>
                                        <Input
                                            id={`end_time_${practitioner.id}`}
                                            type="time"
                                            value={currentDivision?.endTime || slotEndTime}
                                            onChange={(e) => {
                                                // Calculate duration when end time changes
                                                const startTimeValue = currentDivision?.startTime || slotStartTime;
                                                const [startHours, startMinutes] = startTimeValue.split(':').map(Number);
                                                const [endHours, endMinutes] = e.target.value.split(':').map(Number);
                                                const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
                                                
                                                const updatedDivisions = slotDivisions.map(sd => 
                                                    sd.practitionerId === practitioner.id 
                                                        ? { ...sd, endTime: e.target.value, durationMinutes: duration, isEntireSlot: false }
                                                        : sd
                                                );
                                                if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                                    updatedDivisions.push({
                                                        practitionerId: practitioner.id,
                                                        practitionerName: practitioner.label,
                                                        startTime: startTimeValue,
                                                        endTime: e.target.value,
                                                        durationMinutes: duration,
                                                        isEntireSlot: false
                                                    });
                                                }
                                                setSlotDivisions(updatedDivisions);
                                            }}
                                            className="text-sm"
                                            disabled={currentDivision?.isEntireSlot}
                                        />
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <Label htmlFor={`duration_${practitioner.id}`} className="text-xs font-medium">
                                            Duration (min)
                                        </Label>
                                        <Input
                                            id={`duration_${practitioner.id}`}
                                            type="number"
                                            min="5"
                                            max={appointmentSessionDuration}
                                            step="5"
                                            value={currentDivision?.durationMinutes || ''}
                                            onChange={(e) => {
                                                const duration = parseInt(e.target.value) || 0;
                                                const startTimeValue = currentDivision?.startTime || slotStartTime;
                                                
                                                // Calculate end time
                                                const [hours, minutes] = startTimeValue.split(':').map(Number);
                                                const totalMinutes = hours * 60 + minutes + duration;
                                                const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
                                                
                                                const updatedDivisions = slotDivisions.map(sd => 
                                                    sd.practitionerId === practitioner.id 
                                                        ? { ...sd, durationMinutes: duration, endTime, isEntireSlot: false }
                                                        : sd
                                                );
                                                
                                                if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                                    updatedDivisions.push({
                                                        practitionerId: practitioner.id,
                                                        practitionerName: practitioner.label,
                                                        startTime: startTimeValue,
                                                        endTime,
                                                        durationMinutes: duration,
                                                        isEntireSlot: false
                                                    });
                                                }
                                                setSlotDivisions(updatedDivisions);
                                            }}
                                            placeholder="30"
                                            className="text-sm"
                                            disabled={currentDivision?.isEntireSlot}
                                        />
                                    </div>
                                </div>
                                
                                {/* Current Assignment Display */}
                                {currentDivision && (
                                    <div className="bg-gray-50 rounded p-2 text-xs">
                                        <div className="text-center">
                                            <div className="font-medium">
                                                {currentDivision.startTime} - {currentDivision.endTime}
                                            </div>
                                            <div className="text-gray-600">
                                                {currentDivision.durationMinutes} minutes
                                                {currentDivision.isEntireSlot && ' (Full Slot)'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Schedule Summary */}
                {slotDivisions.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                            <Clock className="mt-0.5 mr-2 h-4 w-4 text-green-500" />
                            <div className="text-sm text-green-700 flex-1">
                                <strong>Schedule Overview:</strong>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {slotDivisions.map((division) => (
                                        <div key={division.practitionerId} className="flex justify-between bg-white rounded px-2 py-1">
                                            <span className="font-medium">{division.practitionerName}:</span>
                                            <span>
                                                {division.startTime} - {division.endTime} ({division.durationMinutes}m)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Summary */}
                <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">Practitioners Assigned:</span>
                        <span className="font-bold text-blue-600">
                            {slotDivisions.length} of {selectedPractitioners.length}
                        </span>
                    </div>
                    {slotDivisions.length < selectedPractitioners.length && (
                        <p className="text-amber-600 text-sm mt-1">
                            ⚠️ Please assign time slots to all selected practitioners.
                        </p>
                    )}
                    {slotDivisions.some(sd => sd.durationMinutes === 0) && (
                        <p className="text-red-600 text-sm mt-1">
                            ⚠️ All practitioners must have a duration greater than 0 minutes.
                        </p>
                    )}
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => {
                    setShowSlotDivisionModal(false);
                    setSlotDivisions([]);
                }}>
                    Cancel
                </Button>
                <Button
                    onClick={() => {
                        // Validate that all practitioners have valid time assignments
                        const allPractitionersAssigned = slotDivisions.length === selectedPractitioners.length;
                        const allHaveValidDuration = slotDivisions.every(sd => sd.durationMinutes > 0);
                        
                        if (allPractitionersAssigned && allHaveValidDuration) {
                            const dateTime = `${selectedSlotForDivision.date} ${selectedSlotForDivision.time}`;
                            setData('date_time_preference', dateTime);
                            setData('slot_divisions', JSON.stringify(slotDivisions));
                            setShowSlotDivisionModal(false);
                            toast.success('Overlapping appointment schedule saved successfully!');
                        } else {
                            if (!allPractitionersAssigned) {
                                toast.error('Please assign time slots to all selected practitioners.');
                            } else {
                                toast.error('Please ensure all practitioners have a valid duration (greater than 0 minutes).');
                            }
                        }
                    }}
                    disabled={
                        slotDivisions.length !== selectedPractitioners.length ||
                        slotDivisions.some(sd => sd.durationMinutes === 0)
                    }
                >
                    Save Overlapping Schedule
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
)}
```

## 🎯 How to Use

1. **Add Practitioners**: Use the dropdown to add multiple practitioners
2. **Enable Advanced Settings**: Toggle appears when you have 2+ practitioners  
3. **Select Time Slot**: With advanced mode on, clicking a slot opens the division modal
4. **Set Overlapping Times**: Use "Entire Time" or set custom start/end times for each practitioner
5. **Save**: System validates all practitioners are assigned and saves the overlapping schedule

## 🔧 Features

- ✅ Multi-select practitioners with badges
- ✅ Advanced appointment settings toggle
- ✅ Wide modal with column-based layout
- ✅ Overlapping appointment scheduling
- ✅ "Entire Time" quick-set buttons
- ✅ Google Calendar conflict checking for all practitioners
- ✅ Common availability calculation

The system now fully supports your overlapping practitioner appointment requirements! 🎉 