<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class PractitionerPortalAvailability extends Model
{
    use LogsActivity;

    /**
     * The table associated with the model.
     */
    protected $table = 'practitioner_portal_availability';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'practitioner_id',
        'location_id',
        'day',
        'start_time',
        'end_time',
        'is_enabled',
        'notes',
    ];

    /**
     * The attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
        ];
    }

    /**
     * Get the practitioner that owns the availability (from central database).
     */
    public function practitioner()
    {
        return tenancy()->central(function () {
            return \App\Models\Practitioner::find($this->practitioner_id);
        });
    }

    /**
     * Get the location that owns the availability.
     */
    public function location()
    {
        return $this->belongsTo(\App\Models\Location::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Practitioner portal availability for practitioner ID {$this->practitioner_id} was {$eventName}");
    }
}
