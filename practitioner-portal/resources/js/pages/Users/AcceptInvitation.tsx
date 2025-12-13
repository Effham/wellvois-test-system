import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff, AlertCircle, Mail, User, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AcceptInvitationProps = {
    invitation: {
        id: number;
        email: string;
        token: string;
        role: {
            id: number;
            name: string;
        };
        expires_at: string;
    };
    emailExists: boolean;
    userName?: string | null;
    tenantName?: string;
    themeColor?: string;
    logoPath?: string | null;
    errors?: {
        error?: string;
        [key: string]: string | undefined;
    };
};

export default function AcceptInvitation({ 
    invitation, 
    emailExists, 
    userName, 
    tenantName,
    themeColor = '#7c3aed',
    logoPath,
    errors: propErrors 
}: AcceptInvitationProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const { data, setData, post, processing, errors: formErrors } = useForm({
        name: userName || '',
        password: '',
        password_confirmation: '',
    });

    // Combine prop errors and form errors
    const errors = { ...propErrors, ...formErrors };
    const errorMessage = errors.error || errors._general;

    // Apply theme color
    useEffect(() => {
        if (themeColor) {
            const root = document.documentElement;
            root.style.setProperty('--primary', themeColor);
        }
    }, [themeColor]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('users.invitations.accept.store', invitation.token));
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Head title={`Accept Invitation - ${tenantName || 'Clinic'}`} />
            
            <div className="w-full max-w-lg">
                {/* Header with Logo */}
                {logoPath && (
                    <div className="flex justify-center mb-8">
                        <img 
                            src={logoPath} 
                            alt={tenantName || 'Clinic'} 
                            className="h-12 object-contain"
                        />
                    </div>
                )}

                <Card className="shadow-lg border-0">
                    <CardContent className="p-8">
                        {/* Welcome Section */}
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4" style={{ backgroundColor: `${themeColor}20` }}>
                                <Mail className="h-8 w-8" style={{ color: themeColor }} />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                You're Invited!
                            </h1>
                            {tenantName && (
                                <p className="text-lg text-gray-600 mb-1">{tenantName}</p>
                            )}
                            <p className="text-sm text-gray-500">
                                has invited you to join their team
                            </p>
                        </div>

                        {errorMessage && (
                            <Alert variant="destructive" className="mb-6">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{errorMessage}</AlertDescription>
                            </Alert>
                        )}

                        {!errorMessage && (
                            <form onSubmit={submit} className="space-y-6">
                                {/* Invitation Details */}
                                <div className="bg-gray-50 rounded-lg p-6 space-y-4 border border-gray-200">
                                    <div className="flex items-start gap-3">
                                        <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Email</p>
                                            <p className="text-sm font-medium text-gray-900">{invitation.email}</p>
                                        </div>
                                    </div>

                                    {emailExists && userName && (
                                        <div className="flex items-start gap-3">
                                            <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Name</p>
                                                <p className="text-sm font-medium text-gray-900">{userName}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-3">
                                        <Shield className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Role</p>
                                            <p className="text-sm font-semibold" style={{ color: themeColor }}>
                                                {invitation.role.name}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* For existing users - simplified */}
                                {emailExists && userName ? (
                                    <div className="space-y-4">
                                        <div className="text-center py-2">
                                            <p className="text-sm text-gray-600">
                                                Welcome back! Click below to accept this invitation.
                                            </p>
                                        </div>
                                        <Button 
                                            type="submit" 
                                            disabled={processing}
                                            className="w-full h-12 text-base font-semibold"
                                            style={{ 
                                                backgroundColor: themeColor,
                                                borderColor: themeColor,
                                            }}
                                        >
                                            {processing ? 'Accepting...' : 'Accept Invitation'}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {/* For new users - full form */}
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name" className="text-sm font-medium">Your Name *</Label>
                                                <Input
                                                    id="name"
                                                    value={data.name}
                                                    onChange={(e) => setData('name', e.target.value)}
                                                    placeholder="Enter your full name"
                                                    required
                                                    className="h-11"
                                                />
                                                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="password" className="text-sm font-medium">Password *</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="password"
                                                        type={showPassword ? "text" : "password"}
                                                        value={data.password}
                                                        onChange={(e) => setData('password', e.target.value)}
                                                        placeholder="Create a secure password"
                                                        required
                                                        className="h-11 pr-12"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                                    >
                                                        {showPassword ? (
                                                            <EyeOff className="h-5 w-5" />
                                                        ) : (
                                                            <Eye className="h-5 w-5" />
                                                        )}
                                                    </button>
                                                </div>
                                                {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="password_confirmation" className="text-sm font-medium">Confirm Password *</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="password_confirmation"
                                                        type={showPasswordConfirm ? "text" : "password"}
                                                        value={data.password_confirmation}
                                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                                        placeholder="Confirm your password"
                                                        required
                                                        className="h-11 pr-12"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                                    >
                                                        {showPasswordConfirm ? (
                                                            <EyeOff className="h-5 w-5" />
                                                        ) : (
                                                            <Eye className="h-5 w-5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <Button 
                                            type="submit" 
                                            disabled={processing || !data.name || !data.password || !data.password_confirmation}
                                            className="w-full h-12 text-base font-semibold"
                                            style={{ 
                                                backgroundColor: themeColor,
                                                borderColor: themeColor,
                                            }}
                                        >
                                            {processing ? 'Accepting...' : 'Accept Invitation'}
                                        </Button>
                                    </>
                                )}
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
