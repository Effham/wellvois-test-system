<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invoices extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_number',
        'invoiceable_id',
        'invoiceable_type',
        'reference_type',
        'reference_id',
        'customer_wallet_id',
        'price',
        'subtotal',
        'tax_total',
        'due_date',
        'payment_method',
        'paid_at',
        'meta',
        'status',
    ];

    /**
     * Cast attributes for better handling
     */
    protected $casts = [
        'price' => 'decimal:4', // keeps 4 decimal places precision
        'subtotal' => 'decimal:4',
        'tax_total' => 'decimal:4',
        'due_date' => 'date',
        'paid_at' => 'datetime',
        'meta' => 'array',
    ];

    /**
     * Boot the model and auto-generate invoice number
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($invoice) {
            if (empty($invoice->invoice_number)) {
                $invoice->invoice_number = static::generateInvoiceNumber();
            }
        });
    }

    /**
     * Generate unique invoice number using prefix from settings
     */
    public static function generateInvoiceNumber(): string
    {
        // Get invoice prefix from settings (default to 'INV')
        $prefix = \App\Models\OrganizationSetting::getValue('accounting_invoice_prefix', 'INV');

        // Get the last invoice number for this tenant
        $lastInvoice = static::orderBy('id', 'desc')->first();

        if ($lastInvoice && $lastInvoice->invoice_number) {
            // Extract the number part from the last invoice number
            // Format expected: PREFIX-001, PREFIX-002, etc.
            $parts = explode('-', $lastInvoice->invoice_number);
            $lastNumber = (int) end($parts);
            $nextNumber = $lastNumber + 1;
        } else {
            // First invoice
            $nextNumber = 1;
        }

        // Format: PREFIX-001, PREFIX-002, etc. (3 digits, zero-padded)
        return $prefix.'-'.str_pad($nextNumber, 3, '0', STR_PAD_LEFT);
    }

    /**
     * NOTE: invoiceable_type and invoiceable_id are now simple string labels
     * and IDs for categorization, NOT polymorphic relationships.
     *
     * Examples:
     * - 'system' with id 0 = system-generated invoice
     * - 'appointment' with id = appointment ID (reference only, not relationship)
     * - 'order' with id = order ID (reference only, not relationship)
     */

    /**
     * Get the customer's wallet for this invoice
     */
    public function customerWallet()
    {
        return $this->belongsTo(Wallet::class, 'customer_wallet_id');
    }

    /**
     * Get all transactions for this invoice
     */
    public function transactions()
    {
        return $this->hasMany(Transaction::class, 'invoice_id');
    }

    /**
     * Get the primary practitioner's wallet for this invoice
     * This method traverses: Invoice -> Appointment -> AppointmentPractitioner (is_primary=true) -> Practitioner -> User (in tenant) -> Wallet
     */
    public function getPrimaryPractitionerWallet(): ?Wallet
    {
        // Only works if invoiceable is an Appointment
        if ($this->invoiceable_type !== 'App\\Models\\Tenant\\Appointment') {
            return null;
        }

        $appointment = $this->invoiceable;
        if (! $appointment) {
            return null;
        }

        // Get the primary practitioner from appointment_practitioner table
        $primaryPractitioner = \DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->where('is_primary', true)
            ->first();

        if (! $primaryPractitioner) {
            return null;
        }

        // Get practitioner email from central database
        $practitionerEmail = tenancy()->central(function () use ($primaryPractitioner) {
            $practitioner = \App\Models\Practitioner::find($primaryPractitioner->practitioner_id);

            return $practitioner?->email;
        });

        if (! $practitionerEmail) {
            return null;
        }

        // Find user in current tenant with that email
        $user = \App\Models\User::where('email', $practitionerEmail)->first();

        if (! $user) {
            return null;
        }

        // Get or create the user's wallet
        return Wallet::firstOrCreate(
            ['user_id' => $user->id, 'type' => 'user'],
            ['balance' => 0.00]
        );
    }

    /**
     * Check if this invoice has a payment transaction (money coming into clinic)
     */
    public function hasPaymentTransaction(): bool
    {
        return $this->transactions()
            ->where('type', 'invoice_payment')
            ->where('status', 'completed')
            ->exists();
    }

    /**
     * Check if this invoice has a payout transaction (money going to practitioner)
     */
    public function hasPayoutTransaction(): bool
    {
        return $this->transactions()
            ->where('type', 'payout')
            ->exists();
    }

    /**
     * Get the payment transaction for this invoice
     */
    public function getPaymentTransaction(): ?Transaction
    {
        return $this->transactions()
            ->where('type', 'invoice_payment')
            ->first();
    }

    /**
     * Get the payout transaction for this invoice
     */
    public function getPayoutTransaction(): ?Transaction
    {
        return $this->transactions()
            ->where('type', 'payout')
            ->first();
    }

    /**
     * Validate that price = subtotal + tax_total
     */
    public function validateTotals(): bool
    {
        if ($this->subtotal === null && $this->tax_total === null) {
            return true; // Optional fields, so if both are null, no validation needed
        }

        if ($this->subtotal !== null && $this->tax_total !== null) {
            $expectedPrice = bcadd((string) $this->subtotal, (string) $this->tax_total, 4);

            return bccomp((string) $this->price, $expectedPrice, 4) === 0;
        }

        return false; // One is set but not the other
    }

    /**
     * Calculate and set subtotal and tax_total from meta lines
     */
    public function calculateTotalsFromLines(): void
    {
        if (! isset($this->meta['lines']) || ! is_array($this->meta['lines'])) {
            return;
        }

        $subtotal = 0;
        $taxTotal = 0;

        foreach ($this->meta['lines'] as $line) {
            $qty = $line['qty'] ?? 1;
            $unitPrice = $line['unit_price'] ?? 0;
            $taxRate = $line['tax_rate'] ?? 0;

            $lineSubtotal = $qty * $unitPrice;
            $lineTax = $lineSubtotal * ($taxRate / 100);

            $subtotal += $lineSubtotal;
            $taxTotal += $lineTax;
        }

        $this->subtotal = round($subtotal, 4);
        $this->tax_total = round($taxTotal, 4);
        $this->price = round($subtotal + $taxTotal, 4);
    }

    /**
     * Get the total amount paid for this invoice (sum of completed payment transactions)
     */
    public function getTotalPaid(): float
    {
        return (float) $this->transactions()
            ->where('type', 'invoice_payment')
            ->where('status', 'completed')
            ->sum('amount');
    }

    /**
     * Get the remaining balance to be paid
     */
    public function getRemainingBalance(): float
    {
        return max(0, (float) $this->price - $this->getTotalPaid());
    }

    /**
     * Check if invoice is fully paid
     */
    public function isFullyPaid(): bool
    {
        return $this->getRemainingBalance() <= 0.01; // Allow for small rounding differences
    }

    /**
     * Check if invoice is partially paid
     */
    public function isPartiallyPaid(): bool
    {
        $totalPaid = $this->getTotalPaid();

        return $totalPaid > 0 && $totalPaid < (float) $this->price;
    }
}
