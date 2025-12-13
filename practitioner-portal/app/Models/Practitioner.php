<?php

namespace App\Models;

use App\Models\Tenant\License;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use ParagonIE\CipherSweet\BlindIndex;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class Practitioner extends Model implements CipherSweetEncrypted
{
    use LogsActivity, UsesCipherSweet;

    /**
     * The database connection to use.
     * This model uses the tenant database connection.
     * For central database access, use CentralPractitioner model.
     */
    protected $casts = [
        'credentials' => 'array',
        'professional_associations' => 'array',
        'primary_specialties' => 'array',
        'therapeutic_modalities' => 'array',
        'client_types_served' => 'array',
        'languages_spoken' => 'array',
        'available_days' => 'array',
        'resume_files' => 'array',
        'licensing_docs' => 'array',
        'certificates' => 'array',
        'location_assignments' => 'array',
        'availability_schedule' => 'array',
        'service_pricing' => 'array',
        'meta_data' => 'array',
        'is_active' => 'boolean',
        'meta_data' => 'array',

    ];

    protected $fillable = [
        'central_practitioner_id',
        'user_id',
        'first_name',
        'last_name',
        'title',
        'phone_number',
        'meta_data',
        'extension',
        'gender',
        'pronoun',
        'email',
        'short_bio',
        'full_bio',
        'is_active',
        'profile_picture_path',
        'profile_picture_s3_key',
        'profile_picture_url',
        // Professional Details
        'credentials',
        'years_of_experience',
        'license_number',
        'professional_associations',
        'primary_specialties',
        'therapeutic_modalities',
        'client_types_served',
        'languages_spoken',
        'available_days',
        'resume_files',
        'resume_s3_key',
        'licensing_docs',
        'licensing_documents',
        'licensing_documents_s3_key',
        'certificates',
        'certificates_s3_key',
        // Additional fields for separate form submissions
        'location_assignments',
        'availability_schedule',
        'service_pricing',
        'meta_data',
        'slug',
    ];

    /**
     * Get the user associated with this practitioner
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Check if practitioner has registered (has user_id)
     */
    public function isRegistered(): bool
    {
        return ! is_null($this->user_id);
    }

    /**
     * Get the locations this practitioner is assigned to
     */
    public function locations(): BelongsToMany
    {
        return $this->belongsToMany(Location::class, 'location_practitioners')
            ->withPivot('is_assigned')
            ->withTimestamps();
    }

    /**
     * Get only assigned locations for this practitioner
     */
    public function assignedLocations(): BelongsToMany
    {
        return $this->locations()->wherePivot('is_assigned', true);
    }

    /**
     * Get the practitioner's full name
     */
    public function getFullNameAttribute(): string
    {
        return $this->first_name.' '.$this->last_name;
    }

    /**
     * Get the practitioner's display name with title
     */
    public function getDisplayNameAttribute(): string
    {
        $name = $this->full_name;

        if ($this->title) {
            $name = $this->title.' '.$name;
        }

        return $name;
    }

    /**
     * Get services offered by this practitioner
     */
    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'practitioner_services')
            ->withPivot('custom_price', 'custom_duration_minutes', 'is_offered')
            ->withTimestamps();
    }

    /**
     * Get only services actively offered by this practitioner
     */
    public function activeServices(): BelongsToMany
    {
        return $this->services()->wherePivot('is_offered', true);
    }

    /**
     * Get the licenses assigned to this practitioner
     */
    public function licenses(): BelongsToMany
    {
        return $this->belongsToMany(License::class, 'practitioner_license')
            ->withPivot('assigned_at', 'assigned_by', 'notes')
            ->withTimestamps();
    }

    /**
     * Sync practitioner from central database to tenant database
     */
    public static function syncFromCentral(self $centralPractitioner): self
    {
        return static::updateOrCreate(
            ['central_practitioner_id' => $centralPractitioner->id],
            [
                'central_practitioner_id' => $centralPractitioner->id, // Must include in data for insert
                'user_id' => $centralPractitioner->user_id,
                'first_name' => $centralPractitioner->first_name,
                'last_name' => $centralPractitioner->last_name,
                'title' => $centralPractitioner->title,
                'email' => $centralPractitioner->email,
                'phone_number' => $centralPractitioner->phone_number,
                'extension' => $centralPractitioner->extension,
                'gender' => $centralPractitioner->gender,
                'pronoun' => $centralPractitioner->pronoun,
                'short_bio' => $centralPractitioner->short_bio,
                'full_bio' => $centralPractitioner->full_bio,
                'profile_picture_path' => $centralPractitioner->profile_picture_path,
                'profile_picture_s3_key' => $centralPractitioner->profile_picture_s3_key,
                'profile_picture_url' => $centralPractitioner->profile_picture_url,
                'credentials' => $centralPractitioner->credentials,
                'years_of_experience' => $centralPractitioner->years_of_experience,
                'license_number' => $centralPractitioner->license_number,
                'professional_associations' => $centralPractitioner->professional_associations,
                'primary_specialties' => $centralPractitioner->primary_specialties,
                'therapeutic_modalities' => $centralPractitioner->therapeutic_modalities,
                'client_types_served' => $centralPractitioner->client_types_served,
                'languages_spoken' => $centralPractitioner->languages_spoken,
                'resume_files' => $centralPractitioner->resume_files,
                'licensing_docs' => $centralPractitioner->licensing_docs,
                'certificates' => $centralPractitioner->certificates,
                'available_days' => $centralPractitioner->available_days,
                'location_assignments' => $centralPractitioner->location_assignments,
                'availability_schedule' => $centralPractitioner->availability_schedule,
                'service_pricing' => $centralPractitioner->service_pricing,
                'meta_data' => $centralPractitioner->meta_data,
                'is_active' => $centralPractitioner->is_active,
                'slug' => $centralPractitioner->slug,
            ]
        );
    }

    /**
     * Override update method to add S3 key logging
     */
    public function update(array $attributes = [], array $options = []): bool
    {
        if (array_key_exists('profile_picture_s3_key', $attributes)) {
            \Log::info('Practitioner::update S3 key', [
                'practitioner_id' => $this->id,
                'old_s3_key' => $this->profile_picture_s3_key,
                'new_s3_key' => $attributes['profile_picture_s3_key'],
                'tenant_id' => tenant('id'),
            ]);
        }

        $result = parent::update($attributes, $options);

        if (array_key_exists('profile_picture_s3_key', $attributes)) {
            \Log::info('Practitioner::update S3 key result', [
                'practitioner_id' => $this->id,
                'success' => $result,
                'final_s3_key' => $this->fresh()->profile_picture_s3_key,
            ]);
        }

        return $result;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Practitioner {$this->full_name} was {$eventName}");
    }

    /**
     * Configure CipherSweet encryption for Practitioner model (Central Database)
     * Two-layer encryption: Layer 1 (CIPHERSWEET_KEY) + Layer 2 (AWS KMS)
     *
     * Blind indexes reduced to only essential searchable fields:
     * - first_name, last_name, license_number, email
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // CRITICAL PRIORITY - Direct Identifiers (searchable)
            ->addField('first_name')
            ->addBlindIndex('first_name', new BlindIndex('first_name_index'))
            ->addField('last_name')
            ->addBlindIndex('last_name', new BlindIndex('last_name_index'))

            // Contact Information (searchable, nullable)
            ->addOptionalTextField('email')
            ->addBlindIndex('email', new BlindIndex('email_index'))

            // Professional Credentials (searchable, nullable)
            ->addOptionalTextField('license_number')
            ->addBlindIndex('license_number', new BlindIndex('license_number_index'))

            // Contact & Professional Info (encrypted but not searchable, nullable)
            ->addOptionalTextField('phone_number')
            ->addOptionalTextField('extension')
            ->addOptionalTextField('title')
            ->addOptionalTextField('pronoun');
    }
}
