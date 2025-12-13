import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Head, router, Link } from '@inertiajs/react';
import { Calendar, Clock, User, MapPin, Stethoscope, AlertCircle, CheckCircle } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';

interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
}

interface AppointmentDetails {
    id: number;
    service_id?: number;
    location_id?: number;
    mode?: string;
    service?: {
        name: string;
        duration?: number;
    };
    location?: {
        name: string;
        address?: string;
    };
}

interface WaitingListEntry {
    id: number;
    preferred_day: string;
    preferred_time: string;
    notes?: string;
}

interface Props {
    success: boolean;
    token: string;
    patient: Patient;
    appointmentDate: string;
    appointmentDetails?: AppointmentDetails;
    expiresAt: string;
    waitingListEntry: WaitingListEntry;
}

export default function SlotConfirmation({
    success,
    token,
    patient,
    appointmentDate,
    appointmentDetails,
    expiresAt,
    waitingListEntry
}: Props) {
    const [isConfirming, setIsConfirming] = useState(false);

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatExpiryTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleConfirmAppointment = () => {
        if (isConfirming) return;

        setIsConfirming(true);

        router.post(route('waiting-list.confirm', token), {}, {
            onSuccess: () => {
                // The controller will redirect to SlotAccepted page
            },
            onError: () => {
                setIsConfirming(false);
            },
        });
    };

    if (!success) {
        return (
            <div className="bg-muted min-h-screen flex flex-col items-center justify-center p-6">
                <Head title="Appointment Offer Expired" />

                {/* Logo */}
                <div className="mb-8">
                    <AppLogoIcon className="h-6 w-24 fill-current text-black dark:text-white" />
                </div>

                <Card className="max-w-md w-full">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h1 className="text-xl font-semibold text-gray-900 mb-2">
                            Offer Expired
                        </h1>
                        <p className="text-gray-600">
                            This appointment offer is no longer available. Please join the waiting list again if you're still interested.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="bg-muted min-h-screen flex flex-col items-center justify-center p-6">
            <Head title="Confirm Your Appointment" />

            {/* Logo */}
            <div className="mb-8">
                <AppLogoIcon className="h-6 w-24 fill-current text-black dark:text-white" />
            </div>

            <div className="w-full max-w-2xl space-y-6">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-8 h-8 text-green-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            🎉 Appointment Available!
                        </h1>
                        <p className="text-lg text-gray-600">
                            Please review the details below and confirm your appointment
                        </p>
                    </div>

                    {/* Urgency Banner */}
                    <div className="bg-amber-100 border border-amber-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <div className="flex-1">
                                <p className="text-amber-800 font-medium">
                                    ⏰ Time Sensitive: This offer expires on {formatExpiryTime(expiresAt)}
                                </p>
                                <p className="text-amber-700 text-sm">
                                    Click "Confirm Appointment" to secure your slot
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Patient Information */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-600" />
                                Patient Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Full Name</label>
                                    <p className="text-lg font-semibold text-gray-900">
                                        {patient.first_name} {patient.last_name}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Email</label>
                                    <p className="text-gray-900">{patient.email}</p>
                                </div>
                                {patient.phone_number && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Phone</label>
                                        <p className="text-gray-900">{patient.phone_number}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Appointment Details */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-green-600" />
                                Appointment Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Date & Time */}
                                <div className="bg-green-50 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <Clock className="h-5 w-5 text-green-600" />
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">Date & Time</label>
                                            <p className="text-lg font-semibold text-gray-900">
                                                {formatDateTime(appointmentDate)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Service */}
                                {appointmentDetails?.service && (
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <Stethoscope className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">Service</label>
                                            <p className="font-semibold text-gray-900">
                                                {appointmentDetails.service.name}
                                            </p>
                                            {appointmentDetails.service.duration && (
                                                <p className="text-sm text-gray-600">
                                                    Duration: {appointmentDetails.service.duration} minutes
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Mode */}
                                {appointmentDetails?.mode && (
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className="capitalize">
                                            {appointmentDetails.mode} Appointment
                                        </Badge>
                                    </div>
                                )}

                                {/* Location */}
                                {appointmentDetails?.location && (
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <MapPin className="h-5 w-5 text-red-600" />
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">Location</label>
                                            <p className="font-semibold text-gray-900">
                                                {appointmentDetails.location.name}
                                            </p>
                                            {appointmentDetails.location.address && (
                                                <p className="text-sm text-gray-600">
                                                    {appointmentDetails.location.address}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Your Preferences */}
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-gray-600">
                                Your Waiting List Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-600">Preferred Day:</span>
                                    <span className="ml-2 capitalize font-medium">
                                        {waitingListEntry.preferred_day}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Preferred Time:</span>
                                    <span className="ml-2 capitalize font-medium">
                                        {waitingListEntry.preferred_time}
                                    </span>
                                </div>
                            </div>
                            {waitingListEntry.notes && (
                                <div className="mt-3 pt-3 border-t">
                                    <span className="text-gray-600 text-sm">Your Notes:</span>
                                    <p className="text-sm text-gray-900 mt-1">{waitingListEntry.notes}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            onClick={handleConfirmAppointment}
                            disabled={isConfirming}
                            size="lg"
                            className="flex-1 sm:flex-none px-8 py-3 text-lg font-semibold bg-green-600 hover:bg-green-700"
                        >
                            {isConfirming ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    Confirming...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-5 w-5 mr-2" />
                                    Confirm Appointment
                                </>
                            )}
                        </Button>
                    </div>

                {/* Footer Info */}
                <div className="text-center text-sm text-gray-600">
                    <p>
                        By confirming, you agree to attend this appointment at the scheduled time.
                        You will receive a confirmation email with additional details.
                    </p>
                </div>
            </div>
        </div>
    );
}