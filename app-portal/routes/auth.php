<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\ConfirmablePasswordController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\EmailVerificationPromptController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\VerifyEmailController;
use Illuminate\Support\Facades\Route;

Route::middleware('central-guest')->group(function () {
    Route::get('register', [RegisteredUserController::class, 'create'])
        ->name('register');

    Route::post('register', [RegisteredUserController::class, 'store']);

    // Intent selector page (default login route)
    Route::get('login', [AuthenticatedSessionController::class, 'selectIntent'])
        ->name('login.intent');

    // Practitioner/Patient login (with intent query parameter)
    Route::get('login/practitioner', [AuthenticatedSessionController::class, 'create'])
        ->defaults('intent', 'practitioner')
        ->name('login.practitioner');

    Route::get('login/patient', [AuthenticatedSessionController::class, 'create'])
        ->defaults('intent', 'patient')
        ->name('login.patient');

    // Admin login
    Route::get('admin/login', [AuthenticatedSessionController::class, 'createAdmin'])
        ->name('admin.login');

    Route::post('admin/login', [AuthenticatedSessionController::class, 'storeAdmin']);

    // Practitioner/Patient login POST (handles both intents)
    Route::post('login', [AuthenticatedSessionController::class, 'store'])
        ->name('login');

    Route::get('forgot-password', [PasswordResetLinkController::class, 'create'])
        ->name('password.request');

    Route::post('forgot-password', [PasswordResetLinkController::class, 'store'])
        ->name('password.email');

    Route::get('reset-password/{token}', [NewPasswordController::class, 'create'])
        ->name('password.reset');

    Route::post('reset-password', [NewPasswordController::class, 'store'])
        ->name('password.store');
});

Route::middleware('auth')->group(function () {
    Route::get('verify-email', EmailVerificationPromptController::class)
        ->name('verification.notice');

    Route::get('verify-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    Route::get('confirm-password', [ConfirmablePasswordController::class, 'show'])
        ->name('password.confirm');

    Route::post('confirm-password', [ConfirmablePasswordController::class, 'store']);

    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
