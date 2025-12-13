<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\KeycloakService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class KeycloakController extends Controller
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    /**
     * Redirect user to Keycloak authorization endpoint.
     *
     * @return RedirectResponse
     */
    public function redirect(): RedirectResponse
    {
        $authorizationUrl = $this->keycloakService->getAuthorizationUrl();
        return redirect($authorizationUrl);
    }

    /**
     * Handle Keycloak callback after authentication.
     *
     * @param Request $request
     * @return RedirectResponse
     */
    public function callback(Request $request): RedirectResponse
    {
        // Check for error from Keycloak
        if ($request->has('error')) {
            Log::error('Keycloak callback error', [
                'error' => $request->get('error'),
                'error_description' => $request->get('error_description'),
            ]);

            return redirect()->route('login.practitioner')
                ->withErrors(['keycloak' => 'Authentication failed. Please try again.']);
        }

        // Get authorization code and state
        $code = $request->get('code');
        $state = $request->get('state');

        if (!$code || !$state) {
            Log::error('Keycloak callback: Missing code or state', [
                'has_code' => !empty($code),
                'has_state' => !empty($state),
            ]);

            return redirect()->route('login.practitioner')
                ->withErrors(['keycloak' => 'Invalid authentication response. Please try again.']);
        }

        // Exchange code for tokens
        $tokens = $this->keycloakService->exchangeCodeForTokens($code, $state);
        if (!$tokens) {
            return redirect()->route('login.practitioner')
                ->withErrors(['keycloak' => 'Failed to authenticate. Please try again.']);
        }

        // Extract user information from ID token
        $idToken = $tokens['id_token'] ?? null;
        if (!$idToken) {
            Log::error('Keycloak callback: Missing ID token');
            return redirect()->route('login.practitioner')
                ->withErrors(['keycloak' => 'Authentication failed. Please try again.']);
        }

        $userInfo = $this->keycloakService->getUserInfoFromIdToken($idToken);
        if (!$userInfo) {
            // Fallback to userinfo endpoint
            $accessToken = $tokens['access_token'] ?? null;
            if ($accessToken) {
                $userInfo = $this->keycloakService->getUserInfo($accessToken);
            }
        }

        if (!$userInfo) {
            Log::error('Keycloak callback: Failed to get user information');
            return redirect()->route('login.practitioner')
                ->withErrors(['keycloak' => 'Failed to retrieve user information. Please try again.']);
        }

        // Extract user details
        $keycloakUserId = $userInfo['sub'] ?? null;
        $email = $userInfo['email'] ?? null;
        $name = trim(($userInfo['given_name'] ?? '') . ' ' . ($userInfo['family_name'] ?? '')) ?: ($userInfo['name'] ?? 'User');

        if (!$keycloakUserId || !$email) {
            Log::error('Keycloak callback: Missing required user information', [
                'has_keycloak_user_id' => !empty($keycloakUserId),
                'has_email' => !empty($email),
                'user_info' => $userInfo,
            ]);
            return redirect()->route('login.practitioner')
                ->withErrors(['keycloak' => 'Invalid user information. Please contact support.']);
        }

        // Find or create user in Laravel database
        $user = User::where('keycloak_user_id', $keycloakUserId)
            ->orWhere('email', $email)
            ->first();

        if (!$user) {
            // Create new user
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'keycloak_user_id' => $keycloakUserId,
                'email_verified_at' => $userInfo['email_verified'] ?? false ? now() : null,
                'password' => bcrypt(Str::random(64)), // Random password since we use Keycloak
            ]);

            Log::info('Keycloak: Created new user from Keycloak', [
                'user_id' => $user->id,
                'email' => $email,
                'keycloak_user_id' => $keycloakUserId,
            ]);
        } else {
            // Update existing user with Keycloak user ID if not set
            if (!$user->keycloak_user_id) {
                $user->keycloak_user_id = $keycloakUserId;
                $user->save();
            }

            // Update user information if needed
            if ($user->name !== $name) {
                $user->name = $name;
                $user->save();
            }

            Log::info('Keycloak: Authenticated existing user', [
                'user_id' => $user->id,
                'email' => $email,
                'keycloak_user_id' => $keycloakUserId,
            ]);
        }

        // Create Laravel session
        Auth::login($user, true); // Remember user

        // Store Keycloak tokens in session (optional, for future use)
        session([
            'keycloak_access_token' => $tokens['access_token'] ?? null,
            'keycloak_refresh_token' => $tokens['refresh_token'] ?? null,
        ]);

        // Redirect to intended URL or dashboard
        $intendedUrl = session()->pull('url.intended', route('dashboard'));

        Log::info('Keycloak: User authenticated successfully', [
            'user_id' => $user->id,
            'email' => $email,
            'redirect_to' => $intendedUrl,
        ]);

        return redirect()->intended($intendedUrl);
    }
}

