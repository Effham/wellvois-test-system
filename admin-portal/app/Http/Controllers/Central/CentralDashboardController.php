<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CentralDashboardController extends Controller
{
    /**
     * Display the central admin dashboard
     */
    public function index()
    {
        return Inertia::render('CentralDashboard');
    }

    /**
     * Get dashboard data for central admin
     */
    public function getDashboardData()
    {
        // Ensure user is authenticated
        if (!auth()->check()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        try {
            // Total Tenants
            $totalTenants = Tenant::count();

            // Active Tenants (created in last 30 days)
            $activeTenants = Tenant::where('created_at', '>=', now()->subDays(30))->count();

            // Latest Tenants (last 7 days)
            $latestTenants = Tenant::where('created_at', '>=', now()->subDays(7))
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($tenant) {
                    return [
                        'id' => $tenant->id,
                        'name' => $tenant->company_name ?? $tenant->id, // Use company name, fallback to ID
                        'created_at' => $tenant->created_at->diffForHumans(),
                        'domains' => $tenant->domains()->count(),
                        'users' => $tenant->users()->count(),
                    ];
                });

            // Tenants by Month (last 6 months)
            $tenantsByMonth = collect(range(5, 0))->map(function ($monthsAgo) {
                $date = now()->subMonths($monthsAgo);
                $count = Tenant::whereBetween('created_at', [
                    $date->copy()->startOfMonth(),
                    $date->copy()->endOfMonth(),
                ])->count();

                return [
                    'month' => $date->format('M Y'),
                    'count' => $count,
                ];
            });

            // Total Users across all tenants
            $totalUsers = DB::table('tenant_user')
                ->distinct('user_id')
                ->count();

            // Total Patients
            $totalPatients = Patient::count();

            // Total Practitioners
            $totalPractitioners = Practitioner::count();

            // Recent Activity - Latest tenant registrations with details
            $recentActivity = Tenant::orderBy('created_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($tenant) {
                    return [
                        'id' => $tenant->id,
                        'tenant_id' => $tenant->id,
                        'tenant_name' => $tenant->company_name ?? $tenant->id,
                        'action' => 'Tenant Created',
                        'timestamp' => $tenant->created_at->format('M d, Y H:i'),
                        'time_ago' => $tenant->created_at->diffForHumans(),
                        'domains' => $tenant->domains()->pluck('domain')->implode(', ') ?: 'No domain',
                    ];
                });

            // Tenant Growth Rate (compare this month vs last month)
            $thisMonthCount = Tenant::whereBetween('created_at', [
                now()->startOfMonth(),
                now()->endOfMonth(),
            ])->count();

            $lastMonthCount = Tenant::whereBetween('created_at', [
                now()->subMonth()->startOfMonth(),
                now()->subMonth()->endOfMonth(),
            ])->count();

            $growthRate = $lastMonthCount > 0
                ? round((($thisMonthCount - $lastMonthCount) / $lastMonthCount) * 100, 1)
                : ($thisMonthCount > 0 ? 100 : 0);

            // Tenant Distribution by Age
            $tenantDistribution = [
                [
                    'range' => 'Last 7 Days',
                    'count' => Tenant::where('created_at', '>=', now()->subDays(7))->count(),
                ],
                [
                    'range' => '8-30 Days',
                    'count' => Tenant::whereBetween('created_at', [
                        now()->subDays(30),
                        now()->subDays(7),
                    ])->count(),
                ],
                [
                    'range' => '1-3 Months',
                    'count' => Tenant::whereBetween('created_at', [
                        now()->subMonths(3),
                        now()->subDays(30),
                    ])->count(),
                ],
                [
                    'range' => '3+ Months',
                    'count' => Tenant::where('created_at', '<', now()->subMonths(3))->count(),
                ],
            ];

            // Top Tenants by Users
            $topTenantsByUsers = Tenant::withCount('users')
                ->orderBy('users_count', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($tenant) {
                    return [
                        'tenant_id' => $tenant->id,
                        'tenant_name' => $tenant->company_name ?? $tenant->id,
                        'users_count' => $tenant->users_count,
                        'domains' => $tenant->domains()->pluck('domain')->first() ?: 'No domain',
                    ];
                });

            return response()->json([
                'stats' => [
                    'totalTenants' => $totalTenants,
                    'activeTenants' => $activeTenants,
                    'totalUsers' => $totalUsers,
                    'totalPatients' => $totalPatients,
                    'totalPractitioners' => $totalPractitioners,
                    'growthRate' => $growthRate,
                ],
                'latestTenants' => $latestTenants,
                'tenantsByMonth' => $tenantsByMonth,
                'recentActivity' => $recentActivity,
                'tenantDistribution' => $tenantDistribution,
                'topTenantsByUsers' => $topTenantsByUsers,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch central dashboard data', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Failed to load dashboard data',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
