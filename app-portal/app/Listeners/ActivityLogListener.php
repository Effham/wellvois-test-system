<?php

namespace App\Listeners;

use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;

class ActivityLogListener
{
    /**
     * Handle user login events.
     */
    public function handleLogin(Login $event): void
    {
        $user = $event->user;
        $guard = $event->guard;

        activity()
            ->causedBy($user)
            ->performedOn($user) // Set the user as the subject
            ->event('login')
            ->withProperties([
                'guard' => $guard,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'tenant_id' => tenant('id'),
                'login_method' => 'standard',
            ])
            ->log("User {$user->name} logged in");
    }

    /**
     * Handle user logout events.
     */
    public function handleLogout(Logout $event): void
    {
        $user = $event->user;
        $guard = $event->guard;

        activity()
            ->causedBy($user)
            ->performedOn($user) // Set the user as the subject
            ->event('logout')
            ->withProperties([
                'guard' => $guard,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'tenant_id' => tenant('id'),
                'logout_method' => 'standard',
            ])
            ->log("User {$user->name} logged out");
    }

    /**
     * Handle failed login attempts.
     */
    public function handleFailedLogin(Failed $event): void
    {
        $email = $event->credentials['email'] ?? 'unknown';
        $guard = $event->guard;

        activity()
            ->event('login_failed')
            ->withProperties([
                'email' => $email,
                'guard' => $guard,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'tenant_id' => tenant('id'),
                'failure_reason' => 'invalid_credentials',
            ])
            ->log("Failed login attempt for email: {$email}");
    }

    /**
     * Handle account lockout events.
     */
    public function handleLockout(Lockout $event): void
    {
        $email = $event->request->input('email', 'unknown');

        activity()
            ->event('account_locked')
            ->withProperties([
                'email' => $email,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'tenant_id' => tenant('id'),
                'lockout_reason' => 'too_many_attempts',
            ])
            ->log("Account locked for email: {$email}");
    }

    /**
     * Handle password reset events.
     */
    public function handlePasswordReset(PasswordReset $event): void
    {
        $user = $event->user;

        activity()
            ->causedBy($user)
            ->performedOn($user) // Set the user as the subject
            ->event('password_reset')
            ->withProperties([
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'tenant_id' => tenant('id'),
                'reset_method' => 'email_link',
            ])
            ->log("Password reset for user {$user->name}");
    }

    /**
     * Log custom authentication events for public portal
     */
    public static function logPublicPortalLogin($patient, $tenantId): void
    {
        activity()
            ->causedBy(null)
            ->event('public_portal_login')
            ->withProperties([
                'patient_id' => $patient->id,
                'patient_email' => $patient->email,
                'patient_name' => $patient->first_name.' '.$patient->last_name,
                'tenant_id' => $tenantId,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'login_source' => 'public_portal',
            ])
            ->log("Patient {$patient->first_name} {$patient->last_name} logged in via public portal");
    }

    /**
     * Log tenant switching events
     */
    public static function logTenantSwitch($user, $fromTenant, $toTenant): void
    {
        activity()
            ->causedBy($user)
            ->event('tenant_switch')
            ->withProperties([
                'from_tenant_id' => $fromTenant,
                'to_tenant_id' => $toTenant,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'switch_method' => 'dashboard_selection',
            ])
            ->log("User {$user->name} switched from tenant {$fromTenant} to tenant {$toTenant}");
    }

    /**
     * Log admin login to tenant
     */
    public static function logAdminTenantLogin($user, $tenantId): void
    {
        activity()
            ->causedBy($user)
            ->event('admin_tenant_login')
            ->withProperties([
                'tenant_id' => $tenantId,
                'admin_user_id' => $user->id,
                'admin_email' => $user->email,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'login_source' => 'admin_panel',
            ])
            ->log("Admin {$user->name} logged into tenant {$tenantId}");
    }
}
