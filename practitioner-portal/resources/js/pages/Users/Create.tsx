import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, useForm, router } from '@inertiajs/react';
import { Eye, EyeOff, Info } from 'lucide-react';
import axios from 'axios';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Create User',
        href: '/users/create',
    },
];

type CreateProps = {
    roles: { id: number; name: string }[];
    user?: any;
    userRole?: string;
};

export default function Create({ roles, user, userRole }: CreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        password_confirmation: '',
        role: userRole ?? '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [emailExists, setEmailExists] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);

    // Check if email exists in central database
    const checkEmailExists = async (email: string) => {
        // Only check if email looks complete (has @, domain, and at least 2 chars after dot)
        // This ensures user has finished typing (e.g., .com, .net, not just .co)
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!email || !emailPattern.test(email.trim())) {
            setEmailExists(false);
            setCheckingEmail(false);
            return;
        }

        setCheckingEmail(true);
        try {
            const apiUrl = typeof route !== 'undefined' ? route('api.check-email-exists') : '/api/check-email-exists';
            const response = await axios.post(apiUrl, {
                email: email.trim().toLowerCase(),
                check_tenant: true, // Also check if exists in current tenant
            });

            if (response.data.success) {
                setEmailExists(response.data.email_exists === true);
                
                // If email exists in tenant, show error
                if (response.data.email_exists_in_tenant) {
                    setData('email', '');
                    setEmailExists(false);
                }
            }
        } catch (error) {
            console.error('Error checking email:', error);
            setEmailExists(false);
        } finally {
            setCheckingEmail(false);
        }
    };

    // Debounce email check - only check when email is entered and looks complete
    useEffect(() => {
        if (!data.email || user) {
            setEmailExists(false);
            setCheckingEmail(false);
            return; // Skip if editing existing user or no email
        }

        // Only check if email looks complete (has @, domain, and at least 2 chars after dot)
        // This ensures user has finished typing (e.g., .com, .net, not just .co)
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailPattern.test(data.email.trim())) {
            setEmailExists(false);
            setCheckingEmail(false);
            return;
        }

        // Wait 1000ms (1 second) after user stops typing before checking
        // This gives user time to finish typing completely
        const timeoutId = setTimeout(() => {
            checkEmailExists(data.email);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [data.email]);

    // Clear password fields when email exists (user will use existing password)
    useEffect(() => {
        if (emailExists) {
            setData('password', '');
            setData('password_confirmation', '');
        }
    }, [emailExists]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (user) {
            router.put(route('users.update', user.id), data);
        } else {
            post(route('users.store'));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create User" />
            <TooltipProvider>
                <Card className="shadow-none border-none m-6">
                    <CardContent className="flex flex-col gap-4 p-6">
                        <h2 className="text-2xl font-bold">Create New User</h2>
                        <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="role">Role *</Label>
                                <Select
                                    value={data.role}
                                    onValueChange={(value) => setData('role', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => {
                                            const isDisabled = role.name.toLowerCase() === 'practitioner' || role.name.toLowerCase() === 'patient';

                                            if (isDisabled) {
                                                return (
                                                    <Tooltip key={role.id}>
                                                        <TooltipTrigger asChild>
                                                            <div>
                                                                <SelectItem
                                                                    value={role.name}
                                                                    disabled
                                                                    className="cursor-not-allowed opacity-50"
                                                                >
                                                                    {role.name}
                                                                </SelectItem>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <p className="text-sm">
                                                                You cannot create {role.name}s from this page. Please use the dedicated registration pages.
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            }

                                            return (
                                                <SelectItem key={role.id} value={role.name}>
                                                    {role.name}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                            <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        // Allow only letters and spaces (no numbers or symbols)
                                        if (/^[A-Za-z\s]*$/.test(value)) {
                                        setData('name', value)
                                        }
                                    }}
                                    placeholder="Enter Name"
                                    maxLength={100}
                                    />

                                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="Enter Email"
                                    maxLength={264}
                                />
                                {checkingEmail && (
                                    <p className="text-sm text-gray-500">Checking email...</p>
                                )}
                                {emailExists && !checkingEmail && data.email && (
                                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-blue-800">
                                            This email already exists in the system. The user will login with their existing password.
                                        </p>
                                    </div>
                                )}
                                {!emailExists && !checkingEmail && data.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim()) && (
                                    <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                                        <Info className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-green-800">
                                            This email is new. Please set a password for this user.
                                        </p>
                                    </div>
                                )}
                                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                            </div>

                            {/* Only show password fields if email doesn't exist and email is valid */}
                            {!emailExists && !checkingEmail && data.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim()) && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password *</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                value={data.password}
                                                onChange={(e) => setData('password', e.target.value)}
                                                placeholder="Enter Password"
                                                className="pr-12"
                                                maxLength={64}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
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
                                        {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password_confirmation">Confirm Password *</Label>
                                        <div className="relative">
                                            <Input
                                                id="password_confirmation"
                                                type={showPasswordConfirm ? "text" : "password"}
                                                value={data.password_confirmation}
                                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                                placeholder="Confirm Password"
                                                className="pr-12"
                                                maxLength={64}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                tabIndex={-1}
                                            >
                                                {showPasswordConfirm ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="pt-4">
                            <Button 
                                type="submit" 
                                disabled={processing || checkingEmail || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim()) || !data.name || !data.role} 
                                size="save"
                            >
                                {processing ? 'Saving...' : user ? 'Update User' : 'Create User'}
                            </Button>
                        </div>
                        </form>
                    </CardContent>
                </Card>
            </TooltipProvider>
        </AppLayout>
    );
}