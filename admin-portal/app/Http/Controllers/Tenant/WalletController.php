<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Wallet;
use App\Models\User;
use App\Services\WalletTransactionService;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    protected WalletTransactionService $walletService;

    public function __construct(WalletTransactionService $walletService)
    {
        $this->walletService = $walletService;
    }

    /**
     * Display a listing of wallets
     */
    public function index()
    {
        $wallets = Wallet::select('id', 'user_id', 'balance', 'currency')
            ->with('user:id,name,email')
            ->paginate(20);

        return response()->json($wallets);
    }

    /**
     * Display the specified wallet
     */
    public function show(Wallet $wallet)
    {
        $wallet->load('user');
        $transactions = $this->walletService->getWalletTransactionHistory($wallet, 10);

        return response()->json([
            'wallet' => $wallet,
            'transactions' => $transactions,
        ]);
    }

    /**
     * Display wallet by user ID
     */
    public function showByUser(User $user)
    {
        $wallet = $user->wallet;

        if (! $wallet) {
            return response()->json(['error' => 'Wallet not found for this user'], 404);
        }

        $transactions = $this->walletService->getWalletTransactionHistory($wallet, 10);

        return response()->json([
            'wallet' => $wallet,
            'transactions' => $transactions,
        ]);
    }

    /**
     * Get practitioner earnings
     */
    public function practitionerEarnings(Request $request, int $practitionerId)
    {
        $totalEarnings = $this->walletService->getPractitionerTotalEarnings($practitionerId);

        $response = [
            'practitioner_id' => $practitionerId,
            'total_earnings' => $totalEarnings,
        ];

        // If date range is provided, get earnings for period
        if ($request->has('start_date') && $request->has('end_date')) {
            $startDate = \Carbon\Carbon::parse($request->start_date);
            $endDate = \Carbon\Carbon::parse($request->end_date);

            $periodEarnings = $this->walletService->getPractitionerEarningsForPeriod(
                $practitionerId,
                $startDate,
                $endDate
            );

            $response['period_earnings'] = $periodEarnings;
            $response['period'] = [
                'start' => $startDate->toDateString(),
                'end' => $endDate->toDateString(),
            ];
        }

        return response()->json($response);
    }

    /**
     * Recalculate wallet balance
     */
    public function recalculateBalance(Wallet $wallet)
    {
        $this->walletService->recalculateWalletBalance($wallet);

        return response()->json([
            'message' => 'Wallet balance recalculated successfully',
            'wallet' => $wallet->fresh(),
        ]);
    }
}
