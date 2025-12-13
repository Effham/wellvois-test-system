<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AppointmentFeedback extends Model
{
    protected $table = 'appointment_feedback';

    protected $fillable = [
        'appointment_id',
        'patient_id',
        'visit_rating',
        'visit_led_by_id',
        'call_out_person_id',
        'additional_feedback',
        'is_editable',
        'submitted_at',
        'last_edited_at',
    ];

    protected $casts = [
        'is_editable' => 'boolean',
        'submitted_at' => 'datetime',
        'last_edited_at' => 'datetime',
        'visit_rating' => 'integer',
    ];

    /**
     * Get the appointment this feedback belongs to
     */
    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    /**
     * Get the practitioner ratings for this feedback
     */
    public function practitionerRatings(): HasMany
    {
        return $this->hasMany(PractitionerRating::class, 'appointment_id', 'appointment_id');
    }

    /**
     * Get patient data from central database
     */
    public function getPatientData()
    {
        return tenancy()->central(function () {
            return \App\Models\Patient::find($this->patient_id);
        });
    }

    /**
     * Mark feedback as submitted if not already
     */
    public function markAsSubmitted(): void
    {
        if (! $this->submitted_at) {
            $this->update([
                'submitted_at' => now(),
                'last_edited_at' => now(),
            ]);
        } else {
            $this->update(['last_edited_at' => now()]);
        }
    }

    /**
     * Check if feedback can be edited (within 24 hours of submission)
     */
    public function canBeEdited(): bool
    {
        if (! $this->is_editable || ! $this->submitted_at) {
            return $this->is_editable;
        }

        // Allow editing within 24 hours of submission
        return $this->submitted_at->diffInHours(now()) < 24;
    }

    /**
     * Disable editing for this feedback
     */
    public function disableEditing(): void
    {
        $this->update(['is_editable' => false]);
    }
}
