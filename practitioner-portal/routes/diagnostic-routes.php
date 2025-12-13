<?php

use Illuminate\Support\Facades\Route;

Route::get('/diagnostic-error', function () {
    throw new Exception('This is a test exception to verify error reporting is visible.');
});

Route::get('/diagnostic-log', function () {
    \Log::info('Diagnostic log test');

    return 'Log entry created. Check your logs.';
});

