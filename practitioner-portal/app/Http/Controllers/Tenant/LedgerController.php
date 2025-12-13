<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Transaction;
use App\Models\Tenant\Wallet;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LedgerController extends Controller
{
    /**
     * Display the double-entry ledger view
     */
    public function index(Request $request)
    {
        $query = Transaction::query()
            ->with(['fromWallet', 'toWallet', 'invoice'])
            ->latest('created_at');

        // Filters
        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($walletId = $request->input('wallet_id')) {
            $query->where(function ($q) use ($walletId) {
                $q->where('from_wallet_id', $walletId)
                    ->orWhere('to_wallet_id', $walletId);
            });
        }

        if ($dateFrom = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $perPage = (int) $request->input('perPage', 50);

        // Get transactions
        $transactions = $query->paginate($perPage)->through(function ($transaction) {
            return [
                'id' => $transaction->id,
                'invoice_id' => $transaction->invoice_id,
                'amount' => (string) $transaction->amount,
                'type' => $transaction->type,
                'direction_source' => $transaction->direction_source,
                'payment_method' => $transaction->payment_method,
                'provider_ref' => $transaction->provider_ref,
                'status' => $transaction->status,
                'from_wallet' => $transaction->fromWallet ? [
                    'id' => $transaction->fromWallet->id,
                    'type' => $transaction->fromWallet->type,
                    'user_id' => $transaction->fromWallet->user_id,
                ] : null,
                'to_wallet' => $transaction->toWallet ? [
                    'id' => $transaction->toWallet->id,
                    'type' => $transaction->toWallet->type,
                    'user_id' => $transaction->toWallet->user_id,
                ] : null,
                'created_at' => $transaction->created_at->toISOString(),
            ];
        })->withQueryString();

        // Get wallet balances
        $clinicWallet = Wallet::clinic()->first();
        $wallets = Wallet::with('user')->get()->map(function ($wallet) {
            return [
                'id' => $wallet->id,
                'type' => $wallet->type,
                'balance' => (string) $wallet->balance,
                'user_id' => $wallet->user_id,
                'user_name' => $wallet->user ? $wallet->user->name : null,
            ];
        });

        // Calculate summary statistics
        $totalIncoming = Transaction::where('to_wallet_id', $clinicWallet?->id)
            ->where('status', 'completed')
            ->sum('amount');

        $totalOutgoing = Transaction::where('from_wallet_id', $clinicWallet?->id)
            ->where('status', 'completed')
            ->sum('amount');

        $totalCommission = Transaction::where('type', 'payout')
            ->where('status', 'completed')
            ->get()
            ->sum(function ($transaction) {
                // Commission is the difference between invoice and payout
                if ($transaction->invoice_id) {
                    $invoice = $transaction->invoice;
                    if ($invoice) {
                        return (float) $invoice->price - (float) $transaction->amount;
                    }
                }

                return 0;
            });

        // Get all available wallets for filter
        $allWallets = Wallet::with('user')->get()->map(function ($wallet) {
            return [
                'id' => $wallet->id,
                'label' => $wallet->type === 'clinic'
                    ? 'Clinic Wallet'
                    : ($wallet->user ? $wallet->user->name : "User Wallet #{$wallet->id}"),
            ];
        });

        return Inertia::render('Ledger/Index', [
            'transactions' => $transactions,
            'wallets' => $wallets,
            'allWallets' => $allWallets,
            'filters' => [
                'type' => $request->input('type', ''),
                'status' => $request->input('status', ''),
                'wallet_id' => $request->input('wallet_id', ''),
                'date_from' => $request->input('date_from', ''),
                'date_to' => $request->input('date_to', ''),
                'perPage' => $perPage,
            ],
            'summary' => [
                'clinic_balance' => $clinicWallet ? (string) $clinicWallet->balance : '0.00',
                'total_incoming' => (string) $totalIncoming,
                'total_outgoing' => (string) $totalOutgoing,
                'total_commission' => (string) number_format($totalCommission, 2, '.', ''),
                'net_position' => (string) ($totalIncoming - $totalOutgoing),
            ],
            'transactionTypes' => [
                ['label' => 'Invoice Payment', 'value' => 'invoice_payment'],
                ['label' => 'Payout', 'value' => 'payout'],
                ['label' => 'Refund', 'value' => 'refund'],
                ['label' => 'Adjustment', 'value' => 'adjustment'],
            ],
        ]);
    }
}
