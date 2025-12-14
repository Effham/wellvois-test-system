<?php

use App\Http\Middleware\CanAccessTenant;
use App\Http\Middleware\CentralGuestAccess;
use App\Http\Middleware\CheckGlobalLogout;
use App\Http\Middleware\CheckKeycloakSession;
use App\Http\Middleware\EnsureOnboardingComplete;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\PreventPageCaching;
use App\Http\Middleware\PublicTenantAccess;
use App\Http\Middleware\RedirectIfAuthenticated;
use App\Http\Middleware\RequireBillingSetup;
use App\Http\Middleware\RequireTenantContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\URL;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Stancl\Tenancy\Contracts\TenantCouldNotBeIdentifiedException;
use Stancl\Tenancy\Exceptions\TenantCouldNotBeIdentifiedOnDomainException;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->booting(function () {
        if (app()->environment('production')) {
            URL::forceScheme('https');
        }
    })
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->validateCsrfTokens(except: [
            'waiting-list/confirm/*',
            'logout',
            '*/logout',
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            PreventPageCaching::class, // Prevent browser caching of authenticated pages (HIPAA)
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            CheckGlobalLogout::class,
            \App\Http\Middleware\EnforceAbsoluteSessionTimeout::class,
            CheckKeycloakSession::class, // Check Keycloak session validity
            RequireBillingSetup::class, // Check if user needs to complete billing setup
            EnsureOnboardingComplete::class, // Check if onboarding is complete
        ]);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'can-access-tenant' => CanAccessTenant::class,
            'public-tenant-access' => PublicTenantAccess::class,
            'guest' => RedirectIfAuthenticated::class,
            'central-guest' => CentralGuestAccess::class,
            'check-global-logout' => CheckGlobalLogout::class,
            'require-tenant' => RequireTenantContext::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Handle TenantCouldNotBeIdentifiedOnDomainException gracefully for central domains
        // This allows central domain routes (like tenant creation status) to work without tenant context
        $exceptions->render(function (TenantCouldNotBeIdentifiedOnDomainException $e, $request) {
            $domain = $request->getHost();
            $centralDomains = config('tenancy.central_domains', []);

            // If the domain is a central domain, allow the request to continue
            // This is expected behavior - central domain routes don't need tenant context
            if (in_array($domain, $centralDomains)) {
                \Illuminate\Support\Facades\Log::info('Tenant identification skipped for central domain', [
                    'domain' => $domain,
                    'path' => $request->path(),
                    'route' => $request->route()?->getName(),
                ]);

                // Return null to let Laravel handle the request normally
                // The route will continue without tenant context, which is correct for central routes
                return null;
            }

            // If it's not a central domain, this is a real error - let it propagate
            // This means a tenant domain was accessed but tenant couldn't be found
            \Illuminate\Support\Facades\Log::error('Tenant could not be identified on tenant domain', [
                'domain' => $domain,
                'path' => $request->path(),
                'route' => $request->route()?->getName(),
            ]);

            // Return null to let Laravel handle it (will show 404 or error page)
            return null;
        });

        // Handle 403 unauthorized errors - automatically logout authenticated users
        $exceptions->render(function (HttpException $e, $request) {
            // Only handle 403 Forbidden errors
            if ($e->getStatusCode() !== 403) {
                return null;
            }

            // Only auto-logout if user is authenticated
            if (! Auth::check()) {
                // User is not authenticated, show normal 403 error page
                return null;
            }

            $user = Auth::user();

            \Illuminate\Support\Facades\Log::warning('403 Unauthorized - Auto-logging out user', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'path' => $request->path(),
                'route' => $request->route()?->getName(),
                'tenant_id' => tenant('id'),
                'message' => $e->getMessage(),
            ]);

            // Perform global logout
            $globalLogoutService = app(\App\Services\GlobalLogoutService::class);

            try {
                $globalLogoutService->performGlobalLogout($request);
            } catch (\Exception $logoutError) {
                \Illuminate\Support\Facades\Log::error('Error during auto-logout on 403', [
                    'error' => $logoutError->getMessage(),
                    'user_id' => $user->id,
                ]);

                // Fallback: manual logout if service fails
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            // Get redirect URL
            $redirectUrl = $globalLogoutService->getLogoutRedirectUrl();

            // Handle Inertia requests
            if ($request->header('X-Inertia')) {
                return redirect()->away($redirectUrl);
            }

            // Regular requests
            return redirect()->away($redirectUrl);
        });

        // $exceptions->render(function (TenantCouldNotBeIdentifiedException $e) {
        //     return response()->view('errors.tenant-not-found', [], 404);
        // });

        // $exceptions->render(function (UnauthorizedException $e, $request) {
        //     // Log failed authorization attempt
        //     \App\Listeners\FailedAuthorizationListener::logUnauthorizedException($e);

        //     if ($request->header('X-Inertia')) {
        //         return redirect()->route('dashboard')
        //             ->with('error', 'You do not have permission to access that page.');
        //     }

        //     return redirect()->back()
        //         ->with('error', 'You do not have permission to access that page.');
        // });

        // // Global exception handler for all other exceptions
        // $exceptions->render(function (\Throwable $e, $request) {
        //     // Log the exception with full context
        //     \Log::error('Application Exception', [
        //         'message' => $e->getMessage(),
        //         'exception' => get_class($e),
        //         'file' => $e->getFile(),
        //         'line' => $e->getLine(),
        //         'url' => $request->fullUrl(),
        //         'method' => $request->method(),
        //         'ip' => $request->ip(),
        //         'user_id' => $request->user()?->id,
        //         'tenant_id' => tenant('id'),
        //         'trace' => $e->getTraceAsString(),
        //     ]);

        //     // In production, show a clean error page instead of blank 500
        //     if (app()->environment('production')) {
        //         // Try to use view files, fallback to inline HTML if views fail
        //         try {
        //             if ($request->header('X-Inertia')) {
        //                 return response()->view('errors.500-inertia', [
        //                     'message' => 'An error occurred while processing your request.',
        //                     'exception' => $e,
        //                 ], 500);
        //             }

        //             return response()->view('errors.500', [
        //                 'message' => 'An error occurred while processing your request.',
        //                 'exception' => $e,
        //             ], 500);
        //         } catch (\Throwable $viewError) {
        //             // If view rendering fails, return inline HTML
        //             \Log::error('Error view failed to render', ['error' => $viewError->getMessage()]);

        //             $html = '<!DOCTYPE html>
        // <html lang="en">
        // <head>
        //     <meta charset="UTF-8">
        //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
        //     <title>Server Error - '.config('app.name').'</title>
        //     <style>
        //         * { margin: 0; padding: 0; box-sizing: border-box; }
        //         body {
        //             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        //             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        //             min-height: 100vh;
        //             display: flex;
        //             align-items: center;
        //             justify-content: center;
        //             padding: 20px;
        //         }
        //         .error-container {
        //             background: white;
        //             border-radius: 20px;
        //             box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        //             max-width: 600px;
        //             width: 100%;
        //             padding: 60px 40px;
        //             text-align: center;
        //         }
        //         .error-code {
        //             font-size: 120px;
        //             font-weight: 800;
        //             color: #667eea;
        //             line-height: 1;
        //             margin-bottom: 20px;
        //         }
        //         .error-title {
        //             font-size: 32px;
        //             font-weight: 700;
        //             color: #2d3748;
        //             margin-bottom: 15px;
        //         }
        //         .error-message {
        //             font-size: 18px;
        //             color: #718096;
        //             line-height: 1.6;
        //             margin-bottom: 30px;
        //         }
        //         .btn {
        //             display: inline-block;
        //             padding: 12px 30px;
        //             margin: 0 10px;
        //             border-radius: 10px;
        //             text-decoration: none;
        //             font-weight: 600;
        //             font-size: 16px;
        //             transition: all 0.3s ease;
        //         }
        //         .btn-primary {
        //             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        //             color: white;
        //             box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        //         }
        //         .btn-secondary {
        //             background: #e2e8f0;
        //             color: #4a5568;
        //         }
        //         .support-text {
        //             margin-top: 30px;
        //             font-size: 14px;
        //             color: #a0aec0;
        //         }
        //     </style>
        // </head>
        // <body>
        //     <div class="error-container">
        //         <div class="error-code">500</div>
        //         <h1 class="error-title">Internal Server Error</h1>
        //         <p class="error-message">
        //             Oops! Something went wrong on our end. We\'re sorry for the inconvenience.
        //         </p>
        //         <p class="error-message" style="font-size: 16px;">
        //             This error has been logged and our team has been notified.
        //         </p>
        //         <div>
        //             <a href="javascript:history.back()" class="btn btn-secondary">Go Back</a>
        //             <a href="'.url('/').'" class="btn btn-primary">Go to Homepage</a>
        //         </div>
        //         <p class="support-text">
        //             If this problem persists, please contact support
        //         </p>
        //     </div>
        //     '.($request->header('X-Inertia') ? '<script>setTimeout(function(){window.location.reload();}, 5000);</script>' : '').'
        // </body>
        // </html>';

        //             return response($html, 500);
        //         }
        //     }

        //     // In development/staging, let Laravel handle it (shows detailed error page)
        //     return null;
        // });
    })->create();
