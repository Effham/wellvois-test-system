<?php

namespace App\Providers;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Laravel\Cashier\Cashier;
use Laravel\Passport\Passport;
use Spatie\Activitylog\Models\Activity;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Override CipherSweet singleton to ensure consistent KeyProvider usage
        // This fixes decryption issues for central database models queried from tenant context
        $this->app->singleton(\ParagonIE\CipherSweet\CipherSweet::class, function ($app) {
            // Build backend
            $backend = match (config('ciphersweet.backend')) {
                'fips' => new \ParagonIE\CipherSweet\Backend\FIPSCrypto,
                'boring' => new \ParagonIE\CipherSweet\Backend\BoringCrypto,
                default => new \ParagonIE\CipherSweet\Backend\ModernCrypto,
            };

            // Build KeyProvider - use our custom provider for KMS integration
            if (config('ciphersweet.provider') === 'custom') {
                $factory = config('ciphersweet.providers.custom');
                $keyProvider = $app->make($factory)();
            } else {
                // Fallback to package's default providers
                $keyProvider = match (config('ciphersweet.provider')) {
                    'file' => new \ParagonIE\CipherSweet\KeyProvider\FileProvider(
                        config('ciphersweet.providers.file.path')
                    ),
                    'string' => new \ParagonIE\CipherSweet\KeyProvider\StringProvider(
                        config('ciphersweet.providers.string.key')
                    ),
                    default => new \ParagonIE\CipherSweet\KeyProvider\RandomProvider($backend),
                };
            }

            return new \ParagonIE\CipherSweet\CipherSweet($keyProvider, $backend);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Disable Cashier's default webhook route registration
        // We use our custom webhook handler at /api/stripe/webhook
        Cashier::ignoreRoutes();

        //  Passport::routes();

        Activity::saving(function (Activity $activity) {
            // Add IP and user agent to all activity logs
            $activity->properties = $activity->properties->put('ip', request()->ip());
            $activity->properties = $activity->properties->put('user_agent', request()->userAgent());

            // Auto-set causer if there's an authenticated user and no causer is set
            if (! $activity->causer_id && Auth::check()) {
                $activity->causer_id = Auth::id();
                $activity->causer_type = get_class(Auth::user());
            }
        });

        // Register authentication event listeners
        Event::listen(
            \Illuminate\Auth\Events\Login::class,
            [\App\Listeners\ActivityLogListener::class, 'handleLogin']
        );

        Event::listen(
            \Illuminate\Auth\Events\Logout::class,
            [\App\Listeners\ActivityLogListener::class, 'handleLogout']
        );

        Event::listen(
            \Illuminate\Auth\Events\Failed::class,
            [\App\Listeners\ActivityLogListener::class, 'handleFailedLogin']
        );

        Event::listen(
            \Illuminate\Auth\Events\Lockout::class,
            [\App\Listeners\ActivityLogListener::class, 'handleLockout']
        );

        Event::listen(
            \Illuminate\Auth\Events\PasswordReset::class,
            [\App\Listeners\ActivityLogListener::class, 'handlePasswordReset']
        );

        // Register admin override listener
        Event::listen(
            \App\Events\AdminOverrideUsed::class,
            [\App\Listeners\RolePermissionActivityListener::class, 'handleAdminOverride']
        );

        // Register EntityConsent observer
        \App\Models\Tenant\EntityConsent::observe(\App\Observers\EntityConsentObserver::class);
    }
}
