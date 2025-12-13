<?php

namespace App\Services;

use App\Models\Tenant\Appointment;
use App\Models\Tenant\Transaction;
use App\Models\Tenant\Wallet;
use Illuminate\Support\Facades\DB;

class WalletTransactionService
{
    /**
     * Process appointment completion and create practitioner transaction
     * Only creates transaction for the primary practitioner
     */
    public function processAppointmentCompletion(Appointment $appointment): array
    {
        $transactions = [];

        // Get only the primary practitioner for this appointment
        $primaryPractitioner = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->where('is_primary', true)
            ->first();

        if (! $primaryPractitioner) {
            \Log::warning('No primary practitioner found for appointment', [
                'appointment_id' => $appointment->id,
                'service_id' => $appointment->service_id,
            ]);

            return $transactions;
        }

        $practitionerId = $primaryPractitioner->practitioner_id;

        // Get practitioner's price for this service
        $price = $this->getPractitionerServicePrice($practitionerId, $appointment->service_id);

        // Find practitioner's wallet (need to get user from central DB)
        $wallet = $this->getPractitionerWallet($practitionerId);

        if ($wallet && $price > 0) {
            // NOTE: This service needs to be updated to work with the new wallet architecture
            // The old addCredit method is deprecated. Should use WalletService instead.
            // For now, logging a warning that this code path needs updating.
            \Log::warning('WalletTransactionService needs updating for new architecture', [
                'appointment_id' => $appointment->id,
                'practitioner_id' => $practitionerId,
                'price' => $price,
                'message' => 'This method uses deprecated wallet transaction structure',
            ]);

            // TODO: Update this to use the new WalletService and invoice-based transactions
        } else {
            \Log::warning('Could not create transaction for primary practitioner', [
                'appointment_id' => $appointment->id,
                'practitioner_id' => $practitionerId,
                'has_wallet' => $wallet !== null,
                'price' => $price,
            ]);
        }

        return $transactions;
    }

    /**
     * Get practitioner's price for a service
     * Check custom_price first, then fallback to service default_price
     */
    protected function getPractitionerServicePrice(int $practitionerId, int $serviceId): float
    {
        // First check if practitioner has custom price for this service
        $practitionerService = DB::table('practitioner_services')
            ->where('practitioner_id', $practitionerId)
            ->where('service_id', $serviceId)
            ->where('is_offered', true)
            ->first();

        if ($practitionerService && $practitionerService->custom_price !== null) {
            return (float) $practitionerService->custom_price;
        }

        // Fallback to service default price
        $service = DB::table('services')->where('id', $serviceId)->first();

        return $service ? (float) $service->default_price : 0.00;
    }

    /**
     * Get practitioner's wallet
     * Need to find the user associated with practitioner from central DB
     */
    protected function getPractitionerWallet(int $practitionerId): ?Wallet
    {
        // Get practitioner's user_id from central database
        $centralUserId = null;

        tenancy()->central(function () use (&$centralUserId, $practitionerId) {
            $practitioner = \App\Models\Practitioner::find($practitionerId);
            if ($practitioner) {
                $centralUserId = $practitioner->user_id;
            }
        });

        if (! $centralUserId) {
            return null;
        }

        // Find the corresponding user in tenant database by email
        $centralUserEmail = null;
        tenancy()->central(function () use (&$centralUserEmail, $centralUserId) {
            $user = \App\Models\User::find($centralUserId);
            if ($user) {
                $centralUserEmail = $user->email;
            }
        });

        if (! $centralUserEmail) {
            return null;
        }

        // Find tenant user and their wallet
        $tenantUser = \App\Models\User::where('email', $centralUserEmail)->first();

        return $tenantUser ? Wallet::getOrCreateUserWallet($tenantUser->id) : null;
    }

    /**
     * Recalculate wallet balance based on transactions
     */
    public function recalculateWalletBalance(Wallet $wallet): void
    {
        $wallet->recalculateBalance();
    }

    /**
     * Get wallet transaction history
     */
    public function getWalletTransactionHistory(Wallet $wallet, int $limit = 50): \Illuminate\Pagination\LengthAwarePaginator
    {
        return Transaction::query()
            ->where(function ($query) use ($wallet) {
                $query->where('from_wallet_id', $wallet->id)
                    ->orWhere('to_wallet_id', $wallet->id);
            })
            ->with(['fromWallet', 'toWallet', 'invoice'])
            ->orderBy('created_at', 'desc')
            ->paginate($limit);
    }

    /**
     * Get practitioner's total earnings
     */
    public function getPractitionerTotalEarnings(int $practitionerId): float
    {
        $wallet = $this->getPractitionerWallet($practitionerId);

        return $wallet ? $wallet->getCurrentBalance() : 0.00;
    }

    /**
     * Get practitioner's earnings for a specific period
     */
    public function getPractitionerEarningsForPeriod(int $practitionerId, \Carbon\Carbon $startDate, \Carbon\Carbon $endDate): float
    {
        $wallet = $this->getPractitionerWallet($practitionerId);

        if (! $wallet) {
            return 0.00;
        }

        return Transaction::query()
            ->where('to_wallet_id', $wallet->id)
            ->where('type', 'invoice_payment')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->sum('amount');
    }
}
