import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle, Eye, EyeOff, Building2 } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
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
};

interface AdminLoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function AdminLogin({ status, canResetPassword }: AdminLoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<Required<LoginForm>>({
        email: '',
        password: '',
        remember: false,
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
        post(route('admin.login'), {
            onFinish: () => reset('password'),
        });
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
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
                
                {/* Form Card */}
                <Card className="shadow-lg">
                    <CardContent className="px-5 sm:px-6 xl:px-8 pt-4 sm:pt-5 pb-4 sm:pb-5">
                        {/* Status Message */}
                        {status && (
                            <div className="mb-4 rounded-lg bg-green-50 p-4 text-center text-sm font-medium text-green-600">
                                {status}
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
                                    placeholder="admin@example.com"
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
                            <TextLink 
                                href={route('admin.login')} 
                                className="text-sm font-medium text-purple-600 hover:text-purple-700 no-underline"
                                tabIndex={5}
                            >
                                ← Back to Login Options
                            </TextLink>
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
