import { useRef, useState, useMemo, useCallback } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, getExpandedRowModel, Row } from '@tanstack/react-table';
import { CheckCircle, AlertCircle, MoreHorizontal, Clock, RefreshCw, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

type Invitation = {
    id: number;
    patient_id: number;
    tenant_id: string;
    email: string;
    token: string;
    status: 'pending' | 'accepted' | 'expired';
    expires_at: string;
    sent_at: string;
    accepted_at?: string;
    created_at: string;
    updated_at: string;
    patient_name: string;
    patient_email: string;
    patient_health_number?: string;
    is_expired: boolean;
    expires_in_days: number;
};

type GroupedPatient = {
    id: string;
    patient_id: number;
    patient_name: string;
    patient_email: string;
    patient_health_number?: string;
    total_invitations: number;
    pending_count: number;
    accepted_count: number;
    expired_count: number;
    latest_invitation_date: string;
    latest_status: string;
    invitations: Invitation[];
    subRows?: GroupedPatient[];
};

interface InvitationsTableProps {
    invitations?: any;
    filters?: any;
    standalone?: boolean;
}

// Helper function to group invitations by patient
const groupInvitationsByPatient = (invitations: Invitation[]): GroupedPatient[] => {
    const grouped = invitations.reduce((acc, invitation) => {
        const key = `${invitation.patient_id}`;
        
        if (!acc[key]) {
            acc[key] = {
                id: key,
                patient_id: invitation.patient_id,
                patient_name: invitation.patient_name,
                patient_email: invitation.patient_email,
                patient_health_number: invitation.patient_health_number,
                total_invitations: 0,
                pending_count: 0,
                accepted_count: 0,
                expired_count: 0,
                latest_invitation_date: invitation.sent_at,
                latest_status: invitation.status,
                invitations: []
            };
        }
        
        acc[key].invitations.push(invitation);
        acc[key].total_invitations++;
        
        // Count by status
        if (invitation.status === 'pending' && !invitation.is_expired) {
            acc[key].pending_count++;
        } else if (invitation.status === 'accepted') {
            acc[key].accepted_count++;
        } else if (invitation.status === 'expired' || invitation.is_expired) {
            acc[key].expired_count++;
        }
        
        // Update latest invitation info
        if (new Date(invitation.sent_at) > new Date(acc[key].latest_invitation_date)) {
            acc[key].latest_invitation_date = invitation.sent_at;
            acc[key].latest_status = invitation.is_expired ? 'expired' : invitation.status;
        }
        
        return acc;
    }, {} as Record<string, GroupedPatient>);
    
    // Sort invitations within each group by date (newest first)
    Object.values(grouped).forEach(group => {
        group.invitations.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    });
    
    return Object.values(grouped).sort((a, b) => 
        new Date(b.latest_invitation_date).getTime() - new Date(a.latest_invitation_date).getTime()
    );
};

export default function InvitationsTable({ 
    invitations, 
    filters: propFilters, 
    standalone = true 
}: InvitationsTableProps) {
    const { flash }: any = usePage().props;
    
    const [search, setSearch] = useState(propFilters?.search || '');
    const [perPage, setPerPage] = useState(propFilters?.perPage || 10);

    // Memoize the grouped data (server handles all filtering)
    const groupedData = useMemo(() => {
        return groupInvitationsByPatient(invitations?.data || []);
    }, [invitations?.data]);

    const resendInvitation = useCallback((invitationId: number) => {
        router.post(route('patients.invitations.resend', invitationId), {}, {
            onSuccess: () => {
                // Invitation resent successfully - the success message is handled by the controller
            },
        });
    }, []);

    const getStatusSummary = useCallback((group: GroupedPatient) => {
        const badges = [];
        
        if (group.pending_count > 0) {
            badges.push(
                <Badge key="pending" variant="secondary" className="text-xs mr-1">
                    <Send className="w-3 h-3 mr-1" />
                    {group.pending_count} Pending
                </Badge>
            );
        }
        
        if (group.accepted_count > 0) {
            badges.push(
                <Badge key="accepted" variant="default" className="text-xs bg-green-100 text-green-800 mr-1">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {group.accepted_count} Accepted
                </Badge>
            );
        }
        
        if (group.expired_count > 0) {
            badges.push(
                <Badge key="expired" variant="destructive" className="text-xs mr-1">
                    <Clock className="w-3 h-3 mr-1" />
                    {group.expired_count} Expired
                </Badge>
            );
        }
        
        return <div className="flex flex-wrap gap-1">{badges}</div>;
    }, []);

    const columns: ColumnDef<GroupedPatient>[] = useMemo(() => [
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
            accessorKey: 'patient_name', 
            header: 'Patient', 
            cell: ({ row }) => {
                const group = row.original;
                return (
                    <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={""} alt={group.patient_name} />
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {group.patient_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium text-gray-900">{group.patient_name}</div>
                            {group.patient_health_number && (
                                <div className="text-sm text-gray-500">Health #: {group.patient_health_number}</div>
                            )}
                        </div>
                    </div>
                );
            }
        },
        { 
            accessorKey: 'patient_email', 
            header: 'Email', 
            cell: ({ row }) => row.getValue('patient_email') || '-'
        },
        { 
            accessorKey: 'total_invitations', 
            header: 'Total Invitations', 
            cell: ({ row }) => {
                const group = row.original;
                return (
                    <div className="text-sm">
                        <div className="font-medium">{group.total_invitations} invitations</div>
                        <div className="text-gray-500">Click to view history</div>
                    </div>
                );
            }
        },
        { 
            id: 'status_summary',
            header: 'Status Summary', 
            cell: ({ row }) => {
                const group = row.original;
                return getStatusSummary(group);
            }
        },
        { 
            accessorKey: 'latest_invitation_date', 
            header: 'Latest Invitation', 
            cell: ({ row }) => {
                const group = row.original;
                const latestDate = new Date(group.latest_invitation_date);
                return (
                    <div className="text-sm">
                        <div>{latestDate.toLocaleDateString()}</div>
                        <div className="text-gray-500 capitalize">{group.latest_status}</div>
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const group = row.original;
                
                // Find the most recent invitation that can be resent (pending/expired)
                const latestResendableInvitation = group.invitations.find(
                    inv => inv.status !== 'accepted'
                );
                
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {latestResendableInvitation ? (
                                <DropdownMenuItem 
                                    onClick={() => resendInvitation(latestResendableInvitation.id)}
                                    className="text-blue-600"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    {latestResendableInvitation.is_expired ? 'Send New Invitation' : 'Resend Latest Invitation'}
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled className="text-gray-400">
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    All Invitations Accepted
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ], [getStatusSummary, resendInvitation]);

    const table = useReactTable({
        data: groupedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        enableExpanding: true,
        getRowCanExpand: (row) => {
            return row.original.invitations && row.original.invitations.length > 0;
        },
    });

    const handleSearch = useCallback(() => {
        router.get(route('patients.invitations.index'), { 
            search, 
            perPage
        }, { 
            only: ['invitations', 'filters'],
            preserveState: true,
            preserveScroll: true 
        });
    }, [search, perPage]);

    const handlePerPageChange = useCallback((e: any) => {
        setPerPage(e);
        router.get(route('patients.invitations.index'), { 
            search, 
            perPage: e
        }, { 
            only: ['invitations', 'filters'],
            preserveState: true,
            preserveScroll: true 
        });
    }, [search]);

    const renderExpandedRow = useCallback((group: GroupedPatient) => {
        const renderInvitationStatus = (invitation: Invitation) => {
            switch (invitation.status) {
                case 'pending':
                    return invitation.is_expired ? (
                        <Badge variant="destructive" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Expired
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="text-xs">
                            <Send className="w-3 h-3 mr-1" />
                            Pending
                        </Badge>
                    );
                case 'accepted':
                    return (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Accepted
                        </Badge>
                    );
                case 'expired':
                    return (
                        <Badge variant="destructive" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Expired
                        </Badge>
                    );
                default:
                    return (
                        <Badge variant="outline" className="text-xs">
                            Unknown
                        </Badge>
                    );
            }
        };

        const renderInvitationExpiry = (invitation: Invitation) => {
            const expiresAt = new Date(invitation.expires_at);
            const isExpired = invitation.is_expired;
            const daysLeft = invitation.expires_in_days;
            
            return (
                <div className={`text-sm ${isExpired ? 'text-red-600' : daysLeft <= 1 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {expiresAt.toLocaleDateString()}
                    {!isExpired && (
                        <div className="text-xs text-gray-500">
                            {daysLeft > 0 ? `${Math.ceil(daysLeft)} days left` : 'Expires today'}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <tr className="bg-gray-50">
                <td colSpan={7} className="px-6 py-4">
                    <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 text-sm">
                            Invitation History for {group.patient_name}
                        </h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Sent Date</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Expires</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {group.invitations.map((invitation) => (
                                        <tr key={invitation.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2">
                                                {renderInvitationStatus(invitation)}
                                            </td>
                                            <td className="px-4 py-2">
                                                {new Date(invitation.sent_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-2">
                                                {renderInvitationExpiry(invitation)}
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
    }, []);

    return (
        <div className="space-y-4">
            <FilterBar 
                search={search} 
                onSearchChange={setSearch} 
                onSearch={handleSearch} 
                perPage={perPage} 
                onPerPageChange={handlePerPageChange} 
            />
            
            {flash?.success && (
                <Alert className="border-green-400 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-700">Success</AlertTitle>
                    <AlertDescription className="text-green-600">{flash.success}</AlertDescription>
                </Alert>
            )}
            
            {flash?.error && (
                <Alert className="border-red-400 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-700">Error</AlertTitle>
                    <AlertDescription className="text-red-600">{flash.error}</AlertDescription>
                </Alert>
            )}
            
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-300">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th key={header.id} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 tracking-wide">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-gray-300 bg-white">
                        {table.getRowModel().rows.length > 0 ? (
                            table.getRowModel().rows.map((row) => (
                                <>
                                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-6 py-4 text-sm text-gray-900">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                    {row.getIsExpanded() && renderExpandedRow(row.original)}
                                </>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                    No invitations found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {invitations && (
                <Pagination
                    currentPage={invitations?.current_page || 1}
                    lastPage={invitations?.last_page || 1}
                    total={invitations?.total || 0}
                    url={route('patients.invitations.index')}
                />
            )}
        </div>
    );
} 