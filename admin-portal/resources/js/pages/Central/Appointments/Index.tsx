import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Calendar, Clock, MapPin, Phone, Mail, User, FileText, Eye, CheckCircle, XCircle, AlertCircle, Hourglass, Stethoscope, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/hooks/use-time-locale';

interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}

interface Service {
    id: number;
    name: string;
    duration?: number;
}

interface Appointment {
    id: number;
    tenant_id: number;
    tenant_name: string;
    status: string;
    appointment_datetime: string;
    appointment_datetime_local?: string;
    tenant_timezone?: string;
    start_time?: string;
    end_time?: string;
    notes?: string;
    patient: Patient;
    service?: Service;
    booking_source: string;
    date_time_preference: string;
    created_at: string;
    updated_at: string;
}

interface Props {
    appointments: Appointment[];
    pagination: {
        current_page: number;
        per_page: number;
        total: number;
        last_page: number;
        from: number;
        to: number;
    };
    filters: {
        status: string;
        search: string;
        date_from: string;
        date_to: string;
        perPage: number;
    };
    practitioner: {
        id: number;
        first_name: string;
        last_name: string;
    };
}

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '' },
];

export default function CentralAppointmentsIndex({ appointments, pagination, filters, practitioner }: Props) {
    const { auth, flash }: any = usePage().props;

    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showDetailsSheet, setShowDetailsSheet] = useState(false);

    // Filter states
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [status, setStatus] = useState(filters.status || '');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    // Handle flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                description: 'Operation completed successfully.',
                duration: 4000,
            });
        }
        if (flash?.error) {
            toast.error(flash.error, {
                description: 'Please try again or contact support if the issue persists.',
                duration: 5000,
            });
        }
    }, [flash]);

    const handleSearch = () => {
        const filterParams = {
            search,
            perPage,
            status: status === 'all' ? '' : status,
            date_from: dateFrom,
            date_to: dateTo,
        };
        router.get(route('central.appointments'), filterParams, { preserveState: true });
    };
       const handlePerPageChange = (e:any) => {
        const filterParams = {
            search,
            perPage:e,
            status: status === 'all' ? '' : status,
            date_from: dateFrom,
            date_to: dateTo,
        };
        setPerPage(e)
        router.get(route('central.appointments'), filterParams, { preserveState: true });
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'confirmed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'cancelled':
            case 'declined':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return <Hourglass className="h-4 w-4" />;
            case 'confirmed':
                return <CheckCircle className="h-4 w-4" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4" />;
            case 'cancelled':
            case 'declined':
                return <XCircle className="h-4 w-4" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
        }
    };

    const formatDateTime = (datetime: string) => {
        return new Date(datetime).toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const columns = [
        {
            accessorKey: 'tenant_name',
            header: 'Clinic',
            cell: ({ row }: any) => (
                <div className="font-medium text-sm">
                    {row.original.tenant_name}
                </div>
            ),
        },
        {
            accessorKey: 'patient',
            header: 'Patient',
            cell: ({ row }: any) => (
                <div>
                    <div className="font-medium">
                        {row.original.patient?.first_name} {row.original.patient?.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                        {row.original.patient?.email}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'service',
            header: 'Service',
            cell: ({ row }: any) => (
                <div className="font-medium">
                    {row.original.service?.name || 'Unknown Service'}
                </div>
            ),
        },
        {
            accessorKey: 'appointment_datetime',
            header: 'Date & Time',
            cell: ({ row }: any) => (
                <div className="text-sm">
                    <div className="font-medium">{formatDateTime(row.original.appointment_datetime_local || row.original.appointment_datetime)}</div>
                    <div className="text-xs text-gray-500">
                        {row.original.tenant_timezone && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs mr-1">{row.original.tenant_timezone.split('/').pop()}</span>}
                        Requested: {formatDateTime(row.original.created_at)}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'booking_source',
            header: 'Source',
            cell: ({ row }: any) => (
                <Badge variant="secondary" className="capitalize">
                    {row.original.booking_source}
                </Badge>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }: any) => (
                <Badge className={getStatusColor(row.original.status)}>
                    {getStatusIcon(row.original.status)}
                    <span className="ml-1 capitalize">{row.original.status}</span>
                </Badge>
            ),
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }: any) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setSelectedAppointment(row.original);
                        setShowDetailsSheet(true);
                    }}
                >
                    <Eye className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    const table = useReactTable({
        data: appointments,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="All Appointments" />

            <Card className="shadow-none border-none m-6">
                <CardContent className="space-y-4 p-6">
                    <PageHeader
                        title="All Appointments"
                        description={`Viewing appointments across all clinics for ${practitioner.first_name} ${practitioner.last_name}`}
                    />

                    <FilterBar
                        searchPlaceholder="Search by patient name, service, or clinic..."
                        filters={[
                            {
                                name: 'status',
                                label: 'Status',
                                type: 'select',
                                options: [
                                    { label: 'All Statuses', value: '' },
                                    { label: 'Pending', value: 'pending' },
                                    { label: 'Confirmed', value: 'confirmed' },
                                    { label: 'Completed', value: 'completed' },
                                    { label: 'Cancelled', value: 'cancelled' },
                                    { label: 'Declined', value: 'declined' },
                                ]
                            },
                            {
                                name: 'date_from',
                                label: 'From Date',
                                type: 'date'
                            },
                            {
                                name: 'date_to',
                                label: 'To Date',
                                type: 'date'
                            }
                        ]}
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={handlePerPageChange}
                    />

                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Appointments Across All Clinics</h3>
                                <div className="text-sm text-gray-500">
                                    Showing {pagination.from} to {pagination.to} of {pagination.total} appointments
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            {table.getHeaderGroups().map((headerGroup) => (
                                                <tr key={headerGroup.id}>
                                                    {headerGroup.headers.map((header) => (
                                                        <th key={header.id} className="px-4 py-3 text-left text-sm font-medium text-gray-900">
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
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {table.getRowModel().rows.map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50">
                                                    {row.getVisibleCells().map((cell) => (
                                                        <td key={cell.id} className="px-4 py-3 text-sm">
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-4">
                                <Pagination
                                    currentPage={pagination.current_page}
                                    lastPage={pagination.last_page}
                                    total={pagination.total}
                                    url="/central/appointments"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            {/* Appointment Details Sheet */}
            <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
                <SheetContent className="w-[50vw] min-w-[50vw] max-w-[50vw] overflow-hidden flex flex-col bg-gradient-to-br from-white to-gray-50/50" side="right">
                    <SheetHeader className="pb-8 border-b border-gray-200/80 flex-shrink-0 bg-white/80 backdrop-blur-sm">
                        <SheetTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
                                    <Calendar className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Appointment Details</h2>
                                    <p className="text-sm text-gray-500 font-medium mt-1">
                                        {selectedAppointment && `Appointment ID: #${selectedAppointment.id}`}
                                    </p>
                                </div>
                            </div>
                            {selectedAppointment && (
                                <div className="flex flex-col items-end gap-2">
                                    <Badge className={`${getStatusColor(selectedAppointment.status)} px-4 py-2 text-sm font-semibold shadow-sm`}>
                                        {getStatusIcon(selectedAppointment.status)}
                                        <span className="ml-2 capitalize">{selectedAppointment.status}</span>
                                    </Badge>
                                    <p className="text-xs text-gray-400 font-medium">Status</p>
                                </div>
                            )}
                        </SheetTitle>
                    </SheetHeader>

                    {selectedAppointment && (
                        <div className="flex-1 overflow-y-auto py-6 pr-1">
                            <div className="space-y-8">
                                {/* Clinic Information */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100/50 shadow-sm">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                            <UserCheck className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Clinic Information</h3>
                                    </div>
                                    <div className="bg-white/80 rounded-xl p-4 backdrop-blur-sm border border-white/50">
                                        <p className="text-sm font-medium text-gray-600 mb-1">Clinic Name</p>
                                        <p className="text-lg font-bold text-gray-900">{selectedAppointment.tenant_name}</p>
                                    </div>
                                </div>

                                {/* Date & Time Section */}
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100/50 shadow-sm">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                            <Clock className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Schedule Information</h3>
                                    </div>
                                    <div className="bg-white/80 rounded-xl p-4 backdrop-blur-sm border border-white/50">
                                        <p className="text-sm font-medium text-gray-600 mb-1">Appointment Date & Time</p>
                                        <p className="text-2xl font-bold text-gray-900 mb-1">
                                            {formatDateTime(selectedAppointment.appointment_datetime_local || selectedAppointment.appointment_datetime)}
                                        </p>
                                        {selectedAppointment.tenant_timezone && (
                                            <div className="text-xs text-gray-500">
                                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{selectedAppointment.tenant_timezone.split('/').pop()}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 mt-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <Badge variant="secondary" className="capitalize font-medium px-3 py-1">
                                                {selectedAppointment.booking_source} Booking
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Patient Information */}
                                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100/50 shadow-sm">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Patient Information</h3>
                                    </div>

                                    <div className="bg-white/80 rounded-xl p-5 backdrop-blur-sm border border-white/50">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center border-2 border-violet-200">
                                                <User className="w-6 h-6 text-violet-600" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-gray-900">
                                                    {selectedAppointment.patient?.first_name} {selectedAppointment.patient?.last_name}
                                                </p>
                                                <p className="text-sm text-gray-500 font-medium">Patient</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {selectedAppointment.patient?.email && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                        <Mail className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email Address</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedAppointment.patient.email}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedAppointment.patient?.phone_number && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                        <Phone className="w-4 h-4 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone Number</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedAppointment.patient.phone_number}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Service Details */}
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100/50 shadow-sm">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                                            <Stethoscope className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Service Details</h3>
                                    </div>

                                    <div className="bg-white/80 rounded-xl p-5 backdrop-blur-sm border border-white/50">
                                        <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                <Stethoscope className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Service Type</p>
                                                <p className="text-sm font-bold text-gray-900">{selectedAppointment.service?.name || 'Unknown Service'}</p>
                                                {selectedAppointment.service?.duration && (
                                                    <p className="text-xs text-gray-600">{selectedAppointment.service.duration} minutes</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Information */}
                                {selectedAppointment.notes && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-5">
                                            <FileText className="w-5 h-5 text-primary" />
                                            <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                                        </div>

                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Notes</p>
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <p className="text-sm text-gray-700 leading-relaxed">{selectedAppointment.notes}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* System Information */}
                                <div className="bg-gray-50 rounded-lg p-4 border-t">
                                    <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">System Information</p>
                                    <div className="text-xs text-gray-600 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Created:</span>
                                            <span>{new Date(selectedAppointment.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Last Updated:</span>
                                            <span>{new Date(selectedAppointment.updated_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}

