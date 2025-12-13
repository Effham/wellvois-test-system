import React from 'react';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Calendar, Clock, MapPin, User } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';

interface Props {
    success: boolean;
    message: string;
    appointment?: {
        id: number;
        appointment_datetime: string;
        service?: {
            name: string;
        };
        location?: {
            name: string;
        };
        mode: string;
    };
}

export default function SlotAccepted({ success, message, appointment }: Props) {
    const formatDateTime = (dateTime: string) => {
        return new Date(dateTime).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    return (
        <div className="bg-muted min-h-screen flex flex-col items-center justify-center p-6">
            <Head title={success ? "Appointment Confirmed" : "Slot Not Available"} />

            {/* Logo */}
            <div className="mb-8">
                <AppLogoIcon className="h-6 w-24 fill-current text-black dark:text-white" />
            </div>

            <div className="max-w-md w-full">
                    <Card className="shadow-lg">
                        <CardHeader className="text-center">
                            {success ? (
                                <div className="space-y-4">
                                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-8 h-8 text-green-600" />
                                    </div>
                                    <CardTitle className="text-2xl text-green-700">
                                        Appointment Confirmed!
                                    </CardTitle>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                        <XCircle className="w-8 h-8 text-red-600" />
                                    </div>
                                    <CardTitle className="text-2xl text-red-700">
                                        Slot Not Available
                                    </CardTitle>
                                </div>
                            )}
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="text-center">
                                <p className="text-gray-700 leading-relaxed">
                                    {message}
                                </p>
                            </div>

                            {success && appointment && (
                                <div className="space-y-4">
                                    <div className="border-t pt-4">
                                        <h3 className="font-semibold text-gray-900 mb-3">
                                            Appointment Details
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-sm">
                                                <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                <div>
                                                    <span className="font-medium">Date & Time:</span>
                                                    <br />
                                                    <span className="text-gray-600">
                                                        {formatDateTime(appointment.appointment_datetime)}
                                                    </span>
                                                </div>
                                            </div>

                                            {appointment.service && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                    <div>
                                                        <span className="font-medium">Service:</span>
                                                        <br />
                                                        <span className="text-gray-600">
                                                            {appointment.service.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 text-sm">
                                                <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                                <div>
                                                    <span className="font-medium">Mode:</span>
                                                    <br />
                                                    <span className="text-gray-600 capitalize">
                                                        {appointment.mode}
                                                    </span>
                                                </div>
                                            </div>

                                            {appointment.location && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
                                                    <div>
                                                        <span className="font-medium">Location:</span>
                                                        <br />
                                                        <span className="text-gray-600">
                                                            {appointment.location.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-blue-900 mb-2">
                                            What's Next?
                                        </h4>
                                        <ul className="text-sm text-blue-800 space-y-1">
                                            <li>• You'll receive a confirmation email with all details</li>
                                            <li>• Add this appointment to your personal calendar</li>
                                            <li>• Arrive 15 minutes early for check-in</li>
                                            {appointment.mode === 'virtual' && (
                                                <li>• Virtual meeting details will be sent separately</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {!success && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">
                                        Don't Worry!
                                    </h4>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                        <li>• You're still on our waiting list</li>
                                        <li>• We'll notify you of the next available slot</li>
                                        <li>• Slots become available regularly</li>
                                        <li>• No action needed from you</li>
                                    </ul>
                                </div>
                            )}

                            <div className="pt-4 border-t">
                                <Button
                                    onClick={() => window.close()}
                                    className="w-full"
                                    variant={success ? "default" : "outline"}
                                >
                                    Close Window
                                </Button>
                            </div>
                        </CardContent>
                </Card>
            </div>
        </div>
    );
}