<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class TwoFactorAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if ($user && $user->google2fa_enabled && ! $request->session()->has('2fa_passed')) {
            // Allow access to the 2FA challenge page and verification route
            if ($request->routeIs('two-factor-authentication.challenge') || $request->routeIs('two-factor-authentication.verify')) {
                return $next($request);
            }

            return redirect()->route('two-factor-authentication.challenge');
        }

        return $next($request);
    }
}
