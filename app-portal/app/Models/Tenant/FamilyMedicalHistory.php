<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class FamilyMedicalHistory extends Model implements CipherSweetEncrypted
{
    use LogsActivity, UsesCipherSweet;

    protected $fillable = [
        'patient_id',
        'summary',
        'relationship_to_patient',
        'details',
        'diagnosis_date',
    ];

    protected $casts = [
        'diagnosis_date' => 'date',
    ];

    /**
     * Get the patient that owns this family medical history
     * Note: Patient is in central database, but we reference by ID only
     */
    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // NOT NULL fields
            ->addField('summary')
            ->addField('relationship_to_patient')
            // Nullable field
            ->addOptionalTextField('details');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Family medical history for patient ID {$this->patient_id} was {$eventName}");
    }
}
