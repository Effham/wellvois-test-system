<?php

namespace App\Listeners;

use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Exceptions\UnauthorizedException;

class FailedAuthorizationListener
{
    /**
     * Log failed authorization attempt
     */
    public static function logFailedAuthorization(
        $user,
        string $requiredPermission,
        ?string $route = null,
        ?string $action = null,
        ?string $resource = null,
        array $context = []
    ): void {
        activity()
            ->causedBy($user)
            ->event('authorization_failed')
            ->withProperties([
                'user_id' => $user->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'user_roles' => $user->roles->pluck('name')->toArray(),
                'required_permission' => $requiredPermission,
                'route' => $route ?? request()->route()?->getName(),
                'action' => $action ?? request()->route()?->getActionName(),
                'resource' => $resource,
                'url' => request()->fullUrl(),
                'method' => request()->method(),
                'referrer' => request()->header('referer'),
                'context' => $context,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Failed authorization: User {$user->name} attempted to access resource requiring '{$requiredPermission}' permission");
    }

    /**
     * Log failed role check
     */
    public static function logFailedRoleCheck(
        $user,
        string $requiredRole,
        ?string $route = null,
        ?string $action = null,
        array $context = []
    ): void {
        activity()
            ->causedBy($user)
            ->event('role_check_failed')
            ->withProperties([
                'user_id' => $user->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'user_roles' => $user->roles->pluck('name')->toArray(),
                'required_role' => $requiredRole,
                'route' => $route ?? request()->route()?->getName(),
                'action' => $action ?? request()->route()?->getActionName(),
                'url' => request()->fullUrl(),
                'method' => request()->method(),
                'referrer' => request()->header('referer'),
                'context' => $context,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Failed role check: User {$user->name} attempted to access resource requiring '{$requiredRole}' role");
    }

    /**
     * Log unauthorized exception
     */
    public static function logUnauthorizedException(
        UnauthorizedException $exception,
        ?string $requiredPermissions = null
    ): void {
        $user = Auth::user();

        if (! $user) {
            // If no authenticated user, log as unauthenticated attempt
            activity()
                ->event('authorization_failed_unauthenticated')
                ->withProperties([
                    'required_permissions' => $requiredPermissions ?? $exception->getRequiredPermissions(),
                    'required_roles' => $exception->getRequiredRoles(),
                    'route' => request()->route()?->getName(),
                    'action' => request()->route()?->getActionName(),
                    'url' => request()->fullUrl(),
                    'method' => request()->method(),
                    'referrer' => request()->header('referer'),
                    'exception_message' => $exception->getMessage(),
                    'tenant_id' => tenant('id'),
                    'ip' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ])
                ->log('Unauthenticated user attempted to access protected resource');

            return;
        }

        activity()
            ->causedBy($user)
            ->event('authorization_exception')
            ->withProperties([
                'user_id' => $user->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'user_roles' => $user->roles->pluck('name')->toArray(),
                'user_permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
                'required_permissions' => $requiredPermissions ?? $exception->getRequiredPermissions(),
                'required_roles' => $exception->getRequiredRoles(),
                'route' => request()->route()?->getName(),
                'action' => request()->route()?->getActionName(),
                'url' => request()->fullUrl(),
                'method' => request()->method(),
                'referrer' => request()->header('referer'),
                'exception_message' => $exception->getMessage(),
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Authorization exception: User {$user->name} was denied access - {$exception->getMessage()}");
    }

    /**
     * Log gate denial
     */
    public static function logGateDenial(
        $user,
        string $ability,
        $arguments = null,
        ?string $message = null
    ): void {
        activity()
            ->causedBy($user)
            ->event('gate_denied')
            ->withProperties([
                'user_id' => $user->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'user_roles' => $user->roles->pluck('name')->toArray(),
                'ability' => $ability,
                'arguments' => $arguments,
                'message' => $message,
                'route' => request()->route()?->getName(),
                'url' => request()->fullUrl(),
                'method' => request()->method(),
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Gate denied: User {$user->name} was denied '{$ability}' ability");
    }
}
