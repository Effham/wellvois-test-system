<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Keycloak Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for Keycloak OAuth 2.0 authentication.
    |
    */

    'base_url' => env('KEYCLOAK_BASE_URL', 'http://localhost:8080'),
    'realm' => env('KEYCLOAK_REALM', 'dev'),
    'client_id' => env('KEYCLOAK_CLIENT_ID', 'practitioner-portal'),
    'client_secret' => env('KEYCLOAK_CLIENT_SECRET', ''),
    'redirect_uri' => env('KEYCLOAK_REDIRECT_URI', 'http://localhost:8001/auth/keycloak/callback'),

    /*
    |--------------------------------------------------------------------------
    | Admin API Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for Keycloak Admin API (used for user management).
    |
    */

    'admin_api' => [
        'admin_client_id' => env('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),
        'admin_client_secret' => env('KEYCLOAK_ADMIN_CLIENT_SECRET', ''),
        'admin_username' => env('KEYCLOAK_ADMIN_USERNAME', 'admin'),
        'admin_password' => env('KEYCLOAK_ADMIN_PASSWORD', 'admin'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    |
    | OAuth 2.0 scopes to request during authentication.
    |
    */

    'scopes' => [
        'openid',
        'profile',
        'email',
    ],

    /*
    |--------------------------------------------------------------------------
    | Response Type
    |--------------------------------------------------------------------------
    |
    | OAuth 2.0 response type. 'code' for Authorization Code flow.
    |
    */

    'response_type' => 'code',
];

