import { useState } from 'react';
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Pencil, Trash2, Eye, UserX } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Consents', href: '/consents' },
];

export default function Index() {
    const { consents, filters, auth }: { consents: any; filters: any; auth: any } = usePage().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);

    const permissions = auth?.user?.permissions || [];

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
    const [selectedConsent, setSelectedConsent] = useState<any | null>(null);

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'granted':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'revoked':
                return 'bg-red-100 text-red-800';
            case 'expired':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getTypeBadgeColor = (type: string) => {
        switch (type) {
            case 'explicit':
                return 'bg-blue-100 text-blue-800';
            case 'auto':
                return 'bg-green-100 text-green-800';
            case 'emergency':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const table = useReactTable({
        data: consents.data,
        columns: [
            {
                accessorKey: 'entity_type',
                header: 'Entity Type',
                cell: ({ row }) => (
                    <div className="font-medium">{row.original.entity_type}</div>
                ),
            },
            {
                accessorKey: 'entity_id',
                header: 'Entity ID',
                cell: ({ row }) => (
                    <div className="text-gray-600">#{row.original.entity_id}</div>
                ),
            },
            {
                accessorKey: 'user',
                header: 'User',
                cell: ({ row }) => (
                    <div>
                        {row.original.user ? (
                            <div>
                                <div className="font-medium">{row.original.user.name}</div>
                                <div className="text-sm text-gray-500">{row.original.user.email}</div>
                            </div>
                        ) : (
                            <span className="text-gray-400">No user assigned</span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'consent_type',
                header: 'Type',
                cell: ({ row }) => (
                    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getTypeBadgeColor(row.original.consent_type)}`}>
                        {row.original.consent_type}
                    </span>
                ),
            },
            {
                accessorKey: 'consent_status',
                header: 'Status',
                cell: ({ row }) => (
                    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getStatusBadgeColor(row.original.consent_status)}`}>
                        {row.original.consent_status}
                    </span>
                ),
            },
            {
                accessorKey: 'consented_at',
                header: 'Consented At',
                cell: ({ row }) => (
                    <div className="text-sm">
                        {row.original.consented_at ? new Date(row.original.consented_at).toLocaleDateString() : 'N/A'}
                    </div>
                ),
            },
            {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }) => (
                    <div className="flex space-x-2">
                        {permissions.includes('view-consents') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => router.get(route('consents.show', row.original.id))}
                                title="View"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        )}
                        {permissions.includes('update-consents') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => router.get(route('consents.edit', row.original.id))}
                                title="Edit"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {permissions.includes('update-consents') && row.original.consent_status === 'granted' && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-orange-600 hover:text-orange-800"
                                onClick={() => {
                                    setSelectedConsent(row.original);
                                    setRevokeDialogOpen(true);
                                }}
                                title="Revoke"
                            >
                                <UserX className="h-4 w-4" />
                            </Button>
                        )}
                        {permissions.includes('delete-consents') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-600 hover:text-red-800"
                                onClick={() => {
                                    setSelectedConsent(row.original);
                                    setDeleteDialogOpen(true);
                                }}
                                title="Delete"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ),
            },
        ],
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get(route('consents.index'), { search, perPage }, { preserveState: true });
    };

    const handleRevoke = () => {
        if (selectedConsent?.id) {
            router.patch(route('consents.update', selectedConsent.id), {
                ...selectedConsent,
                consent_status: 'revoked',
            });
            setRevokeDialogOpen(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Consents" />

            <div className="space-y-4 p-6">
                <PageHeader 
                    title="Consents" 
                    breadcrumbs={breadcrumbs} 
                    createRoute={permissions.includes('add-consents') ? route('consents.create') : undefined} 
                    createLabel="New Consent" 
                />

                <FilterBar
                    search={search}
                    onSearchChange={setSearch}
                    onSearch={handleSearch}
                    perPage={perPage}
                    onPerPageChange={(value) => {
                        setPerPage(value);
                        router.get(route('consents.index'), { search, perPage: value }, { preserveState: true });
                    }}
                />

                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th key={header.id} className="border-b px-4 py-2 text-left">
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="border-b px-4 py-2">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination currentPage={consents.current_page} lastPage={consents.last_page} total={consents.total} url="/consents" />

                {/* Revoke Consent Dialog */}
                <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Revoke Consent</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to revoke consent for "{selectedConsent?.entity_type}" (ID: {selectedConsent?.entity_id})? This action will change the status to "revoked".</p>
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
                        <p>Are you sure you want to permanently delete this consent record? This action cannot be undone.</p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (selectedConsent?.id) {
                                        router.delete(route('consents.destroy', selectedConsent.id));
                                        setDeleteDialogOpen(false);
                                    }
                                }}
                            >
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}