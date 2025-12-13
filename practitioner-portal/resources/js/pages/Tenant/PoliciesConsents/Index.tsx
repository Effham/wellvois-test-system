import React, { useState, useEffect } from 'react';
// Imports treated as external dependencies to resolve build environment issues
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Plus,
    Eye,
    Trash2,
    FileText,
    Users,
    UserCheck,
    Shield,
    FolderArchive
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

// Interfaces are placed here as this file is self-contained
interface ActiveVersion {
    id: number;
    version: number;
    status: string;
    created_at: string;
}

interface Consent {
    id: number;
    title: string;
    key: string;
    entity_type: string;
    is_required: boolean;
    active_version: ActiveVersion | null;
    versions_count: number;
}

interface Props {
    // This component expects a simple array of Consent objects
    consents: Consent[];
}

export default function Index({ consents }: Props) {
    const { props } = usePage<{ flash?: { success?: string; error?: string } }>();
    const flash = props.flash;

    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [consentToArchive, setConsentToArchive] = useState<Consent | null>(null);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const handleDeleteClick = (consent: Consent) => {
        setConsentToArchive(consent);
        setShowArchiveModal(true);
    };

    const handleArchiveConsent = () => {
        if (consentToArchive) {
            router.delete(route('policies-consents.destroy', consentToArchive.id), {
                preserveState: false,
                onSuccess: () => {
                    setShowArchiveModal(false);
                    setConsentToArchive(null);
                }
            });
        }
    };

    const getEntityTypeIcon = (entityType: string) => {
        switch (entityType) {
            case 'PRACTITIONER':
                return <Shield className="h-4 w-4 text-blue-600" />;
            case 'PATIENT':
                return <Users className="h-4 w-4 text-green-600" />;
            case 'USER':
                return <UserCheck className="h-4 w-4 text-purple-600" />;
            default:
                return <FileText className="h-4 w-4 text-gray-600" />;
        }
    };

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

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: route('dashboard') },
                { title: 'Policies & Consents', href: route('policies-consents.index') },
            ]}
        >
            <Head title="Policies & Consents" />

            <div className="p-6 md:p-6 page-content-mobile">
                <div className="space-y-6">
                
                {/* Header and Action Grouping */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Policies & Consents
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Manage consent documents and policies for your organization
                        </p>
                    </div>
                    
                    {/* Action Buttons Grouped */}
                    <div className="flex space-x-3 mt-4 md:mt-0"> 
                        {/* Create New Button */}
                        <Link href={route('policies-consents.create')}>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Create New
                            </Button>
                        </Link>

                        {/* View Archived Policies Button */}
                        <Link href={route('policies-consents.archive')}>
                            <Button 
                                variant="outline" 
                                className="flex items-center space-x-2 border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                                <FolderArchive className="h-4 w-4" />
                                <span>View Archived Policies</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Consents</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{consents.length}</div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Versions</CardTitle>
                            <Badge variant="default" className="bg-green-100 text-green-800">
                                {consents.filter(c => c.active_version?.status === 'ACTIVE').length}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {consents.filter(c => c.active_version?.status === 'ACTIVE').length}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Versions</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {consents.reduce((sum, consent) => sum + consent.versions_count, 0)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Consents Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>All Consents</CardTitle>
                        <CardDescription>
                            Manage your organization's consent documents and policies
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {consents.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    No consents found
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Get started by creating your first consent document.
                                </p>
                                <Link href={route('policies-consents.create')}>
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Your First Consent
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Key</TableHead>
                                            <TableHead>Entity Type</TableHead>
                                            <TableHead>Active Version</TableHead>
                                            <TableHead>Total Versions</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {consents.map((consent) => (
                                            <TableRow key={consent.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <span>{consent.title}</span>
                                                        {consent.is_required && (
                                                            <Badge variant="destructive" className="text-xs">
                                                                Required
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                        {consent.key}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {getEntityTypeIcon(consent.entity_type)}
                                                        <span className="text-sm">
                                                            {getEntityTypeLabel(consent.entity_type)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {consent.active_version ? (
                                                        <Badge variant="outline">
                                                            v{consent.active_version.version}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-gray-400">No active version</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {consent.versions_count}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {consent.active_version?.status === 'ACTIVE' ? (
                                                        <Badge className="bg-green-100 text-green-800">
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={route('policies-consents.show', consent.id)}>
                                                            <Button variant="outline" size="sm" title="View Details">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDeleteClick(consent)}
                                                            title="Archive Policy"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </div>
            </div>

            {/* Archive Confirmation Modal */}
            <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Archive Consent Policy</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to archive "{consentToArchive?.title}"? If users have accepted this policy, it will be archived and moved to the archive page. If no users have accepted it, it will be permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowArchiveModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleArchiveConsent} className="bg-red-600 hover:bg-red-700 text-white">
                            Archive Policy
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Toaster position="top-right" richColors />
        </AppLayout>
    );
}