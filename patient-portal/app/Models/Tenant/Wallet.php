<?php

namespace App\Models\Tenant;

use App\Models\Practitioner;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Wallet extends Model
{
    protected $fillable = [
        'owner_type',
        'owner_id',
        'balance',
        'singleton_key',
        'currency',
    ];

    protected $casts = [
        'balance' => 'decimal:4',
    ];

    /**
     * Get the polymorphic owner of the wallet (system, patient, practitioner, or user)
     */
    public function owner(): MorphTo
    {
        return $this->morphTo('owner', 'owner_type', 'owner_id');
    }

    /**
     * DEPRECATED: Use owner() morphTo relationship instead
     * Get the user that owns the wallet
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * Get all transactions where this wallet is the sender
     */
    public function outgoingTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'from_wallet_id');
    }

    /**
     * Get all transactions where this wallet is the receiver
     */
    public function incomingTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'to_wallet_id');
    }

    /**
     * Get all transactions for this wallet (both incoming and outgoing)
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'to_wallet_id');
    }

    /**
     * Scope for system (clinic) wallet
     */
    public function scopeSystem($query)
    {
        return $query->where('owner_type', 'system')
            ->whereNull('owner_id')
            ->where('singleton_key', 1);
    }

    /**
     * DEPRECATED: Use scopeSystem instead
     * Scope for clinic wallet
     */
    public function scopeClinic($query)
    {
        return $query->where('owner_type', 'system')->where('singleton_key', 1);
    }

    /**
     * Scope for user wallets
     */
    public function scopeUser($query)
    {
        return $query->where('owner_type', 'user');
    }

    /**
     * Scope for patient wallets
     */
    public function scopePatient($query)
    {
        return $query->where('owner_type', 'patient');
    }

    /**
     * Scope for practitioner wallets
     */
    public function scopePractitioner($query)
    {
        return $query->where('owner_type', 'practitioner');
    }

    /**
     * Scope to find wallet by owner
     */
    public function scopeForOwner($query, string $ownerType, ?int $ownerId)
    {
        return $query->where('owner_type', $ownerType)
            ->where('owner_id', $ownerId);
    }

    /**
     * DEPRECATED: Use WalletService instead
     * Add a credit transaction and update balance
     */
    public function addCredit(float $amount, Model $accountable): Transaction
    {
        throw new \Exception('addCredit is deprecated. Use WalletService for transaction management.');
    }

    /**
     * DEPRECATED: Use WalletService instead
     * Add a debit transaction and update balance
     */
    public function addDebit(float $amount, Model $accountable): Transaction
    {
        throw new \Exception('addDebit is deprecated. Use WalletService for transaction management.');
    }

    /**
     * Get the current balance
     */
    public function getCurrentBalance(): float
    {
        return (float) $this->balance;
    }

    /**
     * Recalculate balance from transactions
     */
    public function recalculateBalance(): void
    {
        $incoming = Transaction::where('to_wallet_id', $this->id)
            ->where('status', 'completed')
            ->sum('amount');

        $outgoing = Transaction::where('from_wallet_id', $this->id)
            ->where('status', 'completed')
            ->sum('amount');

        $this->update(['balance' => $incoming - $outgoing]);
    }

    /**
     * Get total earnings (all incoming transactions)
     */
    public function getTotalEarnings(): float
    {
        return (float) Transaction::where('to_wallet_id', $this->id)
            ->where('status', 'completed')
            ->sum('amount');
    }

    /**
     * Get pending balance (transactions in pending status)
     */
    public function getPendingBalance(): float
    {
        return (float) Transaction::where('to_wallet_id', $this->id)
            ->where('status', 'pending')
            ->sum('amount');
    }

    /**
     * Get revenue for a specific month
     */
    public function getRevenueForMonth(\DateTimeInterface $date): float
    {
        $startOfMonth = \Carbon\Carbon::parse($date)->startOfMonth();
        $endOfMonth = \Carbon\Carbon::parse($date)->endOfMonth();

        return (float) Transaction::where('to_wallet_id', $this->id)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
            ->sum('amount');
    }

    /**
     * Get total number of transactions (incoming completed transactions)
     */
    public function getTotalTransactions(): int
    {
        return Transaction::where('to_wallet_id', $this->id)
            ->where('status', 'completed')
            ->count();
    }

    /**
     * @deprecated Use getTotalTransactions instead
     */
    public function getTotalAppointments(): int
    {
        return $this->getTotalTransactions();
    }

    /**
     * Get average earning per appointment
     */
    public function getAveragePerAppointment(): float
    {
        $total = $this->getTotalAppointments();

        if ($total === 0) {
            return 0.0;
        }

        return $this->getTotalEarnings() / $total;
    }

    /**
     * Get wallet statistics
     */
    public function getStatistics(): array
    {
        $now = now();
        $revenueThisMonth = $this->getRevenueForMonth($now);
        $revenueLastMonth = $this->getRevenueForMonth($now->copy()->subMonth());

        return [
            'total_appointments' => $this->getTotalAppointments(),
            'revenue_this_month' => $revenueThisMonth,
            'revenue_last_month' => $revenueLastMonth,
            'average_per_appointment' => $this->getAveragePerAppointment(),
        ];
    }

    /**
     * Get default currency from accounting settings
     */
    protected static function getDefaultCurrency(): string
    {
        return \App\Models\OrganizationSetting::getValue('accounting_currency', 'CAD');
    }

    /**
     * Static helper: Get or create system (clinic) wallet
     */
    public static function getSystemWallet(): self
    {
        return static::firstOrCreate(
            ['owner_type' => 'system', 'owner_id' => null, 'singleton_key' => 1],
            ['balance' => 0.0000, 'currency' => static::getDefaultCurrency()]
        );
    }

    /**
     * Static helper: Get or create wallet for a patient
     */
    public static function getOrCreatePatientWallet(int $patientId): self
    {
        return static::firstOrCreate(
            ['owner_type' => 'patient', 'owner_id' => $patientId],
            ['balance' => 0.0000, 'currency' => static::getDefaultCurrency(), 'singleton_key' => null]
        );
    }

    /**
     * Static helper: Get or create wallet for a practitioner
     */
    public static function getOrCreatePractitionerWallet(int $practitionerId): self
    {
        return static::firstOrCreate(
            ['owner_type' => 'practitioner', 'owner_id' => $practitionerId],
            ['balance' => 0.0000, 'currency' => static::getDefaultCurrency(), 'singleton_key' => null]
        );
    }

    /**
     * Static helper: Get or create wallet for a user
     */
    public static function getOrCreateUserWallet(int $userId): self
    {
        return static::firstOrCreate(
            ['owner_type' => 'user', 'owner_id' => $userId],
            ['balance' => 0.0000, 'currency' => static::getDefaultCurrency(), 'singleton_key' => null]
        );
    }

    /**
     * Check if this is the system (clinic) wallet
     */
    public function isSystemWallet(): bool
    {
        return $this->owner_type === 'system' && $this->owner_id === null;
    }

    /**
     * Check if this is a patient wallet
     */
    public function isPatientWallet(): bool
    {
        return $this->owner_type === 'patient';
    }

    /**
     * Check if this is a practitioner wallet
     */
    public function isPractitionerWallet(): bool
    {
        return $this->owner_type === 'practitioner';
    }

    /**
     * Check if this is a user wallet
     */
    public function isUserWallet(): bool
    {
        return $this->owner_type === 'user';
    }
}
