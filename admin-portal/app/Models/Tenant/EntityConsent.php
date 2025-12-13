<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class EntityConsent extends Model
{
    // SoftDeletes trait removed from this model

    protected $connection = 'tenant';

    public $timestamps = false;

    protected $fillable = [
        'consent_version_id',
        'consented_at',
        'consentable_type',
        'consentable_id',
    ];

    protected $casts = [
        'consented_at' => 'datetime',
    ];

    public function consentVersion(): BelongsTo
    {
        return $this->belongsTo(ConsentVersion::class);
    }

    public function consentable(): MorphTo
    {
        return $this->morphTo();
    }
}
