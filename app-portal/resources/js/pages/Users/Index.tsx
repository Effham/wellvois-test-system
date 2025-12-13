import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { withAppLayout } from '@/utils/layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Archive, Loader2, Mail, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import InvitationsTab from "./Invitations"
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Users', href: '/users' },
];

type User = {
    id: string;
    name: string;
    email: string;
    role_name: string;
    role_id: number;
    can_be_archived: boolean;
};

type Role = {
    id: number;
    name: string;
};

type UsersPageProps = {
    users?: {
        data: User[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    invitations?: {
        data: any[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    roles?: Role[];
    filters: {
        search: string;
        perPage: number;
    };
};

function Index() {
    const { users, invitations, roles, filters, flash, auth }: any = usePage<UsersPageProps>().props;
    const userPerms: string[] = auth?.user?.permissions || [];
    
    // Get current tab from URL or default to 'users'
    const getCurrentTab = () => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('tab') || 'users';
        }
        return 'users';
    };

    const [activeTab, setActiveTab] = useState(getCurrentTab());
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [userToArchive, setUserToArchive] = useState<User | null>(null);

    // Handle tab change - update URL and fetch data if needed
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        
        // Update URL to stay on /users route with tab query param
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            // Ensure we're on /users route, not /users/invitations
            if (url.pathname === '/users/invitations') {
                url.pathname = '/users';
            }
            url.searchParams.set('tab', value);
            window.history.replaceState({}, '', url.pathname + url.search);
        }

        // Fetch data for the selected tab if not already loaded
        if (value === 'users' && (!users || !roles)) {
            router.reload({
                only: ['users', 'roles'],
                data: { ...filters, tab: value },
                preserveState: true,
                preserveScroll: true,
            });
        } else if (value === 'invitations' && !invitations) {
            router.get('/users', { ...filters, tab: value }, {
                only: ['invitations', 'filters'],
                preserveState: true,
                preserveScroll: true,
            });
        }
    };

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Fetch data using partial reload when deferred props are null (only on mount)
    useEffect(() => {
        const currentTab = getCurrentTab();
        
        // Ensure URL is correct on mount (redirect /users/invitations to /users?tab=invitations)
        if (typeof window !== 'undefined' && window.location.pathname === '/users/invitations') {
            const url = new URL(window.location.href);
            url.pathname = '/users';
            url.searchParams.set('tab', 'invitations');
            window.history.replaceState({}, '', url.pathname + url.search);
            setActiveTab('invitations');
        }
        
        if (currentTab === 'users' && (!users || !roles)) {
            router.reload({
                only: ['users', 'roles'],
                data: { ...filters, tab: currentTab },
                preserveState: true,
                preserveScroll: true,
                onError: (errors) => {
                    console.error('Failed to load users data:', errors);
                    toast.error('Failed to load users', {
                        description: 'Please refresh the page to try again.',
                    });
                },
            });
        } else if (currentTab === 'invitations' && !invitations) {
            router.get('/users', { ...filters, tab: currentTab }, {
                only: ['invitations', 'filters'],
                preserveState: true,
                preserveScroll: true,
            });
        }
    }, []); // Only run on mount

    const handleEditRole = (user: User) => {
        // Prevent opening dialog if roles haven't loaded yet
        if (!roles) {
            toast.error('Please wait for roles to load');
            return;
        }
        setSelectedUser(user);
        setSelectedRoleId(user.role_id?.toString() || '');
        setIsEditDialogOpen(true);
    };

    const handleUpdateRole = async () => {
        if (!selectedUser || !selectedRoleId) return;

        setIsUpdating(true);
        
        router.patch(route('users.updateRole', selectedUser.id), {
            role_id: parseInt(selectedRoleId)
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setIsEditDialogOpen(false);
                setSelectedUser(null);
                setSelectedRoleId('');
            },
            onError: (error) => {
                console.error('Error updating role:', error);
            },
            onFinish: () => {
                setIsUpdating(false);
            }
        });
    };

    const handleArchiveUser = () => {
        if (userToArchive) {
            router.delete(route('users.destroy', userToArchive.id), {
                preserveState: false,
                onSuccess: () => {
                    setShowArchiveModal(false);
                    setUserToArchive(null);
                }
            });
        }
    };

    const columns: ColumnDef<User>[] = [
        {
            accessorKey: 'name',
            header: 'Name',
            cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
        },
        {
            accessorKey: 'email',
            header: 'Email',
            cell: ({ row }) => <div>{row.getValue('email')}</div>,
        },
        {
            accessorKey: 'role_name',
            header: 'Role',
            cell: ({ row }) => {
                const roleName = row.getValue('role_name') as string;
                return (
                    <Badge variant={roleName === 'No Role' ? 'secondary' : 'default'}>
                        {roleName}
                    </Badge>
                );
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <div className="flex items-center gap-2">
                        {userPerms.includes('update-users') && (
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditRole(user)}
                                disabled={!roles}
                                title="Edit user role"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {userPerms.includes('delete-users') && user.can_be_archived && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setUserToArchive(user);
                                    setShowArchiveModal(true);
                                }}
                                title="Archive user"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: users?.data || [],
        columns: columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/users', { search, perPage }, { preserveState: true });
    };

    return (
        <>
            <Head title="Users" />
            <Card className="shadow-none border-none m-3 sm:m-6">
                <CardContent className="space-y-4 p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h1 className="text-xl sm:text-2xl font-bold">Users</h1>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                            {userPerms.includes('view-users') && activeTab === 'users' && (
                                <Button
                                    onClick={() => router.get('/users-archived')}
                                    variant="outline"
                                    className="h-10 sm:h-[44px] bg-white text-gray-600 border-gray-300 hover:bg-gray-50 text-sm"
                                >
                                    <Archive className="w-4 h-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Archived Users</span>
                                    <span className="sm:hidden">Archived</span>
                                </Button>
                            )}
                            {userPerms.includes('add-users') && (
                                <Button onClick={() => router.get('/users/invite')} className="h-10 sm:h-[44px] text-sm">
                                    {activeTab === 'invitations' ? 'Invite User' : 'Invite User'}
                                </Button>
                            )}
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="users" className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Users
                            </TabsTrigger>
                            <TabsTrigger value="invitations" className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Invitations
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="users" className="space-y-4">
                            <FilterBar
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={(value) => {
                            setPerPage(value);
                            router.get('/users', { search, perPage: value }, { preserveState: true });
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
                                {!users ? (
                                    <tr>
                                        <td colSpan={columns.length} className="border-b px-4 py-8 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center">
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                Loading users...
                                            </div>
                                        </td>
                                    </tr>
                                ) : table.getRowModel().rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length} className="border-b px-4 py-8 text-center text-muted-foreground">
                                            No users found
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

                            {users && (
                                <Pagination currentPage={users.current_page} lastPage={users.last_page} total={users.total} url="/users" />
                            )}
                        </TabsContent>

                        <TabsContent value="invitations" className="space-y-4">
                            {activeTab === 'invitations' && <InvitationsTab invitations={invitations} filters={filters} />}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Role Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit User Role</DialogTitle>
                        <DialogDescription>
                            Change the role for {selectedUser?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="role" className="text-right">
                                Role
                            </label>
                            <div className="col-span-3">
                                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles?.map((role: Role) => (
                                            <SelectItem key={role.id} value={role.id.toString()}>
                                                {role.name}
                                            </SelectItem>
                                        )) || (
                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                                Loading roles...
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsEditDialogOpen(false)}
                            disabled={isUpdating}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            onClick={handleUpdateRole}
                            disabled={isUpdating || !selectedRoleId}
                        >
                            {isUpdating ? 'Updating...' : 'Update Role'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Archive Confirmation Modal */}
            <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-orange-600" />
                            Archive User
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to archive "{userToArchive?.name}"? This will remove them from the active users list, but you can restore them later if needed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowArchiveModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleArchiveUser} className="bg-orange-600 hover:bg-orange-700">
                            Archive User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default withAppLayout(Index, {
    breadcrumbs: breadcrumbs
});
