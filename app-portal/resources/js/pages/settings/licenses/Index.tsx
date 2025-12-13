import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SettingsLayout from '@/layouts/settings-layout';
import { Key, UserPlus, X, Search, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface License {
    id: number;
    license_key: string;
    status: 'available' | 'assigned' | 'revoked';
    assigned_at: string | null;
    revoked_at: string | null;
    notes: string | null;
    subscription_item_id: number | null;
    subscription_item?: {
        id: number;
        quantity: number | null;
        stripe_price: string;
    };
    practitioners?: Array<{
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        pivot: {
            assigned_at: string;
            assigned_by: number | null;
            notes: string | null;
        };
    }>;
    created_at: string;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
}

interface Props {
    licenses: {
        data: License[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    practitioners: Practitioner[];
    filters: {
        status?: string;
        search?: string;
    };
}

export default function LicensesIndex({ licenses, practitioners, filters: initialFilters }: Props) {
    const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
    const [attachDialogOpen, setAttachDialogOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        practitioner_id: '',
        notes: '',
    });

    const handleAttach = (license: License) => {
        setSelectedLicense(license);
        reset();
        setAttachDialogOpen(true);
    };

    const submitAttach = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLicense) return;

        post(route('settings.licenses.attach', selectedLicense.id), {
            preserveScroll: true,
            onSuccess: () => {
                setAttachDialogOpen(false);
                reset();
                setSelectedLicense(null);
            },
        });
    };

    const handleDetach = (license: License, practitionerId: number) => {
        if (confirm('Are you sure you want to detach this license from the practitioner?')) {
            router.delete(route('settings.licenses.detach', [license.id, practitionerId]), {
                preserveScroll: true,
            });
        }
    };

    const handleRevoke = (license: License) => {
        if (confirm('Are you sure you want to revoke this license? This will detach it from all practitioners.')) {
            router.post(route('settings.licenses.revoke', license.id), {
                preserveScroll: true,
            });
        }
    };

    const handleFilter = (key: string, value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        router.get(route('settings.licenses'), Object.fromEntries(params), {
            preserveScroll: true,
            replace: true,
        });
    };

    const getStatusBadge = (status: string) => {
        const variants = {
            available: 'default',
            assigned: 'secondary',
            revoked: 'destructive',
        } as const;

        return (
            <Badge variant={variants[status as keyof typeof variants] || 'default'}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        );
    };

    return (
        <SettingsLayout activeSection="licenses" title="Licenses">
            <Head title="Licenses" />

            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">License Management</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage practitioner licenses created based on your subscription seats
                    </p>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="search">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="search"
                                        placeholder="Search by license key..."
                                        className="pl-10"
                                        defaultValue={initialFilters.search || ''}
                                        onChange={(e) => handleFilter('search', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={initialFilters.status || 'all'}
                                    onValueChange={(value) => handleFilter('status', value === 'all' ? '' : value)}
                                >
                                    <SelectTrigger id="status">
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="available">Available</SelectItem>
                                        <SelectItem value="assigned">Assigned</SelectItem>
                                        <SelectItem value="revoked">Revoked</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* All Licenses */}
                <Card>
                        <CardHeader>
                            <CardTitle>All Licenses</CardTitle>
                            <CardDescription>
                                View and manage all licenses. Licenses are automatically created based on your subscription seats.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {licenses.data.length === 0 ? (
                                <div className="text-center py-12">
                                    <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">No licenses found.</p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Licenses will be created automatically based on your subscription seats.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>License Key</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Assigned To</TableHead>
                                                    <TableHead>Assigned At</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {licenses.data.map((license) => (
                                                    <TableRow key={license.id}>
                                                        <TableCell className="font-mono text-sm">
                                                            {license.license_key}
                                                        </TableCell>
                                                        <TableCell>
                                                            {getStatusBadge(license.status)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {license.practitioners && license.practitioners.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {license.practitioners.map((practitioner) => (
                                                                        <div key={practitioner.id} className="flex items-center gap-2">
                                                                            <span className="text-sm">
                                                                                {practitioner.first_name} {practitioner.last_name}
                                                                            </span>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0"
                                                                                onClick={() => handleDetach(license, practitioner.id)}
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-gray-400">Not assigned</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {license.assigned_at ? (
                                                                <span className="text-sm text-gray-600">
                                                                    {new Date(license.assigned_at).toLocaleDateString()}
                                                                </span>
                                                            ) : (
                                                                <span className="text-sm text-gray-400">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                {license.status === 'available' && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleAttach(license)}
                                                                    >
                                                                        <UserPlus className="h-4 w-4 mr-1" />
                                                                        Attach
                                                                    </Button>
                                                                )}
                                                                {license.status === 'assigned' && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleRevoke(license)}
                                                                    >
                                                                        Revoke
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Pagination */}
                                    {licenses.last_page > 1 && (
                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="text-sm text-gray-600">
                                                Showing {((licenses.current_page - 1) * licenses.per_page) + 1} to{' '}
                                                {Math.min(licenses.current_page * licenses.per_page, licenses.total)} of{' '}
                                                {licenses.total} licenses
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={licenses.current_page === 1}
                                                    onClick={() => router.get(route('settings.licenses'), { ...initialFilters, page: licenses.current_page - 1 })}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={licenses.current_page === licenses.last_page}
                                                    onClick={() => router.get(route('settings.licenses'), { ...initialFilters, page: licenses.current_page + 1 })}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                {/* Attach Dialog */}
                <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Attach License</DialogTitle>
                            <DialogDescription>
                                Assign license <span className="font-mono font-semibold">{selectedLicense?.license_key}</span> to a practitioner.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitAttach}>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label htmlFor="practitioner_id">Practitioner *</Label>
                                    {practitioners.length === 0 ? (
                                        <div className="mt-2 p-4 border border-gray-200 rounded-md bg-gray-50">
                                            <p className="text-sm text-gray-600">
                                                No practitioners currently found. Please invite practitioners to assign licenses.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <Select
                                                value={data.practitioner_id}
                                                onValueChange={(value) => setData('practitioner_id', value)}
                                            >
                                                <SelectTrigger id="practitioner_id">
                                                    <SelectValue placeholder="Select a practitioner" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {practitioners.map((practitioner) => (
                                                        <SelectItem key={practitioner.id} value={practitioner.id.toString()}>
                                                            {practitioner.first_name} {practitioner.last_name} ({practitioner.email})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.practitioner_id && (
                                                <p className="text-sm text-red-500 mt-1">{errors.practitioner_id}</p>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="notes">Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        value={data.notes}
                                        onChange={(e) => setData('notes', e.target.value)}
                                        placeholder="Add any notes about this license assignment..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setAttachDialogOpen(false);
                                        reset();
                                        setSelectedLicense(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing || practitioners.length === 0}>
                                    {processing ? 'Attaching...' : 'Attach License'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </SettingsLayout>
    );
}
