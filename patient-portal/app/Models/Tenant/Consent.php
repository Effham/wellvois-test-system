<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes; // <-- CORRECTED IMPORT

class Consent extends Model
{
    use SoftDeletes; // <-- The trait is used here

    protected $connection = 'tenant';

    protected $fillable = [
        'key',
        'title',
        'entity_type',
        'is_required',
        'trigger_points',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'trigger_points' => 'array',
        ];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(ConsentVersion::class);
    }

    public function activeVersion(): HasOne
    {
        return $this->hasOne(ConsentVersion::class)->where('status', 'ACTIVE');
    }

    public function entityConsents(): HasManyThrough
    {
        return $this->hasManyThrough(EntityConsent::class, ConsentVersion::class);
    }

    public function scopeWithActiveVersion($query)
    {
        return $query->with('activeVersion');
    }

    public function scopeRequired($query)
    {
        return $query->where('is_required', true);
    }

    public static function patientHasAcceptedAllRequired($patient): bool
    {
        // When querying from Consent, only non-archived consents (where deleted_at is null) are returned by default.
        $requiredConsents = self::where('entity_type', 'PATIENT')
            ->where('is_required', true)
            ->withActiveVersion()
            ->get();

        foreach ($requiredConsents as $consent) {
            if (! $consent->activeVersion) {
                continue;
            }

            $hasAccepted = EntityConsent::where('consentable_type', get_class($patient))
                ->where('consentable_id', $patient->id)
                ->where('consent_version_id', $consent->activeVersion->id)
                ->exists();

            if (! $hasAccepted) {
                return false;
            }
        }

        return true;
    }
}
