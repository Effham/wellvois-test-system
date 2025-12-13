<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PractitionerRating extends Model
{
    protected $table = 'practitioner_ratings';

    protected $fillable = [
        'appointment_id',
        'practitioner_id',
        'patient_id',
        'rating_points',
        'rating_percentage',
        'is_lead_practitioner',
        'is_called_out',
        'notes',
    ];

    protected $casts = [
        'rating_points' => 'decimal:2',
        'rating_percentage' => 'decimal:2',
        'is_lead_practitioner' => 'boolean',
        'is_called_out' => 'boolean',
    ];

    /**
     * Get the appointment this rating belongs to
     */
    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    /**
     * Get the appointment feedback this rating belongs to
     */
    public function appointmentFeedback(): BelongsTo
    {
        return $this->belongsTo(AppointmentFeedback::class, 'appointment_id', 'appointment_id');
    }

    /**
     * Get practitioner data from central database
     */
    public function getPractitionerData()
    {
        return tenancy()->central(function () {
            return \App\Models\Practitioner::find($this->practitioner_id);
        });
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
     * Scope for lead practitioners
     */
    public function scopeLeadPractitioners(Builder $query): Builder
    {
        return $query->where('is_lead_practitioner', true);
    }

    /**
     * Scope for called out practitioners
     */
    public function scopeCalledOut(Builder $query): Builder
    {
        return $query->where('is_called_out', true);
    }

    /**
     * Scope for a specific practitioner
     */
    public function scopeForPractitioner(Builder $query, int $practitionerId): Builder
    {
        return $query->where('practitioner_id', $practitionerId);
    }

    /**
     * Get average rating for a practitioner
     */
    public static function getAverageRatingForPractitioner(int $practitionerId): float
    {
        return static::forPractitioner($practitionerId)
            ->avg('rating_points') ?? 0.0;
    }

    /**
     * Get total ratings count for a practitioner
     */
    public static function getTotalRatingsForPractitioner(int $practitionerId): int
    {
        return static::forPractitioner($practitionerId)->count();
    }

    /**
     * Get percentage distribution of ratings for a practitioner
     */
    public static function getRatingDistributionForPractitioner(int $practitionerId): array
    {
        $ratings = static::forPractitioner($practitionerId)
            ->selectRaw('ROUND(rating_points) as rating, COUNT(*) as count')
            ->groupBy('rating')
            ->orderBy('rating')
            ->get()
            ->pluck('count', 'rating')
            ->toArray();

        // Ensure all rating levels are represented
        $distribution = [];
        for ($i = 1; $i <= 5; $i++) {
            $distribution[$i] = $ratings[$i] ?? 0;
        }

        return $distribution;
    }
}
