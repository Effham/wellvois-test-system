import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RotateCcw, Trash2, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

type Location = {
    id: number;
    name: string;
    city: string;
    province: string;
    timezone: string;
    street_address: string;
    phone_number: string;
    email_address: string;
    is_active: boolean;
    deleted_at: string;
    full_address: string;
};

type LocationsPageProps = {
    locations: {
        data: Location[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
    };
    filters: {
        search?: string;
        perPage?: number;
    };

    flash?: {
        success?: string;
        error?: string;
    };
};

const breadcrumbs = [
    { title: 'Settings', href: '/settings' },
    { title: 'Locations', href: '/settings?section=locations' },
    { title: 'Archived Locations', href: '/locations-archived' },
];

export default function Archived() {
    const { locations, filters, flash } = usePage<LocationsPageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(!!flash?.error);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Define columns for archived locations
    const columns: ColumnDef<Location>[] = [
        {
            accessorKey: 'name',
            header: 'Name',
            cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
        },
        {
            accessorKey: 'city',
            header: 'City',
        },
        {
            accessorKey: 'province',
            header: 'Province',
        },
        {
            accessorKey: 'full_address',
            header: 'Address',
            cell: ({ row }) => {
                const address = row.getValue('full_address') as string;
                return <div className="max-w-xs truncate" title={address}>{address}</div>;
            },
        },
        {
            accessorKey: 'deleted_at',
            header: 'Archived On',
            cell: ({ row }) => {
                const deletedAt = new Date(row.getValue('deleted_at'));
                return <div className="text-gray-500">{deletedAt.toLocaleDateString()}</div>;
            },
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const location = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSelectedLocation(location);
                                setShowRestoreModal(true);
                            }}
                            title="Restore location"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                        {/* Commented out permanent delete for now */}
                        {/* <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSelectedLocation(location);
                                setShowDeleteModal(true);
                            }}
                            title="Permanently delete location"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button> */}
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: locations.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/locations-archived', { search, perPage }, { preserveState: true });
    };

    const handleRestoreLocation = () => {
        if (selectedLocation) {
            router.post(route('locations.restore', selectedLocation.id), {}, {
                preserveState: false,
                onSuccess: () => {
                    setShowRestoreModal(false);
                    setSelectedLocation(null);
                }
            });
        }
    };

    const handleDeleteLocation = () => {
        if (selectedLocation) {
            router.delete(route('locations.force-delete', selectedLocation.id), {
                preserveState: false,
                onSuccess: () => {
                    setShowDeleteModal(false);
                    setSelectedLocation(null);
                }
            });
        }
    };

        return (
        <>
            <Head title="Archived Locations" />
            <AppLayout breadcrumbs={breadcrumbs}>
                <Card className="shadow-none border-none">
                    <CardHeader className="px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.get(route('settings.locations'))}
                                    className="text-gray-600 hover:text-gray-800"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Locations
                                </Button>
                                <div>
                                    <CardTitle className="text-xl font-semibold">Archived Locations</CardTitle>
                                    <p className="text-sm text-gray-600 mt-1">
                                        View and manage archived locations. You can restore or permanently delete them.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="px-6">
                        {/* Filter Bar */}
                        <FilterBar
                            onSearch={handleSearch}
                            search={search}
                            setSearch={setSearch}
                            perPage={perPage}
                            setPerPage={setPerPage}
                            showPerPage={true}
                            searchPlaceholder="Search archived locations..."
                        />

                        {/* Locations Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id} className="bg-gray-50 border-b">
                                            {headerGroup.headers.map((header) => (
                                                <th key={header.id} className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {table.getRowModel().rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            {row.getVisibleCells().map((cell) => (
                                                <td key={cell.id} className="px-4 py-3 text-sm text-gray-900">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Empty State */}
                            {locations.data.length === 0 && (
                                <div className="px-6 py-8 text-center">
                                    <div className="text-gray-500 mb-4">
                                        <div className="mx-auto w-12 h-12 mb-3">
                                            <svg
                                                className="w-full h-full text-gray-300"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1}
                                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1}
                                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                            </svg>
                                        </div>
                                        <h3 className="text-base font-medium text-gray-900 mb-2">No archived locations found</h3>
                                        <p className="text-sm text-gray-500">
                                            {search ? 'Try adjusting your search terms.' : 'You have no archived locations at the moment.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {locations.total > 0 && (
                            <div className="mt-6">
                                <Pagination
                                    currentPage={locations.current_page}
                                    lastPage={locations.last_page}
                                    perPage={locations.per_page}
                                    total={locations.total}
                                    from={locations.from}
                                    to={locations.to}
                                    onPageChange={(page) => {
                                        router.get('/locations-archived', {
                                            search,
                                            perPage,
                                            page,
                                        }, { preserveState: true });
                                    }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Restore Modal */}
                <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-green-600" />
                                Restore Location
                            </DialogTitle>
                            <DialogDescription>
                                Are you sure you want to restore "{selectedLocation?.name}"? This will make the location active again and available for use.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowRestoreModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleRestoreLocation} className="bg-green-600 hover:bg-green-700">
                                Restore Location
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Permanent Delete Modal - Commented out for now */}
                {/* <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                                Permanently Delete Location
                            </DialogTitle>
                            <DialogDescription className="text-red-600">
                                Are you sure you want to permanently delete "{selectedLocation?.name}"? This action cannot be undone and will remove all associated data.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteLocation}>
                                Permanently Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog> */}

                {/* Error Modal */}
                <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                                Error
                            </DialogTitle>
                            <DialogDescription>
                                {flash?.error}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => setShowErrorModal(false)}>
                                OK
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Toaster />
            </AppLayout>
        </>
    );
}
