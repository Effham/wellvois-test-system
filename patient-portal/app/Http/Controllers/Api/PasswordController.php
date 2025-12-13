<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ChangePasswordRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PasswordController extends Controller
{
    /**
     * Update the user's password in the central database.
     * This ensures password consistency across all tenants for the same user.
     */
    public function change(ChangePasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $currentUserEmail = $request->user()->email;
        $centralUser = null;
        $passwordValid = false;

        // Get the central user and verify password
        tenancy()->central(function () use ($currentUserEmail, $validated, &$centralUser, &$passwordValid) {
            // Get the user from central database
            $centralUser = User::where('email', $currentUserEmail)->first();

            if ($centralUser) {
                // Verify current password against central database
                $passwordValid = Hash::check($validated['current_password'], $centralUser->password);
            }
        });

        // Validate outside the tenancy closure
        if (! $centralUser) {
            throw ValidationException::withMessages([
                'current_password' => ['User not found in central database.'],
            ]);
        }

        if (! $passwordValid) {
            throw ValidationException::withMessages([
                'current_password' => ['The provided password does not match your current password.'],
            ]);
        }

        // Update password in central database
        tenancy()->central(function () use ($currentUserEmail, $validated) {
            $centralUser = User::where('email', $currentUserEmail)->first();
            if ($centralUser) {
                $centralUser->update([
                    'password' => Hash::make($validated['password']),
                ]);

                Log::info('Password updated in central database via API', [
                    'user_email' => $currentUserEmail,
                    'user_id' => $centralUser->id,
                    'updated_from_tenant' => tenant('id'),
                ]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully across all tenants.',
        ]);
    }
}
