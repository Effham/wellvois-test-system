<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use ParagonIE\CipherSweet\BlindIndex;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class Patient extends Model implements CipherSweetEncrypted
{
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
        'uid',
        'health_number',
        'user_id',
        'external_tenant_id',
        'external_patient_id',
        'first_name',
        'last_name',
        'preferred_name',
        'date_of_birth',
        'gender',
        'gender_pronouns',
        'client_type',
        'email',
        'phone_number',
        'emergency_contact_phone',
        'address',
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
        'meta_data',
        'is_active',
        'registration_status',
        'requested_at',
        'approved_at',
        'approved_by',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'consent_to_treatment' => 'boolean',
        'consent_to_data_storage' => 'boolean',
        'privacy_policy_acknowledged' => 'boolean',
        'consent_to_receive_reminders' => 'boolean',
        'is_active' => 'boolean',
        'meta_data' => 'array',
        'requested_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    /**
     * Get the user associated with this patient
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    /**
     * Get all medical histories for this patient
     */
    public function medicalHistories(): HasMany
    {
        return $this->hasMany(PatientMedicalHistory::class);
    }

    /**
     * Get all family medical histories for this patient
     */
    public function familyMedicalHistories(): HasMany
    {
        return $this->hasMany(FamilyMedicalHistory::class);
    }

    /**
     * Get all known allergies for this patient
     */
    public function knownAllergies(): HasMany
    {
        return $this->hasMany(KnownAllergy::class);
    }

    /**
     * Get all appointments for this patient
     */
    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    /**
     * Get all encounters for this patient
     */
    public function encounters(): HasMany
    {
        return $this->hasMany(Encounter::class);
    }

    /**
     * Get all patient invitations for this patient
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(PatientInvitation::class);
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
     * Check if patient is registered (has user_id)
     */
    public function isRegistered(): bool
    {
        return ! is_null($this->user_id);
    }

    /**
     * Check if patient is approved (status is not 'Requested')
     */
    public function isApproved(): bool
    {
        return $this->registration_status !== 'Requested';
    }

    /**
     * Check if patient registration is pending (status is 'Requested')
     */
    public function isPending(): bool
    {
        return $this->registration_status === 'Requested';
    }

    /**
     * Approve patient registration request
     * Changes status from 'Requested' to 'Active'
     */
    public function approve(int $adminUserId): void
    {
        $this->update([
            'registration_status' => 'Active',
            'approved_by' => $adminUserId,
            'approved_at' => now(),
        ]);
    }

    /**
     * Reject patient registration request
     */
    public function reject(?string $reason = null): void
    {
        $metaData = $this->meta_data ?? [];
        if ($reason) {
            $metaData['rejection_reason'] = $reason;
            $metaData['rejected_at'] = now()->toDateTimeString();
        }

        $this->update([
            'registration_status' => 'Rejected',
            'meta_data' => $metaData,
        ]);
    }

    /**
     * Configure CipherSweet encryption for tenant Patient model
     * Encrypts sensitive fields with blind indexes for searchable fields
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // Direct identifiers (searchable with blind indexes)
            ->addField('health_number')
            ->addBlindIndex('health_number', new BlindIndex('health_number_index'))
            ->addField('first_name')
            ->addBlindIndex('first_name', new BlindIndex('first_name_index'))
            ->addField('last_name')
            ->addBlindIndex('last_name', new BlindIndex('last_name_index'))

            // Nullable searchable fields
            ->addOptionalTextField('preferred_name')
            ->addBlindIndex('preferred_name', new BlindIndex('preferred_name_index'))

            // Contact information (encrypted)
            ->addOptionalTextField('email')
            ->addBlindIndex('email', new BlindIndex('email_index'))
            ->addOptionalTextField('phone_number')
            ->addOptionalTextField('emergency_contact_phone')

            // Address information (encrypted)
            ->addOptionalTextField('street_address')
            ->addOptionalTextField('city')
            ->addOptionalTextField('postal_zip_code')

            // Clinical information (encrypted)
            ->addOptionalTextField('presenting_concern')
            ->addOptionalTextField('current_medications')
            ->addOptionalTextField('diagnoses')
            ->addOptionalTextField('risk_safety_concerns')

            // Insurance information (encrypted)
            ->addOptionalTextField('insurance_provider')
            ->addOptionalTextField('policy_number');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Tenant patient {$this->full_name} was {$eventName}");
    }

    /**
     * Get all entity consents for this patient (polymorphic relationship)
     */
    public function entityConsents(): \Illuminate\Database\Eloquent\Relations\MorphMany
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

        return \App\Models\Tenant\EntityConsent::where('consentable_type', self::class)
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
                $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', self::class)
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
            $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', self::class)
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
        $existing = \App\Models\Tenant\EntityConsent::where('consentable_type', self::class)
            ->where('consentable_id', $this->id)
            ->where('consent_version_id', $consentVersionId)
            ->first();

        if ($existing) {
            return $existing;
        }

        return \App\Models\Tenant\EntityConsent::create([
            'consentable_type' => self::class,
            'consentable_id' => $this->id,
            'consent_version_id' => $consentVersionId,
            'consented_at' => now(),
        ]);
    }
}
