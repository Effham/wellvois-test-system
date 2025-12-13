<?php

namespace App\Http\Controllers;

use App\Http\Requests\UploadFileRequest;
use App\Services\S3BucketService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PrivateFileController extends Controller
{
    public function __construct()
    {
        // Temporarily disabled auth for testing S3 functionality
        // $this->middleware('auth:sanctum')->only(['upload', 'signedUrl', 'download', 'delete']);
    }

    /**
     * POST /api/storage/upload
     * Body: multipart/form-data { file: ..., key?: "path/optional.ext", expires_minutes?: 10 }
     */
    public function upload(UploadFileRequest $request, S3BucketService $s3)
    {
        \Log::info('PrivateFileController: Upload request received', [
            'user_id' => auth()->id() ?? 'guest',
            'file_name' => $request->file('file')?->getClientOriginalName(),
            'file_size' => $request->file('file')?->getSize(),
            'mime_type' => $request->file('file')?->getClientMimeType(),
            'custom_key' => $request->string('key')->toString(),
            'expires_minutes' => $request->input('expires_minutes', 10),
        ]);

        try {
            $key = $s3->upload(
                $request->file('file'),
                key: $request->string('key')->toString() ?: null,
                visibility: 'private'
            );

            $minutes = (int) ($request->input('expires_minutes', 10));
            $signedUrl = $s3->temporaryUrl($key, now()->addMinutes($minutes));

            \Log::info('PrivateFileController: Upload completed successfully', [
                'user_id' => auth()->id() ?? 'guest',
                'final_key' => $key,
                'signed_url_expires_in' => $minutes.' minutes',
            ]);

            return response()->json([
                'key' => $key,
                'signed_url' => $signedUrl, // valid for X minutes
            ], Response::HTTP_CREATED);
        } catch (\Exception $e) {
            \Log::error('PrivateFileController: Upload failed', [
                'user_id' => auth()->id() ?? 'guest',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'File upload failed',
                'message' => $e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * GET /api/storage/signed-url?key=...
     * Returns a fresh signed URL (default 10 minutes).
     */
    public function signedUrl(Request $request, S3BucketService $s3)
    {
        $request->validate([
            'key' => ['required', 'string'],
            'expires_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
        ]);

        $minutes = (int) ($request->input('expires_minutes', 10));
        $url = $s3->temporaryUrl($request->string('key'), now()->addMinutes($minutes));

        return response()->json(['url' => $url]);
    }

    /**
     * GET /api/storage/download/{key}
     * Streams the file through Laravel (good for enforcing auth/roles).
     */
    public function download(string $key, S3BucketService $s3)
    {
        // Add your authorization logic here (e.g., Gate::authorize('view-file', $key));
        return $s3->streamResponse($key);
    }

    /**
     * DELETE /api/storage/delete
     * Body: { "key": "path/to/file.ext" }
     */
    public function delete(Request $request, S3BucketService $s3)
    {
        $request->validate([
            'key' => ['required', 'string'],
        ]);

        $deleted = $s3->delete($request->string('key'));

        return response()->json(['deleted' => $deleted]);
    }
}
