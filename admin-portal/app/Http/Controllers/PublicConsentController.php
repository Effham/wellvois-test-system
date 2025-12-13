<?php

namespace App\Http\Controllers;

use App\Models\Practitioner;
use App\Models\Tenant\Consent;
use App\Models\Tenant\EntityConsent;
use App\Models\Tenant\Patient;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PublicConsentController extends Controller
{
    /**
     * Show the consent acceptance page
     */
    public function show(Request $request, string $token)
    {
        try {
            // Decode the token
            $tokenData = $this->decodeConsentToken($token);

            if (! $tokenData) {
                return view('consent.patient-consent-error', [
                    'error' => 'Invalid or expired consent link. Please contact your healthcare provider.',
                    'branding' => $this->getTenantBranding(),
                ]);
            }

            $entityId = $tokenData['entity_id'];
            $entityType = $tokenData['entity_type'];
            $triggerEvent = $tokenData['trigger_event'] ?? null; // May be null for old tokens
            $consentIds = $tokenData['consent_ids'] ?? null; // New: specific consent IDs from token

            // Get entity from database based on type
            $entity = $this->getEntity($entityId, $entityType);

            if (! $entity) {
                return view('consent.patient-consent-error', [
                    'error' => 'User not found. Please contact your healthcare provider.',
                    'branding' => $this->getTenantBranding(),
                ]);
            }

            // Get current tenant
            $tenant = tenant();

            if (! $tenant) {
                return view('consent.patient-consent-error', [
                    'error' => 'Healthcare provider not found.',
                    'branding' => $this->getTenantBranding(),
                ]);
            }

            // Verify tenant matches the token
            if ($tenant->id !== $tokenData['tenant_id']) {
                return view('consent.patient-consent-error', [
                    'error' => 'Invalid consent link for this healthcare provider.',
                    'branding' => $this->getTenantBranding(),
                ]);
            }

            // Get consents based on token data
            if ($consentIds !== null && is_array($consentIds) && count($consentIds) > 0) {
                // New approach: Load specific consents by ID from token
                $allConsents = Consent::whereIn('id', $consentIds)
                    ->where('entity_type', $entityType)
                    ->with('activeVersion')
                    ->get()
                    ->filter(fn ($consent) => $consent->activeVersion !== null);

                Log::info('Loading consents by specific IDs from token', [
                    'consent_ids' => $consentIds,
                    'loaded_count' => $allConsents->count(),
                ]);
            } else {
                // Backward compatibility: Filter by trigger event (old token format)
                $allConsents = Consent::where('entity_type', $entityType)
                    ->with('activeVersion')
                    ->get()
                    ->filter(fn ($consent) => $consent->activeVersion !== null);

                // If trigger event is provided, filter consents by trigger point
                if ($triggerEvent && $triggerEvent !== 'manual') {
                    $allConsents = $allConsents->filter(function ($consent) use ($entityType, $triggerEvent) {
                        $triggerPoints = $consent->trigger_points;

                        if (! $triggerPoints || ! is_array($triggerPoints)) {
                            return false;
                        }

                        $entityKey = strtolower($entityType);

                        return isset($triggerPoints[$entityKey]) &&
                               is_array($triggerPoints[$entityKey]) &&
                               in_array($triggerEvent, $triggerPoints[$entityKey]);
                    });
                }

                Log::info('Loading consents by trigger event (backward compatibility)', [
                    'trigger_event' => $triggerEvent,
                    'loaded_count' => $allConsents->count(),
                ]);
            }

            // Get consentable class for this entity type
            $consentableClass = $this->getConsentableClass($entityType);

            // Filter to ONLY pending consents (not accepted)
            $pendingConsents = collect();

            foreach ($allConsents as $consent) {
                $hasAccepted = EntityConsent::where('consentable_type', $consentableClass)
                    ->where('consentable_id', $entity->id)
                    ->where('consent_version_id', $consent->activeVersion->id)
                    ->exists();

                if (! $hasAccepted) {
                    $pendingConsents->push($consent);
                }
            }

            Log::info('Public consent page accessed', [
                'entity_id' => $entity->id,
                'entity_type' => $entityType,
                'tenant_id' => $tenant->id,
                'pending_consents' => $pendingConsents->count(),
            ]);

            // Get tenant branding/appearance settings
            $branding = $this->getTenantBranding();

            return view('consent.patient-consent', [
                'patient' => $entity, // Keep variable name for blade compatibility
                'entity' => $entity,
                'entityType' => $entityType,
                'tenant' => $tenant,
                'pendingConsents' => $pendingConsents,
                'acceptedConsents' => collect(), // Empty - not showing accepted consents
                'token' => $token,
                'branding' => $branding, // Tenant branding data
            ]);
        } catch (\Exception $e) {
            Log::error('Error showing consent page', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return view('consent.patient-consent-error', [
                'error' => 'An error occurred. Please try again later or contact support.',
                'branding' => $this->getTenantBranding(),
            ]);
        }
    }

    /**
     * Handle consent acceptance
     */
    public function accept(Request $request)
    {
        try {
            $request->validate([
                'patient_id' => 'required|integer',
                'consent_version_ids' => 'required|array',
                'consent_version_ids.*' => 'integer',
            ]);

            $patientId = $request->input('patient_id');
            $consentVersionIds = $request->input('consent_version_ids', []);

            // Get patient
            $patient = Patient::find($patientId);

            if (! $patient) {
                return response()->json([
                    'success' => false,
                    'message' => 'Patient not found.',
                ], 404);
            }

            $tenant = tenant();

            if (! $tenant) {
                return response()->json([
                    'success' => false,
                    'message' => 'Healthcare provider not found.',
                ], 404);
            }

            // Accept all consent versions
            $acceptedCount = 0;
            foreach ($consentVersionIds as $versionId) {
                // Check if already accepted
                $existing = EntityConsent::where('consentable_type', Patient::class)
                    ->where('consentable_id', $patient->id)
                    ->where('consent_version_id', $versionId)
                    ->first();

                if (! $existing) {
                    EntityConsent::create([
                        'consentable_type' => Patient::class,
                        'consentable_id' => $patient->id,
                        'consent_version_id' => $versionId,
                        'consented_at' => now(),
                    ]);
                    $acceptedCount++;
                }
            }

            Log::info('Patient consents accepted', [
                'patient_id' => $patient->id,
                'patient_email' => $patient->email,
                'tenant_id' => $tenant->id,
                'consents_accepted' => $acceptedCount,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Consents accepted successfully.',
                'accepted_count' => $acceptedCount,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error accepting consents', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred. Please try again.',
            ], 500);
        }
    }

    /**
     * Get entity based on type and ID
     */
    private function getEntity(int $entityId, string $entityType)
    {
        return match ($entityType) {
            'PATIENT' => Patient::find($entityId),
            'PRACTITIONER' => Practitioner::find($entityId),
            'USER' => User::find($entityId),
            default => null,
        };
    }

    /**
     * Get consentable class name for entity type
     */
    private function getConsentableClass(string $entityType): string
    {
        return match ($entityType) {
            'PATIENT' => Patient::class,
            'PRACTITIONER' => Practitioner::class,
            'USER' => User::class,
            default => Patient::class,
        };
    }

    /**
     * Decode and validate consent token
     */
    private function decodeConsentToken(string $token): ?array
    {
        try {
            $decoded = base64_decode($token);
            $data = json_decode($decoded, true);

            // Validate required fields (new generic structure)
            if (! isset($data['entity_id']) || ! isset($data['entity_type']) || ! isset($data['tenant_id']) || ! isset($data['expires_at'])) {
                Log::warning('Invalid consent token structure', ['token' => substr($token, 0, 20).'...']);

                return null;
            }

            // Check if token is expired
            if (now()->isAfter($data['expires_at'])) {
                Log::info('Expired consent token', [
                    'entity_id' => $data['entity_id'],
                    'entity_type' => $data['entity_type'],
                    'expires_at' => $data['expires_at'],
                ]);

                return null;
            }

            return $data;
        } catch (\Exception $e) {
            Log::error('Failed to decode consent token', [
                'error' => $e->getMessage(),
                'token' => substr($token, 0, 20).'...',
            ]);

            return null;
        }
    }

    /**
     * Get tenant branding/appearance settings
     */
    private function getTenantBranding(): array
    {
        $appearanceSettings = \App\Models\OrganizationSetting::getByPrefix('appearance_');

        \Log::info('PublicConsentController: Fetched tenant branding', [
            'tenant_id' => tenant('id'),
            'settings' => $appearanceSettings,
            'has_primary_color' => isset($appearanceSettings['appearance_primary_color']),
            'has_theme_color' => isset($appearanceSettings['appearance_theme_color']),
            'primary_color_value' => $appearanceSettings['appearance_primary_color'] ?? 'NOT SET',
            'theme_color_value' => $appearanceSettings['appearance_theme_color'] ?? 'NOT SET',
            'final_color' => $appearanceSettings['appearance_primary_color'] ?? $appearanceSettings['appearance_theme_color'] ?? '#7c3aed (fallback)',
        ]);

        // Process logo S3 key to generate proxy URL
        $logoS3Key = $appearanceSettings['appearance_logo_s3_key'] ?? null;
        if (! empty($logoS3Key)) {
            $tenantId = tenant('id');
            $cacheBuster = substr(md5($logoS3Key), 0, 8);
            $appearanceSettings['appearance_logo_path'] = url("/logo-proxy/{$tenantId}?v={$cacheBuster}");
        }

        return $appearanceSettings;
    }
}
