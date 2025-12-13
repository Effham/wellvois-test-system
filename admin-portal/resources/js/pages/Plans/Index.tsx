import { useState } from 'react';
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { CheckCircle2, Pencil, Trash2, XCircle } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Billing Settings', href: '/billing/settings' },
    { title: 'Subscription Plans', href: '/billing/settings/plans' },
];

export default function Index() {
    const { plans, filters }: { plans: any; filters: any } = usePage().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

    const table = useReactTable({
        data: plans.data,
        columns: [
            {
                accessorKey: 'name',
                header: 'Plan Name',
                cell: ({ row }) => (
                    <div className="flex items-center space-x-2">
                        <div className="font-medium">{row.original.name}</div>
                        {row.original.is_active ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'price',
                header: 'Price',
                cell: ({ row }) => (
                    <div className="font-medium">
                        {row.original.formatted_price}
                        <span className="ml-1 text-xs text-gray-500">
                            / {row.original.billing_cycle.toLowerCase()}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'billing_interval',
                header: 'Billing Cycle',
                cell: ({ row }) => (
                    <div className="text-sm">
                        {row.original.billing_interval_count > 1
                            ? `Every ${row.original.billing_interval_count} ${row.original.billing_interval}s`
                            : `${row.original.billing_interval}ly`.charAt(0).toUpperCase() + `${row.original.billing_interval}ly`.slice(1)}
                    </div>
                ),
            },
            {
                accessorKey: 'stripe_price_id',
                header: 'Stripe Price ID',
                cell: ({ row }) => (
                    <div className="max-w-xs truncate text-xs font-mono text-gray-600">
                        {row.original.stripe_price_id || (
                            <span className="text-red-500">Not set</span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'tenants_count',
                header: 'Active Subscriptions',
                cell: ({ row }) => (
                    <div className="text-center">
                        <span className={`font-medium ${row.original.tenants_count > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {row.original.tenants_count || 0}
                        </span>
                    </div>
                ),
            },
            {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }) => (
                    <div className="space-x-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => router.get(route('plans.edit', row.original.id))}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => {
                                setSelectedPlan(row.original);
                                setDeleteDialogOpen(true);
                            }}
                            disabled={row.original.tenants_count > 0}
                            title={row.original.tenants_count > 0 ? 'Cannot delete plan with active subscriptions' : 'Delete plan'}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ),
            },
        ],
        getCoreRowModel: getCoreRowModel(),
    });

    const handleDelete = () => {
        if (selectedPlan) {
            router.delete(route('plans.destroy', selectedPlan.id), {
                onSuccess: () => {
                    setDeleteDialogOpen(false);
                    setSelectedPlan(null);
                },
            });
        }
    };

    const handleSearch = () => {
        router.get(route('billing.settings.plans'), { search, perPage }, { preserveState: true });
    };

    return (
        <>
            <Head title="Subscription Plans" />

            <Card className="shadow-none border-none">
                <CardContent className="space-y-4 p-3 sm:p-6">
                    <PageHeader
                        title="Subscription Plans"
                        breadcrumbs={breadcrumbs}
                        createRoute={route('plans.create')}
                        createLabel="Create Plan"
                    />

                    <FilterBar
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={(value) => {
                            setPerPage(value);
                            router.get(route('billing.settings.plans'), { search, perPage: value }, { preserveState: true });
                        }}
                    />

                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <th key={header.id} className="border-b px-4 py-2 text-left">
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row) => (
                                    <tr key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="border-b px-4 py-2">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {plans.data.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">No plans found.</p>
                        </div>
                    )}

                    <Pagination currentPage={plans.current_page} lastPage={plans.last_page} total={plans.total} url="/billing/settings/plans" />

                    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete Plan</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                <p>
                                    Are you sure you want to delete the plan <strong>{selectedPlan?.name}</strong>?
                                </p>
                                <p className="mt-2 text-sm text-red-600">
                                    This will also delete the plan from Stripe. This action cannot be undone.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleDelete}>
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    </CardContent>
                </Card>
        </>
    );
}

