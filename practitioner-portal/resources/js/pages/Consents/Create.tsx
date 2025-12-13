import React, { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Consent {
    id: number;
    entity_type: string;
    entity_id: number;
    user_id?: number;
    permitted_columns?: string[];
    consent_type: string;
    consent_status: string;
    consented_at?: string;
}

export default function Create({
    consent,
    consentTypes,
    consentStatuses,
}: {
    consent?: Consent;
    consentTypes: string[];
    consentStatuses: string[];
}) {
    const { props } = usePage();
    const permissions = (props.auth?.user?.permissions || []) as string[];
    
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Consents', href: '/consents' },
        { title: consent ? 'Edit Consent' : 'New Consent', href: consent ? `/consents/${consent.id}/edit` : '/consents/create' },
    ];

    const { data, setData, post, put, processing, errors } = useForm({
        entity_type: consent?.entity_type || '',
        entity_id: consent?.entity_id || '',
        user_id: consent?.user_id || '',
        permitted_columns: consent?.permitted_columns || [],
        consent_type: consent?.consent_type || 'auto',
        consent_status: consent?.consent_status || 'granted',
        consented_at: consent?.consented_at ? consent.consented_at.split('T')[0] : '',
    });

    const [permittedColumnsText, setPermittedColumnsText] = useState(
        consent?.permitted_columns ? consent.permitted_columns.join(', ') : ''
    );

    const handlePermittedColumnsChange = (value: string) => {
        setPermittedColumnsText(value);
        const columns = value.split(',').map(col => col.trim()).filter(col => col.length > 0);
        setData('permitted_columns', columns);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (consent) {
            put(route('consents.update', consent.id));
        } else {
            post(route('consents.store'));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={consent ? 'Edit Consent' : 'New Consent'} />

            <div className="space-y-6 p-6">
                <div>
                    <h2 className="text-2xl font-bold">{consent ? 'Edit Consent' : 'Create New Consent'}</h2>
                    <p className="text-gray-600 mt-1">
                        {consent ? 'Update the consent information below.' : 'Create a new consent record for an entity.'}
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="entity_type">Entity Type</Label>
                            <Input
                                id="entity_type"
                                value={data.entity_type}
                                onChange={e => setData('entity_type', e.target.value)}
                                placeholder="e.g. patient, appointment, record"
                                required
                            />
                            {errors.entity_type && <p className="text-sm text-red-500 mt-1">{errors.entity_type}</p>}
                        </div>

                        <div>
                            <Label htmlFor="entity_id">Entity ID</Label>
                            <Input
                                id="entity_id"
                                type="number"
                                value={data.entity_id}
                                onChange={e => setData('entity_id', e.target.value)}
                                placeholder="Enter entity ID"
                                required
                            />
                            {errors.entity_id && <p className="text-sm text-red-500 mt-1">{errors.entity_id}</p>}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="user_id">User ID (Optional)</Label>
                        <Input
                            id="user_id"
                            type="number"
                            value={data.user_id}
                            onChange={e => setData('user_id', e.target.value)}
                            placeholder="Leave empty if not applicable"
                        />
                        {errors.user_id && <p className="text-sm text-red-500 mt-1">{errors.user_id}</p>}
                        <p className="text-sm text-gray-500 mt-1">
                            Optional: Specify a user ID if this consent is tied to a specific user.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="consent_type">Consent Type</Label>
                            <Select value={data.consent_type} onValueChange={(value) => setData('consent_type', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select consent type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {consentTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.consent_type && <p className="text-sm text-red-500 mt-1">{errors.consent_type}</p>}
                        </div>

                        <div>
                            <Label htmlFor="consent_status">Consent Status</Label>
                            <Select value={data.consent_status} onValueChange={(value) => setData('consent_status', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select consent status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {consentStatuses.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.consent_status && <p className="text-sm text-red-500 mt-1">{errors.consent_status}</p>}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="consented_at">Consented At (Optional)</Label>
                        <Input
                            id="consented_at"
                            type="date"
                            value={data.consented_at}
                            onChange={e => setData('consented_at', e.target.value)}
                        />
                        {errors.consented_at && <p className="text-sm text-red-500 mt-1">{errors.consented_at}</p>}
                        <p className="text-sm text-gray-500 mt-1">
                            Leave empty to auto-set when status is "granted".
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="permitted_columns">Permitted Columns (Optional)</Label>
                        <Textarea
                            id="permitted_columns"
                            value={permittedColumnsText}
                            onChange={e => handlePermittedColumnsChange(e.target.value)}
                            placeholder="Enter column names separated by commas (e.g. name, email, phone)"
                            rows={3}
                        />
                        {errors.permitted_columns && <p className="text-sm text-red-500 mt-1">{errors.permitted_columns}</p>}
                        <p className="text-sm text-gray-500 mt-1">
                            Specify which columns/fields are permitted for this consent. Separate multiple columns with commas.
                        </p>
                    </div>

                    <div className="flex space-x-4">
                        {!consent && permissions.includes('add-consents') && (
                            <Button type="submit" disabled={processing} size="save">
                                {processing ? 'Creating...' : 'Create Consent'}
                            </Button>
                        )}
                        {consent && permissions.includes('update-consents') && (
                            <Button type="submit" disabled={processing} size="save">
                                {processing ? 'Updating...' : 'Update Consent'}
                            </Button>
                        )}
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => window.history.back()}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}