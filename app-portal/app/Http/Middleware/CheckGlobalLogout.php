<?php

namespace App\Http\Middleware;

use App\Services\GlobalLogoutService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckGlobalLogout
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Only check for authenticated users
        if (Auth::check()) {
            $user = Auth::user();
            $globalLogoutService = app(GlobalLogoutService::class);

            // Check if user has been globally logged out from another domain
            if ($globalLogoutService->isGloballyLoggedOut($user->email)) {
                // Clear the global logout flag
                $globalLogoutService->clearGlobalLogoutFlag($user->email);

                // Logout the user from current domain
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                // Redirect to appropriate login page
                $redirectUrl = $globalLogoutService->getLogoutRedirectUrl();

                return redirect()->away($redirectUrl);
            }
        }

        return $next($request);
    }
}
