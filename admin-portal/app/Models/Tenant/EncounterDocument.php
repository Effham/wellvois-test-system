<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class EncounterDocument extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'encounter_id',
        'original_name',
        'file_name',
        'file_path',
        's3_key',
        'mime_type',
        'file_size',
        'uploaded_by_type',
        'uploaded_by_id',
        'description',
        'document_type',
        'document_request_id',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationship to the encounter.
     */
    public function encounter(): BelongsTo
    {
        return $this->belongsTo(Encounter::class);
    }

    /**
     * Polymorphic relationship to the user who uploaded the document.
     */
    public function uploadedBy(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Relationship to the user who uploaded the document (when uploaded_by_type is User).
     */
    public function uploadedByUser(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'uploaded_by_id');
    }

    /**
     * Check if the document was uploaded by a user.
     */
    public function isUploadedByUser(): bool
    {
        return $this->uploaded_by_type === \App\Models\User::class;
    }

    /**
     * Relationship to the document request (if this document fulfills a request).
     */
    public function documentRequest(): BelongsTo
    {
        return $this->belongsTo(EncounterDocumentRequest::class, 'document_request_id');
    }

    /**
     * Get human-readable file size.
     */
    public function getFileSizeHumanAttribute(): string
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2).' '.$units[$i];
    }

    /**
     * Get the full file URL.
     */
    public function getFileUrlAttribute(): string
    {
        return asset($this->file_path);
    }

    /**
     * Check if the file is an image.
     */
    public function getIsImageAttribute(): bool
    {
        return strpos($this->mime_type, 'image/') === 0;
    }

    /**
     * Check if the file is a PDF.
     */
    public function getIsPdfAttribute(): bool
    {
        return $this->mime_type === 'application/pdf';
    }

    /**
     * Check if the file is a document (PDF, Word, etc.).
     */
    public function getIsDocumentAttribute(): bool
    {
        return in_array($this->mime_type, [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ]);
    }

    /**
     * Get file extension.
     */
    public function getFileExtensionAttribute(): string
    {
        return pathinfo($this->original_name, PATHINFO_EXTENSION);
    }

    /**
     * Get display name for document type.
     */
    public function getDocumentTypeDisplayAttribute(): string
    {
        return match ($this->document_type) {
            'imaging' => 'Medical Imaging',
            'lab_result' => 'Lab Result',
            'prescription' => 'Prescription',
            'report' => 'Medical Report',
            'consent' => 'Consent Form',
            'additional' => 'Additional Document',
            'other' => 'Other',
            default => 'Unknown',
        };
    }

    /**
     * Generate a consistent file path for storage.
     */
    public static function generateFilePath(int $encounterId, string $filename): string
    {
        return 'tenants/'.tenant('id')."/encounters/{$encounterId}/{$filename}";
    }

    /**
     * Override create method to add S3 key logging
     */
    public static function create(array $attributes = []): static
    {
        if (array_key_exists('s3_key', $attributes)) {
            \Log::info('EncounterDocument::create with S3 key', [
                's3_key' => $attributes['s3_key'],
                'encounter_id' => $attributes['encounter_id'] ?? null,
                'tenant_id' => tenant('id'),
            ]);
        }

        $result = parent::create($attributes);

        if (array_key_exists('s3_key', $attributes)) {
            \Log::info('EncounterDocument::create S3 key result', [
                'document_id' => $result->id ?? 'FAILED',
                'final_s3_key' => $result->s3_key ?? null,
                'success' => ! is_null($result),
            ]);
        }

        return $result;
    }

    /**
     * Boot the model.
     */
    protected static function booted(): void
    {
        static::deleting(function (EncounterDocument $document) {
            // Delete the physical file when the model is deleted
            $fullPath = public_path($document->file_path);
            if (file_exists($fullPath)) {
                unlink($fullPath);
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Document '{$this->original_name}' was {$eventName}");
    }
}
