import { withAppLayout } from '@/utils/layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    AlertCircle, 
    Building2, 
    Users, 
    UserPlus, 
    TrendingUp, 
    Activity,
    Calendar,
    Globe,
    BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface DashboardStats {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalPatients: number;
    totalPractitioners: number;
    growthRate: number;
}

interface LatestTenant {
    id: string;
    name: string;
    created_at: string;
    domains: number;
    users: number;
}

interface TenantByMonth {
    month: string;
    count: number;
}

interface RecentActivity {
    id: string;
    tenant_id: string;
    tenant_name: string;
    action: string;
    timestamp: string;
    time_ago: string;
    domains: string;
}

interface TenantDistribution {
    range: string;
    count: number;
}

interface TopTenant {
    tenant_id: string;
    tenant_name: string;
    users_count: number;
    domains: string;
}

interface CentralDashboardData {
    stats: DashboardStats;
    latestTenants: LatestTenant[];
    tenantsByMonth: TenantByMonth[];
    recentActivity: RecentActivity[];
    tenantDistribution: TenantDistribution[];
    topTenantsByUsers: TopTenant[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Central Dashboard',
        href: '/central/dashboard',
    },
];

function CentralDashboard() {
    const [dashboardData, setDashboardData] = useState<CentralDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/central/dashboard/data', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                setDashboardData(data);
            } catch (err) {
                console.error('Failed to fetch central dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const stats = dashboardData?.stats || {
        totalTenants: 0,
        activeTenants: 0,
        totalUsers: 0,
        totalPatients: 0,
        totalPractitioners: 0,
        growthRate: 0,
    };

    const latestTenants = dashboardData?.latestTenants || [];
    const tenantsByMonth = dashboardData?.tenantsByMonth || [];
    const recentActivity = dashboardData?.recentActivity || [];
    const tenantDistribution = dashboardData?.tenantDistribution || [];
    const topTenantsByUsers = dashboardData?.topTenantsByUsers || [];

    // Calculate max count for progress bars
    const maxDistributionCount = Math.max(...tenantDistribution.map(d => d.count), 1);

    return (
        <>
            <Head title="Central Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Central Admin Dashboard</h1>
                        <p className="text-muted-foreground">Overview of all tenants and system statistics</p>
                    </div>
                </div>

                {/* Dashboard Data Loading Error */}
                {error && (
                    <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <AlertDescription className="text-red-800 dark:text-red-200">
                            <strong>Dashboard Error:</strong> {error}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                )}

                {/* Main Stats Grid - 6 Key Metrics */}
                {!isLoading && (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* Total Tenants */}
                            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                        Total Tenants
                                    </CardTitle>
                                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalTenants}</div>
                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                        All registered organizations
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Active Tenants (Last 30 Days) */}
                            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 dark:from-green-950 dark:to-emerald-950 dark:border-green-800">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">
                                        New Tenants (30d)
                                    </CardTitle>
                                    <UserPlus className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.activeTenants}</div>
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                        Recently joined
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Total Users */}
                            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100 dark:from-purple-950 dark:to-violet-950 dark:border-purple-800">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-200">
                                        Total Users
                                    </CardTitle>
                                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.totalUsers}</div>
                                    <p className="text-xs text-purple-600 dark:text-purple-400">
                                        Across all tenants
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Growth Rate */}
                            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 dark:from-amber-950 dark:to-orange-950 dark:border-amber-800">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                        Growth Rate
                                    </CardTitle>
                                    <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                                        {stats.growthRate > 0 ? '+' : ''}{stats.growthRate}%
                                    </div>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        This month vs last month
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Total Patients */}
                            <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100 dark:from-rose-950 dark:to-pink-950 dark:border-rose-800">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-rose-800 dark:text-rose-200">
                                        Total Patients
                                    </CardTitle>
                                    <Activity className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-rose-900 dark:text-rose-100">{stats.totalPatients}</div>
                                    <p className="text-xs text-rose-600 dark:text-rose-400">
                                        Registered in system
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Total Practitioners */}
                            <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 border-cyan-100 dark:from-cyan-950 dark:to-sky-950 dark:border-cyan-800">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-cyan-800 dark:text-cyan-200">
                                        Total Practitioners
                                    </CardTitle>
                                    <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{stats.totalPractitioners}</div>
                                    <p className="text-xs text-cyan-600 dark:text-cyan-400">
                                        Active healthcare providers
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Secondary Widgets Grid */}
                        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                            {/* Latest Tenants */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Latest Tenants
                                    </CardTitle>
                                    <CardDescription>
                                        Most recently registered organizations (last 7 days)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {latestTenants.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No new tenants in the last 7 days
                                            </p>
                                        ) : (
                                            latestTenants.map((tenant) => (
                                                <div key={tenant.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium leading-none">{tenant.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {tenant.domains} domain(s) • {tenant.users} user(s)
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <p className="text-sm font-medium">{tenant.created_at}</p>
                                                        <Badge variant="secondary" className="text-xs">
                                                            New
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Tenant Distribution by Age */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5" />
                                        Tenant Distribution
                                    </CardTitle>
                                    <CardDescription>
                                        Tenants grouped by registration date
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {tenantDistribution.map((dist, index) => (
                                            <div key={index} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">{dist.range}</span>
                                                    <span className="text-sm font-medium">{dist.count}</span>
                                                </div>
                                                <Progress 
                                                    value={(dist.count / maxDistributionCount) * 100} 
                                                    className="h-2" 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Full Width Widgets */}
                        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                            {/* Recent Activity */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Activity className="h-5 w-5" />
                                        Recent Activity
                                    </CardTitle>
                                    <CardDescription>
                                        Latest system events and tenant registrations
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {recentActivity.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No recent activity
                                            </p>
                                        ) : (
                                            recentActivity.map((activity) => (
                                                <div key={activity.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                                                    <div className="space-y-1 flex-1">
                                                        <p className="text-sm font-medium leading-none">{activity.action}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {activity.tenant_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {activity.domains}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <p className="text-xs text-muted-foreground">{activity.time_ago}</p>
                                                        <Badge variant="outline" className="text-xs">
                                                            {activity.timestamp}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Top Tenants by Users */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Globe className="h-5 w-5" />
                                        Top Tenants by Users
                                    </CardTitle>
                                    <CardDescription>
                                        Tenants with the most registered users
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {topTenantsByUsers.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No tenant data available
                                            </p>
                                        ) : (
                                            topTenantsByUsers.map((tenant, index) => (
                                                <div key={tenant.tenant_id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                                    <div className="space-y-1 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="text-xs">
                                                                #{index + 1}
                                                            </Badge>
                                                            <p className="text-sm font-medium leading-none">{tenant.tenant_name}</p>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {tenant.domains}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <p className="text-2xl font-bold">{tenant.users_count}</p>
                                                        <p className="text-xs text-muted-foreground">users</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Tenant Growth Chart Data */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />
                                    Tenant Growth (Last 6 Months)
                                </CardTitle>
                                <CardDescription>
                                    Monthly tenant registration trends
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {tenantsByMonth.map((month, index) => (
                                        <div key={index} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{month.month}</span>
                                                <span className="text-sm font-bold">{month.count} tenant(s)</span>
                                            </div>
                                            <Progress 
                                                value={month.count > 0 ? (month.count / Math.max(...tenantsByMonth.map(m => m.count), 1)) * 100 : 0} 
                                                className="h-2" 
                                            />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </>
    );
}

export default withAppLayout(CentralDashboard, {
    breadcrumbs,
});

