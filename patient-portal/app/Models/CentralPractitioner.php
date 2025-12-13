<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * Central Practitioner model - for accessing practitioners in the central database
 * This model has the tenants() relationship and is used in central controllers
 */
class CentralPractitioner extends Practitioner
{
    use CentralConnection;

    /**
     * The table associated with the model.
     * Must explicitly set since Laravel would derive 'central_practitioners' from class name
     */
    protected $table = 'practitioners';

    /**
     * Get the tenants this practitioner is assigned to
     */
    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(
            Tenant::class,
            'tenant_practitioners',
            'practitioner_id',
            'tenant_id'
        )->withPivot('invitation_status', 'invited_at', 'accepted_at')
            ->withTimestamps();
    }
}
