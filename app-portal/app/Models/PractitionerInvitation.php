<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class PractitionerInvitation extends Model
{
    use CentralConnection, LogsActivity;

    protected $fillable = [
        'tenant_id',
        'practitioner_id',
        'email',
        'token',
        'status',
        'expires_at',
        'sent_at',
        'accepted_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'sent_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    /**
     * Get the practitioner that was invited (nullable for email-only invitations)
     */
    public function practitioner(): BelongsTo
    {
        return $this->belongsTo(Practitioner::class);
    }

    /**
     * Check if this is an email-only invitation (practitioner doesn't exist yet)
     */
    public function isEmailOnlyInvitation(): bool
    {
        return is_null($this->practitioner_id);
    }

    /**
     * Get the tenant that sent the invitation
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id', 'id');
    }

    /**
     * Check if the invitation has expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Check if the invitation is pending
     */
    public function isPending(): bool
    {
        return $this->status === 'pending' && ! $this->isExpired();
    }

    /**
     * Generate a unique token for the invitation
     */
    public static function generateToken(): string
    {
        do {
            $token = Str::random(32);
        } while (self::where('token', $token)->exists());

        return $token;
    }

    /**
     * Accept the invitation
     */
    public function accept(): void
    {
        $this->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);
    }

    /**
     * Mark invitation as expired
     */
    public function markAsExpired(): void
    {
        $this->update(['status' => 'expired']);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Practitioner invitation to {$this->email} was {$eventName}");
    }
}
