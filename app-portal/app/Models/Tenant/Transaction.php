<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    protected $fillable = [
        'from_wallet_id',
        'to_wallet_id',
        'invoice_id',
        'amount',
        'type',
        'direction_source',
        'payment_method',
        'provider_ref',
        'payment_proof_url',
        'status',
        'idempotency_key',
        'meta',
    ];

    protected $casts = [
        'amount' => 'decimal:4',
        'meta' => 'array',
    ];

    /**
     * Get the wallet that sent the funds
     */
    public function fromWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'from_wallet_id');
    }

    /**
     * Get the wallet that received the funds
     */
    public function toWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'to_wallet_id');
    }

    /**
     * Get the invoice associated with this transaction
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoices::class, 'invoice_id');
    }

    /**
     * Scope for invoice payment transactions
     */
    public function scopeInvoicePayments($query)
    {
        return $query->where('type', 'invoice_payment');
    }

    /**
     * Scope for payout transactions
     */
    public function scopePayouts($query)
    {
        return $query->where('type', 'payout');
    }

    /**
     * Scope for completed transactions
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope for pending transactions
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Get formatted amount with currency
     */
    public function getFormattedAmountAttribute(): string
    {
        return '$'.number_format($this->amount, 2);
    }

    /**
     * Check if transaction is completed
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Check if transaction is pending
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if transaction is failed
     */
    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    /**
     * Generate idempotency key from payment provider reference
     */
    public static function generateIdempotencyKey(?string $providerRef = null, ?int $invoiceId = null, ?int $fromWalletId = null, ?string $attemptId = null): string
    {
        if ($providerRef) {
            return "provider:{$providerRef}";
        }

        if ($invoiceId && $fromWalletId && $attemptId) {
            return "inv:{$invoiceId}|payer:{$fromWalletId}|attempt:{$attemptId}";
        }

        // Fallback to unique ID
        return 'txn:'.uniqid('', true);
    }

    /**
     * Validate that transaction follows the required rules
     */
    public function validateTransactionRules(): void
    {
        // Rule: Positive amounts only
        if ($this->amount <= 0) {
            throw new \InvalidArgumentException('Transaction amount must be positive');
        }

        // Rule: Internal transfers must have both wallets and they must differ
        if ($this->direction_source === 'internal_wallet') {
            if (! $this->from_wallet_id || ! $this->to_wallet_id) {
                throw new \InvalidArgumentException('Internal transfers require both from_wallet_id and to_wallet_id');
            }

            if ($this->from_wallet_id === $this->to_wallet_id) {
                throw new \InvalidArgumentException('Internal transfers require different from and to wallets');
            }
        }

        // Rule: External transfers can have one side null but should have invoice_id
        if (in_array($this->direction_source, ['external_gateway', 'external_pos', 'external_cash'])) {
            if (! $this->invoice_id) {
                throw new \InvalidArgumentException('External transfers should reference an invoice_id');
            }
        }

        // Rule: Transactions should be invoice-driven
        if (! $this->invoice_id && $this->type !== 'adjustment') {
            \Log::warning('Transaction created without invoice_id', [
                'transaction_id' => $this->id,
                'type' => $this->type,
            ]);
        }
    }

    /**
     * Scope for refund transactions
     */
    public function scopeRefunds($query)
    {
        return $query->where('type', 'refund');
    }

    /**
     * Check if this transaction is a refund
     */
    public function isRefund(): bool
    {
        return $this->type === 'refund';
    }
}
