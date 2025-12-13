<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class PatientMedicalHistory extends Model implements CipherSweetEncrypted
{
    use LogsActivity, UsesCipherSweet;

    protected $fillable = [
        'patient_id',
        'disease',
        'recent_tests',
    ];

    /**
     * Get the patient that owns this medical history
     * Note: Patient is in central database, but we reference by ID only
     */
    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    /**
     * Configure CipherSweet encryption for medical history fields
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // NOT NULL field
            ->addField('disease')
            // Nullable field
            ->addOptionalTextField('recent_tests');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Patient medical history for patient ID {$this->patient_id} was {$eventName}");
    }
}
