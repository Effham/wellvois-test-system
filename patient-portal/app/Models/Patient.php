<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Str;
use ParagonIE\CipherSweet\BlindIndex;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Patient extends Model implements CipherSweetEncrypted
{
    use CentralConnection;
    use LogsActivity;
    use UsesCipherSweet;

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->uid)) {
                $model->uid = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'health_number',
        'first_name',
        'last_name',
        'uid',
        'preferred_name',
        'email',
        'phone_number',
        'gender',
        'gender_pronouns',
        'client_type',
        'date_of_birth',
        'emergency_contact_phone',
        'address_lookup',
        'street_address',
        'apt_suite_unit',
        'city',
        'postal_zip_code',
        'province',
        'presenting_concern',
        'goals_for_therapy',
        'previous_therapy_experience',
        'current_medications',
        'diagnoses',
        'history_of_hospitalization',
        'risk_safety_concerns',
        'other_medical_conditions',
        'cultural_religious_considerations',
        'accessibility_needs',
        'insurance_provider',
        'policy_number',
        'coverage_card_path',
        'consent_to_treatment',
        'consent_to_data_storage',
        'privacy_policy_acknowledged',
        'language_preferences',
        'best_time_to_contact',
        'best_way_to_contact',
        'consent_to_receive_reminders',
        'user_id',
        'address', // Legacy field
        'password',
        'email_verified_at',
        'created_via_public_portal',
        'is_active',
        'meta_data',

    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'consent_to_treatment' => 'boolean',
        'consent_to_data_storage' => 'boolean',
        'privacy_policy_acknowledged' => 'boolean',
        'consent_to_receive_reminders' => 'boolean',
        'email_verified_at' => 'datetime',
        'created_via_public_portal' => 'boolean',
        'is_active' => 'boolean',
        'meta_data' => 'array',

    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
    ];

    /**
     * Get the user associated with this patient
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all invitations for this patient
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(PatientInvitation::class);
    }

    /**
     * Get pending invitations for this patient
     */
    public function pendingInvitations(): HasMany
    {
        return $this->hasMany(PatientInvitation::class)->where('status', 'pending');
    }

    /**
     * Check if patient has been invited by a specific tenant
     */
    public function hasInvitationFromTenant(string $tenantId): bool
    {
        return $this->invitations()->where('tenant_id', $tenantId)->exists();
    }

    /**
     * Check if patient has registered (has user_id)
     */
    public function isRegistered(): bool
    {
        return ! is_null($this->user_id);
    }

    /**
     * Get all tenants this patient is linked to
     */
    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(
            Tenant::class,
            'tenant_patients',
            'patient_id',
            'tenant_id'
        )->withPivot('invitation_status')->withTimestamps();
    }

    /**
     * Check if patient is linked to a specific tenant
     */
    public function isLinkedToTenant(string $tenantId): bool
    {
        return $this->tenants()->where('tenant_id', $tenantId)->exists();
    }

    /**
     * Get patient's full name
     */
    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }

    /**
     * Get patient's display name (preferred name or full name)
     */
    public function getDisplayNameAttribute(): string
    {
        return $this->preferred_name ?: $this->full_name;
    }

    /**
     * Get all entity consents for this patient (poly morphic relationship with tenant context)
     * Note: EntityConsent is stored in tenant database, so we query it via tenant context
     */
    public function entityConsents(): MorphMany
    {
        return $this->morphMany(
            \App\Models\Tenant\EntityConsent::class,
            'consentable'
        );
    }

    /**
     * Check if patient has accepted a specific consent by key
     */
    public function hasAcceptedConsent(string $consentKey): bool
    {
        $consent = \App\Models\Tenant\Consent::where('key', $consentKey)
            ->where('entity_type', 'PATIENT')
            ->first();

        if (! $consent) {
            return false;
        }

        $activeVersion = $consent->activeVersion;
        if (! $activeVersion) {
            return false;
        }

        return \App\Models\Tenant\EntityConsent::where('consentable_type', \App\Models\Tenant\Patient::class)
            ->where('consentable_id', $this->id)
            ->where('consent_version_id', $activeVersion->id)
            ->exists();
    }

    /**
     * Check if patient has accepted all required PATIENT consents
     */
    public function hasAcceptedAllRequiredConsents(): bool
    {
        \Illuminate\Support\Facades\Log::info('DEBUG Patient::hasAcceptedAllRequiredConsents START', [
            'patient_id' => $this->id,
        ]);

        try {
            $requiredConsents = \App\Models\Tenant\Consent::where('entity_type', 'PATIENT')
                ->with('activeVersion')
                ->get()
                ->filter(fn ($consent) => $consent->activeVersion !== null);

            \Illuminate\Support\Facades\Log::info('DEBUG: Found required consents', [
                'patient_id' => $this->id,
                'consents_count' => $requiredConsents->count(),
            ]);

            foreach ($requiredConsents as $consent) {
                $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', \App\Models\Tenant\Patient::class)
                    ->where('consentable_id', $this->id)
                    ->where('consent_version_id', $consent->activeVersion->id)
                    ->exists();

                \Illuminate\Support\Facades\Log::info('DEBUG: Checking consent', [
                    'patient_id' => $this->id,
                    'consent_key' => $consent->key,
                    'consent_version_id' => $consent->activeVersion->id,
                    'has_accepted' => $hasAccepted,
                ]);

                if (! $hasAccepted) {
                    return false;
                }
            }

            \Illuminate\Support\Facades\Log::info('DEBUG Patient::hasAcceptedAllRequiredConsents END - TRUE', [
                'patient_id' => $this->id,
            ]);

            return true;
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('DEBUG Patient::hasAcceptedAllRequiredConsents ERROR', [
                'patient_id' => $this->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Get pending consents for this patient
     */
    public function getPendingConsents(): \Illuminate\Support\Collection
    {
        $allConsents = \App\Models\Tenant\Consent::where('entity_type', 'PATIENT')
            ->with('activeVersion')
            ->get()
            ->filter(fn ($consent) => $consent->activeVersion !== null);

        $pendingConsents = collect();

        foreach ($allConsents as $consent) {
            $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', \App\Models\Tenant\Patient::class)
                ->where('consentable_id', $this->id)
                ->where('consent_version_id', $consent->activeVersion->id)
                ->exists();

            if (! $hasAccepted) {
                $pendingConsents->push($consent);
            }
        }

        return $pendingConsents;
    }

    /**
     * Accept a specific consent version for this patient
     */
    public function acceptConsent(int $consentVersionId): ?\App\Models\Tenant\EntityConsent
    {
        // Check if already accepted
        $existing = \App\Models\Tenant\EntityConsent::where('consentable_type', \App\Models\Tenant\Patient::class)
            ->where('consentable_id', $this->id)
            ->where('consent_version_id', $consentVersionId)
            ->first();

        if ($existing) {
            return $existing;
        }

        return \App\Models\Tenant\EntityConsent::create([
            'consentable_type' => \App\Models\Tenant\Patient::class,
            'consentable_id' => $this->id,
            'consent_version_id' => $consentVersionId,
            'consented_at' => now(),
        ]);
    }

    // Note: Medical history relationships removed due to central/tenant database separation
    // Use the PatientMedicalHistory service to access medical history data

    /**
     * Configure CipherSweet encryption for Patient model (Central Database)
     * Two-layer encryption: Layer 1 (CIPHERSWEET_KEY) + Layer 2 (AWS KMS)
     *
     * Blind indexes reduced to only essential searchable fields:
     * - first_name, last_name, health_number, preferred_name
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // CRITICAL PRIORITY - Direct Identifiers (searchable)
            // Health number is optional in central DB (only used for minimal patient records)
            ->addOptionalTextField('health_number')
            ->addBlindIndex('health_number', new BlindIndex('health_number_index'))

            // Non-nullable fields
            ->addField('first_name')
            ->addBlindIndex('first_name', new BlindIndex('first_name_index'))
            ->addField('last_name')
            ->addBlindIndex('last_name', new BlindIndex('last_name_index'))

            // Nullable fields (use addOptionalTextField)
            ->addOptionalTextField('preferred_name')
            ->addBlindIndex('preferred_name', new BlindIndex('preferred_name_index'))

            // Contact Information (encrypted but not searchable)
            ->addOptionalTextField('email')
            ->addBlindIndex('email', new BlindIndex('email_index'))
            ->addOptionalTextField('phone_number')
            ->addOptionalTextField('emergency_contact_phone')

            // Clinical & Medical Info (encrypted but not searchable)
            ->addOptionalTextField('street_address')
            ->addOptionalTextField('city')
            ->addOptionalTextField('postal_zip_code')
            ->addOptionalTextField('presenting_concern')
            ->addOptionalTextField('current_medications')
            ->addOptionalTextField('diagnoses')
            ->addOptionalTextField('risk_safety_concerns')

            // Insurance & Policy (encrypted but not searchable)
            ->addOptionalTextField('insurance_provider')
            ->addOptionalTextField('policy_number');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Patient {$this->full_name} was {$eventName}");
    }
}
