<?php

namespace App\Http\Controllers;

use App\Services\SignedUrlService;
use Illuminate\Http\Request;

class SignedUrlController extends Controller
{
    protected SignedUrlService $signedUrlService;

    public function __construct(SignedUrlService $signedUrlService)
    {
        $this->signedUrlService = $signedUrlService;
        $this->middleware('auth');
    }

    /**
     * Generate a signed URL for a profile picture
     */
    public function profilePicture(Request $request)
    {
        $request->validate([
            's3_key' => 'required|string',
            'expires_minutes' => 'nullable|integer|min:1|max:1440',
        ]);

        $expiresMinutes = $request->input('expires_minutes', 60);
        $signedUrl = $this->signedUrlService->getProfilePictureUrl($request->s3_key, $expiresMinutes);

        return response()->json([
            'signed_url' => $signedUrl,
            'expires_in_minutes' => $expiresMinutes,
        ]);
    }

    /**
     * Generate a signed URL for an organization logo
     */
    public function organizationLogo(Request $request)
    {
        $request->validate([
            's3_key' => 'required|string',
            'expires_minutes' => 'nullable|integer|min:1|max:1440',
        ]);

        $expiresMinutes = $request->input('expires_minutes', 1440); // 24 hours for logos
        $signedUrl = $this->signedUrlService->getLogoUrl($request->s3_key, $expiresMinutes);

        return response()->json([
            'signed_url' => $signedUrl,
            'expires_in_minutes' => $expiresMinutes,
        ]);
    }

    /**
     * Generate a signed URL for a document
     */
    public function document(Request $request)
    {
        $request->validate([
            's3_key' => 'required|string',
            'expires_minutes' => 'nullable|integer|min:1|max:1440',
        ]);

        $expiresMinutes = $request->input('expires_minutes', 30);
        $signedUrl = $this->signedUrlService->getDocumentUrl($request->s3_key, $expiresMinutes);

        return response()->json([
            'signed_url' => $signedUrl,
            'expires_in_minutes' => $expiresMinutes,
        ]);
    }
}
