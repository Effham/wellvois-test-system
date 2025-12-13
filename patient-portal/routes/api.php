<?php

use App\Http\Controllers\Api\EmailValidationController;
use App\Http\Controllers\Api\MobileAuthController;
use App\Http\Controllers\Api\PasswordController;
use App\Http\Controllers\Api\RecordingController;
use App\Http\Controllers\Api\UserTenantController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\PrivateFileController;
use App\Http\Controllers\UserIntegrationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Health check routes - public access
Route::prefix('health')->group(function () {
    Route::get('/', [HealthController::class, 'check'])->name('health.check');
    Route::get('/simple', [HealthController::class, 'simple'])->name('health.simple');
});

// Stripe webhook - public (Stripe signs the request)
Route::post('/stripe/webhook', [\App\Http\Controllers\StripeWebhookController::class, 'handle'])
    ->name('stripe.webhook');

// Registration status check - REMOVED: Now handled server-side in tenantCreation controller
// Route::get('/register/check-status', [\App\Http\Controllers\TenantController::class, 'checkStatus'])
//     ->name('register.check-status');

// Mobile Authentication Routes (Public)
Route::prefix('mobile')->group(function () {
    Route::post('/login', [MobileAuthController::class, 'login'])->name('api.mobile.login');
});

// Mobile Authentication Routes (Protected - requires Sanctum token)
Route::prefix('mobile')->middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [MobileAuthController::class, 'logout'])->name('api.mobile.logout');
    Route::get('/user', [MobileAuthController::class, 'user'])->name('api.mobile.user');
    Route::get('/dashboard', [MobileAuthController::class, 'dashboard'])->name('api.mobile.dashboard');
    Route::get('/appointments', [\App\Http\Controllers\Api\MobileAppointmentController::class, 'index']);
    Route::get('/appointments/{id}', [\App\Http\Controllers\Api\MobileAppointmentController::class, 'show'])->name('api.mobile.appointments');

    // Mobile Session Routes
    Route::prefix('session')->group(function () {
        Route::post('/save', [App\Http\Controllers\Api\MobileSessionController::class, 'save']);
        Route::post('/finish', [App\Http\Controllers\Api\MobileSessionController::class, 'finish']);
        Route::post('/request-recording-consent', [App\Http\Controllers\Api\MobileSessionController::class, 'requestRecordingConsent']);
        Route::get('/check-recording-consent/{appointmentId}', [App\Http\Controllers\Api\MobileSessionController::class, 'checkRecordingConsent']);
        Route::post('/save-recording', [App\Http\Controllers\Api\MobileSessionController::class, 'saveRecording']);
        Route::post('/ai-summary/generate', [App\Http\Controllers\Api\MobileSessionController::class, 'generateAiSummary']);
        Route::post('/video/start', [App\Http\Controllers\Api\MobileSessionController::class, 'startVideo']);
        Route::post('/video/stop', [App\Http\Controllers\Api\MobileSessionController::class, 'stopVideo']);
        Route::post('/appointments/{id}/send-patient-link', [App\Http\Controllers\Api\MobileSessionController::class, 'sendPatientLink']);
        Route::post('/appointments/{id}/send-invitation', [App\Http\Controllers\Api\MobileSessionController::class, 'sendInvitation']);
    });
});

// Calendar conflicts API - requires authentication
Route::middleware('auth')->group(function () {
    Route::post('/check-calendar-conflicts', [UserIntegrationController::class, 'checkMultipleCalendarConflicts'])
        ->name('api.check-calendar-conflicts');
    Route::post('/organization/logo/upload', [OrganizationController::class, 'uploadLogo'])->name('api.organization.logo.upload');

});

Route::prefix('storage')->group(function () {
    Route::post('/upload', [PrivateFileController::class, 'upload']);           // multipart/form-data
    Route::get('/signed-url', [PrivateFileController::class, 'signedUrl']);     // ?key=...
    Route::get('/download/{key}', [PrivateFileController::class, 'download'])->where('key', '.*');
    Route::delete('/delete', [PrivateFileController::class, 'delete']);
});

// Signed URL generation endpoints
Route::prefix('signed-urls')->middleware('auth')->group(function () {
    Route::post('/profile-picture', [\App\Http\Controllers\SignedUrlController::class, 'profilePicture']);
    Route::post('/organization-logo', [\App\Http\Controllers\SignedUrlController::class, 'organizationLogo']);
    Route::post('/document', [\App\Http\Controllers\SignedUrlController::class, 'document']);
});

// Email validation API - public access for registration flow
Route::post('/check-email-exists', [EmailValidationController::class, 'checkEmailExists'])
    ->name('api.check-email-exists');

// User tenants API - requires Sanctum authentication
Route::prefix('user')->middleware('auth:sanctum')->group(function () {
    Route::get('/tenants', [UserTenantController::class, 'index'])->name('api.user.tenants');
});

// Password change API - requires Sanctum authentication
Route::prefix('password')->middleware('auth:sanctum')->group(function () {
    Route::post('/change', [PasswordController::class, 'change'])->name('api.password.change');
});

// Recordings API - requires Sanctum authentication
Route::prefix('recordings')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [RecordingController::class, 'index'])->name('api.recordings.index');
});
