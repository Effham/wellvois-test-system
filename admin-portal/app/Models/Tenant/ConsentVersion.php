<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConsentVersion extends Model
{
    protected $connection = 'tenant';

    protected $fillable = [
        'consent_id',
        'version',
        'consent_body',
        'status',
    ];

    protected $casts = [
        'consent_body' => 'array',
    ];

    public function consent(): BelongsTo
    {
        return $this->belongsTo(Consent::class);
    }

    public function entityConsents(): HasMany
    {
        return $this->hasMany(EntityConsent::class);
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($version) {
            if (! $version->version) {
                $lastVersion = static::where('consent_id', $version->consent_id)
                    ->max('version');
                $version->version = ($lastVersion ?? 0) + 1;
            }
        });

        static::saving(function ($version) {
            if ($version->status === 'ACTIVE') {
                // Deactivate all other versions of the same consent
                static::where('consent_id', $version->consent_id)
                    ->where('id', '!=', $version->id)
                    ->update(['status' => 'INACTIVE']);
            }
        });

        static::updating(function ($version) {
            // Prevent deactivating the last active version
            if ($version->isDirty('status') && $version->status === 'INACTIVE') {
                $activeVersionsCount = static::where('consent_id', $version->consent_id)
                    ->where('status', 'ACTIVE')
                    ->where('id', '!=', $version->id)
                    ->count();

                if ($activeVersionsCount === 0) {
                    throw new \Exception('Cannot deactivate the last active version. At least one version must remain active.');
                }
            }
        });
    }
}
