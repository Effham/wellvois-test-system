import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { withAppLayout } from '@/utils/layout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { Shield, Save, ArrowLeft } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { getTenantTimezone } from '@/hooks/use-time-locale';

interface Practitioner {
    id: number;
    name: string;
}

interface Appointment {
    id: number;
    appointment_datetime: string;
    appointment_datetime_local?: string;
    practitioners_list?: Array<{id: number; name: string}>;
    practitioners_detail?: Array<{
        id: number; 
        name: string; 
        is_primary: boolean;
    }>;
    primary_practitioner_id?: number;
}

interface Props {
    appointment: Appointment;
    practitioners: Practitioner[];
}

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '/appointments' },
    { title: 'Manage Appointment', href: '' },
];

function ManageAppointment({ appointment, practitioners }: Props) {
    const { flash }: any = usePage().props;
    const [updatingAppointment, setUpdatingAppointment] = useState(false);

    // Parse appointment_datetime_local (backend format: 'Y-m-d H:i:s' like "2025-10-30 14:30:00")
    // HTML date input requires YYYY-MM-DD format, time input requires HH:MM format
    const parseAppointmentDateTime = () => {
        // Prefer appointment_datetime_local if available (already in tenant timezone)
        if (appointment.appointment_datetime_local) {
            const [datePart, timePart] = appointment.appointment_datetime_local.split(' ');
            // Extract YYYY-MM-DD from datePart
            const dateValue = datePart || '';
            // Extract HH:MM from timePart (H:i:s format like "14:30:00")
            const timeValue = timePart ? timePart.substring(0, 5) : '';
            return { dateValue, timeValue };
        }
        
        // Fallback: parse appointment_datetime (UTC)
        if (appointment.appointment_datetime) {
            const date = new Date(appointment.appointment_datetime);
            if (!isNaN(date.getTime())) {
                const dateValue = date.toISOString().split('T')[0]; // YYYY-MM-DD
                const hours = date.getUTCHours().toString().padStart(2, '0');
                const minutes = date.getUTCMinutes().toString().padStart(2, '0');
                const timeValue = `${hours}:${minutes}`; // HH:MM
                return { dateValue, timeValue };
            }
        }
        
        return { dateValue: '', timeValue: '' };
    };

    const { dateValue: initialDate, timeValue: initialTime } = parseAppointmentDateTime();

    // Get practitioner IDs
    const practitionerIds = appointment.practitioners_list?.map(p => p.id) || [];

    // Get primary practitioner
    const primaryPractitionerId = (() => {
        if (appointment.practitioners_detail) {
            const primary = appointment.practitioners_detail.find((p: any) => p.is_primary);
            return primary?.id || null;
        }
        return appointment.primary_practitioner_id || (practitionerIds.length > 0 ? practitionerIds[0] : null);
    })();

    // Form state
    const [manageForm, setManageForm] = useState({
        appointment_date: initialDate,
        appointment_time: initialTime,
        practitioner_ids: practitionerIds,
        primary_practitioner_id: primaryPractitionerId,
        reason: ''
    });

    // Handle flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                description: 'Operation completed successfully.',
                duration: 4000,
            });
        }
        if (flash?.error) {
            toast.error(flash.error, {
                description: 'Please try again or contact support if the issue persists.',
                duration: 5000,
            });
        }
    }, [flash]);

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!manageForm.reason.trim()) {
            toast.error('Please provide a reason for the appointment change');
            return;
        }

        // Validate primary practitioner is selected
        if (!manageForm.primary_practitioner_id) {
            toast.error('Please select a primary practitioner');
            return;
        }

        // Validate primary practitioner is in the practitioner list
        if (!manageForm.practitioner_ids.includes(manageForm.primary_practitioner_id)) {
            toast.error('Primary practitioner must be one of the selected practitioners');
            return;
        }

        setUpdatingAppointment(true);

        try {
            await router.patch(route('appointments.updateManageAppointment', appointment.id), {
                appointment_date: manageForm.appointment_date,
                appointment_time: manageForm.appointment_time,
                practitioner_ids: manageForm.practitioner_ids,
                primary_practitioner_id: manageForm.primary_practitioner_id,
                reason: manageForm.reason
            }, {
                preserveState: false,
                onSuccess: () => {
                    router.visit('/appointments');
                },
                onError: () => {
                    toast.error('Failed to update appointment');
                },
                onFinish: () => {
                    setUpdatingAppointment(false);
                },
            });
        } catch (error) {
            toast.error('An error occurred while updating the appointment');
            setUpdatingAppointment(false);
        }
    };

    const safePractitioners = practitioners || [];

    return (
        <>
            <Head title="Manage Appointment" />
            <Toaster position="top-right" richColors />

            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-6">
                    <Link href="/appointments">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Appointments
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <h1 className="text-2xl font-bold">Manage Appointment #{appointment.id}</h1>
                        <p className="text-sm text-gray-500">Update appointment details and practitioners</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Date and Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="appointment_date">Date *</Label>
                                    <Input
                                        id="appointment_date"
                                        type="date"
                                        value={manageForm.appointment_date}
                                        onChange={(e) => setManageForm(prev => ({ ...prev, appointment_date: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="appointment_time">Time *</Label>
                                    <Input
                                        id="appointment_time"
                                        type="time"
                                        value={manageForm.appointment_time}
                                        onChange={(e) => setManageForm(prev => ({ ...prev, appointment_time: e.target.value }))}
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Timezone: {getTenantTimezone()}
                                    </p>
                                </div>
                            </div>

                            {/* Primary Practitioner */}
                            {manageForm.practitioner_ids.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Primary Practitioner *</Label>
                                    <Select
                                        value={manageForm.primary_practitioner_id?.toString() || ''}
                                        onValueChange={(value) => {
                                            setManageForm(prev => ({
                                                ...prev,
                                                primary_practitioner_id: parseInt(value)
                                            }));
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select primary practitioner" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {safePractitioners
                                                .filter(p => manageForm.practitioner_ids.includes(p.id))
                                                .map((practitioner) => (
                                                    <SelectItem key={practitioner.id} value={practitioner.id.toString()}>
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="h-4 w-4 text-blue-600" />
                                                            {practitioner.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-600">
                                        The primary practitioner will receive payment for this appointment
                                    </p>
                                </div>
                            )}

                            {/* Other Practitioners */}
                            <div>
                                <Label>Other Practitioners</Label>
                                {(() => {
                                    const availablePractitioners = safePractitioners.filter(p => p.id !== manageForm.primary_practitioner_id);
                                    
                                    if (availablePractitioners.length === 0) {
                                        return (
                                            <div className="mt-2 p-3 border rounded bg-gray-50 text-center text-gray-500">
                                                No other practitioners available
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto border rounded p-3">
                                            {availablePractitioners.map((practitioner) => (
                                                <div key={practitioner.id} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`practitioner-${practitioner.id}`}
                                                        checked={manageForm.practitioner_ids.includes(practitioner.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setManageForm(prev => ({
                                                                    ...prev,
                                                                    practitioner_ids: [...prev.practitioner_ids, practitioner.id]
                                                                }));
                                                            } else {
                                                                setManageForm(prev => ({
                                                                    ...prev,
                                                                    practitioner_ids: prev.practitioner_ids.filter(id => id !== practitioner.id)
                                                                }));
                                                            }
                                                        }}
                                                        className="rounded border-gray-300"
                                                    />
                                                    <Label htmlFor={`practitioner-${practitioner.id}`} className="text-sm font-normal cursor-pointer">
                                                        {practitioner.name}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Reason for Change */}
                            <div>
                                <Label htmlFor="reason">Reason for Change *</Label>
                                <Textarea
                                    id="reason"
                                    placeholder="Please provide a reason for this appointment change..."
                                    value={manageForm.reason}
                                    onChange={(e) => setManageForm(prev => ({ ...prev, reason: e.target.value }))}
                                    required
                                    className={`min-h-[100px] ${!manageForm.reason.trim() ? 'border-red-300 focus:border-red-500' : ''}`}
                                />
                                {!manageForm.reason.trim() && (
                                    <p className="text-red-500 text-sm mt-1">Reason for change is required</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Link href="/appointments">
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    className="flex items-center gap-2"
                                    disabled={updatingAppointment || !manageForm.reason.trim() || !manageForm.appointment_date || !manageForm.appointment_time}
                                >
                                    <Save className="h-4 w-4" />
                                    {updatingAppointment ? 'Updating...' : 'Update Appointment'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default withAppLayout(ManageAppointment, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'Manage Appointment' }
    ]
});

