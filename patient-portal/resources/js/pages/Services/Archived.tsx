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

type Service = {
    id: number;
    name: string;
    category: string;
    delivery_modes: string[];
    default_price: number;
    currency: string;
    is_active: boolean;
    deleted_at: string;
    formatted_delivery_modes: string;
    formatted_price: string;
};

type ServicesPageProps = {
    services: {
        data: Service[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search: string;
        perPage: number;
    };
    flash?: {
        success?: string;
        error?: string;
    };
};

const breadcrumbs = [
    { title: 'Settings', href: '/settings' },
    { title: 'Services', href: '/settings?section=services' },
    { title: 'Archived Services', href: '/services-archived' },
];

export default function Archived() {
    const { services, filters, flash } = usePage<ServicesPageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(!!flash?.error);
    const [selectedService, setSelectedService] = useState<Service | null>(null);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Define columns for archived services
    const columns: ColumnDef<Service>[] = [
        {
            accessorKey: 'name',
            header: 'Service Name',
            cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
        },
        {
            accessorKey: 'category',
            header: 'Service Type',
            cell: ({ row }) => {
                const category = row.getValue('category') as string;
                return (
                    <Badge variant="outline" className="text-xs">
                        {category}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'default_price',
            header: 'Fee',
            cell: ({ row }) => {
                const price = row.getValue('default_price');
                const numericPrice = parseFloat(price) || 0;
                return <div className="text-muted-foreground font-medium">${numericPrice.toFixed(2)}</div>;
            },
        },
        {
            accessorKey: 'deleted_at',
            header: 'Archived Date',
            cell: ({ row }) => {
                const deletedAt = new Date(row.getValue('deleted_at'));
                return <div className="text-sm text-gray-500">{deletedAt.toLocaleDateString()}</div>;
            },
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const service = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSelectedService(service);
                                setShowRestoreModal(true);
                            }}
                            title="Restore service"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSelectedService(service);
                                setShowDeleteModal(true);
                            }}
                            title="Permanently delete service"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: services.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/services-archived', { search, perPage }, { preserveState: true });
    };

    const handleRestoreService = () => {
        if (selectedService) {
            router.post(route('services.restore', selectedService.id), {}, {
                preserveState: false,
                onSuccess: () => {
                    setShowRestoreModal(false);
                    setSelectedService(null);
                }
            });
        }
    };

    const handleDeleteService = () => {
        if (selectedService) {
            router.delete(route('services.force-delete', selectedService.id), {
                preserveState: false,
                onSuccess: () => {
                    setShowDeleteModal(false);
                    setSelectedService(null);
                }
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Archived Services" />
            
            <div className="p-6">
                <Card className="shadow-none border-none">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.get(route('settings.services'))}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <CardTitle>Archived Services</CardTitle>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                            Services that have been archived. You can restore them or permanently delete them.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        <FilterBar
                            search={search}
                            onSearchChange={setSearch}
                            onSearch={handleSearch}
                            perPage={perPage}
                            onPerPageChange={(value) => {
                                setPerPage(value);
                                router.get('/services-archived', { search, perPage: value }, { preserveState: true });
                            }}
                        />

                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-sm">
                                <thead>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id} className="border-b bg-gray-50">
                                            {headerGroup.headers.map((header, index) => (
                                                <th key={header.id} className={`px-4 py-3 text-left font-bold text-gray-700 ${
                                                    index === 0 ? 'rounded-tl-md' : 
                                                    index === headerGroup.headers.length - 1 ? 'rounded-tr-md' : ''
                                                }`}>
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {table.getRowModel().rows.length > 0 ? (
                                        table.getRowModel().rows.map((row) => (
                                            <tr key={row.id} className="border-b hover:bg-gray-50">
                                                {row.getVisibleCells().map((cell) => (
                                                    <td key={cell.id} className="px-4 py-4">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={columns.length} className="px-6 py-8 text-center">
                                                <div className="text-gray-500">
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
                                                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-base font-medium text-gray-900 mb-2">No archived services found</h3>
                                                    <p className="text-sm text-gray-500">Archived services will appear here when you archive them.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <Pagination 
                            currentPage={services.current_page} 
                            lastPage={services.last_page} 
                            total={services.total} 
                            url="/services-archived" 
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Restore Confirmation Modal */}
            <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Restore Service</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to restore "{selectedService?.name}"? It will be available for booking again.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRestoreModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRestoreService} className="bg-green-600 hover:bg-green-700 text-white">
                            Restore Service
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Permanent Delete Confirmation Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Permanently Delete Service</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to permanently delete "{selectedService?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleDeleteService} className="bg-red-600 hover:bg-red-700 text-white">
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Error Modal */}
            <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="h-5 w-5" />
                            Error
                        </DialogTitle>
                        <DialogDescription className="text-red-600">
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

        <Toaster position="top-right" />
        </AppLayout>
    );
}
