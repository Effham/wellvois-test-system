<?php

namespace App\Listeners;

class AttendanceActivityListener
{
    /**
     * Log clock in events
     */
    public static function logClockIn($user, $clockInTime, $tenantId): void
    {
        activity()
            ->causedBy($user)
            ->event('clock_in')
            ->withProperties([
                'clock_in_time' => $clockInTime,
                'tenant_id' => $tenantId,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'attendance_date' => now()->format('Y-m-d'),
            ])
            ->log("User {$user->name} clocked in at {$clockInTime}");
    }

    /**
     * Log clock out events
     */
    public static function logClockOut($user, $clockOutTime, $totalDuration, $tenantId): void
    {
        activity()
            ->causedBy($user)
            ->event('clock_out')
            ->withProperties([
                'clock_out_time' => $clockOutTime,
                'total_duration_minutes' => $totalDuration,
                'tenant_id' => $tenantId,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'attendance_date' => now()->format('Y-m-d'),
            ])
            ->log("User {$user->name} clocked out at {$clockOutTime} (Total: {$totalDuration} minutes)");
    }

    /**
     * Log session start events for encounters
     */
    public static function logSessionStart($encounter, $user): void
    {
        activity()
            ->causedBy($user)
            ->performedOn($encounter)
            ->event('session_started')
            ->withProperties([
                'encounter_id' => $encounter->id,
                'appointment_id' => $encounter->appointment_id,
                'session_started_at' => $encounter->session_started_at,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Session started for encounter ID {$encounter->id}");
    }

    /**
     * Log session end events for encounters
     */
    public static function logSessionEnd($encounter, $user): void
    {
        activity()
            ->causedBy($user)
            ->performedOn($encounter)
            ->event('session_ended')
            ->withProperties([
                'encounter_id' => $encounter->id,
                'appointment_id' => $encounter->appointment_id,
                'session_started_at' => $encounter->session_started_at,
                'session_completed_at' => $encounter->session_completed_at,
                'session_duration_seconds' => $encounter->session_duration_seconds,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Session ended for encounter ID {$encounter->id} (Duration: {$encounter->session_duration_seconds} seconds)");
    }
}
