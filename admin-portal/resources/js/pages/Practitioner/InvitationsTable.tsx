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
import React from 'react';

type Invitation = {
    id: number;
    practitioner_id: number | null;
    tenant_id: string;
    email: string;
    token: string;
    status: 'pending' | 'accepted' | 'expired';
    expires_at: string;
    sent_at: string;
    accepted_at?: string;
    created_at: string;
    updated_at: string;
    practitioner_name: string | null;
    practitioner_email: string;
    practitioner_title?: string | null;
    is_expired: boolean;
    expires_in_days: number;
};

type GroupedPractitioner = {
    id: string;
    practitioner_id: number | null;
    practitioner_name: string | null;
    practitioner_email: string;
    practitioner_title?: string | null;
    total_invitations: number;
    pending_count: number;
    accepted_count: number;
    expired_count: number;
    latest_invitation_date: string;
    latest_status: string;
    invitations: Invitation[];
    subRows?: GroupedPractitioner[];
};

interface InvitationsTableProps {
    invitations?: any;
    filters?: any;
    standalone?: boolean;
}

// Helper function to group invitations by practitioner
const groupInvitationsByPractitioner = (invitations: Invitation[]): GroupedPractitioner[] => {
    const grouped = invitations.reduce((acc, invitation) => {
        // Use practitioner_id if available, otherwise use email as unique key for email-only invitations
        const key = invitation.practitioner_id ? `practitioner-${invitation.practitioner_id}` : `email-${invitation.email}`;
        
        if (!acc[key]) {
            acc[key] = {
                id: key,
                practitioner_id: invitation.practitioner_id,
                practitioner_name: invitation.practitioner_name,
                practitioner_email: invitation.practitioner_email,
                practitioner_title: invitation.practitioner_title,
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
    }, {} as Record<string, GroupedPractitioner>);
    
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
        return groupInvitationsByPractitioner(invitations?.data || []);
    }, [invitations?.data]);

    const resendInvitation = useCallback((invitationId: number) => {
        router.post(route('practitioners.invitations.resend', invitationId), {}, {
            onSuccess: () => {
                // Invitation resent successfully - the success message is handled by the controller
            },
        });
    }, []);

    const getStatusSummary = useCallback((group: GroupedPractitioner) => {
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

    const columns: ColumnDef<GroupedPractitioner>[] = useMemo(() => [
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
            accessorKey: 'practitioner_name', 
            header: 'Practitioner', 
            cell: ({ row }) => {
                const group = row.original;
                const displayName = group.practitioner_name || 'Pending Registration';
                const initials = group.practitioner_name 
                    ? group.practitioner_name.split(' ').map(n => n[0]).join('') 
                    : '?';
                
                return (
                    <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={""} alt={displayName} />
                            <AvatarFallback className={group.practitioner_name ? "bg-primary/10 text-primary font-medium" : "bg-yellow-100 text-yellow-700 font-medium"}>
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className={`font-medium ${group.practitioner_name ? 'text-gray-900' : 'text-yellow-700 italic'}`}>
                                {displayName}
                            </div>
                            {group.practitioner_title && (
                                <div className="text-sm text-gray-500">{group.practitioner_title}</div>
                            )}
                            {!group.practitioner_name && (
                                <div className="text-xs text-gray-500">Email-only invitation</div>
                            )}
                        </div>
                    </div>
                );
            }
        },
        { 
            accessorKey: 'practitioner_email', 
            header: 'Email', 
            cell: ({ row }) => row.getValue('practitioner_email') || '-'
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
        router.get(route('practitioners.index'), { 
            search, 
            perPage, 
            tab: 'invitations'
        }, { 
            only: ['invitations', 'filters'],
            preserveState: true,
            preserveScroll: true 
        });
    }, [search, perPage]);

    const renderExpandedRow = useCallback((group: GroupedPractitioner) => {
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
                            Invitation History for {group.practitioner_name || group.practitioner_email}
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
        <div className="space-y-6">
            <Card className={standalone ? 'card' : 'border-none shadow-none card'}>
                <CardHeader className="card-header-mobile">
                    <CardTitle>
                        Practitioner Invitations
                    </CardTitle>
                </CardHeader>
                <CardContent className="card-content-mobile">
                    <div className="space-y-4">
                        <FilterBar
                            search={search}
                            onSearchChange={setSearch}
                            onSearch={handleSearch}
                            perPage={perPage}
                            onPerPageChange={(value) => {
                                setPerPage(value);
                                router.get(route('practitioners.index'), { 
                                    search, 
                                    perPage: value,
                                    tab: 'invitations'
                                }, { 
                                    only: ['invitations', 'filters'],
                                    preserveState: true,
                                    preserveScroll: true 
                                });
                            }}
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

                        <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                            <table className="w-full min-w-[800px]">
                                <thead className="bg-gray-50 border-b border-gray-300">
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => (
                                                <th
                                                    key={header.id}
                                                    className="px-6 py-4 text-left text-sm font-semibold text-gray-900 tracking-wide whitespace-nowrap"
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="divide-y divide-gray-300 bg-white">
                                    {table.getRowModel().rows.length > 0 ? (
                                        table.getRowModel().rows.map((row) => (
                                            <React.Fragment key={row.id}>
                                                <tr className="hover:bg-gray-50 transition-colors">
                                                    {row.getVisibleCells().map((cell) => (
                                                        <td
                                                            key={cell.id}
                                                            className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap"
                                                        >
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                                {row.getIsExpanded() && renderExpandedRow(row.original)}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center">
                                                <div className="text-gray-500">
                                                    <h3 className="text-base font-medium text-gray-900 mb-2">
                                                        No invitations found
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        Invitations will appear here once practitioners are invited.
                                                    </p>
                                                </div>
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
                                url={`${route('practitioners.index')}?tab=invitations`}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 