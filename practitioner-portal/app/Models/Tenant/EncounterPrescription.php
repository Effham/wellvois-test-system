<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use ParagonIE\CipherSweet\BlindIndex;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class EncounterPrescription extends Model implements CipherSweetEncrypted
{
    use HasFactory, LogsActivity, UsesCipherSweet;

    protected $fillable = [
        'encounter_id',
        'medicine_name',
        'dosage',
        'frequency',
        'duration',
        'instructions',
    ];

    /**
     * Get the encounter that owns this prescription.
     */
    public function encounter(): BelongsTo
    {
        return $this->belongsTo(Encounter::class);
    }

    /**
     * Configure CipherSweet encryption for prescription fields
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // Field with blind index (searchable) - NOT NULL
            ->addField('medicine_name')
            ->addBlindIndex('medicine_name', new BlindIndex('medicine_name_index'))

            // Fields without blind indexes (not searchable, but encrypted) - all nullable
            ->addOptionalTextField('dosage')
            ->addOptionalTextField('frequency')
            ->addOptionalTextField('duration')
            ->addOptionalTextField('instructions');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Prescription '{$this->medicine_name}' was {$eventName}");
    }
}
