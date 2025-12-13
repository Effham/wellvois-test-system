import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Trash2, UserX, ArrowLeft } from 'lucide-react';

interface Consent {
    id: number;
    entity_type: string;
    entity_id: number;
    tenant_id: string;
    user_id?: number;
    user?: {
        id: number;
        name: string;
        email: string;
    };
    permitted_columns?: string[];
    consent_type: string;
    consent_status: string;
    consented_at?: string;
    revoked_at?: string;
    created_at: string;
    updated_at: string;
}

export default function Show({ consent }: { consent: Consent }) {
    const { props } = usePage();
    const permissions = (props.auth?.user?.permissions || []) as string[];
    
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Consents', href: '/consents' },
        { title: `Consent #${consent.id}`, href: `/consents/${consent.id}` },
    ];

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'granted':
                return 'default';
            case 'pending':
                return 'secondary';
            case 'revoked':
                return 'destructive';
            case 'expired':
                return 'outline';
            default:
                return 'outline';
        }
    };

    const getTypeBadgeVariant = (type: string) => {
        switch (type) {
            case 'explicit':
                return 'default';
            case 'auto':
                return 'secondary';
            case 'emergency':
                return 'destructive';
            default:
                return 'outline';
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const handleRevoke = () => {
        router.patch(route('consents.update', consent.id), {
            ...consent,
            consent_status: 'revoked',
        });
        setRevokeDialogOpen(false);
    };

    const handleDelete = () => {
        router.delete(route('consents.destroy', consent.id));
        setDeleteDialogOpen(false);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Consent #${consent.id}`} />

            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Consent Details</h1>
                        <p className="text-gray-600 mt-1">
                            View and manage consent record #{consent.id}
                        </p>
                    </div>
                    <div className="flex space-x-2">
                        <Button 
                            variant="outline" 
                            onClick={() => router.get(route('consents.index'))}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Consents
                        </Button>
                        {permissions.includes('update-consents') && (
                            <Button 
                                onClick={() => router.get(route('consents.edit', consent.id))}
                            >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </Button>
                        )}
                        {permissions.includes('update-consents') && consent.consent_status === 'granted' && (
                            <Button 
                                variant="destructive"
                                onClick={() => setRevokeDialogOpen(true)}
                            >
                                <UserX className="h-4 w-4 mr-2" />
                                Revoke
                            </Button>
                        )}
                        {permissions.includes('delete-consents') && (
                            <Button 
                                variant="outline"
                                onClick={() => setDeleteDialogOpen(true)}
                                className="text-red-600 hover:text-red-800"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Information */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Entity Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Entity Type</label>
                                        <p className="text-lg font-semibold">{consent.entity_type}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Entity ID</label>
                                        <p className="text-lg font-semibold">#{consent.entity_id}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Tenant ID</label>
                                    <p className="text-lg font-semibold">{consent.tenant_id}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Consent Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Type</label>
                                        <div className="mt-1">
                                            <Badge variant={getTypeBadgeVariant(consent.consent_type)}>
                                                {consent.consent_type.charAt(0).toUpperCase() + consent.consent_type.slice(1)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Status</label>
                                        <div className="mt-1">
                                            <Badge variant={getStatusBadgeVariant(consent.consent_status)}>
                                                {consent.consent_status.charAt(0).toUpperCase() + consent.consent_status.slice(1)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Consented At</label>
                                        <p className="text-sm">{formatDate(consent.consented_at)}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Revoked At</label>
                                        <p className="text-sm">{formatDate(consent.revoked_at)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {consent.permitted_columns && consent.permitted_columns.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Permitted Columns</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {consent.permitted_columns.map((column, index) => (
                                            <Badge key={index} variant="outline">
                                                {column}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {consent.user && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Associated User</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Name</label>
                                        <p className="font-semibold">{consent.user.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Email</label>
                                        <p className="text-sm">{consent.user.email}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">User ID</label>
                                        <p className="text-sm">#{consent.user.id}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Record Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Consent ID</label>
                                    <p className="font-semibold">#{consent.id}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Created</label>
                                    <p className="text-sm">{formatDate(consent.created_at)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                                    <p className="text-sm">{formatDate(consent.updated_at)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Revoke Consent Dialog */}
                <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Revoke Consent</DialogTitle>
                        </DialogHeader>
                        <p>
                            Are you sure you want to revoke consent for "{consent.entity_type}" (ID: {consent.entity_id})? 
                            This action will change the status to "revoked" and set the revoked timestamp.
                        </p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleRevoke}>
                                Revoke Consent
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Consent Dialog */}
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Consent</DialogTitle>
                        </DialogHeader>
                        <p>
                            Are you sure you want to permanently delete this consent record? 
                            This action cannot be undone and will remove all consent data.
                        </p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDelete}>
                                Delete Consent
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}