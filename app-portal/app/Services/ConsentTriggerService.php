<?php

namespace App\Services;

use App\Mail\BatchConsentNotificationMail;
use App\Mail\ConsentNotificationMail;
use App\Models\Practitioner;
use App\Models\Tenant\Consent;
use App\Models\Tenant\EntityConsent;
use App\Models\Tenant\Patient;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ConsentTriggerService
{
    /**
     * Trigger consents for an entity based on the event
     *
     * @param  string  $entityType  PATIENT, PRACTITIONER, or USER
     * @param  string  $event  creation, appointment_creation
     * @param  mixed  $entity  The entity instance (Patient, Practitioner, User)
     */
    public function triggerConsentsForEntity(string $entityType, string $event, $entity): void
    {
        Log::info('ConsentTriggerService: Triggering consents', [
            'entity_type' => $entityType,
            'event' => $event,
            'entity_id' => $entity->id,
        ]);

        // Get all consents for this entity type that should be triggered on this event
        $consents = $this->getTriggeredConsents($entityType, $event);

        Log::info('ConsentTriggerService: Consents found for trigger', [
            'entity_type' => $entityType,
            'event' => $event,
            'consent_count' => $consents->count(),
            'consent_keys' => $consents->pluck('key')->toArray(),
        ]);

        if ($consents->isEmpty()) {
            Log::info('ConsentTriggerService: No consents found for trigger', [
                'entity_type' => $entityType,
                'event' => $event,
            ]);

            return;
        }

        // Filter out consents that have already been accepted
        $consentsToSend = $consents->filter(function ($consent) use ($entity) {
            return ! $this->hasAcceptedConsent($entity, $consent);
        });

        Log::info('ConsentTriggerService: Pending consents to send', [
            'entity_type' => $entityType,
            'event' => $event,
            'pending_count' => $consentsToSend->count(),
            'pending_keys' => $consentsToSend->pluck('key')->toArray(),
        ]);

        if ($consentsToSend->isEmpty()) {
            Log::info('ConsentTriggerService: All consents already accepted', [
                'entity_type' => $entityType,
                'event' => $event,
                'entity_id' => $entity->id,
            ]);

            return;
        }

        // Send batch consent email with all consents for this trigger point
        $this->sendBatchConsentEmail($consentsToSend, $entity, $entityType, $event);
    }

    /**
     * Trigger consents with smart fallback logic
     *
     * @param  string  $entityType  PATIENT, PRACTITIONER, or USER
     * @param  string  $event  Primary event (e.g., appointment_creation)
     * @param  mixed  $entity  The entity instance
     * @param  string|null  $fallbackEvent  Fallback event to check (e.g., creation)
     */
    public function triggerConsentsWithFallback(string $entityType, string $event, $entity, ?string $fallbackEvent = null): void
    {
        Log::info('ConsentTriggerService: Triggering consents with fallback', [
            'entity_type' => $entityType,
            'event' => $event,
            'fallback_event' => $fallbackEvent,
            'entity_id' => $entity->id,
        ]);

        // Get consents for the primary event
        $primaryConsents = $this->getTriggeredConsents($entityType, $event);

        // Filter out already accepted primary consents
        $pendingPrimaryConsents = $primaryConsents->filter(function ($consent) use ($entity) {
            return ! $this->hasAcceptedConsent($entity, $consent);
        });

        Log::info('ConsentTriggerService: Primary consents status', [
            'total_primary' => $primaryConsents->count(),
            'pending_primary' => $pendingPrimaryConsents->count(),
        ]);

        // Initialize collection for consents to send
        $consentsToSend = collect();

        // If fallback event is provided, check if fallback consents are accepted
        if ($fallbackEvent) {
            // Get all required consents for the fallback event
            $fallbackConsents = $this->getTriggeredConsents($entityType, $fallbackEvent)
                ->where('is_required', true);

            // Check if entity has accepted all required fallback consents
            $hasAcceptedAllFallback = true;
            foreach ($fallbackConsents as $consent) {
                if (! $this->hasAcceptedConsent($entity, $consent)) {
                    $hasAcceptedAllFallback = false;
                    break;
                }
            }

            Log::info('ConsentTriggerService: Fallback consents status', [
                'total_fallback_required' => $fallbackConsents->count(),
                'has_accepted_all_fallback' => $hasAcceptedAllFallback,
            ]);

            // If NOT all fallback consents are accepted, include them too
            if (! $hasAcceptedAllFallback) {
                $pendingFallbackConsents = $this->getTriggeredConsents($entityType, $fallbackEvent)
                    ->filter(function ($consent) use ($entity) {
                        return ! $this->hasAcceptedConsent($entity, $consent);
                    });

                // Combine both primary and fallback consents
                $consentsToSend = $pendingPrimaryConsents->merge($pendingFallbackConsents)->unique('id');

                Log::info('ConsentTriggerService: BATCH EMAIL - Combining both event types', [
                    'scenario' => 'NEW_PATIENT_DURING_APPOINTMENT',
                    'primary_event' => $event,
                    'fallback_event' => $fallbackEvent,
                    'pending_primary_count' => $pendingPrimaryConsents->count(),
                    'pending_primary_keys' => $pendingPrimaryConsents->pluck('key')->toArray(),
                    'pending_fallback_count' => $pendingFallbackConsents->count(),
                    'pending_fallback_keys' => $pendingFallbackConsents->pluck('key')->toArray(),
                    'total_batch_count' => $consentsToSend->count(),
                    'combined_consent_keys' => $consentsToSend->pluck('key')->toArray(),
                    'entity_id' => $entity->id,
                ]);
            } else {
                // All fallback consents accepted, send only primary consents
                $consentsToSend = $pendingPrimaryConsents;

                Log::info('ConsentTriggerService: Fallback consents already accepted - sending only primary', [
                    'scenario' => 'EXISTING_PATIENT_NEW_APPOINTMENT',
                    'primary_event' => $event,
                    'fallback_event' => $fallbackEvent,
                    'primary_consent_keys' => $pendingPrimaryConsents->pluck('key')->toArray(),
                    'entity_id' => $entity->id,
                ]);
            }
        } else {
            // No fallback, just send primary consents
            $consentsToSend = $pendingPrimaryConsents;
        }

        // If no consents to send, return early
        if ($consentsToSend->isEmpty()) {
            Log::info('ConsentTriggerService: All consents already accepted', [
                'entity_type' => $entityType,
                'event' => $event,
                'entity_id' => $entity->id,
            ]);

            return;
        }

        // Send batch consent email with all consents
        $this->sendBatchConsentEmail($consentsToSend, $entity, $entityType, $event);
    }

    /**
     * Get consents that should be triggered for the given entity type and event
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getTriggeredConsents(string $entityType, string $event)
    {
        return Consent::where('entity_type', strtoupper($entityType))
            ->with('activeVersion')
            ->get()
            ->filter(function ($consent) use ($entityType, $event) {
                $triggerPoints = $consent->trigger_points;

                if (! $triggerPoints || ! is_array($triggerPoints)) {
                    return false;
                }

                $entityKey = strtolower($entityType);

                return isset($triggerPoints[$entityKey]) &&
                       is_array($triggerPoints[$entityKey]) &&
                       in_array($event, $triggerPoints[$entityKey]);
            });
    }

    /**
     * Check if entity has accepted the consent
     *
     * @param  mixed  $entity
     */
    public function hasAcceptedConsent($entity, Consent $consent): bool
    {
        if (! $consent->activeVersion) {
            return false;
        }

        return EntityConsent::where('consentable_type', get_class($entity))
            ->where('consentable_id', $entity->id)
            ->where('consent_version_id', $consent->activeVersion->id)
            ->exists();
    }

    /**
     * Send batch consent email to the entity
     *
     * @param  \Illuminate\Database\Eloquent\Collection  $consents
     * @param  mixed  $entity
     */
    public function sendBatchConsentEmail($consents, $entity, string $entityType, string $event): void
    {
        try {
            // Get email based on entity type
            $email = $this->getEntityEmail($entity);

            if (! $email) {
                Log::error('ConsentTriggerService: No email found for entity', [
                    'entity_type' => get_class($entity),
                    'entity_id' => $entity->id,
                ]);

                return;
            }

            // Generate consent acceptance URL with all consents
            $consentUrl = $this->generateConsentUrl($entity, $consents, $event);

            Log::info('ConsentTriggerService: Sending batch consent email', [
                'consent_count' => $consents->count(),
                'consent_ids' => $consents->pluck('id')->toArray(),
                'email' => $email,
                'url' => $consentUrl,
                'trigger_event' => $event,
            ]);

            // Send batch email
            Mail::to($email)->send(new BatchConsentNotificationMail($consents, $entity, $consentUrl, $event));

            Log::info('ConsentTriggerService: Batch consent email sent successfully', [
                'consent_count' => $consents->count(),
                'email' => $email,
            ]);
        } catch (\Exception $e) {
            Log::error('ConsentTriggerService: Failed to send batch consent email', [
                'consent_count' => $consents->count(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Send consent email to the entity
     *
     * @param  mixed  $entity
     */
    public function sendConsentEmail(Consent $consent, $entity): void
    {
        try {
            // Get email based on entity type
            $email = $this->getEntityEmail($entity);

            if (! $email) {
                Log::error('ConsentTriggerService: No email found for entity', [
                    'entity_type' => get_class($entity),
                    'entity_id' => $entity->id,
                ]);

                return;
            }

            // Generate consent acceptance token/link
            // TODO: Implement token-based consent acceptance
            // For now, we'll use direct links to consent management pages

            $consentUrl = $this->generateConsentUrl($entity, $consent);

            Log::info('ConsentTriggerService: Sending consent email', [
                'consent_id' => $consent->id,
                'email' => $email,
                'url' => $consentUrl,
            ]);

            // Send email
            Mail::to($email)->send(new ConsentNotificationMail($consent, $entity, $consentUrl));

            Log::info('ConsentTriggerService: Consent email sent successfully', [
                'consent_id' => $consent->id,
                'email' => $email,
            ]);
        } catch (\Exception $e) {
            Log::error('ConsentTriggerService: Failed to send consent email', [
                'consent_id' => $consent->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Get entity email address
     *
     * @param  mixed  $entity
     */
    protected function getEntityEmail($entity): ?string
    {
        if ($entity instanceof Patient) {
            return $entity->email;
        }

        if ($entity instanceof Practitioner) {
            return $entity->email;
        }

        if ($entity instanceof User) {
            return $entity->email;
        }

        return null;
    }

    /**
     * Generate generic entity consent token
     *
     * @param  mixed  $entity
     * @param  string  $triggerEvent  The trigger event (creation, appointment_creation, etc.)
     * @param  array|null  $consentIds  Optional array of specific consent IDs to include
     */
    protected function generateEntityConsentToken($entity, string $entityType, string $triggerEvent, ?array $consentIds = null): string
    {
        $data = [
            'entity_id' => $entity->id,
            'entity_type' => strtoupper($entityType),
            'tenant_id' => tenant()->id,
            'trigger_event' => $triggerEvent,
            'expires_at' => now()->addDays(7)->toISOString(),
        ];

        // Add consent IDs if provided
        if ($consentIds !== null) {
            $data['consent_ids'] = $consentIds;
        }

        return base64_encode(json_encode($data));
    }

    /**
     * Generate consent URL for entity
     *
     * @param  mixed  $entity
     * @param  \Illuminate\Database\Eloquent\Collection|Consent  $consents  Single consent or collection of consents
     * @param  string  $triggerEvent  The trigger event (creation, appointment_creation, etc.)
     */
    protected function generateConsentUrl($entity, $consents, string $triggerEvent = 'manual'): string
    {
        $entityType = $this->getEntityType($entity);

        if (! $entityType) {
            return route('dashboard');
        }

        // Extract consent IDs if a collection is provided
        $consentIds = null;
        if ($consents instanceof \Illuminate\Database\Eloquent\Collection) {
            $consentIds = $consents->pluck('id')->toArray();
        }

        // Generate token-based public URL for all entity types with trigger event and consent IDs
        $token = $this->generateEntityConsentToken($entity, $entityType, $triggerEvent, $consentIds);

        return route('consents.show', ['token' => $token]);
    }

    /**
     * Check if entity has accepted all required consents
     *
     * @param  mixed  $entity
     */
    public function hasAcceptedRequiredConsents($entity): bool
    {
        $entityType = $this->getEntityType($entity);

        if (! $entityType) {
            return true;
        }

        $requiredConsents = Consent::where('entity_type', $entityType)
            ->where('is_required', true)
            ->with('activeVersion')
            ->get();

        foreach ($requiredConsents as $consent) {
            if (! $this->hasAcceptedConsent($entity, $consent)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get entity type string
     *
     * @param  mixed  $entity
     */
    protected function getEntityType($entity): ?string
    {
        if ($entity instanceof Patient) {
            return 'PATIENT';
        }

        if ($entity instanceof Practitioner) {
            return 'PRACTITIONER';
        }

        if ($entity instanceof User) {
            return 'USER';
        }

        return null;
    }
}
