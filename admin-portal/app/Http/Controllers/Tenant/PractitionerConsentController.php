<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Practitioner;
use App\Models\Tenant\Consent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PractitionerConsentController extends Controller
{
    /**
     * Display consent management page for the authenticated practitioner
     */
    public function index()
    {
        $user = auth()->user();

        // Check if user has Practitioner role OR tenant practitioner record
        $hasPractitionerRole = $user->hasRole('Practitioner');
        $hasTenantPractitionerRecord = Practitioner::where('user_id', $user->id)->exists();

        if (! $hasPractitionerRole && ! $hasTenantPractitionerRecord) {
            abort(403, 'Access denied. You must be a practitioner or have a practitioner record in this tenant.');
        }

        // Get practitioner from tenant database
        $practitioner = Practitioner::where('user_id', $user->id)->first();

        if (! $practitioner) {
            return redirect()->route('dashboard')
                ->with('error', 'Practitioner record not found.');
        }

        // Get all practitioner consents (pending and accepted)
        $allPractitionerConsents = Consent::where('entity_type', 'PRACTITIONER')
            ->with('activeVersion')
            ->get()
            ->filter(fn ($consent) => $consent->activeVersion !== null);

        $pendingConsents = collect();
        $acceptedConsents = collect();

        foreach ($allPractitionerConsents as $consent) {
            $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', Practitioner::class)
                ->where('consentable_id', $practitioner->id)
                ->where('consent_version_id', $consent->activeVersion->id)
                ->first();

            if ($hasAccepted) {
                $acceptedConsents->push([
                    'id' => $consent->id,
                    'key' => $consent->key,
                    'title' => $consent->title,
                    'version_id' => $consent->activeVersion->id,
                    'version' => $consent->activeVersion->version,
                    'is_required' => $consent->is_required,
                    'body' => $consent->activeVersion->consent_body,
                    'accepted_at' => $hasAccepted->consented_at,
                ]);
            } else {
                $pendingConsents->push([
                    'id' => $consent->id,
                    'key' => $consent->key,
                    'title' => $consent->title,
                    'version_id' => $consent->activeVersion->id,
                    'version' => $consent->activeVersion->version,
                    'is_required' => $consent->is_required,
                    'body' => $consent->activeVersion->consent_body,
                ]);
            }
        }

        return Inertia::render('Tenant/Practitioner/Consents', [
            'practitioner' => $practitioner,
            'pendingConsents' => $pendingConsents,
            'acceptedConsents' => $acceptedConsents,
        ]);
    }

    /**
     * Accept multiple consents at once
     */
    public function acceptAll(Request $request)
    {
        Log::info('PractitionerConsentController::acceptAll START', [
            'request_data' => $request->all(),
        ]);

        $user = auth()->user();
        Log::info('Auth user check', ['user_id' => $user->id, 'user_email' => $user->email]);

        $request->validate([
            'practitioner_id' => 'required|integer',
            'consent_version_ids' => 'required|array',
            'consent_version_ids.*' => 'required|integer',
        ]);

        $practitionerId = $request->input('practitioner_id');
        $consentVersionIds = $request->input('consent_version_ids', []);

        try {
            // Verify practitioner belongs to user
            $practitioner = Practitioner::where('id', $practitionerId)
                ->where('user_id', $user->id)
                ->first();

            Log::info('Practitioner lookup', ['practitioner' => $practitioner ? ['id' => $practitioner->id, 'email' => $practitioner->email] : 'not found']);

            if (! $practitioner) {
                Log::error('Unauthorized - practitioner not found or does not belong to user');

                return back()->with('error', 'Unauthorized access.');
            }

            $acceptedCount = 0;
            $skippedCount = 0;

            foreach ($consentVersionIds as $consentVersionId) {
                // Check if consent version exists and is for practitioner
                $consentVersion = \App\Models\Tenant\ConsentVersion::find($consentVersionId);

                if (! $consentVersion) {
                    Log::warning('Consent version not found, skipping', ['consent_version_id' => $consentVersionId]);

                    continue;
                }

                // Verify it's a practitioner consent
                $consent = $consentVersion->consent;
                if ($consent->entity_type !== 'PRACTITIONER') {
                    Log::warning('Consent is not for practitioners, skipping', ['consent_id' => $consent->id]);

                    continue;
                }

                // Check if already accepted
                $existing = \App\Models\Tenant\EntityConsent::where('consentable_type', Practitioner::class)
                    ->where('consentable_id', $practitioner->id)
                    ->where('consent_version_id', $consentVersionId)
                    ->first();

                if (! $existing) {
                    \App\Models\Tenant\EntityConsent::create([
                        'consentable_type' => Practitioner::class,
                        'consentable_id' => $practitioner->id,
                        'consent_version_id' => $consentVersionId,
                        'consented_at' => now(),
                    ]);
                    $acceptedCount++;
                } else {
                    $skippedCount++;
                }
            }

            Log::info('Practitioner consents accepted (batch)', [
                'practitioner_id' => $practitioner->id,
                'accepted_count' => $acceptedCount,
                'skipped_count' => $skippedCount,
                'total_consent_ids' => count($consentVersionIds),
            ]);

            return back()->with('success', "Successfully accepted {$acceptedCount} consents.");
        } catch (\Exception $e) {
            Log::error('Failed to accept practitioner consents (batch)', [
                'practitioner_id' => $practitionerId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'Failed to accept consents. Please try again.');
        }
    }

    /**
     * Revoke a practitioner's consent
     */
    public function revoke(Request $request, $consentVersionId)
    {
        $user = auth()->user();

        // Get practitioner
        $practitioner = Practitioner::where('user_id', $user->id)->first();

        if (! $practitioner) {
            return back()->with('error', 'Practitioner record not found.');
        }

        // Get the consent version
        $consentVersion = \App\Models\Tenant\ConsentVersion::find($consentVersionId);

        if (! $consentVersion) {
            return back()->with('error', 'Consent version not found.');
        }

        // Check if the consent is required
        $consent = $consentVersion->consent;
        if ($consent->is_required) {
            return back()->with('error', 'Cannot revoke a required consent.');
        }

        // Delete the entity consent record
        \App\Models\Tenant\EntityConsent::where('consentable_type', Practitioner::class)
            ->where('consentable_id', $practitioner->id)
            ->where('consent_version_id', $consentVersionId)
            ->delete();

        return back()->with('success', 'Consent revoked successfully.');
    }
}
