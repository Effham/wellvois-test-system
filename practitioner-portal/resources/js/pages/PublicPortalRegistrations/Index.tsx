import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Calendar, User, Mail, Check, X, Clock, CalendarCheck } from "lucide-react"
import { toast } from 'sonner';
import { formatDate, formatTime } from '@/hooks/use-time-locale';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Public Portal Registrations', href: '/public-portal-registrations' },
];

type Patient = {
    id: number;
    user_id: number;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    email: string;
    health_number: string;
    phone_number?: string;
    date_of_birth?: string;
    registration_status: 'Requested' | 'pending_invitation' | 'Active' | 'Rejected';
    requested_at: string;
    approved_at?: string;
    approved_by?: number;
    user?: {
        id: number;
        name: string;
        email: string;
    };
    has_appointment: boolean;
    appointment_count: number;
    first_appointment?: {
        id: number;
        appointment_datetime: string;
        status: string;
        service?: {
            name: string;
        };
        location?: {
            name: string;
        };
    };
};

type PublicPortalRegistrationsPageProps = {
    registrations: {
        data: Patient[];
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

export default function Index() {
    const { registrations, filters, flash }: any = usePage<PublicPortalRegistrationsPageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const handleApprove = (patient: Patient) => {
        if (confirm(`Are you sure you want to approve ${patient.first_name} ${patient.last_name}'s registration?`)) {
            router.post(route('patients.approve', patient.id), {}, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Patient registration approved successfully!');
                },
                onError: () => {
                    toast.error('Failed to approve patient registration.');
                }
            });
        }
    };

    const handleRejectClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setRejectionReason('');
        setRejectModalOpen(true);
    };

    const handleRejectSubmit = () => {
        if (!selectedPatient || !rejectionReason.trim()) {
            toast.error('Please provide a rejection reason.');
            return;
        }

        if (rejectionReason.trim().length < 10) {
            toast.error('Rejection reason must be at least 10 characters.');
            return;
        }

        setIsSubmitting(true);
        router.post(route('patients.reject', selectedPatient.id), {
            rejection_reason: rejectionReason
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Patient registration rejected.');
                setRejectModalOpen(false);
                setSelectedPatient(null);
                setRejectionReason('');
            },
            onError: () => {
                toast.error('Failed to reject patient registration.');
            },
            onFinish: () => {
                setIsSubmitting(false);
            }
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Requested':
                return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>;
            case 'pending_invitation':
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Pending Invitation</Badge>;
            case 'Active':
                return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
            case 'Rejected':
                return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const columns: ColumnDef<Patient>[] = [
        {
            accessorKey: 'first_name',
            header: 'Patient',
            cell: ({ row }) => {
                const patient = row.original;
                return (
                    <div className="space-y-1">
                        <div className="font-medium">
                            {patient.first_name} {patient.last_name}
                            {patient.preferred_name && (
                                <span className="text-gray-500 ml-1">({patient.preferred_name})</span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {patient.email}
                        </div>
                        {patient.health_number && (
                            <div className="text-xs text-gray-400">
                                HN: {patient.health_number}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'user',
            header: 'User Account',
            cell: ({ row }) => {
                const user = row.original.user;
                if (!user) {
                    return (
                        <div className="text-gray-500 italic text-sm">
                            No user account
                        </div>
                    );
                }
                return (
                    <div className="space-y-1">
                        <div className="font-medium flex items-center gap-1 text-sm">
                            <User className="h-3 w-3" />
                            {user.name}
                        </div>
                        <div className="text-xs text-gray-500">
                            {user.email}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: 'has_appointment',
            header: 'Appointment',
            cell: ({ row }) => {
                const patient = row.original;
                if (!patient.has_appointment) {
                    return (
                        <div className="text-sm text-gray-500 italic">
                            Register only
                        </div>
                    );
                }
                const appointment = patient.first_appointment;
                if (!appointment) {
                    return (
                        <Badge variant="outline" className="text-xs">
                            {patient.appointment_count} appointment(s)
                        </Badge>
                    );
                }
                return (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                            <CalendarCheck className="h-3 w-3 text-blue-500" />
                            <span className="font-medium">
                                {formatDate(appointment.appointment_datetime)}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {formatTime(appointment.appointment_datetime)}
                        </div>
                        {appointment.service && (
                            <div className="text-xs text-gray-600">
                                {appointment.service.name}
                            </div>
                        )}
                        {patient.appointment_count > 1 && (
                            <Badge variant="outline" className="text-xs mt-1">
                                +{patient.appointment_count - 1} more
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'requested_at',
            header: 'Requested',
            cell: ({ row }) => {
                const requestedAt = row.getValue('requested_at') as string;
                return (
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <div className="space-y-1">
                            <div className="text-sm font-medium">
                                {formatDate(requestedAt)}
                            </div>
                            <div className="text-xs text-gray-500">
                                {formatTime(requestedAt)}
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: 'registration_status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.getValue('registration_status') as string;
                return getStatusBadge(status);
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const patient = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(patient)}
                        >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectClick(patient)}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                        </Button>
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: registrations.data,
        columns: columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/public-portal-registrations', { search, perPage }, { preserveState: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Public Portal Registrations" />
            <Card className="shadow-none border-none m-6">
                <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Intake Queue</h1>
                            <p className="text-sm text-gray-600">
                                Review and approve patient registrations from the public portal ({registrations.total} pending)
                            </p>
                        </div>
                    </div>

                    <FilterBar
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={(value) => {
                            setPerPage(value);
                            router.get('/public-portal-registrations', { search, perPage: value }, { preserveState: true });
                        }}
                        placeholder="Search by patient name, email, or user account..."
                    />

                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <th key={header.id} className="border-b px-4 py-3 text-left font-medium text-gray-700">
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.length > 0 ? (
                                    table.getRowModel().rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            {row.getVisibleCells().map((cell) => (
                                                <td key={cell.id} className="border-b px-4 py-3">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={columns.length} className="border-b px-4 py-8 text-center text-gray-500">
                                            No public portal registrations found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {registrations.last_page > 1 && (
                        <Pagination
                            currentPage={registrations.current_page}
                            lastPage={registrations.last_page}
                            total={registrations.total}
                            url="/public-portal-registrations"
                        />
                    )}
                </CardContent>
            </Card>

            {/* Rejection Modal */}
            <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Reject Patient Registration</DialogTitle>
                        <DialogDescription>
                            {selectedPatient && (
                                <span>
                                    You are about to reject the registration request from{' '}
                                    <strong>{selectedPatient.first_name} {selectedPatient.last_name}</strong>.
                                    Please provide a detailed reason for rejection.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="rejection_reason">
                                Rejection Reason <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="rejection_reason"
                                placeholder="Please explain why this registration is being rejected (minimum 10 characters)..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows={4}
                                className="resize-none"
                            />
                            <p className="text-xs text-gray-500">
                                {rejectionReason.length} / 10 minimum characters
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setRejectModalOpen(false);
                                setSelectedPatient(null);
                                setRejectionReason('');
                            }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleRejectSubmit}
                            disabled={isSubmitting || rejectionReason.trim().length < 10}
                        >
                            {isSubmitting ? 'Rejecting...' : 'Reject Registration'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}