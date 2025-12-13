<?php

namespace App\Models\Tenant;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class RegisterFromPublicPortal extends Model
{
    use LogsActivity;

    protected $table = 'register_from_public_portal';

    protected $fillable = [
        'patient_id',
        'user_id',
        'registered_at',
    ];

    protected function casts(): array
    {
        return [
            'registered_at' => 'datetime',
        ];
    }

    /**
     * Get the user - handled manually in controller due to cross-database limitations
     */
    public function user()
    {
        return null;
    }

    /**
     * Get the patient - handled manually in controller due to cross-database limitations
     */
    public function patient()
    {
        return null;
    }

    /**
     * Helper method to get user data from tenant database
     */
    public function getUserData()
    {
        return User::find($this->user_id);
    }

    /**
     * Helper method to get patient data from central database
     */
    public function getPatientData()
    {
        return tenancy()->central(function () {
            return \App\Models\Patient::find($this->patient_id);
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Public portal registration for patient ID {$this->patient_id} was {$eventName}");
    }
}
