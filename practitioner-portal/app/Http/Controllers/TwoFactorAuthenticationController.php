<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;
use PragmaRX\Google2FALaravel\Facade as Google2FA;

class TwoFactorAuthenticationController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified']);
    }

    /**
     * Display the 2FA setup page.
     */
    public function showSetupForm(Request $request): Response
    {
        $user = $request->user();
        $secret = $user->google2fa_secret;
        $isCentral = tenant('id') === null; // Define $isCentral here

        if (! $secret) {
            $secret = Google2FA::generateSecretKey();
            $user->google2fa_secret = $secret;
            $user->save();
        }

        $qrCodeImageUrl = Google2FA::getQrCodeInline(
            config('app.name'),
            $user->email,
            $secret
        );

        return Inertia::render('settings/TwoFactorAuthentication', [
            'qrCodeImageUrl' => $qrCodeImageUrl,
            'secret' => $secret,
            'google2faEnabled' => (bool) $user->google2fa_enabled,
            'isCentral' => $isCentral,
            'userRole' => $user->getRoleNames()->first(),
        ]);
    }

    /**
     * Enable 2FA for the authenticated user.
     */
    public function enable(Request $request): \Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'one_time_password' => 'required|numeric',
        ]);

        $user = $request->user();

        if (Google2FA::verifyKey($user->google2fa_secret, $request->one_time_password)) {
            $user->google2fa_enabled = true;
            $user->save();

            return redirect()->back()->with('success', 'Two-factor authentication enabled successfully.');
        }

        return redirect()->back()->with('error', 'Invalid one-time password.');
    }

    /**
     * Disable 2FA for the authenticated user.
     */
    public function disable(Request $request): \Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'one_time_password' => 'required|numeric',
        ]);

        $user = $request->user();

        if (Google2FA::verifyKey($user->google2fa_secret, $request->one_time_password)) {
            $user->google2fa_enabled = false;
            $user->save();

            return redirect()->back()->with('success', 'Two-factor authentication disabled successfully.');
        }

        return redirect()->back()->with('error', 'Invalid one-time password.');
    }

    /**
     * Show the 2FA challenge page.
     */
    public function showChallengeForm(): Response
    {
        return Inertia::render('settings/TwoFactorChallenge');
    }

    /**
     * Cancel 2FA challenge and return to login.
     */
    public function cancelChallenge(Request $request): \Illuminate\Http\RedirectResponse
    {
        // Get intent before clearing session
        $intent = session('login_intent');
        
        // Clear the 2FA session data
        $request->session()->forget('2fa_passed');
        $request->session()->forget('2fa_user_id');
        $request->session()->forget('login_intent');

        // Logout the user completely
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // Redirect based on intent
        if ($intent === 'admin') {
            return redirect()->route('admin.login')->with('status', 'Two-factor authentication cancelled. Please log in again.');
        }
        
        return redirect()->route('login.practitioner')->with('status', 'Two-factor authentication cancelled. Please log in again.');
    }

    /**
     * Verify the 2FA OTP during login.
     */
    public function verifyChallenge(Request $request)
    {
        $request->validate([
            'one_time_password' => 'required|numeric',
        ]);

        $user = Auth::guard('web')->user(); // Get the user from session before 2FA

        if (Google2FA::verifyKey($user->google2fa_secret, $request->one_time_password)) {
            // Mark 2FA as complete in session
            session(['2fa_passed' => true]);

            return app(AuthenticatedSessionController::class)->redirectAfterAuth($user);

            return redirect()->intended(route('dashboard'));
        }

        return redirect()->back()->withErrors(['one_time_password' => 'Invalid one-time password.']);
    }
}
