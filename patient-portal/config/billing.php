<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Trial Period Days
    |--------------------------------------------------------------------------
    |
    | The number of days for the free trial period. This can be overridden
    | by setting TRIAL_DAYS in your .env file.
    |
    */

    'trial_days' => env('TRIAL_DAYS', 30),

    /*
    |--------------------------------------------------------------------------
    | Maximum Payment Attempts
    |--------------------------------------------------------------------------
    |
    | The maximum number of payment attempts after trial expires before
    | blocking access.
    |
    */

    'max_payment_attempts' => env('MAX_PAYMENT_ATTEMPTS', 3),
];
