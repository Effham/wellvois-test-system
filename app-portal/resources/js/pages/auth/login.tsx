import { Head, useForm, router, usePage } from '@inertiajs/react';
import { LoaderCircle, Eye, EyeOff, Stethoscope, User, LogIn } from 'lucide-react';
import { FormEventHandler, useState, useEffect } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import OnboardingLayout from '@/components/onboarding-layout';
import { imageAsset } from '@/utils/asset';
import { useZodValidation } from '@/hooks/useZodValidation';
import { loginSchema } from '@/lib/validations';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
    intent: 'practitioner' | 'patient';
};

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
    tenant: string | null;
    tenantLogo?: string | null;
    intent?: 'practitioner' | 'patient';
    isTenantLogin?: boolean;
    keycloakError?: string | null; // Keycloak-specific error message
}

export default function Login({ status, canResetPassword, tenant, tenantLogo, intent, isTenantLogin, keycloakError }: LoginProps) {
    const { errors: pageErrors } = usePage().props as any;
    const [isKeycloakRedirecting, setIsKeycloakRedirecting] = useState(false);

    const handleKeycloakLogin = () => {
        setIsKeycloakRedirecting(true);
        // Use window.location.href for full browser redirect (required for OAuth)
        window.location.href = route('keycloak.login');
    };
    // App portal uses tenant-specific login - no intent needed
    const { data, setData, post, processing, errors, reset } = useForm<Required<LoginForm>>({
        email: '',
        password: '',
        remember: false,
        intent: intent || 'practitioner',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const { validate } = useZodValidation(loginSchema);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const result = validate(data);
        if (!result.success) {
            setValidationErrors(result.errors);
            return;
        }

        setValidationErrors({});
        // Ensure intent is up to date before submission
        if (data.intent !== (intent || 'practitioner')) {
            setData('intent', intent || 'practitioner');
        }
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    // Determine if this is a tenant-specific login
    const isTenantLoginPage = isTenantLogin === true;

    return (
        <OnboardingLayout title="Log in" contentClassName="max-w-md">
            <div className="w-full">
                {/* Header Section */}
                <div className="mb-6 text-center">
                    {/* Logo - Show above company name for tenant login */}
                    {isTenantLoginPage && tenantLogo && (
                        <div className="mb-4 flex justify-center">
                            <img 
                                src={tenantLogo} 
                                alt={`${tenant} logo`}
                                className="h-16 sm:h-20 w-auto object-contain"
                            />
                        </div>
                    )}
                    
                    <div className="flex items-center justify-center gap-3 mb-3">
                        {!isTenantLoginPage && (
                            <>
                                {intent === 'practitioner' ? (
                                    <Stethoscope className="h-6 w-6 text-purple-600" />
                                ) : (
                                    <User className="h-6 w-6 text-blue-600" />
                                )}
                            </>
                        )}
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                            {isTenantLoginPage && tenant 
                                ? tenant // Just show company name, no "Login"
                                : intent === 'practitioner' 
                                    ? 'Practitioner Login' 
                                    : 'Patient Login'}
                        </h1>
                    </div>
                    <p className="text-gray-600 text-sm sm:text-base">
                        {isTenantLoginPage && tenant
                            ? `Enter your credentials to access ${tenant}`
                            : tenant 
                                ? `Enter your credentials to access ${tenant}`
                                : intent === 'practitioner'
                                    ? 'Enter your credentials to access your practitioner account.'
                                    : 'Enter your credentials to access your patient account.'}
                    </p>
                </div>
                
                {/* Form Card */}
                <Card className="shadow-lg">
                    <CardContent className="px-5 sm:px-6 xl:px-8 pt-4 sm:pt-5 pb-4 sm:pb-5">
                        {/* Status Message */}
                        {status && (
                            <div className="mb-4 rounded-lg bg-green-50 p-4 text-center text-sm font-medium text-green-600">
                                {status}
                            </div>
                        )}

                        {/* Keycloak Error Message */}
                        {(keycloakError || pageErrors?.keycloak) && (
                            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-center text-sm font-medium text-red-700">
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{keycloakError || pageErrors?.keycloak}</span>
                                </div>
                            </div>
                        )}

                        {/* Keycloak Login Button */}
                        {isTenantLogin && (
                            <div className="mb-6">
                                <Button 
                                    onClick={handleKeycloakLogin}
                                    disabled={isKeycloakRedirecting}
                                    className="w-full h-12 sm:h-14 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-semibold shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200 text-base sm:text-lg flex items-center justify-center gap-2"
                                >
                                    {isKeycloakRedirecting ? (
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

                                <div className="mt-4 flex items-center">
                                    <div className="flex-1 border-t border-gray-300"></div>
                                    <span className="px-4 text-sm text-gray-500">or</span>
                                    <div className="flex-1 border-t border-gray-300"></div>
                                </div>
                            </div>
                        )}
                        
                        {/* Form Fields */}
                        <form onSubmit={submit} className="space-y-5 sm:space-y-6">
                            
                            {/* Email Field */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                    Email address <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="email@example.com"
                                    className="h-11 sm:h-12 rounded-lg border-gray-300 bg-white text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                                />
                                <InputError message={validationErrors.email || errors.email} />
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                                    Password <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        tabIndex={2}
                                        autoComplete="current-password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="Password"
                                        className="h-11 sm:h-12 rounded-lg border-gray-300 bg-white pr-12 text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={togglePasswordVisibility}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                                <InputError message={validationErrors.password || errors.password} />
                            </div>

                            {/* Submit Button */}
                            <div className="pt-3 sm:pt-4">
                                <Button 
                                    type="submit" 
                                    className="w-full h-11 sm:h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-medium shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200 text-base"
                                    tabIndex={4} 
                                    disabled={processing}
                                >
                                    {processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    Continue
                                </Button>
                            </div>
                        </form>

                        {/* Footer Links */}
                        <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
                            {canResetPassword && (
                                <TextLink 
                                    href={route('password.request')} 
                                    className="text-sm font-medium text-purple-600 hover:text-purple-700 no-underline"
                                    tabIndex={5}
                                >
                                    Forgot password?
                                </TextLink>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </OnboardingLayout>
    );
}