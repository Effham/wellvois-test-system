<?php

namespace App\Services;

use Illuminate\Http\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class S3BucketService
{
    protected string $disk;

    protected ?string $basePath;

    protected string $instanceId;

    public function __construct(string $disk = 's3', ?string $basePath = null)
    {
        $this->instanceId = uniqid('s3bucket_', true);

        $this->disk = $disk;
        $this->basePath = $basePath ? trim($basePath, '/').'/' : '';
    }

    /**
     * Upload a file (UploadedFile, File, or raw string) to S3.
     * Returns the S3 key (path inside the bucket).
     */
    public function upload(
        UploadedFile|File|string $file,
        ?string $key = null,
        string $visibility = 'private',
        ?string $contentType = null,
        array $extra = []
    ): string {
        $key = $this->normalizeKey($key, $file);

        $options = array_filter([
            'ContentType' => $contentType ?? $this->guessMime($file),
            // 'CacheControl' => 'max-age=31536000, public',
            // 'ACL' => 'bucket-owner-full-control',
        ]) + $extra;

        try {
            if ($file instanceof UploadedFile || $file instanceof File) {
                $result = Storage::disk($this->disk)->putFileAs(
                    $this->dirName($key),
                    $file,
                    basename($key),
                    $options
                );
                if (! $result) {
                    throw new \Exception('Failed to upload file to S3 - Storage::putFileAs() returned false');
                }
            } else {
                // $file is raw string contents
                $result = Storage::disk($this->disk)->put($key, $file, $options);
                if (! $result) {
                    throw new \Exception('Failed to upload file to S3 - Storage::put() returned false');
                }
            }

            return $key;
        } catch (\Exception $e) {
            // Only log critical errors, avoid logging success/info to prevent recursive failures
            try {
                \Log::error('S3BucketService: File upload failed', [
                    'key' => $key,
                    'error' => $e->getMessage(),
                ]);
            } catch (\Exception $logException) {
                // Silently fail if logging itself fails to prevent recursive errors
            }
            throw $e;
        }
    }

    /** Generate a temporary signed URL (best for private objects). */
    public function temporaryUrl(string $key, \DateTimeInterface|\DateInterval|int $expires = 900, array $options = []): string
    {
        $expiry = $this->normalizeExpiry($expires);

        return Storage::disk($this->disk)->temporaryUrl($this->prefixed($key), $expiry, $options);
    }

    /** Stream a response back to the client (good for gated access). */
    public function streamResponse(string $key, ?string $downloadName = null)
    {
        $path = $this->prefixed($key);

        return Storage::disk($this->disk)->response($path, $downloadName);
    }

    /** Fetch object contents (small files). */
    public function get(string $key): string
    {
        return Storage::disk($this->disk)->get($this->prefixed($key));
    }

    /** Delete an object. */
    public function delete(string $key): bool
    {
        return Storage::disk($this->disk)->delete($this->prefixed($key));
    }

    // ---------- Helpers ----------

    protected function normalizeKey(?string $key, UploadedFile|File|string $file): string
    {
        if ($key) {
            return $this->prefixed($key);
        }

        $ext = $this->guessExtension($file) ?? 'bin';
        $uuid = (string) Str::uuid();

        return $this->prefixed(now()->format('Y/m/d')."/{$uuid}.{$ext}");
    }

    protected function prefixed(string $key): string
    {
        $key = ltrim($key, '/');

        return $this->basePath.$key;
    }

    protected function dirName(string $key): string
    {
        $dir = pathinfo($key, PATHINFO_DIRNAME);

        return $dir === '.' ? '' : $dir;
    }

    protected function guessMime(UploadedFile|File|string $file): ?string
    {
        if ($file instanceof UploadedFile) {
            return $file->getClientMimeType() ?: $file->getMimeType();
        }
        if ($file instanceof File) {
            return mime_content_type($file->getPathname()) ?: null;
        }

        return null;
    }

    protected function guessExtension(UploadedFile|File|string $file): ?string
    {
        if ($file instanceof UploadedFile) {
            return $file->getClientOriginalExtension() ?: $file->extension();
        }
        if ($file instanceof File) {
            return pathinfo($file->getFilename(), PATHINFO_EXTENSION) ?: null;
        }

        return null;
    }

    protected function normalizeExpiry(\DateTimeInterface|\DateInterval|int $expires): \DateTimeInterface
    {
        if ($expires instanceof \DateTimeInterface) {
            return $expires;
        }
        $dt = now();
        if ($expires instanceof \DateInterval) {
            return $dt->add($expires);
        }

        return $dt->addSeconds($expires); // int seconds
    }
}
