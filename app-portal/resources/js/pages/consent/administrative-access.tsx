import React, { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AppLogoIcon from '@/components/app-logo-icon';

interface AdministrativeAccessConsentProps {
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
}

export default function AdministrativeAccessConsent({ 
    practitioner, 
    tenant, 
    token 
}: AdministrativeAccessConsentProps) {
    const { data, setData, post, processing, errors } = useForm({
        administrative_consent: false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!data.administrative_consent) {
            return;
        }
        
        post(route('consent.administrative-access.accept', token));
    };

    const practitionerName = `${practitioner.first_name} ${practitioner.last_name}`;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <Head title="Administrative Access Consent" />
            
            <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <AppLogoIcon className="mx-auto h-12 w-12 text-blue-600" />
                    <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                        Administrative Access Consent
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Required for {tenant.company_name} EMR Platform Access
                    </p>
                </div>

                {/* Practitioner Info */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Practitioner Information</CardTitle>
                        <CardDescription>
                            Please review your information and accept the consent below
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
                            Administrative Access Consent
                        </CardTitle>
                        <CardDescription>
                            This consent is required for your use of the Wellovis EMR platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Important Notice */}
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Important Notice</AlertTitle>
                                <AlertDescription>
                                    This consent is legally binding and required for your access to the Wellovis EMR platform. 
                                    Please read carefully and ensure you understand all obligations before accepting.
                                </AlertDescription>
                            </Alert>

                            {/* Consent Content */}
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                                    <p>
                                        By checking this box, I acknowledge and agree that authorized administrative staff of Wellovis may view and manage my availability, locations, and appointment metadata (date, time, service) for the exclusive purposes of platform maintenance, technical support, and operational management. This access adheres to the legal principle of "Minimum Necessary" use of health information and is required for my use of the Wellovis EMR platform.
                                    </p>
                                </div>
                            </div>

                            {/* Consent Checkbox */}
                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="administrative_consent"
                                    checked={data.administrative_consent}
                                    onCheckedChange={(checked) => setData('administrative_consent', checked as boolean)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <Label htmlFor="administrative_consent" className="text-sm font-medium">
                                        I consent to the limited, necessary administrative access to my professional profile and data by Wellovis personnel.
                                    </Label>
                                    {errors.administrative_consent && (
                                        <p className="text-sm text-red-600 mt-1">{errors.administrative_consent}</p>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button 
                                type="submit"
                                disabled={processing || !data.administrative_consent}
                                className="w-full"
                                size="lg"
                            >
                                {processing ? (
                                    <>
                                        <CheckCircle className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Accept Consent & Continue'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>
                        By accepting this consent, you agree to the terms outlined above and acknowledge 
                        that this consent is required for your continued use of the Wellovis EMR platform.
                    </p>
                </div>
            </div>
        </div>
    );
}
