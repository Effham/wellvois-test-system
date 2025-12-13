<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use ParagonIE\CipherSweet\BlindIndex;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class Note extends Model implements CipherSweetEncrypted
{
    use LogsActivity, UsesCipherSweet;

    protected $fillable = [
        'user_id',
        'title',
        'content',
        'priority',
        'tags',
        'sort_order',
    ];

    protected $casts = [
        'tags' => 'array',
        'sort_order' => 'integer',
    ];

    /**
     * Configure CipherSweet encryption for note fields
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // Nullable field with blind index for search
            ->addOptionalTextField('content')
            ->addBlindIndex('content', new BlindIndex('content_index'));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Note '{$this->title}' was {$eventName}");
    }

    /**
     * Get the user that owns the note
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    /**
     * Scope to get notes for the current user
     */
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to order by creation date
     */
    public function scopeLatest($query)
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Scope to order by sort order
     */
    public function scopeOrderedBySortOrder($query)
    {
        return $query->orderBy('sort_order');
    }
}
