import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, AlertCircle, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';



type Service = {
    id: number;
    name: string;
    category: string;
    delivery_modes: string[];
    default_price: number;
    currency: string;
    is_active: boolean;
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
};



interface IndexProps {
    onCreateClick?: () => void;
    onEditClick?: (service: Service) => void;
    services?: any;
    filters?: any;
}

export default function Index({ onCreateClick, onEditClick, services: servicesProp, filters: filtersProp }: IndexProps = {}) {
    const pageProps = usePage<ServicesPageProps>().props;
    const servicesData = servicesProp || pageProps.services;
    const services = servicesData && typeof servicesData === 'object' && 'data' in servicesData 
        ? servicesData 
        : { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0, links: [], meta: {} };
    const filters = filtersProp || pageProps.filters || {};
    const flash = pageProps.flash || {};
    const auth = (pageProps as any).auth;
    const userPerms: string[] = auth?.user?.permissions || [];
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(!!flash?.error);
    const [serviceToArchive, setServiceToArchive] = useState<Service | null>(null);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Define columns inside component to access props
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
            accessorKey: 'is_active',
            header: 'Status',
            cell: ({ row }) => {
                const isActive = row.getValue('is_active') as boolean;
                return (
                    <Badge 
                        variant={isActive ? "default" : "secondary"}
                        className={isActive 
                            ? "bg-green-100 text-green-800 hover:bg-green-100" 
                            : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                        }
                    >
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                            isActive ? 'bg-green-600' : 'bg-gray-400'
                        }`} />
                        {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                );
            },
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const service = row.original;
                return (
                    <div className="flex items-center gap-2">
                        {userPerms.includes('update-services') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditClick ? onEditClick(service) : router.get(route('services.edit', service.id), {}, { preserveState: false })}
                            >
                                <Edit className="w-4 h-4" />
                            </Button>
                        )}
                        {userPerms.includes('delete-services') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setServiceToArchive(service);
                                    setShowArchiveModal(true);
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: Array.isArray(services.data) ? services.data : [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
                        router.get(route('settings.services'), { search, perPage: perPage }, { preserveState: true  })

        // router.get('/services', { search, perPage }, { preserveState: true });
    };

    const handleArchiveService = () => {
        if (serviceToArchive) {
            router.delete(route('services.destroy', serviceToArchive.id), {
                preserveState: false,
                onSuccess: () => {
                    setShowArchiveModal(false);
                    setServiceToArchive(null);
                }
            });
        }
    };

        return (
        <>
            <Card className="shadow-none border-none">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-lg sm:text-xl">All Services</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {userPerms.includes('view-services') && (
                            <Button
                                onClick={() => router.get(route('services.archived'), {}, { preserveState: false })}
                                variant="outline"
                                className="flex items-center gap-2 h-10 sm:h-[44px] text-sm"
                            >
                                <Archive className="w-4 h-4" />
                                <span className="hidden sm:inline">Archived Service</span>
                                <span className="sm:hidden">Archived</span>
                            </Button>
                        )}
                        {userPerms.includes('add-services') && (
                            <Button
                                onClick={onCreateClick || (() => router.get(route('services.create'), {}, { preserveState: false }))}
                                variant="outline"
                                className="h-10 sm:h-[44px] bg-white text-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/10 text-sm"
                            >
                                Add Service
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">

                <FilterBar
                    search={search}
                    onSearchChange={setSearch}
                    onSearch={handleSearch}
                    perPage={perPage}
                    onPerPageChange={(value) => {
                        setPerPage(value);
                        router.get(route('settings.services'), { search, perPage: value }, { preserveState: true  })
                        // router.get('/services', { search, perPage: value }, { preserveState: true  });
                    }}
                />

                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm min-w-[700px]">
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
                                            <h3 className="text-base font-medium text-gray-900 mb-2">No services found</h3>
                                            <p className="text-sm text-gray-500">Get started by adding your first service using the button above.</p>
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
                    url="/services" 
                />
            </CardContent>
        </Card>

        {/* Archive Confirmation Modal */}
        <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Archive Service</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to archive "{serviceToArchive?.name}"? You can restore it later from Archived Services.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowArchiveModal(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleArchiveService} className="bg-red-600 hover:bg-red-700 text-white">
                        Archive Service
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
        </>
    );
} 