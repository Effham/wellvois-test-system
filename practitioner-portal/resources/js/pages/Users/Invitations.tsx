import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { Head, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Loader2, RotateCcw } from "lucide-react"
import { toast } from 'sonner';

type Invitation = {
    id: number;
    email: string;
    role: {
        id: number;
        name: string;
    };
    status: 'pending' | 'accepted' | 'expired' | 'cancelled';
    expires_at: string;
    sent_at: string;
    accepted_at: string | null;
    inviter: {
        id: number;
        name: string;
    } | null;
};

type InvitationsPageProps = {
    invitations?: {
        data: Invitation[];
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

export default function Invitations({ invitations: propInvitations, filters: propFilters }: { invitations?: any; filters?: any }) {
    const { invitations: pageInvitations, filters: pageFilters, flash }: any = usePage<InvitationsPageProps>().props;
    const invitations = propInvitations || pageInvitations;
    const filters = propFilters || pageFilters;
    const [search, setSearch] = useState(filters?.search || '');
    const [perPage, setPerPage] = useState(filters?.perPage || 10);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Fetch invitations if not loaded (only on mount)
    // Note: This is handled by the parent Index component, so this is a fallback
    useEffect(() => {
        if (!invitations) {
            router.get('/users', { search, perPage, tab: 'invitations' }, {
                only: ['invitations', 'filters'],
                preserveState: true,
                preserveScroll: true,
            });
        }
    }, []); // Only run on mount

    const handleResend = (invitationId: number) => {
        router.post(route('users.invitations.resend', invitationId), {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Invitation resent successfully');
            },
            onError: (errors) => {
                toast.error('Failed to resend invitation');
            }
        });
    };

    const getStatusBadge = (status: string, expiresAt: string) => {
        const isExpired = new Date(expiresAt) < new Date();
        
        if (status === 'accepted') {
            return <Badge variant="default" className="bg-green-600">Accepted</Badge>;
        }
        if (status === 'expired' || isExpired) {
            return <Badge variant="secondary">Expired</Badge>;
        }
        if (status === 'cancelled') {
            return <Badge variant="secondary">Cancelled</Badge>;
        }
        return <Badge variant="default">Pending</Badge>;
    };

    const columns: ColumnDef<Invitation>[] = [
        {
            accessorKey: 'email',
            header: 'Email',
            cell: ({ row }) => <div className="font-medium">{row.getValue('email')}</div>,
        },
        {
            accessorKey: 'role',
            header: 'Role',
            cell: ({ row }) => {
                const role = row.original.role;
                return (
                    <Badge variant="default">
                        {role.name}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const invitation = row.original;
                return getStatusBadge(invitation.status, invitation.expires_at);
            },
        },
        {
            accessorKey: 'expires_at',
            header: 'Expires',
            cell: ({ row }) => {
                const date = new Date(row.getValue('expires_at'));
                return <div className="text-sm text-muted-foreground">{date.toLocaleDateString()}</div>;
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const invitation = row.original;
                const isExpired = new Date(invitation.expires_at) < new Date();
                const canResend = invitation.status === 'pending' && !isExpired;

                return (
                    <div className="flex items-center gap-2">
                        {canResend && (
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleResend(invitation.id)}
                                title="Resend invitation"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: invitations?.data || [],
        columns: columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/users', { search, perPage, tab: 'invitations' }, { preserveState: true });
    };

    return (
        <>
            <FilterBar
                search={search}
                onSearchChange={setSearch}
                onSearch={handleSearch}
                perPage={perPage}
                onPerPageChange={(value) => {
                    setPerPage(value);
                    router.get('/users', { search, perPage: value, tab: 'invitations' }, { preserveState: true });
                }}
            />

            <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm min-w-[600px]">
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
                        {!invitations ? (
                            <tr>
                                <td colSpan={columns.length} className="border-b px-4 py-8 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        Loading invitations...
                                    </div>
                                </td>
                            </tr>
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="border-b px-4 py-8 text-center text-muted-foreground">
                                    No invitations found
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="border-b px-4 py-2">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {invitations && (
                <Pagination currentPage={invitations.current_page} lastPage={invitations.last_page} total={invitations.total} url="/users?tab=invitations" />
            )}
        </>
    );
}
