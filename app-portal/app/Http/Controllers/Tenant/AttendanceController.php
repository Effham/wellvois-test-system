<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Mail\PractitionerClockEventMail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class AttendanceController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-attendance')->only(['index', 'show']);
        $this->middleware('permission:add-attendance')->only(['create', 'store']);
        $this->middleware('permission:update-attendance')->only(['edit', 'update']);
        $this->middleware('permission:delete-attendance')->only('destroy');
    }

    /**
     * Get the tenant's configured timezone
     * For attendance, use organization setting directly (not location-based)
     */
    private function getTenantTimezone(): string
    {
        // For attendance, prioritize organization-level timezone setting over location
        $orgTimezone = \App\Models\OrganizationSetting::getValue('time_locale_timezone', null);

        // Fallback to first active location timezone if no org setting
        if (! $orgTimezone) {
            $location = \App\Models\Location::where('is_active', true)->first();

            return $location ? $location->timezone : 'America/Toronto';
        }

        return $orgTimezone;
    }

    /**
     * Get timezone abbreviation for display
     */
    private function getTimezoneAbbreviation(): string
    {
        $timezone = $this->getTenantTimezone();

        $timezoneMap = [
            'America/Toronto' => 'EST/EDT',
            'America/New_York' => 'EST/EDT',
            'America/Chicago' => 'CST/CDT',
            'America/Denver' => 'MST/MDT',
            'America/Vancouver' => 'PST/PDT',
            'America/Los_Angeles' => 'PST/PDT',
            'America/Halifax' => 'AST/ADT',
            'America/St_Johns' => 'NST/NDT',
            'UTC' => 'UTC',
            'Europe/London' => 'GMT/BST',
            'Europe/Paris' => 'CET/CEST',
            'Asia/Tokyo' => 'JST',
            'Australia/Sydney' => 'AEST/AEDT',
            'Pacific/Auckland' => 'NZST/NZDT',
        ];

        return $timezoneMap[$timezone] ?? $timezone;
    }

    /**
     * Get current attendance status for the authenticated user
     */
    public function getStatus(): \Illuminate\Http\JsonResponse
    {
        $user = Auth::user();
        $tenantTimezone = $this->getTenantTimezone();
        $today = Carbon::today($tenantTimezone);

        $attendance = DB::table('user_attendance')
            ->where('user_id', $user->id)
            ->where('date', $today->format('Y-m-d'))
            ->first();

        if (! $attendance) {
            return response()->json([
                'status' => 'not_clocked_in',
                'clock_in_time' => null,
                'clock_out_time' => null,
                'total_duration_minutes' => null,
                'current_duration_minutes' => null,
            ]);
        }

        // Calculate current duration if clocked in
        $currentDurationMinutes = null;
        if ($attendance->status === 'clocked_in' && $attendance->clock_in_time) {
            // Combine today's date with the stored clock-in time in tenant timezone
            $clockInDateTime = Carbon::createFromFormat('Y-m-d H:i:s', $today->format('Y-m-d').' '.$attendance->clock_in_time, $tenantTimezone);
            $now = Carbon::now($tenantTimezone);
            $currentDurationMinutes = $clockInDateTime->diffInMinutes($now);
        }

        return response()->json([
            'status' => $attendance->status,
            'clock_in_time' => $attendance->clock_in_time,
            'clock_out_time' => $attendance->clock_out_time,
            'total_duration_minutes' => $attendance->total_duration_minutes,
            'current_duration_minutes' => $currentDurationMinutes,
        ]);
    }

    /**
     * Clock in the authenticated user
     */
    public function clockIn(): \Illuminate\Http\JsonResponse
    {
        $user = Auth::user();
        $tenantTimezone = $this->getTenantTimezone();

        // Use tenant timezone for today and current time
        $today = Carbon::today($tenantTimezone);
        $now = Carbon::now($tenantTimezone);

        // Check if user is already clocked in today
        $existingAttendance = DB::table('user_attendance')
            ->where('user_id', $user->id)
            ->where('date', $today->format('Y-m-d'))
            ->first();

        if ($existingAttendance && $existingAttendance->status === 'clocked_in') {
            return response()->json([
                'success' => false,
                'message' => 'You are already clocked in for today.',
            ], 400);
        }

        if ($existingAttendance) {
            // Update existing record
            DB::table('user_attendance')
                ->where('id', $existingAttendance->id)
                ->update([
                    'clock_in_time' => $now->format('H:i:s'),
                    'clock_out_time' => null,
                    'total_duration_minutes' => null,
                    'status' => 'clocked_in',
                    'updated_at' => $now->utc(), // Store timestamps in UTC
                ]);
        } else {
            // Create new record
            DB::table('user_attendance')->insert([
                'user_id' => $user->id,
                'date' => $today->format('Y-m-d'),
                'clock_in_time' => $now->format('H:i:s'),
                'clock_out_time' => null,
                'total_duration_minutes' => null,
                'status' => 'clocked_in',
                'created_at' => $now->utc(), // Store timestamps in UTC
                'updated_at' => $now->utc(), // Store timestamps in UTC
            ]);
        }

        // Log the clock in event
        \App\Listeners\AttendanceActivityListener::logClockIn($user, $now->format('H:i:s'), tenant('id'));

        $recipients = $this->attendanceRecipients($user);
        $org = $this->orgArray();
        $section = 'attendance'; // optional for your deep link
        $timesheetUrl = $this->timesheetDeepLink($today->format('Y-m-d'), $section);
        try {
            Mail::to($recipients)->send(new PractitionerClockEventMail(
                organization: $org,
                user: $user,
                eventType: 'clock_in',
                date: $today->format('Y-m-d'),
                clockInTime: $now->format('H:i:s'),
                clockOutTime: null,
                totalMinutes: null,
                tenantTimezone: $tenantTimezone,
                timesheetUrl: $timesheetUrl,
            ));
        } catch (\Throwable $e) {
            // \Log::error('Failed sending clock-in email', ['user_id' => $user->id, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Successfully clocked in.',
            'clock_in_time' => $now->format('H:i:s'), // Return the exact time saved
        ]);
    }

    /**
     * Clock out the authenticated user
     */
    public function clockOut(): \Illuminate\Http\JsonResponse
    {
        $user = Auth::user();
        $tenantTimezone = $this->getTenantTimezone();

        // Use tenant timezone for today and current time
        $today = Carbon::today($tenantTimezone);
        $now = Carbon::now($tenantTimezone);

        // Find today's attendance record
        $attendance = DB::table('user_attendance')
            ->where('user_id', $user->id)
            ->where('date', $today->format('Y-m-d'))
            ->where('status', 'clocked_in')
            ->first();

        if (! $attendance) {
            return response()->json([
                'success' => false,
                'message' => 'You are not currently clocked in.',
            ], 400);
        }

        // Calculate total duration - parse clock-in time in tenant timezone
        $clockInTime = Carbon::parse($today->format('Y-m-d').' '.$attendance->clock_in_time, $tenantTimezone);
        $totalDurationMinutes = $clockInTime->diffInMinutes($now);

        // Update the record
        DB::table('user_attendance')
            ->where('id', $attendance->id)
            ->update([
                'clock_out_time' => $now->format('H:i:s'),
                'total_duration_minutes' => $totalDurationMinutes,
                'status' => 'clocked_out',
                'updated_at' => $now->utc(), // Store timestamps in UTC
            ]);
        $recipients = $this->attendanceRecipients($user);
        $org = $this->orgArray();
        $section = 'attendance';
        $timesheetUrl = $this->timesheetDeepLink($today->format('Y-m-d'), $section);
        try {
            Mail::to($recipients)->send(new PractitionerClockEventMail(
                organization: $org,
                user: $user,
                eventType: 'clock_out',
                date: $today->format('Y-m-d'),
                clockInTime: $clockInTime->format('H:i:s'),
                clockOutTime: $now->format('H:i:s'),
                totalMinutes: $totalDurationMinutes,
                tenantTimezone: $tenantTimezone,
                timesheetUrl: $timesheetUrl,
            ));
        } catch (\Throwable $e) {
        }

        // Log the clock out event
        \App\Listeners\AttendanceActivityListener::logClockOut($user, $now->format('H:i:s'), $totalDurationMinutes, tenant('id'));

        return response()->json([
            'success' => true,
            'message' => 'Successfully clocked out.',
            'total_duration_minutes' => $totalDurationMinutes,
        ]);
    }

    protected function attendanceRecipients($practitioner): array
    {
        // Send to practitioner + Admins (fallback to ADMIN_EMAIL)
        $adminEmails = \App\Models\User::role('Admin')
            ->whereNotNull('email')
            ->pluck('email')
            ->filter()
            ->unique()
            ->all();

        if (empty($adminEmails) && env('ADMIN_EMAIL')) {
            $adminEmails = [env('ADMIN_EMAIL')];
        }

        $self = $practitioner->email ? [$practitioner->email] : [];

        return array_values(array_unique(array_filter(array_merge($self, $adminEmails))));
    }

    protected function orgArray(): array
    {
        return [
            'name' => \App\Models\OrganizationSetting::getValue('practice_details_name') ?? 'Organization',
        ];
    }

    protected function timesheetDeepLink(?string $dateYmd, ?string $section = null): ?string
    {
        if (! function_exists('route')) {
            return null;
        }
        try {
            return route('admin.timesheets.show', ['date' => $dateYmd, 'section' => $section]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Get attendance history for the authenticated user
     */
    public function history(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = Auth::user();
        $limit = $request->get('limit', 30);

        $attendanceHistory = DB::table('user_attendance')
            ->where('user_id', $user->id)
            ->orderBy('date', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $attendanceHistory,
        ]);
    }

    /**
     * Get all attendance logs for admin view (for attendance logs page)
     * If accessed by practitioner, show only their own logs
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $search = $request->get('search', '');
        $perPage = $request->get('perPage', 15);
        $sortBy = $request->get('sortBy', 'date');
        $sortOrder = $request->get('sortOrder', 'desc');

        $query = DB::table('user_attendance')
            ->select([
                'user_attendance.id',
                'user_attendance.user_id',
                'user_attendance.date',
                'user_attendance.clock_in_time',
                'user_attendance.clock_out_time',
                'user_attendance.total_duration_minutes',
                'user_attendance.status',
                'users.name as user_name',
                'users.email as user_email',
            ])
            ->leftJoin('users', 'user_attendance.user_id', '=', 'users.id');

        // If user is a practitioner, filter to show only their own attendance logs
        $isPractitioner = $user->hasRole('Practitioner');
        if ($isPractitioner) {
            $query->where('user_attendance.user_id', $user->id);
        }

        // Search functionality
        if (! empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'like', "%{$search}%")
                    ->orWhere('users.email', 'like', "%{$search}%")
                    ->orWhere('user_attendance.date', 'like', "%{$search}%");
            });
        }

        // Sorting
        $allowedSortFields = ['date', 'user_name', 'clock_in_time', 'clock_out_time', 'total_duration_minutes', 'status'];
        if (in_array($sortBy, $allowedSortFields)) {
            if ($sortBy === 'user_name') {
                $query->orderBy('users.name', $sortOrder);
            } else {
                $query->orderBy("user_attendance.{$sortBy}", $sortOrder);
            }
        }

        $attendanceLogs = $query->paginate($perPage);

        return Inertia::render('AttendanceLogs/Index', [
            'attendanceLogs' => $attendanceLogs,
            'filters' => [
                'search' => $search,
                'perPage' => $perPage,
                'sortBy' => $sortBy,
                'sortOrder' => $sortOrder,
            ],
            'isPractitioner' => $isPractitioner,
            'currentTimezone' => $this->getTenantTimezone(),
            'timezoneAbbreviation' => $this->getTimezoneAbbreviation(),
        ]);
    }
}
