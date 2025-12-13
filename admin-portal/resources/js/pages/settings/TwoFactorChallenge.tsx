import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useForm, router } from '@inertiajs/react';
import { ArrowLeft, KeyRound, Lock, Shield, TriangleAlert } from 'lucide-react';
import React, { useRef, useState } from 'react';

export default function TwoFactorChallenge() {
    const { data, setData, post, processing, errors, clearErrors, transform } = useForm({
        one_time_password: '',
    });

    const [inputValues, setInputValues] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = inputValues.join('');
        transform(() => ({
            one_time_password: code,
        }));
        post(route('two-factor-authentication.verify'));
    };

    const handleInputChange = (index: number, value: string) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        // Clear errors when user starts typing
        if (errors.one_time_password) {
            clearErrors('one_time_password');
        }

        const newValues = [...inputValues];
        newValues[index] = value;
        setInputValues(newValues);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !inputValues[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        
        // Clear errors when user pastes
        if (errors.one_time_password) {
            clearErrors('one_time_password');
        }
        
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newValues = [...inputValues];

        pastedData.split('').forEach((char, index) => {
            if (index < 6) {
                newValues[index] = char;
            }
        });

        setInputValues(newValues);

        // Focus the next empty input or the last one
        const nextEmptyIndex = newValues.findIndex((val) => !val);
        const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
        inputRefs.current[focusIndex]?.focus();
    };

    const handleCancel = () => {
        router.post(route('two-factor-authentication.cancel'));
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="w-full max-w-md">
                {/* Brand Badge (replaces ShieldCheck) */}
                {/* <div className="mb-6 flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-purple-600 to-violet-600 opacity-50 blur-xl"></div>
                        <div className="relative rounded-full bg-white">
                            <img src="/brand/images/mainLogo.png" alt="Brand" className="h-20 w-20 p-3 object-contain" />
                        </div>
                    </div>
                </div> */}

<div className="flex justify-center">
                            <img src="/brand/images/mainLogo.png" alt="Brand" className="h-25 w-35 object-contain mb-0" />
                        </div>

                <Card className="border-2 bg-white/80 shadow-2xl backdrop-blur-sm dark:bg-gray-900/80">
                    <CardHeader className="space-y-1 pb-4 text-center">
                        <div className="mb-1 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                            <Lock className="h-4 w-4" />
                            <span className="text-xs font-medium tracking-wider uppercase">Secure Access</span>
                        </div>
                        <CardTitle className="bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-2xl font-bold text-transparent dark:from-purple-400 dark:to-violet-400">
                            Two-Factor Authentication
                        </CardTitle>
                        <CardDescription className="pt-2 text-sm">Enter the 6-digit code from your authenticator app</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5 pb-6">
                        {errors.one_time_password && (
                            <Alert variant="destructive" className="animate-shake border-red-200 py-3 dark:border-red-900">
                                <TriangleAlert className="h-4 w-4" />
                                <AlertTitle className="text-sm font-semibold">Verification Failed</AlertTitle>
                                <AlertDescription className="text-xs">{errors.one_time_password}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* 6-Digit Code Input */}
                            <div className="space-y-3">
                                <div className="flex justify-center gap-2" onPaste={handlePaste}>
                                    {inputValues.map((value, index) => (
                                        <Input
                                            key={index}
                                            ref={(el) => {
                                                inputRefs.current[index] = el;
                                            }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={value}
                                            onChange={(e) => handleInputChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                            className="h-12 w-11 border-2 text-center text-xl font-bold transition-all focus:border-purple-600 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800"
                                            autoFocus={index === 0}
                                            autoComplete="off"
                                            disabled={processing}
                                        />
                                    ))}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full bg-gradient-to-r from-purple-700 to-violet-700 text-base font-semibold shadow-lg transition-all duration-200 hover:from-purple-800 hover:to-violet-800 hover:shadow-xl dark:from-purple-600 dark:to-violet-600 dark:hover:from-purple-700 dark:hover:to-violet-700"
                                disabled={processing || inputValues.some((v) => !v)}
                            >
                                {processing ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                        <span>Verifying...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <KeyRound className="h-5 w-5" />
                                        <span>Verify & Continue</span>
                                    </div>
                                )}
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full border-2 text-base font-medium transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                onClick={handleCancel}
                                disabled={processing}
                            >
                                <div className="flex items-center gap-2">
                                    <ArrowLeft className="h-5 w-5" />
                                    <span>Back to Login</span>
                                </div>
                            </Button>
                        </form>

                        {/* Security Notice */}
                        <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/30">
                            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-700 dark:text-purple-400" />
                            <p className="text-xs text-purple-800 dark:text-purple-300">
                                Your account is secured with two-factor authentication to protect your medical records.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}