<?php

return [
    /**
     * This controls which cryptographic backend will be used by CipherSweet.
     * Unless you have specific compliance requirements, you should choose
     * "nacl".
     *
     * Supported: "boring", "fips", "nacl", "custom"
     */
    'backend' => env('CIPHERSWEET_BACKEND', 'nacl'),

    /**
     * Set backend-specific options here. "custom" points to a factory class that returns a
     * backend from its `__invoke` method. Please see the docs for more details.
     */
    'backends' => [
        // 'custom' => CustomBackendFactory::class,
    ],

    /**
     * Select which key provider your application will use. The default option
     * is to read a string literal out of .env, but it's also possible to
     * provide the key in a file or use random keys for testing.
     *
     * Supported: "file", "random", "string", "custom"
     */
    'provider' => env('CIPHERSWEET_PROVIDER', 'string'),

    /**
     * Set provider-specific options here. "string" will read the key directly
     * from your .env file. "file" will read the contents of the specified file
     * to use as your key. "custom" points to a factory class that returns a
     * provider from its `__invoke` method. Please see the docs for more details.
     */
    'providers' => [
        'file' => [
            'path' => env('CIPHERSWEET_FILE_PATH'),
        ],
        'string' => [
            'key' => env('CIPHERSWEET_KEY'),
        ],
        'custom' => \App\Services\AwsKmsKeyProviderFactory::class,
    ],

    /**
     * AWS KMS configuration for envelope encryption
     * When using 'custom' provider, the CipherSweet key will be decrypted
     * from AWS KMS at runtime. This provides additional security and
     * enables automatic key rotation at the KMS level.
     */
    'kms' => [
        // The AWS region where your KMS key is located
        'region' => env('CIPHERSWEET_KMS_REGION', 'us-east-1'),

        // The KMS API version
        'version' => env('CIPHERSWEET_KMS_VERSION', 'latest'),

        // The KMS Key ID (can be key ID, key ARN, alias name, or alias ARN)
        'key_id' => env('CIPHERSWEET_KMS_KEY_ID'),

        // The base64-encoded encrypted CipherSweet key
        // This is the output from `php artisan ciphersweet:wrap-key`
        'encrypted_key' => env('CIPHERSWEET_KMS_ENCRYPTED_KEY'),
    ],

    /*
     * The provided code snippet checks whether the $permitEmpty property is set to false
     * for a given field. If it is not set to false, it throws an EmptyFieldException indicating
     * that the field is not defined in the row. This ensures that the code enforces the requirement for
     * the field to have a value and alerts the user if it is empty or undefined.
     * Supported: "true", "false"
     */
    'permit_empty' => env('CIPHERSWEET_PERMIT_EMPTY', false),
];
