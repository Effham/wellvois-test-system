import { useState } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Eye, Clock, Calendar, MapPin, User } from 'lucide-react';



type WaitingListEntry = {
    id: number;
    patient_name: string;
    email: string;
    phone_number?: string;
    preferred_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'any';
    preferred_time: 'morning' | 'afternoon' | 'evening' | 'any';
    status: 'waiting' | 'confirmed';
    created_at: string;
    notes?: string;
};

interface WaitingListProps {
    items?: {
        data: WaitingListEntry[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters?: {
        search?: string;
        perPage?: number;
        status?: string;
        preferred_day?: string;
        preferred_time?: string;
    };
}

export default function Index({ items = { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 }, filters = {} }: WaitingListProps) {
    const [selectedEntry, setSelectedEntry] = useState<WaitingListEntry | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            waiting: { variant: 'secondary' as const, label: 'Waiting' },
            confirmed: { variant: 'default' as const, label: 'Confirmed' },
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.waiting;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const formatDay = (day: string) => {
        if (day === 'any') return 'Any Day';
        return day.charAt(0).toUpperCase() + day.slice(1);
    };

    const formatTime = (time: string) => {
        if (time === 'any') return 'Any Time';
        return time.charAt(0).toUpperCase() + time.slice(1);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const columns: ColumnDef<WaitingListEntry>[] = [
        {
            accessorKey: 'patient_name',
            header: 'Patient Name',
            cell: ({ row }) => (
                <div className="font-medium text-gray-900">
                    {row.getValue('patient_name')}
                </div>
            ),
        },
        {
            accessorKey: 'email',
            header: 'Email',
            cell: ({ row }) => (
                <div className="text-gray-600">
                    {row.getValue('email')}
                </div>
            ),
        },
        {
            accessorKey: 'preferred_day',
            header: 'Preferred Day',
            cell: ({ row }) => (
                <div className="text-gray-700">
                    {formatDay(row.getValue('preferred_day'))}
                </div>
            ),
        },
        {
            accessorKey: 'preferred_time',
            header: 'Preferred Time',
            cell: ({ row }) => (
                <div className="text-gray-700">
                    {formatTime(row.getValue('preferred_time'))}
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => getStatusBadge(row.getValue('status')),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setSelectedEntry(row.original);
                        setSheetOpen(true);
                    }}
                    className="h-8 w-8 p-0"
                >
                    <span className="sr-only">View details</span>
                    <Eye className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    const table = useReactTable({
        data: items.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const filterOptions = [
        {
            id: 'search',
            type: 'search' as const,
            placeholder: 'Search patients...',
            value: filters.search || '',
        },
        {
            id: 'status',
            type: 'select' as const,
            placeholder: 'All Statuses',
            value: filters.status || '',
            options: [
                { value: '', label: 'All Statuses' },
                { value: 'waiting', label: 'Waiting' },
            ],
        },
        {
            id: 'preferred_day',
            type: 'select' as const,
            placeholder: 'All Days',
            value: filters.preferred_day || '',
            options: [
                { value: '', label: 'All Days' },
                { value: 'monday', label: 'Monday' },
                { value: 'tuesday', label: 'Tuesday' },
                { value: 'wednesday', label: 'Wednesday' },
                { value: 'thursday', label: 'Thursday' },
                { value: 'friday', label: 'Friday' },
                { value: 'saturday', label: 'Saturday' },
                { value: 'sunday', label: 'Sunday' },
                { value: 'any', label: 'Any Day' },
            ],
        },
        {
            id: 'preferred_time',
            type: 'select' as const,
            placeholder: 'All Times',
            value: filters.preferred_time || '',
            options: [
                { value: '', label: 'All Times' },
                { value: 'morning', label: 'Morning' },
                { value: 'afternoon', label: 'Afternoon' },
                { value: 'evening', label: 'Evening' },
                { value: 'any', label: 'Any Time' },
            ],
        },
    ];

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: route('dashboard') },
                { title: 'Waiting List', href: route('waiting-list.index') },
            ]}
        >
            <Head title="Waiting List" />
            <div className="p-3 sm:p-6 page-content-mobile">
                <div className="space-y-4 sm:space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                                <span className="text-base sm:text-lg">Waiting List</span>
                            </div>
                            {/* <Button variant="outline" className="text-sm w-full sm:w-auto">
                                Add to Waiting List
                            </Button> */}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="card-content-mobile">
                        <div className="space-y-4">
                            <FilterBar
                                filters={filterOptions}
                                onFilterChange={(filterId, value) => {
                                    // TODO: Implement filter functionality
                                    console.log('Filter changed:', filterId, value);
                                }}
                                route="waiting-list.index"
                            />

                            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[700px]">
                                    <thead className="bg-gray-50 border-b border-gray-300">
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <tr key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => (
                                                    <th key={header.id} className="px-6 py-4 md:px-6 md:py-4 text-left text-sm font-semibold text-gray-900 tracking-wide">
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
                                    <tbody className="divide-y divide-gray-300 bg-white">
                                        {table.getRowModel().rows.length > 0 ? (
                                            table.getRowModel().rows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    className="hover:bg-gray-50 transition-colors"
                                                    onClick={() => {
                                                        setSelectedEntry(row.original);
                                                        setSheetOpen(true);
                                                    }}
                                                >
                                                    {row.getVisibleCells().map((cell) => (
                                                        <td key={cell.id} className="px-6 py-4 md:px-6 md:py-4 text-sm text-gray-900">
                                                            {flexRender(
                                                                cell.column.columnDef.cell,
                                                                cell.getContext()
                                                            )}
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
                                                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                                                />
                                                            </svg>
                                                        </div>
                                                        <h3 className="text-base font-medium text-gray-900 mb-2">No patients in waiting list</h3>
                                                        <p className="text-sm text-gray-500">Patients will appear here when they join the waiting list.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            <Pagination
                                currentPage={items.current_page}
                                lastPage={items.last_page}
                                total={items.total}
                                url={route('waiting-list.index')}
                            />
                        </div>
                    </CardContent>
                </Card>
                </div>
            </div>

            {/* Patient Details Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="w-[50vw] max-w-none min-w-[50vw] overflow-y-auto" style={{ width: '50vw' }}>
                    <SheetHeader className="pb-6 border-b border-gray-200">
                        <SheetTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <User className="h-5 w-5 text-blue-600" />
                            </div>
                            Patient Details
                        </SheetTitle>
                        <SheetDescription className="text-gray-600 mt-2">
                            View comprehensive information about the patient and their waiting list entry.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedEntry && (
                        <div className="py-6 space-y-8">
                            {/* Patient Information */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-50 rounded-lg">
                                        <User className="h-4 w-4 text-green-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                                    <div className="grid grid-cols-1 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Full Name</label>
                                            <p className="text-base font-medium text-gray-900">{selectedEntry.patient_name}</p>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Email Address</label>
                                                <p className="text-sm text-gray-900 break-all">{selectedEntry.email}</p>
                                            </div>
                                            {selectedEntry.phone_number && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Phone Number</label>
                                                    <p className="text-sm text-gray-900">{selectedEntry.phone_number}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Preferences */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-50 rounded-lg">
                                        <Calendar className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900">Scheduling Preferences</h3>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-5">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="flex items-start gap-3">
                                            <Calendar className="h-5 w-5 text-purple-500 mt-1" />
                                            <div className="space-y-2 flex-1">
                                                <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Preferred Day</label>
                                                <p className="text-base font-medium text-gray-900">{formatDay(selectedEntry.preferred_day)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Clock className="h-5 w-5 text-purple-500 mt-1" />
                                            <div className="space-y-2 flex-1">
                                                <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Preferred Time</label>
                                                <p className="text-base font-medium text-gray-900">{formatTime(selectedEntry.preferred_time)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Status and Notes */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 rounded-lg">
                                        <Clock className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900">Status & Additional Information</h3>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-5 space-y-5">
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Current Status</label>
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(selectedEntry.status)}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Added to Waiting List</label>
                                        <p className="text-base font-medium text-gray-900">{formatDate(selectedEntry.created_at)}</p>
                                    </div>
                                    {selectedEntry.notes && (
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Notes</label>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                <p className="text-sm text-gray-900 leading-relaxed">
                                                    {selectedEntry.notes}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-6 border-t border-gray-200">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button className="flex-1 h-11 text-base font-medium">
                                        Schedule Appointment
                                    </Button>
                                    <Button variant="outline" className="flex-1 h-11 text-base font-medium">
                                        Contact Patient
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}