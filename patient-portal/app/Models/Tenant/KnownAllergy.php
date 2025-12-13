<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class KnownAllergy extends Model implements CipherSweetEncrypted
{
    use LogsActivity, UsesCipherSweet;

    protected $fillable = [
        'patient_id',
        'allergens',
        'type',
        'severity',
        'reaction',
        'notes',
    ];

    /**
     * Get the patient that owns this allergy
     */
    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    /**
     * Configure CipherSweet encryption for allergy fields
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // Fields with encryption - NOT NULL
            ->addField('allergens')
            ->addField('type')

            // Fields without blind indexes (not searchable, but encrypted) - nullable
            ->addOptionalTextField('reaction')
            ->addOptionalTextField('notes');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Known allergy for patient ID {$this->patient_id} was {$eventName}");
    }
}
