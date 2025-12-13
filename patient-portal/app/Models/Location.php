<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Location extends Model
{
    use LogsActivity, SoftDeletes;

    protected $fillable = [
        'name',
        'timezone',
        'address_lookup',
        'street_address',
        'apt_suite_unit',
        'city',
        'postal_zip_code',
        'province',
        'phone_number',
        'email_address',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Boot the model and add event listeners for timezone changes and validation
     */
    protected static function boot()
    {
        parent::boot();

        // Validate timezone before saving
        static::saving(function ($location) {
            if ($location->timezone) {
                try {
                    new \DateTimeZone($location->timezone);
                } catch (\Exception $e) {
                    throw new \InvalidArgumentException("Invalid timezone: {$location->timezone}");
                }
            }
        });

        // Log timezone changes (no migration needed with simplified approach)
        static::updating(function ($location) {
            if ($location->isDirty('timezone')) {
                \Log::info('Location timezone changed', [
                    'location_id' => $location->id,
                    'from_timezone' => $location->getOriginal('timezone'),
                    'to_timezone' => $location->timezone,
                    'tenant_id' => tenant('id'),
                ]);
            }
        });
    }

    /**
     * Get timezone offset string for this location
     */
    public function getTimezoneOffset(): string
    {
        if (! $this->timezone) {
            return '+00:00';
        }

        try {
            $dt = \Carbon\Carbon::now($this->timezone);

            return $dt->format('P');
        } catch (\Exception $e) {
            return '+00:00';
        }
    }

    /**
     * Get timezone abbreviation for this location
     */
    public function getTimezoneAbbreviation(): string
    {
        $abbreviations = [
            'America/Toronto' => 'EST/EDT',
            'America/New_York' => 'EST/EDT',
            'America/Chicago' => 'CST/CDT',
            'America/Denver' => 'MST/MDT',
            'America/Vancouver' => 'PST/PDT',
            'America/Los_Angeles' => 'PST/PDT',
            'UTC' => 'UTC',
        ];

        return $abbreviations[$this->timezone] ?? $this->timezone;
    }

    /**
     * Get current time in this location's timezone
     */
    public function getCurrentTime(): \Carbon\Carbon
    {
        return \Carbon\Carbon::now($this->timezone);
    }

    /**
     * Convert UTC datetime to this location's timezone
     */
    public function convertFromUTC(\Carbon\Carbon $utcDateTime): \Carbon\Carbon
    {
        return \App\Services\SimpleTimezoneService::toLocal($utcDateTime, $this->id);
    }

    /**
     * Convert datetime in this location's timezone to UTC
     */
    public function convertToUTC(string $datetime): \Carbon\Carbon
    {
        return \App\Services\SimpleTimezoneService::toUTC($datetime, $this->id);
    }

    /**
     * Get the practitioners assigned to this location
     */
    public function practitioners(): BelongsToMany
    {
        return $this->belongsToMany(Practitioner::class, 'location_practitioners')
            ->withPivot('is_assigned')
            ->withTimestamps();
    }

    /**
     * Get only assigned practitioners for this location
     */
    public function assignedPractitioners(): BelongsToMany
    {
        return $this->practitioners()->wherePivot('is_assigned', true);
    }

    /**
     * Scope for active locations
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get the full address as a formatted string
     */
    public function getFullAddressAttribute(): string
    {
        $address = $this->street_address;

        if ($this->apt_suite_unit) {
            $address .= ', '.$this->apt_suite_unit;
        }

        $address .= ', '.$this->city.', '.$this->province.' '.$this->postal_zip_code;

        return $address;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Location '{$this->name}' was {$eventName}");
    }
}
