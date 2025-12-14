import { Head } from '@inertiajs/react';
import { Building2, LogIn } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import OnboardingLayout from '@/components/onboarding-layout';

interface AdminLoginProps {
    status?: string;
    errors?: {
        keycloak?: string;
    };
}

export default function AdminLogin({ status, errors }: AdminLoginProps) {
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleKeycloakLogin = () => {
        setIsRedirecting(true);
        // Use window.location.href for full browser redirect (required for OAuth)
        window.location.href = route('keycloak.login');
    };

    return (
        <OnboardingLayout title="Admin Login" contentClassName="max-w-md">
            <div className="w-full">
                {/* Header Section */}
                <div className="mb-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <Building2 className="h-6 w-6 text-purple-600" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                            Admin Login
                        </h1>
                    </div>
                    <p className="text-gray-600 text-sm sm:text-base">
                        Enter your credentials to access the admin dashboard.
                    </p>
                </div>
                
                {/* Login Card */}
                <Card className="shadow-lg">
                    <CardContent className="px-5 sm:px-6 xl:px-8 pt-6 sm:pt-8 pb-6 sm:pb-8">
                        {/* Status Message */}
                        {status && (
                            <div className="mb-4 rounded-lg bg-green-50 p-4 text-center text-sm font-medium text-green-600">
                                {status}
                            </div>
                        )}

                        {/* Error Message */}
                        {errors?.keycloak && (
                            <div className="mb-4 rounded-lg bg-red-50 p-4 text-center text-sm font-medium text-red-600">
                                {errors.keycloak}
                            </div>
                        )}

                        {/* Keycloak Login Button */}
                        <div className="space-y-4">
                            <Button 
                                onClick={handleKeycloakLogin}
                                disabled={isRedirecting}
                                className="w-full h-12 sm:h-14 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-semibold shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200 text-base sm:text-lg flex items-center justify-center gap-2"
                            >
                                {isRedirecting ? (
                                    <>
                                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Redirecting...</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="h-5 w-5" />
                                        <span>Login with WELLOVIS</span>
                                    </>
                                )}
                            </Button>

                            <p className="text-xs text-center text-gray-500 mt-4">
                                You will be redirected to WELLOVIS authentication portal
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </OnboardingLayout>
    );
}
