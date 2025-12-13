<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PreventPageCaching
{
    /**
     * Prevent browser caching of authenticated pages to ensure
     * logout properly prevents back-button access to sensitive data.
     *
     * HIPAA Compliance: Prevents PHI from being cached in browser
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only apply to authenticated users to prevent caching of sensitive data
        if (Auth::check()) {
            // Comprehensive cache prevention headers
            $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            $response->headers->set('Pragma', 'no-cache');
            $response->headers->set('Expires', 'Sat, 01 Jan 2000 00:00:00 GMT');

            // Additional security headers for HIPAA compliance
            $response->headers->set('X-Content-Type-Options', 'nosniff');
            $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        }

        return $response;
    }
}
