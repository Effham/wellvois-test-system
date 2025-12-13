<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Activitylog\Models\Activity;

class ActivityLogController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-activity-logs')->only(['index']);
    }

    public function index(Request $request)
    {
        $search = $request->get('search', '');
        $user = auth()->user();

        // Check if user is admin - admins can see all logs
        $isAdmin = $user->hasRole('Admin');

        $activityLogs = Activity::with('causer')
            ->when(! $isAdmin, function ($query) use ($user) {
                // Non-admin users can only see their own activity logs
                return $query->where('causer_id', $user->id)
                    ->where('causer_type', get_class($user));
            })
            ->when($search, function ($query) use ($search) {
                return $query->where('description', 'like', "%{$search}%")
                    ->orWhere('properties->attributes', 'like', "%{$search}%")
                    ->orWhere('properties->old', 'like', "%{$search}%");
            })
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('perPage', 10))
            ->withQueryString();

        return Inertia::render('ActivityLog/Index', [
            'activityLogs' => [
                'data' => $activityLogs->items(),
                'current_page' => $activityLogs->currentPage(),
                'last_page' => $activityLogs->lastPage(),
                'per_page' => $activityLogs->perPage(),
                'total' => $activityLogs->total(),
            ],
            'filters' => [
                'perPage' => (int) $request->get('perPage', 10),
                'search' => $request->get('search', ''),
            ],
            'isAdmin' => $isAdmin,
        ]);
    }
}
