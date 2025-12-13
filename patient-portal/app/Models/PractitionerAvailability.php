<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PractitionerAvailability extends Model
{
    protected $table = 'practitioner_availability';

    protected $fillable = [
        'practitioner_id',
        'location_id',
        'day',
        'start_time',
        'end_time',
    ];

    protected $casts = [
        'start_time' => 'string',
        'end_time' => 'string',
    ];

    /**
     * Get the practitioner (from central database)
     */
    public function practitioner(): BelongsTo
    {
        return $this->belongsTo(Practitioner::class);
    }

    /**
     * Get the location
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * Scope for specific day
     */
    public function scopeForDay($query, string $day)
    {
        return $query->where('day', $day);
    }

    /**
     * Scope for specific practitioner and location
     */
    public function scopeForPractitionerAndLocation($query, int $practitionerId, int $locationId)
    {
        return $query->where('practitioner_id', $practitionerId)
            ->where('location_id', $locationId);
    }
}
