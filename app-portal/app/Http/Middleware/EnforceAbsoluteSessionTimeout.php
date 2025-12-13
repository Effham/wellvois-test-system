<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnforceAbsoluteSessionTimeout
{
    /**
     * Absolute session timeout in minutes
     * Default: 480 minutes (8 hours) - typical for healthcare applications
     * Can be overridden via SESSION_ABSOLUTE_TIMEOUT environment variable
     */
    private function getAbsoluteTimeout(): int
    {
        return (int) config('session.absolute_timeout', 480);
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::check()) {
            $loginTime = session('login_time');

            // If no login time stored, set it now (for existing sessions)
            if (! $loginTime) {
                session(['login_time' => now()->timestamp]);

                return $next($request);
            }

            $elapsed = now()->timestamp - $loginTime;
            $maxSeconds = $this->getAbsoluteTimeout() * 60;

            // If session has exceeded absolute timeout, force logout
            if ($elapsed > $maxSeconds) {
                // Perform logout
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                // Determine appropriate redirect URL
                $redirectUrl = $this->getLogoutRedirectUrl();

                if ($request->header('X-Inertia')) {
                    // For Inertia requests, redirect with message
                    return redirect()->away($redirectUrl)->with('error',
                        'Your session has expired for security reasons. Please log in again.'
                    );
                }

                return redirect()->away($redirectUrl)->with('error',
                    'Your session has expired for security reasons. Please log in again.'
                );
            }
        }

        return $next($request);
    }

    /**
     * Get the appropriate logout redirect URL
     */
    private function getLogoutRedirectUrl(): string
    {
        // Check if we're in a tenant context
        if (tenant('id')) {
            // Redirect to central login
            $protocol = app()->environment('production') ? 'https' : 'http';
            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            $port = app()->environment('production') ? '' : ':8000';

            return "{$protocol}://{$centralDomain}{$port}/login";
        }

        // Central domain - use named route
        return route('login');
    }
}
