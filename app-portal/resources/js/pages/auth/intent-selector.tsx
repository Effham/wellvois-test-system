import { Head, router } from '@inertiajs/react';
import { User, Stethoscope, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import OnboardingLayout from '@/components/onboarding-layout';
import { imageAsset } from '@/utils/asset';

interface IntentSelectorProps {
    status?: string;
}

export default function IntentSelector({ status }: IntentSelectorProps) {
    const selectIntent = (intent: 'practitioner' | 'patient') => {
        const routeName = intent === 'practitioner' ? 'login.practitioner' : 'login.patient';
        router.visit(route(routeName), {
            preserveState: false,
            preserveScroll: false,
        });
    };

    return (
        <OnboardingLayout title="Select Login Type" contentClassName="max-w-4xl">
            <div className="w-full">
                {/* Header Section */}
                <div className="mb-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <LogIn className="h-6 w-6 text-purple-600" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                            Welcome to Wellovis
                        </h1>
                    </div>
                    <p className="text-gray-600 text-sm sm:text-base mb-2">
                        Your trusted healthcare management platform
                    </p>
                    <p className="text-gray-500 text-sm">
                        How would you like to sign in?
                    </p>
                </div>

                {/* Status Message */}
                {status && (
                    <div className="mb-6 rounded-lg bg-green-50 p-4 text-center text-sm font-medium text-green-600 max-w-md mx-auto">
                        {status}
                    </div>
                )}

                {/* Intent Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Practitioner Login */}
                    <Card 
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-500 flex flex-col h-full"
                        onClick={() => selectIntent('practitioner')}
                    >
                        <CardHeader className="text-center pb-4 flex-1 flex flex-col">
                            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                                <Stethoscope className="h-8 w-8 text-purple-600" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">
                                Practitioner
                            </CardTitle>
                            <CardDescription className="text-gray-600 mt-2 flex-1">
                                For practitioners to log in and view their appointments, sessions, notes, calendar, and manage patient care
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 pb-6">
                            <Button 
                                variant="outline"
                                className="w-full h-10 border-purple-600 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    selectIntent('practitioner');
                                }}
                            >
                                Continue as Practitioner
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Patient Login */}
                    <Card 
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-500 flex flex-col h-full"
                        onClick={() => selectIntent('patient')}
                    >
                        <CardHeader className="text-center pb-4 flex-1 flex flex-col">
                            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                                <User className="h-8 w-8 text-purple-600" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">
                                Patient
                            </CardTitle>
                            <CardDescription className="text-gray-600 mt-2 flex-1">
                                For patients to access their appointments, check medical history, view upcoming appointments, and manage their calendar
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 pb-6">
                            <Button 
                                variant="outline"
                                className="w-full h-10 border-purple-600 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    selectIntent('patient');
                                }}
                            >
                                Continue as Patient
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Copyright Footer */}
                <div className="mt-8 text-center">
                    <p className="text-sm text-white">
                        © {new Date().getFullYear()} Wellovis. All rights reserved.
                    </p>
                </div>
            </div>
        </OnboardingLayout>
    );
}
