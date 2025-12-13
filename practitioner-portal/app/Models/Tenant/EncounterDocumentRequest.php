<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class EncounterDocumentRequest extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'encounter_id',
        'document_type',
        'title',
        'description',
        'priority',
        'by_practitioner',
        'status',
        'requested_by_id',
        'requested_at',
        'fulfilled_at',
        'fulfilled_by_document_id',
        'notes',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'fulfilled_at' => 'datetime',
        'by_practitioner' => 'boolean',
    ];

    /**
     * Get the encounter this request belongs to.
     */
    public function encounter(): BelongsTo
    {
        return $this->belongsTo(Encounter::class);
    }

    /**
     * Relationship to the document that fulfills this request (primary).
     */
    public function fulfilledByDocument(): BelongsTo
    {
        return $this->belongsTo(EncounterDocument::class, 'fulfilled_by_document_id');
    }

    /**
     * Relationship to all documents linked to this request.
     */
    public function linkedDocuments(): HasMany
    {
        return $this->hasMany(EncounterDocument::class, 'document_request_id');
    }

    /**
     * Relationship to the user who requested this document.
     */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'requested_by_id');
    }

    /**
     * Check if the request is pending.
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if the request is fulfilled.
     */
    public function isFulfilled(): bool
    {
        return $this->status === 'fulfilled' || $this->linkedDocuments()->exists();
    }

    /**
     * Mark the request as fulfilled.
     */
    public function markAsFulfilled(int $documentId): void
    {
        $this->update([
            'status' => 'fulfilled',
            'fulfilled_at' => now(),
            'fulfilled_by_document_id' => $documentId,
        ]);
    }

    /**
     * Get priority color for UI.
     */
    public function getPriorityColorAttribute(): string
    {
        return match ($this->priority) {
            'urgent' => 'bg-red-100 text-red-800',
            'high' => 'bg-orange-100 text-orange-800',
            'normal' => 'bg-blue-100 text-blue-800',
            'low' => 'bg-gray-100 text-gray-800',
            default => 'bg-gray-100 text-gray-800',
        };
    }

    /**
     * Get document type display name.
     */
    public function getDocumentTypeDisplayAttribute(): string
    {
        return match ($this->document_type) {
            'lab_result' => 'Lab Result',
            'imaging' => 'Imaging',
            'prescription' => 'Prescription',
            'report' => 'Clinical Note/Report',
            'consent' => 'Consent Form',
            'additional' => 'Additional Documents',
            'other' => 'Other',
            default => ucfirst(str_replace('_', ' ', $this->document_type)),
        };
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Document request '{$this->title}' was {$eventName}");
    }
}
