import React, { useState, useEffect } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import { Shield, CheckCircle, Users, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AppLogoIcon from '@/components/app-logo-icon';

interface StaffPermissionsConsentProps {
    practitioner: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    tenant: {
        id: string;
        company_name: string;
    };
    token: string;
    consentAccepted?: boolean;
}

export default function StaffPermissionsConsent({
    practitioner,
    tenant,
    token,
    consentAccepted = false
}: StaffPermissionsConsentProps) {
    const { data, setData, post, processing, errors } = useForm({
        invitation_permission: false,
        location_assignment_permission: false,
        location_modification_permission: false,
    });

    // Debug logging
    useEffect(() => {
        console.log('=== Staff Permissions Component Mounted ===');
        console.log('practitioner:', practitioner);
        console.log('tenant:', tenant);
        console.log('token:', token);
        console.log('consentAccepted:', consentAccepted);
        console.log('typeof consentAccepted:', typeof consentAccepted);
        console.log('Will show success?:', consentAccepted === true);
    }, []);

    useEffect(() => {
        console.log('=== consentAccepted Changed ===', consentAccepted);
    }, [consentAccepted]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        console.log('=== Staff Permissions Form Submit ===');
        console.log('Form data:', data);
        console.log('Token:', token);

        if (!data.invitation_permission || !data.location_assignment_permission || !data.location_modification_permission) {
            console.log('Validation failed: Not all permissions accepted');
            return;
        }

        console.log('Submitting to route:', route('consent.staff-permissions.accept', token));

        post(route('consent.staff-permissions.accept', token), {
            onBefore: () => {
                console.log('=== onBefore: About to submit ===');
            },
            onStart: () => {
                console.log('=== onStart: Request started ===');
            },
            onSuccess: (response) => {
                console.log('=== onSuccess: Request succeeded ===', response);
            },
            onError: (errors) => {
                console.log('=== onError: Request failed ===', errors);
            },
            onFinish: () => {
                console.log('=== onFinish: Request finished ===');
            },
        });
    };

    const practitionerName = `${practitioner.first_name} ${practitioner.last_name}`;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <Head title="Staff Permissions Consent" />
            
            <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <AppLogoIcon className="mx-auto h-12 w-12 text-blue-600" />
                    <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                        Staff Permissions Consent
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Required for {tenant.company_name} EMR Platform Access
                    </p>
                </div>

                {/* Success Message */}
                {consentAccepted ? (
                    <Card className="mb-6">
                        <CardContent className="pt-6">
                            <div className="text-center space-y-4">
                                <div className="flex justify-center">
                                    <CheckCircle className="h-16 w-16 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Consent Accepted Successfully!
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Thank you for accepting the staff permissions for {tenant.company_name}.
                                </p>
                                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                                    <Shield className="h-4 w-4 text-blue-600" />
                                    <AlertTitle className="text-blue-900 dark:text-blue-100">Next Steps</AlertTitle>
                                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                                        Please wait for the invitation email from {tenant.company_name}. Once you receive the invitation, you will be able to complete your registration and access the platform.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Practitioner Info */}
                        <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Practitioner Information</CardTitle>
                        <CardDescription>
                            Please review your information and accept the permissions below
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p><strong>Name:</strong> {practitionerName}</p>
                            <p><strong>Email:</strong> {practitioner.email}</p>
                            <p><strong>Organization:</strong> {tenant.company_name}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Consent Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-6 w-6 text-blue-600" />
                            Staff Permissions Consent
                        </CardTitle>
                        <CardDescription>
                            Please review and accept the following permissions for {tenant.company_name} staff
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Important Notice */}
                            <Alert>
                                <Shield className="h-4 w-4" />
                                <AlertTitle>Important Notice</AlertTitle>
                                <AlertDescription>
                                    These permissions allow {tenant.company_name} staff to manage your practitioner account. 
                                    Please review each permission carefully before accepting.
                                </AlertDescription>
                            </Alert>

                            {/* Permission Checkboxes */}
                            <div className="space-y-6">
                                {/* Invitation Permission */}
                                <div className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <Checkbox
                                        id="invitation_permission"
                                        checked={data.invitation_permission}
                                        onCheckedChange={(checked) => setData('invitation_permission', checked as boolean)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="h-5 w-5 text-blue-600" />
                                            <Label htmlFor="invitation_permission" className="text-sm font-medium">
                                                The staff of {tenant.company_name} can invite you to join {tenant.company_name} as a practitioner
                                            </Label>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            This allows staff to send you invitations to join the platform and manage your account status.
                                        </p>
                                        {errors.invitation_permission && (
                                            <p className="text-sm text-red-600 mt-1">{errors.invitation_permission}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Location Assignment Permission */}
                                <div className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <Checkbox
                                        id="location_assignment_permission"
                                        checked={data.location_assignment_permission}
                                        onCheckedChange={(checked) => setData('location_assignment_permission', checked as boolean)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MapPin className="h-5 w-5 text-green-600" />
                                            <Label htmlFor="location_assignment_permission" className="text-sm font-medium">
                                                The staff of {tenant.company_name} can assign you the locations and the slots for that location
                                            </Label>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            This allows staff to assign you to specific locations and set your available time slots.
                                        </p>
                                        {errors.location_assignment_permission && (
                                            <p className="text-sm text-red-600 mt-1">{errors.location_assignment_permission}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Location Modification Permission */}
                                <div className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <Checkbox
                                        id="location_modification_permission"
                                        checked={data.location_modification_permission}
                                        onCheckedChange={(checked) => setData('location_modification_permission', checked as boolean)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="h-5 w-5 text-orange-600" />
                                            <Label htmlFor="location_modification_permission" className="text-sm font-medium">
                                                The staff of {tenant.company_name} can change the locations and the slots for that location for you
                                            </Label>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            This allows staff to modify your assigned locations and time slots as needed.
                                        </p>
                                        {errors.location_modification_permission && (
                                            <p className="text-sm text-red-600 mt-1">{errors.location_modification_permission}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button 
                                type="submit"
                                disabled={processing || !data.invitation_permission || !data.location_assignment_permission || !data.location_modification_permission}
                                className="w-full"
                                size="lg"
                            >
                                {processing ? (
                                    <>
                                        <CheckCircle className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Accept Permissions & Continue'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                    </>
                )}

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>
                        By accepting these permissions, you agree to allow {tenant.company_name} staff to manage your practitioner account 
                        as outlined above. You can contact your administrator if you have any questions about these permissions.
                    </p>
                </div>
            </div>
        </div>
    );
}
