<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Tenant\Wallet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, LogsActivity, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'patient_id',
        'created_via_public_portal',
        'google2fa_secret',
        'google2fa_enabled',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'created_via_public_portal' => 'boolean',
            'google2fa_enabled' => 'boolean',
        ];
    }

    /**
     * Model boot method - Auto-assign Admin role to first user in tenant
     */
    protected static function booted()
    {
        static::created(function ($user) {
            // Only in tenant context
            if (tenancy()->initialized) {
                // Check if this is the first user
                $userCount = User::count();

                if ($userCount === 1) {
                    try {
                        $adminRole = \Spatie\Permission\Models\Role::where('name', 'Admin')->first();

                        if ($adminRole) {
                            $user->assignRole($adminRole);
                            \Log::info('Auto-assigned Admin role to first tenant user', [
                                'user_id' => $user->id,
                                'email' => $user->email,
                                'tenant_id' => tenant('id'),
                            ]);
                        }
                    } catch (\Exception $e) {
                        \Log::error('Failed to auto-assign Admin role', [
                            'user_id' => $user->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }
        });
    }

    public function tenants()
    {
        return $this->belongsToMany(\App\Models\Tenant::class, 'tenant_user', 'user_id', 'tenant_id');
    }

    /**
     * Get the practitioner associated with this user
     */
    public function practitioner()
    {
        return $this->hasOne(Practitioner::class, 'user_id');
    }

    /**
     * Check if this user can be soft deleted
     * Excludes practitioners, admin, and patients
     */
    public function canBeSoftDeleted(): bool
    {
        // Check if user has protected roles
        $protectedRoles = ['Admin', 'Practitioner', 'Patient'];

        foreach ($protectedRoles as $role) {
            if ($this->hasRole($role)) {
                return false;
            }
        }

        // Additional check - if user has practitioner or patient records
        if ($this->practitioner || $this->patient) {
            return false;
        }

        return true;
    }

    /**
     * Get the patient associated with this user
     */
    public function patient()
    {
        return $this->hasOne(Patient::class, 'user_id');
    }

    /**
     * Get the user integrations for this user
     */
    public function userIntegrations()
    {
        return $this->hasMany(UserIntegration::class, 'user_id');
    }

    /**
     * Scope to only include users that can be soft deleted
     */
    public function scopeCanBeSoftDeleted($query)
    {
        return $query->whereDoesntHave('roles', function ($q) {
            $q->whereIn('name', ['Admin', 'Practitioner', 'Patient']);
        });
    }

    /**
     * Override delete to check if user can be soft deleted
     */
    public function delete()
    {
        if (! $this->canBeSoftDeleted()) {
            throw new \Exception('Cannot delete users with Admin, Practitioner, or Patient roles.');
        }

        return parent::delete();
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontLogIfAttributesChangedOnly(['updated_at', 'remember_token'])
            ->setDescriptionForEvent(fn (string $eventName) => "User {$this->name} was {$eventName}");
    }

    /**
     * Check if user is a practitioner
     * Method 1: Check if user exists in practitioners table (by email match with central DB)
     * Method 2: Check if user has any role containing "practitioner" in the name
     */
    public function isPractitioner(): bool
    {
        // Method 1: Check if user exists in practitioners table
        $centralUserId = null;
        tenancy()->central(function () use (&$centralUserId) {
            $centralUser = \App\Models\User::where('email', $this->email)->first();
            if ($centralUser) {
                $centralUserId = $centralUser->id;
            }
        });

        if ($centralUserId) {
            $practitionerExists = null;
            tenancy()->central(function () use (&$practitionerExists, $centralUserId) {
                $practitionerExists = \App\Models\Practitioner::where('user_id', $centralUserId)->exists();
            });

            if ($practitionerExists) {
                return true;
            }
        }

        // Method 2: Check if any role contains "practitioner" in the name
        return $this->roles()->whereRaw('LOWER(name) LIKE ?', ['%practitioner%'])->exists();
    }

    /**
     * Get user's role names for display
     */
    public function getRoleNamesAttribute(): array
    {
        return $this->roles->pluck('name')->toArray();
    }

    /**
     * Override permission check to bypass when IS_DEVELOPER is true
     */
    public function hasPermissionTo($permission, $guardName = null): bool
    {
        if (config('app.is_developer', false)) {
            return true; // Bypass all permission checks in developer mode
        }

        // Use the original trait implementation
        if ($this->getWildcardClass()) {
            return $this->hasWildcardPermission($permission, $guardName);
        }

        $permission = $this->filterPermission($permission, $guardName);

        return $this->hasDirectPermission($permission) || $this->hasPermissionViaRole($permission);
    }

    /**
     * Override hasAnyPermission to bypass when IS_DEVELOPER is true
     */
    public function hasAnyPermission(...$permissions): bool
    {
        if (config('app.is_developer', false)) {
            return true; // Bypass all permission checks in developer mode
        }

        // Use the original trait implementation
        $permissions = collect($permissions)->flatten();

        foreach ($permissions as $permission) {
            if ($this->checkPermissionTo($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Override Laravel's canAny method to bypass when IS_DEVELOPER is true
     * This is what the Spatie permission middleware actually calls
     */
    public function canAny($abilities, $arguments = []): bool
    {
        if (config('app.is_developer', false)) {
            return true; // Bypass all permission checks in developer mode
        }

        // For permission strings, delegate to hasAnyPermission
        if (is_array($abilities) && count($abilities) > 0 && is_string($abilities[0])) {
            return $this->hasAnyPermission(...$abilities);
        }

        // Fall back to Laravel's default authorization behavior
        return app(\Illuminate\Contracts\Auth\Access\Gate::class)->forUser($this)->any($abilities, $arguments);
    }

    /**
     * Get the wallet associated with this user
     */
    public function wallet()
    {
        return $this->hasOne(Wallet::class, 'owner_id')->where('owner_type', 'user');
    }

    /**
     * Boot method to auto-create wallet when user is created
     */
    protected static function boot()
    {
        parent::boot();

        static::created(function ($user) {
            // Only create wallet if we're in tenant context and wallets table exists
            if (tenancy()->initialized && \Illuminate\Support\Facades\Schema::hasTable('wallets')) {
                try {
                    // Create user wallet with zero balance
                    Wallet::create([
                        'owner_type' => 'user',
                        'owner_id' => $user->id,
                        'balance' => 0.00,
                        'currency' => Wallet::getDefaultCurrency(),
                    ]);
                } catch (\Exception $e) {
                    // Log the error but don't fail user creation
                    \Illuminate\Support\Facades\Log::warning('Failed to create wallet for user', [
                        'user_id' => $user->id,
                        'user_email' => $user->email,
                        'error' => $e->getMessage(),
                        'tenant_initialized' => tenancy()->initialized,
                    ]);
                }
            }
        });
    }
}
