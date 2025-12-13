<?php

namespace App\Providers;

use App\Services\S3BucketService;
use App\Services\S3FileTypeService;
use App\Services\S3PrivateBucketService;
use App\Services\S3StorageService;
use Illuminate\Support\ServiceProvider;

class S3StorageServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(S3StorageService::class, function ($app) {
            $disk = config('s3-storage.default_disk', 's3');

            return new S3StorageService($disk);
        });

        $this->app->singleton(S3BucketService::class, function ($app) {
            $disk = config('s3-storage.default_disk', 's3');

            return new S3BucketService($disk);
        });

        $this->app->singleton(S3FileTypeService::class, function ($app) {
            return new S3FileTypeService($app->make(S3StorageService::class));
        });

        $this->app->singleton(S3PrivateBucketService::class, function ($app) {
            return new S3PrivateBucketService($app->make(S3StorageService::class));
        });

        // Register aliases for easier access
        $this->app->alias(S3StorageService::class, 's3.storage');
        $this->app->alias(S3BucketService::class, 's3.bucket');
        $this->app->alias(S3FileTypeService::class, 's3.files');
        $this->app->alias(S3PrivateBucketService::class, 's3.private');
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Publish configuration file
        $this->publishes([
            __DIR__.'/../../config/s3-storage.php' => config_path('s3-storage.php'),
        ], 's3-storage-config');

        // Merge configuration
        $this->mergeConfigFrom(
            __DIR__.'/../../config/s3-storage.php',
            's3-storage'
        );
    }
}
