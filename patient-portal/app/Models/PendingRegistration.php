<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class PendingRegistration extends Model
{
    use CentralConnection;

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id',
        'encrypted_token',
        'email',
        'created_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /**
     * Create a new pending registration
     */
    public static function createPending(string $encryptedToken, string $email): self
    {
        $pending = self::create([
            'id' => (string) Str::uuid(),
            'encrypted_token' => $encryptedToken,
            'email' => $email,
            'created_at' => now(),
            'expires_at' => now()->addHours(2), // Expires in 2 hours
        ]);

        \Illuminate\Support\Facades\Log::info('Pending registration created', [
            'id' => $pending->id,
            'email' => $email,
            'expires_at' => $pending->expires_at->toDateTimeString(),
        ]);

        return $pending;
    }

    /**
     * Retrieve and delete pending registration
     */
    public static function consumePending(string $uuid): ?string
    {
        $pending = self::where('id', $uuid)
            ->where('expires_at', '>', now())
            ->first();

        if (! $pending) {
            \Illuminate\Support\Facades\Log::warning('Pending registration not found or expired', [
                'id' => $uuid,
            ]);

            return null;
        }

        $token = $pending->encrypted_token;
        $pending->delete();

        \Illuminate\Support\Facades\Log::info('Pending registration consumed', [
            'id' => $uuid,
            'email' => $pending->email,
        ]);

        return $token;
    }

    /**
     * Clean up expired registrations
     */
    public static function cleanupExpired(): int
    {
        $count = self::where('expires_at', '<', now())->count();
        $deleted = self::where('expires_at', '<', now())->delete();

        if ($deleted > 0) {
            \Illuminate\Support\Facades\Log::info('Cleaned up expired pending registrations', [
                'count' => $deleted,
            ]);
        }

        return $deleted;
    }
}
