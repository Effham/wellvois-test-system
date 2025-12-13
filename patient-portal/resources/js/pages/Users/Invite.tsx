import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Users',
        href: '/users',
    },
    {
        title: 'Invite User',
        href: '/users/invite',
    },
];

type InviteProps = {
    roles: { id: number; name: string }[];
};

export default function Invite({ roles }: InviteProps) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        role_id: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('users.invitations.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Invite User" />
            <TooltipProvider>
                <Card className="shadow-none border-none m-6">
                    <CardContent className="flex flex-col gap-4 p-6">
                        <h2 className="text-2xl font-bold">Invite New User</h2>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="role_id">Role *</Label>
                                    <Select
                                        value={data.role_id}
                                        onValueChange={(value) => setData('role_id', value)}
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
                                                                        value={role.id.toString()}
                                                                        disabled
                                                                        className="cursor-not-allowed opacity-50"
                                                                    >
                                                                        {role.name}
                                                                    </SelectItem>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-xs">
                                                                <p className="text-sm">
                                                                    You cannot invite {role.name}s from this page. Please use the dedicated registration pages.
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    );
                                                }

                                                return (
                                                    <SelectItem key={role.id} value={role.id.toString()}>
                                                        {role.name}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    {errors.role_id && <p className="text-sm text-red-500">{errors.role_id}</p>}
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
                                    {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button 
                                    type="submit" 
                                    disabled={processing || !data.email || !data.role_id} 
                                    size="save"
                                >
                                    {processing ? 'Sending Invitation...' : 'Send Invitation'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </TooltipProvider>
        </AppLayout>
    );
}
