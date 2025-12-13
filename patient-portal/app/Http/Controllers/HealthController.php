<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

class HealthController extends Controller
{
    /**
     * Get comprehensive health status of the application and its services
     */
    public function check(Request $request)
    {
        $detailed = $request->get('detailed', false);

        $health = [
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'app' => [
                'name' => config('app.name'),
                'environment' => config('app.env'),
                'debug' => config('app.debug'),
                'version' => $this->getAppVersion(),
            ],
            'services' => [
                'database' => $this->checkDatabase(),
                'cache' => $this->checkCache(),
                'storage' => $this->checkStorage(),
                'queue' => $this->checkQueue(),
            ],
        ];

        // Add detailed checks if requested
        if ($detailed) {
            $health['services']['tenancy'] = $this->checkTenancy();
            $health['services']['passport'] = $this->checkPassport();
            $health['detailed'] = [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'memory_usage' => $this->getMemoryUsage(),
                'disk_usage' => $this->getDiskUsage(),
            ];
        }

        // Determine overall status
        $overallStatus = $this->determineOverallStatus($health['services']);
        $health['status'] = $overallStatus;

        // Return appropriate HTTP status code
        $httpStatus = $overallStatus === 'healthy' ? 200 : 503;

        return response()->json($health, $httpStatus);
    }

    /**
     * Simple health check endpoint
     */
    public function simple()
    {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'message' => 'Application is running',
        ]);
    }

    /**
     * Check database connectivity
     */
    private function checkDatabase(): array
    {
        try {
            $start = microtime(true);
            DB::connection()->getPdo();
            $responseTime = round((microtime(true) - $start) * 1000, 2);

            // Test a simple query
            $result = DB::select('SELECT 1 as test');

            return [
                'status' => 'healthy',
                'connection' => config('database.default'),
                'response_time_ms' => $responseTime,
                'message' => 'Database connection successful',
            ];
        } catch (Exception $e) {
            return [
                'status' => 'unhealthy',
                'connection' => config('database.default'),
                'error' => $e->getMessage(),
                'message' => 'Database connection failed',
            ];
        }
    }

    /**
     * Check cache system
     */
    private function checkCache(): array
    {
        try {
            $start = microtime(true);
            $testKey = 'health_check_'.time();
            $testValue = 'test_value';

            // Test cache write
            Cache::put($testKey, $testValue, 60);

            // Test cache read
            $retrievedValue = Cache::get($testKey);

            // Test cache delete
            Cache::forget($testKey);

            $responseTime = round((microtime(true) - $start) * 1000, 2);

            if ($retrievedValue === $testValue) {
                return [
                    'status' => 'healthy',
                    'driver' => config('cache.default'),
                    'response_time_ms' => $responseTime,
                    'message' => 'Cache system working properly',
                ];
            } else {
                return [
                    'status' => 'unhealthy',
                    'driver' => config('cache.default'),
                    'message' => 'Cache read/write test failed',
                ];
            }
        } catch (Exception $e) {
            return [
                'status' => 'unhealthy',
                'driver' => config('cache.default'),
                'error' => $e->getMessage(),
                'message' => 'Cache system failed',
            ];
        }
    }

    /**
     * Check storage system
     */
    private function checkStorage(): array
    {
        try {
            $start = microtime(true);
            $testFile = 'health_check_'.time().'.txt';
            $testContent = 'health check test';

            // Test file write
            Storage::put($testFile, $testContent);

            // Test file read
            $retrievedContent = Storage::get($testFile);

            // Test file delete
            Storage::delete($testFile);

            $responseTime = round((microtime(true) - $start) * 1000, 2);

            if ($retrievedContent === $testContent) {
                return [
                    'status' => 'healthy',
                    'driver' => config('filesystems.default'),
                    'response_time_ms' => $responseTime,
                    'message' => 'Storage system working properly',
                ];
            } else {
                return [
                    'status' => 'unhealthy',
                    'driver' => config('filesystems.default'),
                    'message' => 'Storage read/write test failed',
                ];
            }
        } catch (Exception $e) {
            return [
                'status' => 'unhealthy',
                'driver' => config('filesystems.default'),
                'error' => $e->getMessage(),
                'message' => 'Storage system failed',
            ];
        }
    }

    /**
     * Check queue system
     */
    private function checkQueue(): array
    {
        try {
            $queueConnection = config('queue.default');

            // For database queue, check if jobs table exists
            if ($queueConnection === 'database') {
                DB::table('jobs')->count();
            }

            return [
                'status' => 'healthy',
                'connection' => $queueConnection,
                'message' => 'Queue system accessible',
            ];
        } catch (Exception $e) {
            return [
                'status' => 'unhealthy',
                'connection' => config('queue.default'),
                'error' => $e->getMessage(),
                'message' => 'Queue system failed',
            ];
        }
    }

    /**
     * Check tenancy system
     */
    private function checkTenancy(): array
    {
        try {
            // Check if tenancy package is working
            $centralDomains = config('tenancy.central_domains', []);

            return [
                'status' => 'healthy',
                'central_domains' => $centralDomains,
                'message' => 'Tenancy system configured',
            ];
        } catch (Exception $e) {
            return [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
                'message' => 'Tenancy system failed',
            ];
        }
    }

    /**
     * Check Laravel Passport
     */
    private function checkPassport(): array
    {
        try {
            // Check if passport keys exist
            $publicKeyExists = file_exists(storage_path('oauth-public.key'));
            $privateKeyExists = file_exists(storage_path('oauth-private.key'));

            if ($publicKeyExists && $privateKeyExists) {
                return [
                    'status' => 'healthy',
                    'message' => 'Passport keys are present',
                ];
            } else {
                return [
                    'status' => 'warning',
                    'message' => 'Passport keys missing - run php artisan passport:keys',
                ];
            }
        } catch (Exception $e) {
            return [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
                'message' => 'Passport check failed',
            ];
        }
    }

    /**
     * Get application version from composer.json
     */
    private function getAppVersion(): string
    {
        try {
            $composerPath = base_path('composer.json');
            if (file_exists($composerPath)) {
                $composer = json_decode(file_get_contents($composerPath), true);

                return $composer['version'] ?? '1.0.0';
            }
        } catch (Exception $e) {
            // Ignore error
        }

        return '1.0.0';
    }

    /**
     * Get memory usage information
     */
    private function getMemoryUsage(): array
    {
        return [
            'current' => $this->formatBytes(memory_get_usage()),
            'peak' => $this->formatBytes(memory_get_peak_usage()),
            'limit' => ini_get('memory_limit'),
        ];
    }

    /**
     * Get disk usage information
     */
    private function getDiskUsage(): array
    {
        $path = base_path();

        return [
            'free' => $this->formatBytes(disk_free_space($path)),
            'total' => $this->formatBytes(disk_total_space($path)),
            'used_percentage' => round((1 - disk_free_space($path) / disk_total_space($path)) * 100, 2),
        ];
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes($bytes, $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision).' '.$units[$i];
    }

    /**
     * Determine overall health status based on service statuses
     */
    private function determineOverallStatus(array $services): string
    {
        $statuses = array_column($services, 'status');

        if (in_array('unhealthy', $statuses)) {
            return 'unhealthy';
        } elseif (in_array('warning', $statuses)) {
            return 'warning';
        } else {
            return 'healthy';
        }
    }
}
