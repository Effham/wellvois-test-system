<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class EncounterRecording extends Model implements CipherSweetEncrypted
{
    use HasFactory, LogsActivity, UsesCipherSweet;

    protected $fillable = [
        'encounter_id',
        's3_key',
        'file_name',
        'mime_type',
        'file_size',
        'duration_seconds',
        'metadata',
        'transcription_status',
        'transcription',
        'transcription_timestamps',
        'transcription_speaker_segments',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'duration_seconds' => 'integer',
            'metadata' => 'array',
            'transcription_status' => 'string',
            // Note: transcription_timestamps and transcription_speaker_segments are NOT cast as 'array'
            // We handle JSON encoding/decoding manually to work properly with CipherSweet encryption
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * Relationship to the encounter.
     */
    public function encounter(): BelongsTo
    {
        return $this->belongsTo(Encounter::class);
    }

    /**
     * Accessor for transcription_timestamps - decrypt and decode JSON
     * CipherSweet handles decryption automatically, we decode JSON to array
     */
    public function getTranscriptionTimestampsAttribute($value)
    {
        // Get raw attribute value (CipherSweet decrypts automatically)
        $rawValue = $this->getAttributeFromArray('transcription_timestamps');

        if ($rawValue === null) {
            return null;
        }

        // If already decoded as array, return it
        if (is_array($rawValue)) {
            return $rawValue;
        }

        // Decode JSON string to array
        if (is_string($rawValue)) {
            $decoded = json_decode($rawValue, true);

            return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        return null;
    }

    /**
     * Mutator for transcription_timestamps - encode JSON before CipherSweet encryption
     */
    public function setTranscriptionTimestampsAttribute($value): void
    {
        if ($value === null) {
            $this->attributes['transcription_timestamps'] = null;
        } elseif (is_array($value)) {
            // Encode array to JSON string - CipherSweet will encrypt this string
            // Even empty arrays will be encoded as "[]" to ensure they're saved
            $this->attributes['transcription_timestamps'] = json_encode($value);
        } elseif (is_string($value)) {
            // Already a JSON string, use as-is
            $this->attributes['transcription_timestamps'] = $value;
        } else {
            $this->attributes['transcription_timestamps'] = null;
        }
    }

    /**
     * Accessor for transcription_speaker_segments - decrypt and decode JSON
     * CipherSweet handles decryption automatically, we decode JSON to array
     */
    public function getTranscriptionSpeakerSegmentsAttribute($value)
    {
        // Get raw attribute value (CipherSweet decrypts automatically)
        $rawValue = $this->getAttributeFromArray('transcription_speaker_segments');

        if ($rawValue === null) {
            return null;
        }

        // If already decoded as array, return it
        if (is_array($rawValue)) {
            return $rawValue;
        }

        // Decode JSON string to array
        if (is_string($rawValue)) {
            $decoded = json_decode($rawValue, true);

            return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        return null;
    }

    /**
     * Mutator for transcription_speaker_segments - encode JSON before CipherSweet encryption
     */
    public function setTranscriptionSpeakerSegmentsAttribute($value): void
    {
        if ($value === null) {
            $this->attributes['transcription_speaker_segments'] = null;
        } elseif (is_array($value)) {
            // Encode array to JSON string - CipherSweet will encrypt this string
            // Even empty arrays will be encoded as "[]" to ensure they're saved
            $this->attributes['transcription_speaker_segments'] = json_encode($value);
        } elseif (is_string($value)) {
            // Already a JSON string, use as-is
            $this->attributes['transcription_speaker_segments'] = $value;
        } else {
            $this->attributes['transcription_speaker_segments'] = null;
        }
    }

    /**
     * Configure CipherSweet encryption for sensitive recording fields
     * Encrypts file identifiers, transcription data including text, timestamps, and speaker segments
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // File identifiers (encrypted but not searchable)
            ->addOptionalTextField('s3_key')
            ->addOptionalTextField('file_name')

            // Transcription text (nullable longText)
            ->addOptionalTextField('transcription')

            // Transcription timestamps (nullable JSON array - encrypted as JSON string)
            ->addOptionalTextField('transcription_timestamps')

            // Speaker-segmented transcription (nullable JSON array - encrypted as JSON string)
            ->addOptionalTextField('transcription_speaker_segments');
    }

    /**
     * Get human-readable file size.
     */
    public function getFileSizeHumanAttribute(): string
    {
        $bytes = $this->file_size ?? 0;
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;

        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2).' '.$units[$i];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Encounter recording for encounter ID {$this->encounter_id} was {$eventName}");
    }
}
