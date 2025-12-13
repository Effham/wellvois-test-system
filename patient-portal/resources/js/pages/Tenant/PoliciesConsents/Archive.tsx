import React, { useState } from 'react';
// Imports treated as external dependencies to resolve build environment issues
import { Head, router, usePage, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, FileText } from 'lucide-react';

// Interfaces for data structure (Assuming a flat array of archived policies)
interface Consent {
    id: number;
    title: string;
    key: string;
    entity_type: string;
    is_required: boolean;
    versions_count: number;
    deleted_at: string; // Crucial for archived policies
}

interface Props {
    // We assume the controller returns a simple array of archived policies
    consents: Consent[];
    // Keeping auth for permission checks
    auth: any; 
}

// NOTE: Since the controller returns non-paginated data, we removed FilterBar/Pagination components
// NOTE: This component assumes it is accessed via 'policies-consents.archive' route.

const breadcrumbs = [
    { title: 'Dashboard', href: route('dashboard') },
    { title: 'Policies & Consents', href: route('policies-consents.index') },
    { title: 'Archive', href: route('policies-consents.archive') },
];

const getEntityTypeLabel = (entityType: string) => {
    switch (entityType) {
        case 'PRACTITIONER':
            return 'Practitioner';
        case 'PATIENT':
            return 'Patient';
        case 'USER':
            return 'User';
        default:
            return entityType;
    }
};

export default function Archive({ consents }: Props) {
    const { auth }: { auth: any } = usePage().props;
    // We need to access permissions from the auth prop passed to the page
    const permissions = auth?.user?.permissions || [];

    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [selectedConsent, setSelectedConsent] = useState<Consent | null>(null);

    const handleRestore = () => {
        if (selectedConsent?.id) {
            // Hitting policies-consents.restore for the main Consent model (policy)
            router.post(route('policies-consents.restore', selectedConsent.id), {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setRestoreDialogOpen(false);
                },
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Archived Policies" />

            <div className="p-6 md:p-6 page-content-mobile">
                <div className="space-y-6">
                    {/* Header: Title and Back Button */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Archived Policies & Consents
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Soft-deleted consent policies that can be restored.
                            </p>
                        </div>
                        <Link href={route('policies-consents.index')}>
                            <Button variant="outline">
                                Back to Active Policies
                            </Button>
                        </Link>
                    </div>

                    {/* Archived Policies Table */}
                    <div className="overflow-x-auto rounded-lg border mt-6">
                        {consents.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    No archived policies found
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Archive a policy from the active list to see it here.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Key</TableHead>
                                        <TableHead>Entity Type</TableHead>
                                        <TableHead>Required</TableHead>
                                        <TableHead>Archived At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {consents.map((consent) => (
                                        <TableRow key={consent.id}>
                                            <TableCell className="font-medium">{consent.title}</TableCell>
                                            <TableCell>
                                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {consent.key}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {getEntityTypeLabel(consent.entity_type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {consent.is_required ? (
                                                    <Badge variant="destructive" className="text-xs">Yes</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs">No</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(consent.deleted_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {/* RESTORE BUTTON LOGIC - conditional on permission */}
                                                {/* {permissions.includes('restore-consents') && ( */}
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="text-white hover:bg-green-700 bg-green-600"
                                                        onClick={() => {
                                                            setSelectedConsent(consent);
                                                            setRestoreDialogOpen(true);
                                                        }}
                                                        title="Restore Policy"
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-2" />
                                                        Restore
                                                    </Button>
                                                {/* )} */}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {/* Restore Policy Dialog */}
                    <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Restore Policy</DialogTitle>
                            </DialogHeader>
                            <p>Are you sure you want to restore the policy: **{selectedConsent?.title}**? It will be moved back to the active policies list.</p>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleRestore}>
                                    Restore Policy
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </AppLayout>
    );
}