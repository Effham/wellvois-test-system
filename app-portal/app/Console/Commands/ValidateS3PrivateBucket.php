<?php

namespace App\Console\Commands;

use App\Services\S3PrivateBucketService;
use App\Services\S3StorageService;
use Illuminate\Console\Command;

class ValidateS3PrivateBucket extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'validate:s3-private-bucket {--disk=s3}';

    /**
     * The console command description.
     */
    protected $description = 'Validate S3 private bucket configuration and connectivity';

    protected S3StorageService $s3Service;

    protected S3PrivateBucketService $privateBucketService;

    public function __construct(
        S3StorageService $s3Service,
        S3PrivateBucketService $privateBucketService
    ) {
        parent::__construct();
        $this->s3Service = $s3Service;
        $this->privateBucketService = $privateBucketService;
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('🔍 Validating S3 Private Bucket Configuration...');
        $this->newLine();

        // Get bucket info
        $bucketInfo = $this->s3Service->getBucketInfo();
        $this->displayBucketInfo($bucketInfo);

        // Validate configuration
        $validation = $this->s3Service->validatePrivateBucketSetup();
        $this->displayValidationResults($validation);

        if (! $validation['valid']) {
            $this->error('❌ Private bucket validation failed!');

            return Command::FAILURE;
        }

        // Run comprehensive private bucket tests
        if ($bucketInfo['is_private']) {
            $this->info('🧪 Running comprehensive private bucket tests...');
            $privateValidation = $this->privateBucketService->validatePrivateBucketSetup();
            $this->displayPrivateValidationResults($privateValidation);

            if (! $privateValidation['valid']) {
                $this->error('❌ Private bucket tests failed!');

                return Command::FAILURE;
            }
        }

        // Display recommendations
        $this->displayRecommendations($bucketInfo);

        $this->newLine();
        $this->info('✅ S3 Private Bucket validation completed successfully!');

        return Command::SUCCESS;
    }

    protected function displayBucketInfo(array $bucketInfo): void
    {
        $this->info('📊 Bucket Information:');
        $this->table(
            ['Setting', 'Value'],
            [
                ['Disk', $bucketInfo['disk']],
                ['Bucket Name', $bucketInfo['bucket']],
                ['Region', $bucketInfo['region']],
                ['Is Private', $bucketInfo['is_private'] ? '✅ Yes' : '❌ No'],
                ['Encryption Enabled', $bucketInfo['encryption_enabled'] ? '✅ Yes' : '❌ No'],
                ['Encryption Type', $bucketInfo['encryption_type'] ?? 'Not configured'],
            ]
        );
        $this->newLine();
    }

    protected function displayValidationResults(array $validation): void
    {
        $this->info('🔍 Configuration Validation:');

        if ($validation['valid']) {
            $this->info('✅ Configuration is valid');
        } else {
            $this->error('❌ Configuration has errors:');
            foreach ($validation['errors'] as $error) {
                $this->error("  • {$error}");
            }
        }

        if (! empty($validation['warnings'])) {
            $this->warn('⚠️  Warnings:');
            foreach ($validation['warnings'] as $warning) {
                $this->warn("  • {$warning}");
            }
        }

        $this->newLine();
    }

    protected function displayPrivateValidationResults(array $validation): void
    {
        $this->info('🔒 Private Bucket Tests:');

        if ($validation['valid']) {
            $this->info('✅ All private bucket tests passed');
        } else {
            $this->error('❌ Private bucket tests failed:');
            foreach ($validation['errors'] as $error) {
                $this->error("  • {$error}");
            }
        }

        if (! empty($validation['warnings'])) {
            $this->warn('⚠️  Private Bucket Warnings:');
            foreach ($validation['warnings'] as $warning) {
                $this->warn("  • {$warning}");
            }
        }

        $this->newLine();
    }

    protected function displayRecommendations(array $bucketInfo): void
    {
        $this->info('💡 Recommendations:');

        if (! $bucketInfo['is_private']) {
            $this->warn('  • Consider configuring as private bucket for medical data security');
        }

        if (! $bucketInfo['encryption_enabled']) {
            $this->warn('  • Enable server-side encryption (AES256) for HIPAA compliance');
        }

        if ($bucketInfo['is_private']) {
            $recommendations = $this->privateBucketService->setupPrivateBucketRecommendations();

            $this->info('  • Ensure bucket policy blocks public access');
            $this->info('  • Enable versioning for audit trails');
            $this->info('  • Configure access logging for compliance');
            $this->info('  • Set up lifecycle policies for cost optimization');
        }

        $this->newLine();
    }
}
