
import { useState } from 'react';
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Tenants', href: '/tenants/v2' },
];

type Tenant = {
    id: string;
    company_name?: string;
    created_at: string;
    domains: {
        domain: string;
    }[];
};

type TenantsPageProps = {
    tenants: {
        data: Tenant[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search: string;
        perPage: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    };
};

export const columns = (appEnv: string, sortBy: string, sortOrder: 'asc' | 'desc', onSort: (column: string) => void): ColumnDef<Tenant>[] => [
    {
        accessorKey: 'company_name',
        header: () => (
            <div className="flex items-center gap-2">
                Company Information
            </div>
        ),
        cell: ({ row }) => (
            <Link 
                href={route('tenants.show', row.original.id)} 
                className="block hover:bg-gray-50 -m-2 p-2 rounded cursor-pointer"
            >
                <div className="font-medium text-primary">
                    {row.original.company_name || 'N/A'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    {row.original.id}
                </div>
            </Link>
        ),
    },
    {
        accessorKey: 'domains',
        header: 'Explore',
        cell: ({ row }) => {
            const isLocal = appEnv === 'local';
            return (
                <div className="text-muted-foreground">
                    {row.original.domains.map((d, idx) => {
                        const url = isLocal ? `http://${d.domain}:8000/explore` : `https://${d.domain}/explore`;
                        return (
                            <div key={idx}>
                                <Button variant="link" className='p-0 m-0'>
                                    <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
                                        {d.domain}/explore
                                    </a>
                                </Button>
                            </div>
                        );
                    })}
                </div>
            );
        },
    },
    {
        accessorKey: 'created_at',
        header: () => (
            <Button
                variant="ghost"
                onClick={() => onSort('created_at')}
                className="h-8 px-2 lg:px-3 hover:bg-transparent"
            >
                Created At
                {sortBy === 'created_at' ? (
                    sortOrder === 'asc' ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                    ) : (
                        <ArrowDown className="ml-2 h-4 w-4" />
                    )
                ) : (
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
            </Button>
        ),
        cell: ({ row }) => {
            const date = new Date(row.getValue('created_at'));
            return (
                <div className="text-sm">
                    {date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </div>
            );
        },
    },
];

export default function Index() {
    const { tenants, filters, appEnv }: any = usePage<TenantsPageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [sortBy, setSortBy] = useState(filters.sortBy || 'created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(filters.sortOrder || 'desc');

    const handleSort = (column: string) => {
        const newOrder = sortBy === column && sortOrder === 'desc' ? 'asc' : 'desc';
        setSortBy(column);
        setSortOrder(newOrder);
        router.get('/tenants/v2', { search, perPage, sortBy: column, sortOrder: newOrder }, { preserveState: true });
    };

    const table = useReactTable({
        data: tenants.data,
        columns: columns(appEnv, sortBy, sortOrder, handleSort),
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/tenants/v2', { search, perPage }, { preserveState: true });
    };


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tenants" />
            <Card className="shadow-none border-none m-3 sm:m-6">
                <CardContent className="space-y-4 p-3 sm:p-6">
                    <PageHeader title="Tenants" breadcrumbs={breadcrumbs} createRoute={route('tenants.create')} createLabel="New Tenant" />

                    <FilterBar
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={(value) => {
                            setPerPage(value);
                            router.get('/tenants/v2', { search, perPage: value }, { preserveState: true });
                        }}
                    />

                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
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

                    <Pagination currentPage={tenants.current_page} lastPage={tenants.last_page} total={tenants.total} url="/tenants/v2" />
                </CardContent>
            </Card>
        </AppLayout>
    );
}
