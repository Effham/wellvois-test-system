<?php

namespace App\Services;

class AwsKmsKeyProviderFactory
{
    /**
     * Create and return an instance of AwsKmsKeyProvider
     */
    public function __invoke(): AwsKmsKeyProvider
    {
        return new AwsKmsKeyProvider;
    }
}
