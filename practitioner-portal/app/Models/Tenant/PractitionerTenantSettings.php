<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class PractitionerTenantSettings extends Model
{
    use LogsActivity;

    /**
     * The table associated with the model.
     */
    protected $table = 'practitioner_tenant_settings';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'practitioner_id',
        'available_days',
        'is_active',
        'settings',
    ];

    /**
     * The attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'available_days' => 'array',
            'settings' => 'array',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get the practitioner that owns the settings (from central database).
     */
    public function practitioner()
    {
        return tenancy()->central(function () {
            return \App\Models\Practitioner::find($this->practitioner_id);
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Practitioner tenant settings for practitioner ID {$this->practitioner_id} was {$eventName}");
    }
}
