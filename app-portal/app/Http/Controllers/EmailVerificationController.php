<?php

namespace App\Http\Controllers;

use App\Mail\OTPVerificationMail;
use App\Models\EmailVerification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class EmailVerificationController extends Controller
{
    /**
     * Send OTP to the provided email address
     */
    public function sendOTP(Request $request): \Illuminate\Http\JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', 'max:255'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid email address',
                'errors' => $validator->errors(),
            ], 422);
        }

        $email = $request->email;

        // Generate 6-digit OTP
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Delete any existing unverified OTPs for this email
        EmailVerification::where('email', $email)
            ->where('is_verified', false)
            ->delete();

        // Create new OTP record
        $verification = EmailVerification::create([
            'email' => $email,
            'otp' => $otp,
            'expires_at' => now()->addMinutes(10),
            'is_verified' => false,
        ]);

        // Send OTP email
        try {
            Mail::to($email)->send(new OTPVerificationMail($otp));
        } catch (\Exception $e) {
            \Log::error('Failed to send OTP email', [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send verification email. Please try again.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Verification code sent to your email',
        ]);
    }

    /**
     * Verify the OTP provided by the user
     */
    public function verifyOTP(Request $request): \Illuminate\Http\JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid input',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Find the verification record
        $verification = EmailVerification::where('email', $request->email)
            ->where('otp', $request->otp)
            ->where('is_verified', false)
            ->first();

        if (! $verification) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid verification code',
            ], 422);
        }

        // Check if OTP is expired
        if ($verification->isExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'Verification code has expired. Please request a new one.',
            ], 422);
        }

        // Mark as verified
        $verification->update([
            'is_verified' => true,
            'verified_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully',
        ]);
    }
}
