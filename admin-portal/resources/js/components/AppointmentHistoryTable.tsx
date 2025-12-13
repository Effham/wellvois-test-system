import React, { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, getExpandedRowModel } from '@tanstack/react-table';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, User, Calendar, MapPin, Stethoscope } from 'lucide-react';
import { smartFormatDateTime } from '@/utils/time-locale-helpers';
import { getTenantTimezone } from '@/hooks/use-time-locale';

interface AppointmentHistoryItem {
    id: number;
    status: string;
    appointment_datetime: string;
    appointment_datetime_local?: string;
    tenant_timezone?: string;
    mode: string;
    booking_source: string;
    notes?: string;
    created_at: string;
    patient: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    service?: {
        id: number;
        name: string;
    };
    location?: {
        id: number;
        name: string;
    };
    practitioners_list?: Array<{id: number; name: string}>;
}

interface GroupedAppointmentHistory {
    id: string;
    root_appointment_id: number;
    total_appointments: number;
    latest_appointment_date: string;
    latest_status: string;
    current_patient: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    service_name: string;
    location_name?: string;
    appointments: AppointmentHistoryItem[];
    subRows?: GroupedAppointmentHistory[];
}

interface AppointmentHistoryTableProps {
    appointmentHistoryData: AppointmentHistoryItem[];
}

// Helper function to group appointments by root_appointment_id
const groupAppointmentsByRoot = (appointments: AppointmentHistoryItem[]): GroupedAppointmentHistory[] => {
    // Since the backend already returns appointments in the same chain,
    // we should treat all appointments as one group
    if (appointments.length === 0) {
        return [];
    }

    // All appointments in the response belong to the same root, so group them together
    const firstAppointment = appointments[0];
    const latestAppointment = appointments[appointments.length - 1];
    
    const grouped: GroupedAppointmentHistory = {
        id: 'history-group',
        root_appointment_id: firstAppointment.id, // The first appointment is typically the root
        total_appointments: appointments.length,
        latest_appointment_date: latestAppointment.appointment_datetime,
        latest_status: latestAppointment.status,
        current_patient: latestAppointment.patient,
        service_name: firstAppointment.service?.name || 'Unknown Service',
        location_name: firstAppointment.location?.name,
        appointments: appointments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    };

    return [grouped];
};

export default function AppointmentHistoryTable({ appointmentHistoryData }: AppointmentHistoryTableProps) {
    // Memoize the grouped data to prevent infinite re-renders
    const groupedData = useMemo(() => {
        return groupAppointmentsByRoot(appointmentHistoryData || []);
    }, [appointmentHistoryData]);

    const getStatusColor = useCallback((status: string) => {
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
    }, []);

    const getStatusIcon = useCallback((status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return <Clock className="h-3 w-3 mr-1" />;
            case 'confirmed':
                return <CheckCircle className="h-3 w-3 mr-1" />;
            case 'completed':
                return <CheckCircle className="h-3 w-3 mr-1" />;
            case 'cancelled':
            case 'declined':
                return <XCircle className="h-3 w-3 mr-1" />;
            default:
                return <Clock className="h-3 w-3 mr-1" />;
        }
    }, []);

    const columns: ColumnDef<GroupedAppointmentHistory>[] = useMemo(() => [
        {
            id: 'expander',
            header: '',
            cell: ({ row }) => {
                return (
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={row.getToggleExpandedHandler()}
                        >
                            {row.getIsExpanded() ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                );
            },
        },
        { 
            accessorKey: 'current_patient', 
            header: 'Current Patient', 
            cell: ({ row }) => {
                const group = row.original;
                return (
                    <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={""} alt={`${group.current_patient.first_name} ${group.current_patient.last_name}`} />
                            <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                {group.current_patient.first_name[0]}{group.current_patient.last_name[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium text-gray-900">
                                {group.current_patient.first_name} {group.current_patient.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{group.current_patient.email}</div>
                        </div>
                    </div>
                );
            }
        },
        { 
            accessorKey: 'service_name', 
            header: 'Service', 
            cell: ({ row }) => (
                <div className="font-medium">{row.original.service_name}</div>
            )
        },
        { 
            accessorKey: 'location_name', 
            header: 'Location', 
            cell: ({ row }) => (
                <div className="text-sm">{row.original.location_name || 'Not specified'}</div>
            )
        },
        { 
            accessorKey: 'total_appointments', 
            header: 'History Count', 
            cell: ({ row }) => {
                const group = row.original;
                return (
                    <div className="text-sm">
                        <div className="font-medium">{group.total_appointments} appointment{group.total_appointments > 1 ? 's' : ''}</div>
                        <div className="text-gray-500">Click to view history</div>
                    </div>
                );
            }
        },
        { 
            id: 'latest_status',
            header: 'Latest Status', 
            cell: ({ row }) => {
                const group = row.original;
                return (
                    <Badge className={getStatusColor(group.latest_status)}>
                        {getStatusIcon(group.latest_status)}
                        <span className="capitalize">{group.latest_status}</span>
                    </Badge>
                );
            }
        },
        { 
            accessorKey: 'latest_appointment_date', 
            header: 'Latest Appointment', 
            cell: ({ row }) => {
                const group = row.original;
                const latestAppointment = group.appointments[group.appointments.length - 1];
                return (
                    <div className="text-sm">
                        <div className="font-medium">{smartFormatDateTime(latestAppointment)}</div>
                    </div>
                );
            }
        },
    ], [getStatusColor, getStatusIcon]);

    const table = useReactTable({
        data: groupedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        enableExpanding: true,
        getRowCanExpand: (row) => {
            return row.original.appointments && row.original.appointments.length > 1;
        },
    });

    const renderExpandedRow = useCallback((group: GroupedAppointmentHistory) => {
        const renderAppointmentStatus = (appointment: AppointmentHistoryItem) => {
            return (
                <Badge className={getStatusColor(appointment.status)}>
                    {getStatusIcon(appointment.status)}
                    <span className="capitalize">{appointment.status}</span>
                </Badge>
            );
        };

        return (
            <tr className="bg-gray-50">
                <td colSpan={7} className="px-6 py-4">
                    <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 text-sm">
                            Appointment History for {group.service_name}
                        </h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Patient</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Date & Time</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Source</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {group.appointments.map((appointment, index) => (
                                        <tr key={appointment.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2">
                                                <div className="flex items-center space-x-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={""} alt={`${appointment.patient.first_name} ${appointment.patient.last_name}`} />
                                                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                                            {appointment.patient.first_name[0]}{appointment.patient.last_name[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium text-xs">
                                                            {appointment.patient.first_name} {appointment.patient.last_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{appointment.patient.email}</div>
                                                    </div>
                                                    {index === 0 && (
                                                        <Badge variant="outline" className="text-xs">Original</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="text-sm">
                                                    <div>{smartFormatDateTime(appointment)}</div>
                                                    <div className="text-xs text-gray-500 capitalize">{appointment.mode}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                {renderAppointmentStatus(appointment)}
                                            </td>
                                            <td className="px-4 py-2">
                                                <Badge variant="secondary" className="text-xs capitalize">
                                                    {appointment.booking_source.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="text-xs text-gray-600 max-w-xs truncate">
                                                    {appointment.notes || '-'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </td>
            </tr>
        );
    }, [getStatusColor, getStatusIcon]);

    if (!groupedData || groupedData.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No appointment history found
            </div>
        );
    }

    return (
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
            <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-300">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th key={header.id} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 tracking-wide">
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-gray-300 bg-white">
                    {table.getRowModel().rows.map((row) => (
                        <React.Fragment key={row.id}>
                            <tr className="hover:bg-gray-50 transition-colors">
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="px-6 py-4 text-sm text-gray-900">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                            {row.getIsExpanded() && renderExpandedRow(row.original)}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
