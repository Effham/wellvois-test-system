<?php

use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\Settings\IntegrationController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SettingsController;
use App\Http\Controllers\Tenant\StripeConnectController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    // Main settings redirect route - redirects to first available settings page based on permissions
    Route::get('settings', function (\Illuminate\Http\Request $request) {
        $user = $request->user();
        $walkthrough = $request->query('walkthrough');

        // Preserve walkthrough query parameter when redirecting
        $queryParams = [];
        if ($walkthrough === 'true') {
            $queryParams['walkthrough'] = 'true';
        }

        // Check permissions in priority order matching the sidebar
        if ($user->hasPermissionTo('view-organization')) {
            return redirect()->route('settings.organization', $queryParams);
        }

        if ($user->hasPermissionTo('view-location')) {
            return redirect()->route('settings.locations', $queryParams);
        }

        if ($user->hasPermissionTo('view-services')) {
            return redirect()->route('settings.services', $queryParams);
        }

        if ($user->hasPermissionTo('view-organization')) {
            return redirect()->route('settings.licenses', $queryParams);
        }

        // If user has no settings permissions, redirect to dashboard with error
        return redirect()->route('dashboard')->with('error', 'You do not have permission to access settings.');
    })->name('settings.index')->middleware('require-tenant');

    // Individual settings pages
    // Organization settings with deferred loading support
    Route::get('settings/organization', [SettingsController::class, 'organization'])->name('settings.organization')->middleware(['require-tenant', 'permission:view-organization']);

    // Locations with deferred loading support
    Route::get('settings/locations', [SettingsController::class, 'locations'])->name('settings.locations')->middleware(['require-tenant', 'permission:view-location']);

    // Practitioners redirect
    Route::get('settings/practitioners', function () {
        return redirect()->route('settings.practitioners.list');
    })->name('settings.practitioners')->middleware(['require-tenant', 'permission:view-practitioner']);

    // Practitioners list with deferred loading support
    Route::get('settings/practitioners/list', [SettingsController::class, 'practitionersList'])->name('settings.practitioners.list')->middleware(['require-tenant', 'permission:view-practitioner']);

    // Practitioners invitations with deferred loading support
    Route::get('settings/practitioners/invitations', [SettingsController::class, 'practitionersInvitations'])->name('settings.practitioners.invitations')->middleware(['require-tenant', 'permission:view-practitioner']);

    // Services with deferred loading support
    Route::get('settings/services', [SettingsController::class, 'services'])->name('settings.services')->middleware(['require-tenant', 'permission:view-services']);

    // Subscription page with Payment Setup and Licenses tabs
    Route::get('settings/subscription', [SettingsController::class, 'subscription'])->name('settings.subscription')->middleware(['require-tenant', 'permission:view-organization']);

    // Licenses with deferred loading support
    Route::get('settings/licenses', [\App\Http\Controllers\Tenant\LicenseController::class, 'index'])->name('settings.licenses')->middleware(['require-tenant', 'permission:view-organization']);
    Route::post('settings/licenses/{license}/attach', [\App\Http\Controllers\Tenant\LicenseController::class, 'attach'])->name('settings.licenses.attach')->middleware(['require-tenant', 'permission:view-organization']);
    Route::delete('settings/licenses/{license}/detach/{practitioner}', [\App\Http\Controllers\Tenant\LicenseController::class, 'detach'])->name('settings.licenses.detach')->middleware(['require-tenant', 'permission:view-organization']);
    Route::post('settings/licenses/{license}/revoke', [\App\Http\Controllers\Tenant\LicenseController::class, 'revoke'])->name('settings.licenses.revoke')->middleware(['require-tenant', 'permission:view-organization']);

    // Integrations with deferred loading support
    Route::get('settings/integrations', [SettingsController::class, 'integrations'])->name('settings.integrations')->middleware(['require-tenant', 'permission:view-integration']);

    // Website with deferred loading support
    Route::get('settings/website', [SettingsController::class, 'website'])->name('settings.website')->middleware(['require-tenant', 'permission:view-website']);

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');
    Route::put('settings/password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance');

    // Stripe Connect / Marketplace Onboarding
    Route::prefix('settings/stripe-connect')->name('stripe-connect.')->middleware('require-tenant')->group(function () {
        Route::get('/', [StripeConnectController::class, 'index'])->name('index');
        Route::get('/status', [StripeConnectController::class, 'index'])->name('status');
        Route::get('/redirect', [StripeConnectController::class, 'redirectToStripe'])->name('redirect');
    });

    // Organization Settings Update Routes (data loaded from settings.index)
    Route::prefix('organization')->name('organization.')->middleware('permission:view-settings')->group(function () {
        Route::post('practice-details', [OrganizationController::class, 'updatePracticeDetails'])->name('practice-details.update');
        Route::post('appearance', [OrganizationController::class, 'updateAppearance'])->name('appearance.update');
        Route::post('logo-upload', [OrganizationController::class, 'uploadLogo'])->name('logo.upload');
        Route::post('time-locale', [OrganizationController::class, 'updateTimeLocale'])->name('time-locale.update');
        Route::post('business-compliance', [OrganizationController::class, 'updateBusinessCompliance'])->name('business-compliance.update');
        Route::post('appointment-settings', [OrganizationController::class, 'updateAppointmentSettings'])->name('appointment-settings.update');
        Route::post('accounting-settings', [OrganizationController::class, 'updateAccountingSettings'])->name('accounting-settings.update');

        // Integration routes
        Route::get('integrations/connect/{provider}', [IntegrationController::class, 'connect'])->name('integrations.connect');
        Route::post('integrations/connect/{provider}', [IntegrationController::class, 'connect'])->name('integrations.connect.post');
        Route::post('integrations/{integration}/disconnect', [IntegrationController::class, 'disconnect'])->name('integrations.disconnect');
        Route::post('integrations/{integration}/test', [IntegrationController::class, 'test'])->name('integrations.test');
        Route::post('integrations/{integration}/sync', [IntegrationController::class, 'sync'])->name('integrations.sync');
        Route::put('integrations/{integration}/configuration', [IntegrationController::class, 'updateConfiguration'])->name('integrations.configuration.update');
    });
});
