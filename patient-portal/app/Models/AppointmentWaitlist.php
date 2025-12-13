<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentWaitlist extends Model
{
    protected $fillable = [
        'patient_id',
        'preferred_day',
        'preferred_time',
        'original_requested_date',
        'status',
        'appointment_id',
        'offered_at',
        'expires_at',
        'acceptance_token',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'offered_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Tenant\Appointment::class);
    }

    /**
     * Check if the waiting list entry has expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    /**
     * Check if the waiting list entry has a valid offer token and not expired
     */
    public function isValidOffer(): bool
    {
        return $this->status === 'waiting' && $this->acceptance_token && ! $this->isExpired();
    }

    /**
     * Generate a unique acceptance token
     */
    public function generateAcceptanceToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    /**
     * Scope to get active waiting list entries
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'waiting');
    }

    /**
     * Scope to get entries that match a specific day and time
     */
    public function scopeMatchingSlot($query, string $dayOfWeek, string $timeSlot)
    {
        return $query->where(function ($q) use ($dayOfWeek) {
            $q->where('preferred_day', $dayOfWeek)
                ->orWhere('preferred_day', 'any');
        })->where(function ($q) use ($timeSlot) {
            $q->where('preferred_time', $timeSlot)
                ->orWhere('preferred_time', 'any');
        });
    }
}
