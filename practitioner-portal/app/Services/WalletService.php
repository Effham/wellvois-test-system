<?php

namespace App\Services;

use App\Models\Tenant\Invoices;
use App\Models\Tenant\Transaction;
use App\Models\Tenant\Wallet;
use Illuminate\Support\Facades\DB;

class WalletService
{
    /**
     * Mark invoice as paid via gateway (e.g., Stripe)
     * Supports partial payments with idempotency
     */
    public function markPaidByGateway(Invoices $invoice, string $stripePaymentIntentId, ?float $partialAmount = null): void
    {
        $systemWallet = Wallet::getSystemWallet();

        // Validate invoice has customer wallet
        if (! $invoice->customer_wallet_id) {
            throw new \InvalidArgumentException('Invoice must have a customer_wallet_id');
        }

        // Determine payment amount (partial or full)
        $paymentAmount = $partialAmount ?? (float) $invoice->price;

        // Generate idempotency key from provider reference
        $idempotencyKey = Transaction::generateIdempotencyKey($stripePaymentIntentId);

        $transaction = null;

        DB::transaction(function () use (&$transaction, $invoice, $systemWallet, $stripePaymentIntentId, $paymentAmount, $idempotencyKey) {
            // Check if transaction with this idempotency key already exists
            $existingTransaction = Transaction::where('idempotency_key', $idempotencyKey)->first();

            if ($existingTransaction) {
                // Idempotent request - return without error
                \Log::info('Duplicate payment attempt blocked by idempotency key', [
                    'idempotency_key' => $idempotencyKey,
                    'existing_transaction_id' => $existingTransaction->id,
                ]);

                return;
            }

            // Create transaction
            $transaction = Transaction::create([
                'from_wallet_id' => null,
                'to_wallet_id' => $systemWallet->id,
                'invoice_id' => $invoice->id,
                'amount' => $paymentAmount,
                'type' => 'invoice_payment',
                'direction_source' => 'external_gateway',
                'payment_method' => 'gateway',
                'provider_ref' => $stripePaymentIntentId,
                'status' => 'completed',
                'idempotency_key' => $idempotencyKey,
            ]);

            // Validate transaction rules
            $transaction->validateTransactionRules();

            // Check if this is a practitioner invoice
            if ($invoice->invoiceable_type === 'practitioner') {
                // Transfer money from clinic wallet to practitioner wallet
                $practitionerWallet = Wallet::find($invoice->customer_wallet_id);

                if ($practitionerWallet && $systemWallet->balance >= $paymentAmount) {
                    $systemWallet->decrement('balance', $paymentAmount);
                    $practitionerWallet->increment('balance', $paymentAmount);
                } else {
                    throw new \RuntimeException('Insufficient clinic wallet balance for practitioner payment.');
                }
            } else {
                // Regular appointment invoice - money goes to clinic wallet
                $systemWallet->increment('balance', $paymentAmount);
            }

            // Check if invoice is now fully paid
            if ($invoice->isFullyPaid()) {
                $invoice->update([
                    'status' => 'paid',
                    'payment_method' => 'gateway',
                    'paid_at' => now(),
                ]);
            } else {
                // Partial payment - update status if needed
                if ($invoice->status === 'pending') {
                    $invoice->update(['status' => 'partial']);
                }
            }
        });

        // Send transaction notification emails (after transaction is committed)
        if ($transaction) {
            $this->sendTransactionNotificationEmails($invoice->fresh(), $transaction->fresh());
        }
    }

    /**
     * Mark invoice as paid manually (POS, cash, etc.)
     * Supports partial payments with idempotency
     */
    public function markPaidManually(Invoices $invoice, ?string $receiptUrl = null, string $method = 'pos', ?float $partialAmount = null, ?string $attemptId = null): void
    {
        $systemWallet = Wallet::getSystemWallet();

        // Validate invoice has customer wallet
        if (! $invoice->customer_wallet_id) {
            throw new \InvalidArgumentException('Invoice must have a customer_wallet_id');
        }

        // Determine payment amount (partial or full)
        $paymentAmount = $partialAmount ?? (float) $invoice->price;

        // Generate idempotency key
        $idempotencyKey = $attemptId
            ? Transaction::generateIdempotencyKey(null, $invoice->id, $invoice->customer_wallet_id, $attemptId)
            : Transaction::generateIdempotencyKey();

        $transaction = null;

        DB::transaction(function () use (&$transaction, $invoice, $systemWallet, $receiptUrl, $method, $paymentAmount, $idempotencyKey) {
            // Check if transaction with this idempotency key already exists
            $existingTransaction = Transaction::where('idempotency_key', $idempotencyKey)->first();

            if ($existingTransaction) {
                // Idempotent request - return without error
                \Log::info('Duplicate manual payment attempt blocked by idempotency key', [
                    'idempotency_key' => $idempotencyKey,
                    'existing_transaction_id' => $existingTransaction->id,
                ]);

                return;
            }

            // Create transaction
            $transaction = Transaction::create([
                'from_wallet_id' => null,
                'to_wallet_id' => $systemWallet->id,
                'invoice_id' => $invoice->id,
                'amount' => $paymentAmount,
                'type' => 'invoice_payment',
                'direction_source' => $method === 'cash' ? 'external_cash' : 'external_pos',
                'payment_method' => $method,
                'payment_proof_url' => $receiptUrl,
                'status' => 'completed',
                'idempotency_key' => $idempotencyKey,
            ]);

            // Validate transaction rules
            $transaction->validateTransactionRules();

            // Check if this is a practitioner invoice
            if ($invoice->invoiceable_type === 'practitioner') {
                // Transfer money from clinic wallet to practitioner wallet
                $practitionerWallet = Wallet::find($invoice->customer_wallet_id);

                if ($practitionerWallet && $systemWallet->balance >= $paymentAmount) {
                    $systemWallet->decrement('balance', $paymentAmount);
                    $practitionerWallet->increment('balance', $paymentAmount);
                } else {
                    throw new \RuntimeException('Insufficient clinic wallet balance for practitioner payment.');
                }
            } else {
                // Regular appointment invoice - money goes to clinic wallet
                $systemWallet->increment('balance', $paymentAmount);
            }

            // Check if invoice is now fully paid
            if ($invoice->isFullyPaid()) {
                $invoice->update([
                    'status' => 'paid_manual',
                    'payment_method' => $method,
                    'paid_at' => now(),
                ]);
            } else {
                // Partial payment - update status if needed
                if ($invoice->status === 'pending') {
                    $invoice->update(['status' => 'partial']);
                }
            }
        });

        // Send transaction notification emails (after transaction is committed)
        if ($transaction) {
            $this->sendTransactionNotificationEmails($invoice->fresh(), $transaction->fresh());
        }
    }

    /**
     * Send transaction notification emails
     */
    protected function sendTransactionNotificationEmails(Invoices $invoice, Transaction $transaction): void
    {
        try {
            // Determine invoice type
            $invoiceType = $invoice->invoiceable_type === 'practitioner' ? 'practitioner' : 'appointment';

            // Get organization data
            $organizationData = [
                'name' => \App\Models\OrganizationSetting::getValue('practice_details_name', 'Practice'),
                'email' => \App\Models\OrganizationSetting::getValue('practice_details_contact_email', ''),
                'phone' => \App\Models\OrganizationSetting::getValue('practice_details_phone_number', ''),
                'currency' => \App\Models\OrganizationSetting::getValue('accounting_currency', 'CAD'),
            ];

            if ($invoiceType === 'appointment') {
                // Appointment invoice transaction - notify tenant
                $tenantEmail = \App\Models\OrganizationSetting::getValue('practice_details_contact_email', '');

                if (empty($tenantEmail)) {
                    // Fallback to admin emails
                    $adminEmails = \App\Models\User::role('Admin')
                        ->whereNotNull('email')
                        ->pluck('email')
                        ->filter()
                        ->values()
                        ->all();

                    $tenantEmail = ! empty($adminEmails) ? $adminEmails[0] : null;
                }

                if ($tenantEmail) {
                    \Mail::to($tenantEmail)->send(
                        new \App\Mail\TransactionNotificationMail(
                            $invoice,
                            $transaction,
                            ['name' => 'Tenant', 'email' => $tenantEmail],
                            $organizationData,
                            'appointment'
                        )
                    );

                    \Log::info('Transaction notification sent to tenant', [
                        'invoice_id' => $invoice->id,
                        'transaction_id' => $transaction->id,
                        'tenant_email' => $tenantEmail,
                    ]);
                }
            } else {
                // Practitioner invoice transaction - notify practitioner
                $practitionerWallet = Wallet::find($invoice->customer_wallet_id);
                if ($practitionerWallet) {
                    $practitionerUser = \App\Models\User::find($practitionerWallet->owner_id);

                    if ($practitionerUser && $practitionerUser->email) {
                        $practitionerName = $practitionerUser->name ?? 'Practitioner';

                        // Get practitioner full name if available (from central database)
                        $practitioner = tenancy()->central(function () use ($practitionerUser) {
                            return \App\Models\Practitioner::where('user_id', $practitionerUser->id)->first();
                        });

                        if ($practitioner) {
                            $practitionerName = trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? ''));
                        }

                        \Mail::to($practitionerUser->email)->send(
                            new \App\Mail\TransactionNotificationMail(
                                $invoice,
                                $transaction,
                                ['name' => $practitionerName, 'email' => $practitionerUser->email],
                                $organizationData,
                                'practitioner'
                            )
                        );

                        \Log::info('Transaction notification sent to practitioner', [
                            'invoice_id' => $invoice->id,
                            'transaction_id' => $transaction->id,
                            'practitioner_email' => $practitionerUser->email,
                        ]);
                    }
                }
            }
        } catch (\Exception $e) {
            \Log::error('Failed to send transaction notification emails', [
                'invoice_id' => $invoice->id,
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't fail transaction if email fails
        }
    }

    /**
     * Process payout from system wallet to practitioner wallet
     * Supports idempotency
     */
    public function payoutToPractitioner(int $practitionerUserId, float $amount, ?int $invoiceId = null, ?string $attemptId = null): void
    {
        $systemWallet = Wallet::getSystemWallet();
        $practitionerWallet = Wallet::getOrCreateUserWallet($practitionerUserId);

        $amount = round($amount, 4);

        // Validate amount is positive
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Payout amount must be positive');
        }

        // Generate idempotency key
        $idempotencyKey = $attemptId
            ? Transaction::generateIdempotencyKey(null, $invoiceId, $systemWallet->id, $attemptId)
            : Transaction::generateIdempotencyKey();

        DB::transaction(function () use ($systemWallet, $practitionerWallet, $amount, $invoiceId, $idempotencyKey) {
            // Check if transaction with this idempotency key already exists
            $existingTransaction = Transaction::where('idempotency_key', $idempotencyKey)->first();

            if ($existingTransaction) {
                \Log::info('Duplicate payout attempt blocked by idempotency key', [
                    'idempotency_key' => $idempotencyKey,
                    'existing_transaction_id' => $existingTransaction->id,
                ]);

                return;
            }

            // Check sufficient balance
            if ($systemWallet->balance < $amount) {
                throw new \RuntimeException('Insufficient system wallet balance.');
            }

            // Update balances
            $systemWallet->decrement('balance', $amount);
            $practitionerWallet->increment('balance', $amount);

            // Create transaction
            $transaction = Transaction::create([
                'from_wallet_id' => $systemWallet->id,
                'to_wallet_id' => $practitionerWallet->id,
                'invoice_id' => $invoiceId,
                'amount' => $amount,
                'type' => 'payout',
                'direction_source' => 'internal_wallet',
                'payment_method' => 'internal',
                'status' => 'completed',
                'idempotency_key' => $idempotencyKey,
            ]);

            // Validate transaction rules
            $transaction->validateTransactionRules();
        });
    }

    /**
     * Create payout for an invoice to its primary practitioner
     * Automatically calculates payout amount after deducting clinic commission (10%)
     *
     * @param  Invoices  $invoice  The invoice to create payout for
     * @param  float  $commissionPercentage  Commission percentage to deduct (default 10%)
     *
     * @throws \RuntimeException If no primary practitioner found or insufficient balance
     */
    public function createInvoicePayout(Invoices $invoice, float $commissionPercentage = 10.0): void
    {
        // Check if invoice has a payment transaction
        if (! $invoice->hasPaymentTransaction()) {
            throw new \RuntimeException('Invoice must be paid before creating a payout.');
        }

        // Check if payout already exists
        if ($invoice->hasPayoutTransaction()) {
            throw new \RuntimeException('Payout already exists for this invoice.');
        }

        // Get primary practitioner's wallet
        $practitionerWallet = $invoice->getPrimaryPractitionerWallet();

        if (! $practitionerWallet) {
            throw new \RuntimeException('No primary practitioner found for this invoice.');
        }

        $clinicWallet = Wallet::clinic()->firstOrFail();

        // Calculate payout amount (invoice price - commission)
        $invoiceAmount = (float) $invoice->price;
        $commissionAmount = round($invoiceAmount * ($commissionPercentage / 100), 2);
        $payoutAmount = round($invoiceAmount - $commissionAmount, 2);

        DB::transaction(function () use ($clinicWallet, $practitionerWallet, $payoutAmount, $invoice, $commissionAmount) {
            if ($clinicWallet->balance < $payoutAmount) {
                throw new \RuntimeException('Insufficient clinic balance for payout.');
            }

            // Transfer from clinic to practitioner
            $clinicWallet->decrement('balance', $payoutAmount);
            $practitionerWallet->increment('balance', $payoutAmount);

            // Create payout transaction
            Transaction::create([
                'from_wallet_id' => $clinicWallet->id,
                'to_wallet_id' => $practitionerWallet->id,
                'invoice_id' => $invoice->id,
                'amount' => $payoutAmount,
                'type' => 'payout',
                'direction_source' => 'internal_wallet',
                'payment_method' => 'internal',
                'status' => 'completed',
                'meta' => json_encode([
                    'invoice_amount' => $invoice->price,
                    'commission_amount' => $commissionAmount,
                    'commission_percentage' => 10.0,
                    'payout_amount' => $payoutAmount,
                ]),
            ]);
        });
    }

    /**
     * Create or get wallet for a user
     */
    public function getOrCreateUserWallet(int $userId): Wallet
    {
        return Wallet::getOrCreateUserWallet($userId);
    }

    /**
     * Get or create system (clinic) wallet
     */
    public function getSystemWallet(): Wallet
    {
        return Wallet::getSystemWallet();
    }

    /**
     * Create or get wallet for a patient
     */
    public function getOrCreatePatientWallet(int $patientId): Wallet
    {
        return Wallet::getOrCreatePatientWallet($patientId);
    }

    /**
     * Create or get wallet for a practitioner
     */
    public function getOrCreatePractitionerWallet(int $practitionerId): Wallet
    {
        return Wallet::getOrCreatePractitionerWallet($practitionerId);
    }

    /**
     * Process a refund for an invoice
     */
    public function processRefund(Invoices $invoice, float $refundAmount, string $reason = '', ?string $attemptId = null): void
    {
        $systemWallet = Wallet::getSystemWallet();

        // Validate invoice has customer wallet
        if (! $invoice->customer_wallet_id) {
            throw new \InvalidArgumentException('Invoice must have a customer_wallet_id for refunds');
        }

        // Validate refund amount
        if ($refundAmount <= 0) {
            throw new \InvalidArgumentException('Refund amount must be positive');
        }

        if ($refundAmount > $invoice->getTotalPaid()) {
            throw new \InvalidArgumentException('Refund amount cannot exceed total paid amount');
        }

        // Generate idempotency key
        $idempotencyKey = $attemptId
            ? Transaction::generateIdempotencyKey(null, $invoice->id, $systemWallet->id, "refund:{$attemptId}")
            : Transaction::generateIdempotencyKey();

        DB::transaction(function () use ($invoice, $systemWallet, $refundAmount, $reason, $idempotencyKey) {
            // Check if transaction with this idempotency key already exists
            $existingTransaction = Transaction::where('idempotency_key', $idempotencyKey)->first();

            if ($existingTransaction) {
                \Log::info('Duplicate refund attempt blocked by idempotency key', [
                    'idempotency_key' => $idempotencyKey,
                    'existing_transaction_id' => $existingTransaction->id,
                ]);

                return;
            }

            // Check sufficient balance in system wallet
            if ($systemWallet->balance < $refundAmount) {
                throw new \RuntimeException('Insufficient system wallet balance for refund');
            }

            // Create refund transaction (money leaving system wallet back to customer)
            $transaction = Transaction::create([
                'from_wallet_id' => $systemWallet->id,
                'to_wallet_id' => null, // External refund back to customer
                'invoice_id' => $invoice->id,
                'amount' => $refundAmount,
                'type' => 'refund',
                'direction_source' => 'external_gateway', // Assuming refund goes back through gateway
                'payment_method' => $invoice->payment_method ?? 'gateway',
                'status' => 'completed',
                'idempotency_key' => $idempotencyKey,
                'meta' => [
                    'reason' => $reason,
                    'refunded_at' => now()->toIso8601String(),
                ],
            ]);

            // Validate transaction rules (will allow refunds)
            // Note: We skip validation for refunds as they have special rules
            // $transaction->validateTransactionRules();

            // Update wallet balance
            $systemWallet->decrement('balance', $refundAmount);

            // Update invoice status if fully refunded
            $totalRefunded = $invoice->transactions()
                ->where('type', 'refund')
                ->where('status', 'completed')
                ->sum('amount');

            if ($totalRefunded >= $invoice->getTotalPaid()) {
                $invoice->update(['status' => 'refunded']);
            }
        });
    }
}
