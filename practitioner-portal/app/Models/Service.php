<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Service extends Model
{
    use LogsActivity, SoftDeletes;

    protected $fillable = [
        'name',
        'category',
        'description',
        'delivery_modes',

        'default_price',
        'currency',
        'is_active',
    ];

    protected $casts = [
        'delivery_modes' => 'array',

        'default_price' => 'decimal:2',
        'is_active' => 'boolean',
        'delivery_modes' => 'array',
    ];

    public function practitioners()
    {
        return $this->belongsToMany(
            \App\Models\Practitioner::class,
            'practitioner_services',
            'service_id',
            'practitioner_id'
        )->withPivot(['custom_price', 'is_offered']);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Service '{$this->name}' was {$eventName}");
    }
}
