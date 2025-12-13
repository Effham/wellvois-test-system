<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PasswordController extends Controller
{
    /**
     * Show the user's password settings page.
     */
    public function edit(): Response
    {
        return Inertia::render('settings/password');
    }

    /**
     * Update the user's password in the central database.
     * This ensures password consistency across all tenants for the same user.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

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

                Log::info('Password updated in central database', [
                    'user_email' => $currentUserEmail,
                    'user_id' => $centralUser->id,
                    'updated_from_tenant' => tenant('id'),
                ]);
            }
        });

        return back()->with('success', 'Password updated successfully across all tenants.');
    }
}
