import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Create Tenant',
        href: '/tenants/create',
    },
];

type CreateProps = {
    baseDomain: string;
};

export default function Create({ baseDomain }: CreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        domain: '',
        company_name: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
        admin_password_confirmation: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    // Auto-generate domain from company name (same logic as TenantController)
    const handleCompanyNameChange = (value: string) => {
        setData('company_name', value);
        
        // Auto-generate domain: lowercase, replace spaces with underscores/hyphens, remove invalid chars
        const cleanedDomain = value
            .toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with hyphens for domain
            .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters
        
        setData('domain', cleanedDomain);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('tenants.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Tenant" />
            <div className="flex flex-col gap-4 p-4">
                <h2 className="text-2xl font-bold">Create New Tenant</h2>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="company_name">Company Name *</Label>
                                <Input
                                    id="company_name"
                                    value={data.company_name}
                                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                                    placeholder="Enter Company Name"
                                    maxLength={100}
                                />
                                <p className="text-muted-foreground text-sm">Domain and Tenant ID will be auto-generated</p>
                                {errors.company_name && <p className="text-sm text-red-500">{errors.company_name}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="domain">Domain (Auto-generated) *</Label>
                                <Input
                                    id="domain"
                                    value={data.domain}
                                    onChange={(e) => {
                                        const cleanedValue = e.target.value
                                            .replace(/\s+/g, '-')
                                            .replace(/[^a-zA-Z0-9-]/g, '')
                                            .toLowerCase();
                                        setData('domain', cleanedValue);
                                    }}
                                    placeholder="subdomain"
                                    
                                />
                                <p className="text-muted-foreground text-sm">
                                    Full domain: <span className="font-medium">{data.domain || 'subdomain'}.{baseDomain}</span>
                                </p>
                                {errors.domain && <p className="text-sm text-red-500">{errors.domain}</p>}
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="admin_name">Admin Name *</Label>
                                <Input
                                    id="admin_name"
                                    value={data.admin_name}
                                    // onChange={(e) => setData('admin_name', e.target.value)}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        // Allow only letters and spaces (no numbers or symbols)
                                        if (/^[A-Za-z\s]*$/.test(value)) {
                                        setData('admin_name', value)
                                        }
                                    }}
                                    placeholder="Enter Admin Name"
                                    maxLength={100}
                                />
                                {errors.admin_name && <p className="text-sm text-red-500">{errors.admin_name}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="admin_email">Admin Email *</Label>
                                <Input
                                    id="admin_email"
                                    type="email"
                                    value={data.admin_email}
                                    onChange={(e) => setData('admin_email', e.target.value)}
                                    placeholder="admin@example.com"
                                    maxLength={254}
                                />
                                {errors.admin_email && <p className="text-sm text-red-500">{errors.admin_email}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="admin_password">Admin Password *</Label>
                                <div className="relative">
                                    <Input
                                        id="admin_password"
                                        type={showPassword ? "text" : "password"}
                                        value={data.admin_password}
                                        onChange={(e) => setData('admin_password', e.target.value)}
                                        placeholder="Minimum 8 characters"
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
                                {errors.admin_password && <p className="text-sm text-red-500">{errors.admin_password}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="admin_password_confirmation">Confirm Password *</Label>
                                <div className="relative">
                                    <Input
                                        id="admin_password_confirmation"
                                        type={showPasswordConfirm ? "text" : "password"}
                                        value={data.admin_password_confirmation}
                                        onChange={(e) => setData('admin_password_confirmation', e.target.value)}
                                        placeholder="Confirm your password"
                                        className="pr-12"
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
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button type="submit" disabled={processing} size="save">
                            {processing ? 'Creating...' : 'Create Tenant'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}